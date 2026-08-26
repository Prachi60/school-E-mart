const { NotFoundError, ForbiddenError, BadRequestError } = require('../../../common/errors');
const { roles } = require('../../../constants');
const attendanceRepository = require('../repositories/attendance.repository');
const studentRepository = require('../repositories/student.repository');
const { assertTeacherClassAccess } = require('../policies/schoolAccess.policy');
const { classGradeQuery } = require('../utils/classGrade');

const { ROLES } = roles;

// Attendance is keyed by calendar day, so every record is pinned to UTC midnight.
// Callers may send a bare "2026-07-17" or a full timestamp; both collapse to the
// same instant here, which is what the unique index relies on.
const normalizeDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError('A valid attendance date is required', null, 'INVALID_ATTENDANCE_DATE');
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const findActiveStudentIds = async (schoolId, { classGrade, section } = {}) => {
  const filter = { schoolId, status: 'active' };
  if (classGrade) filter.classGrade = classGradeQuery(classGrade);
  if (section) filter.section = section;
  const students = await studentRepository.findMany(filter);
  return students.map((student) => student._id);
};

// A parent may only ever see their own children. Resolves the student ids they own
// within the current school; an empty list means they see nothing.
//
// Both link types count. Reading only ParentProfile -> Student.parentProfileIds left
// every parent linked through ChildProfile with an empty attendance page — and, when
// they had no ParentProfile row at all, a 403 for the whole screen — while the push
// notification about the very record they were looking for reached them, because
// notifications resolve both. Having no children here is an ordinary answer, so it
// scopes the query to nothing rather than failing the request.
const resolveParentStudentIds = (req) =>
  studentRepository.findChildStudentIdsForParent(req.schoolId, req.auth.userId);

// Teachers read only the classes they are assigned to. Without a class filter the
// query would span the whole school, so require one rather than silently widening.
const assertTeacherReadScope = async (req, { classGrade, section }) => {
  if (req.auth.role !== ROLES.TEACHER) return;
  if (!classGrade) {
    throw new ForbiddenError(
      'A class is required for this request',
      'CLASS_FILTER_REQUIRED'
    );
  }
  await assertTeacherClassAccess(req, { classGrade, section });
};

const attendanceService = {
  async markAttendance(req, { date, classGrade, section, records }) {
    await assertTeacherClassAccess(req, { classGrade, section });

    const schoolId = req.schoolId;
    const attendanceDate = normalizeDate(date);

    // Resolve the whole roster in one query rather than one per record, and only
    // accept students actually enrolled in the class being marked.
    const students = await studentRepository.findMany({
      schoolId,
      classGrade: classGradeQuery(classGrade),
      section,
      status: 'active',
      _id: { $in: records.map((record) => record.studentId) },
    });

    const studentsById = new Map(students.map((student) => [String(student._id), student]));
    const applicable = records.filter((record) => studentsById.has(String(record.studentId)));

    // Anything left over belongs to another class, is inactive, or does not exist.
    // Report it rather than dropping it silently — otherwise the teacher is told
    // the save succeeded while part of their roster went unrecorded.
    const skipped = records
      .filter((record) => !studentsById.has(String(record.studentId)))
      .map((record) => String(record.studentId));

    if (applicable.length === 0) {
      throw new BadRequestError(
        'None of the submitted students are active in this class',
        null,
        'NO_MARKABLE_STUDENTS'
      );
    }

    const saved = await attendanceRepository.bulkUpsertRecords(
      applicable.map((record) => {
        const studentId = studentsById.get(String(record.studentId))._id;
        const set = { status: record.status, recordedBy: req.auth.userId };

        // Only touch remarks when the caller actually sent the field. Writing
        // `record.remarks || null` unconditionally meant every re-save of a day erased
        // the remarks already on it — and re-saving is routine, because correcting one
        // student means pressing Save for the whole roster. An explicit empty string
        // still clears one, so a remark remains removable.
        if (record.remarks !== undefined) {
          set.remarks = record.remarks || null;
        }

        return {
          filter: { schoolId, studentId, date: attendanceDate },
          update: {
            $set: set,
            $setOnInsert: { schoolId, studentId, date: attendanceDate },
          },
        };
      })
    );

    // Trigger push notifications for marked students (Absent, Present, Late, etc.)
    const { triggerService } = require('../../../services/notification');
    triggerService.notifyAttendanceMarked(schoolId, applicable, studentsById, date);

    return { records: saved, skipped };
  },

  async updateAttendance(req, attendanceId, payload) {
    const schoolId = req.schoolId;

    // Read the record before touching it: correcting one is the same authority as
    // marking one, and this path had none. A teacher could amend any student's
    // attendance anywhere in the school by id — including classes they do not teach,
    // and bypassing the "active in this class" guard markAttendance enforces.
    const existing = await attendanceRepository.findOne({ _id: attendanceId, schoolId });
    if (!existing) throw new NotFoundError('Attendance record not found', 'ATTENDANCE_NOT_FOUND');

    const student = await studentRepository.findById(existing.studentId, { schoolId });
    if (!student) throw new NotFoundError('Attendance record not found', 'ATTENDANCE_NOT_FOUND');

    await assertTeacherClassAccess(req, {
      classGrade: student.classGrade,
      section: student.section,
    });

    const updated = await attendanceRepository.updateRecord(
      { _id: attendanceId, schoolId },
      { $set: { ...payload, recordedBy: req.auth.userId } }
    );

    if (!updated) throw new NotFoundError('Attendance record not found', 'ATTENDANCE_NOT_FOUND');

    if (payload.status) {
      const studentsById = new Map([[String(student._id), student]]);
      const { triggerService } = require('../../../services/notification');
      triggerService.notifyAttendanceMarked(
        schoolId,
        [{ studentId: updated.studentId, status: payload.status }],
        studentsById,
        updated.date
      );
    }

    return updated;
  },

  async getDailyAttendance(req, { date, classGrade, section }) {
    const schoolId = req.schoolId;
    const attendanceDate = normalizeDate(date);

    await assertTeacherReadScope(req, { classGrade, section });

    // Only active students belong on a roster — matches how the monthly summary counts.
    const studentFilter = { schoolId, status: 'active' };
    if (classGrade) studentFilter.classGrade = classGradeQuery(classGrade);
    if (section) studentFilter.section = section;

    const students = await studentRepository.findMany(studentFilter);
    const records = await attendanceRepository.findMany({
      schoolId,
      date: attendanceDate,
      studentId: { $in: students.map((student) => student._id) },
    });

    const recordsByStudent = new Map(records.map((record) => [String(record.studentId), record]));

    return students.map((student) => ({
      student,
      attendance: recordsByStudent.get(String(student._id)) || null,
    }));
  },

  async getAttendanceHistory(req, query) {
    const schoolId = req.schoolId;
    const filter = { schoolId };

    // The role decides which students are in range; the query may only narrow that
    // set further, never widen it.
    let allowedIds = null;

    if (req.auth.role === ROLES.PARENT) {
      allowedIds = await resolveParentStudentIds(req);
    } else {
      await assertTeacherReadScope(req, query);
      if (query.classGrade || query.section) {
        allowedIds = await findActiveStudentIds(schoolId, query);
      }
    }

    if (query.studentId) {
      const permitted =
        allowedIds === null || allowedIds.some((id) => String(id) === String(query.studentId));
      if (!permitted) {
        throw new ForbiddenError(
          'You do not have access to this student',
          'STUDENT_ACCESS_DENIED'
        );
      }
      filter.studentId = query.studentId;
    } else if (allowedIds !== null) {
      filter.studentId = { $in: allowedIds };
    }

    // An exact day, or a range. The range is what lets the parent calendar ask for the
    // months it is actually showing instead of pulling the most recent N records and
    // silently rendering every older month as blank.
    if (query.date) {
      filter.date = normalizeDate(query.date);
    } else if (query.from || query.to) {
      filter.date = {};
      if (query.from) filter.date.$gte = normalizeDate(query.from);
      if (query.to) filter.date.$lte = normalizeDate(query.to);
    }
    if (query.status) filter.status = query.status;

    // Only pagination keys go through to the query builder. It would otherwise
    // re-apply studentId/date/classGrade straight from the URL, and a chained
    // .find() overwrites the matching key in the filter above — handing the caller
    // a way to shed the access scope and skewing the total, which is counted off
    // the filter alone.
    const { page, limit, sort, fields } = query;
    return attendanceRepository.paginateAttendance(filter, { page, limit, sort, fields });
  },

  async getMonthlySummary(req, { year, month, classGrade, section }) {
    await assertTeacherReadScope(req, { classGrade, section });
    return attendanceRepository.monthlySummary(req.schoolId, year, month, classGrade, section);
  },
};

module.exports = attendanceService;
