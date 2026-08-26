const mongoose = require('mongoose');
const attendanceService = require('../../src/modules/school/services/attendance.service');
const studentRepository = require('../../src/modules/school/repositories/student.repository');
const School = require('../../src/database/models/School');
const ParentProfile = require('../../src/database/models/ParentProfile');

describe('attendanceService', () => {
  let schoolId;
  let studentId;
  let adminReq;

  const makeReq = (overrides = {}) => ({
    schoolId: String(schoolId),
    auth: { userId: new mongoose.Types.ObjectId(), role: 'school' },
    ...overrides,
  });

  beforeEach(async () => {
    const school = await School.create({
      code: 'ATT-001',
      name: 'Attendance School',
      schoolRefNo: 'ATT-REF-001',
    });
    schoolId = school._id;

    const student = await studentRepository.create({
      schoolId,
      name: 'Rahul Sharma',
      schoolRefNo: 'STU-ATT-001',
      classGrade: 'Class 4',
      section: 'A',
      status: 'active',
    });
    studentId = student._id;
    adminReq = makeReq();
  });

  test('prevents duplicate attendance for same student and date', async () => {
    const date = new Date('2026-06-15T00:00:00.000Z');
    await attendanceService.markAttendance(adminReq, {
      date,
      classGrade: 'Class 4',
      section: 'A',
      records: [{ studentId, status: 'present' }],
    });

    const { records } = await attendanceService.markAttendance(adminReq, {
      date,
      classGrade: 'Class 4',
      section: 'A',
      records: [{ studentId, status: 'absent' }],
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('absent');
  });

  test('returns monthly attendance summary', async () => {
    await attendanceService.markAttendance(adminReq, {
      date: new Date('2026-06-10T00:00:00.000Z'),
      classGrade: 'Class 4',
      section: 'A',
      records: [{ studentId, status: 'present' }],
    });

    const summary = await attendanceService.getMonthlySummary(adminReq, {
      year: 2026,
      month: 6,
      classGrade: 'Class 4',
      section: 'A',
    });

    expect(summary.students).toHaveLength(1);
    expect(summary.students[0].counts.present).toBe(1);
  });

  test('reports students that are not markable instead of dropping them silently', async () => {
    const otherClassStudent = await studentRepository.create({
      schoolId,
      name: 'Priya Nair',
      schoolRefNo: 'STU-ATT-002',
      classGrade: 'Class 5',
      section: 'B',
      status: 'active',
    });

    const { records, skipped } = await attendanceService.markAttendance(adminReq, {
      date: new Date('2026-06-15T00:00:00.000Z'),
      classGrade: 'Class 4',
      section: 'A',
      records: [
        { studentId, status: 'present' },
        { studentId: otherClassStudent._id, status: 'present' },
      ],
    });

    expect(records).toHaveLength(1);
    expect(skipped).toEqual([String(otherClassStudent._id)]);
  });

  test('accepts a class grade written without the "Class" prefix', async () => {
    const { records } = await attendanceService.markAttendance(adminReq, {
      date: new Date('2026-06-15T00:00:00.000Z'),
      classGrade: '4',
      section: 'A',
      records: [{ studentId, status: 'late' }],
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('late');
  });

  describe('getAttendanceHistory access scoping', () => {
    let parentReq;
    let ownChildId;

    beforeEach(async () => {
      const parentUserId = new mongoose.Types.ObjectId();
      const parentProfile = await ParentProfile.create({
        userId: parentUserId,
        referralCode: 'EMART0001',
      });

      const ownChild = await studentRepository.create({
        schoolId,
        name: 'Aarav Sharma',
        schoolRefNo: 'STU-ATT-003',
        classGrade: 'Class 4',
        section: 'A',
        status: 'active',
        parentProfileIds: [parentProfile._id],
      });
      ownChildId = ownChild._id;

      await attendanceService.markAttendance(adminReq, {
        date: new Date('2026-06-15T00:00:00.000Z'),
        classGrade: 'Class 4',
        section: 'A',
        records: [
          { studentId, status: 'present' },
          { studentId: ownChildId, status: 'absent' },
        ],
      });

      parentReq = makeReq({ auth: { userId: parentUserId, role: 'parent' } });
    });

    test('an unfiltered parent request returns only their own children', async () => {
      const { data } = await attendanceService.getAttendanceHistory(parentReq, {});

      expect(data).toHaveLength(1);
      expect(String(data[0].studentId)).toBe(String(ownChildId));
    });

    test('a parent cannot read another family\'s child by passing studentId', async () => {
      await expect(
        attendanceService.getAttendanceHistory(parentReq, { studentId })
      ).rejects.toMatchObject({ code: 'STUDENT_ACCESS_DENIED' });
    });

    test('a parent can read their own child by passing studentId', async () => {
      const { data } = await attendanceService.getAttendanceHistory(parentReq, {
        studentId: ownChildId,
      });

      expect(data).toHaveLength(1);
      expect(data[0].status).toBe('absent');
    });
  });

  test('allows marking attendance for past dates', async () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const { records } = await attendanceService.markAttendance(adminReq, {
      date: pastDate,
      classGrade: 'Class 4',
      section: 'A',
      records: [{ studentId, status: 'present' }],
    });

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('present');
  });

  test('validator rejects future dates for attendance', () => {
    const markAttendanceSchema = require('../../src/modules/school/validators/school.validator').markAttendanceSchema;
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days in future
    const { error } = markAttendanceSchema.validate({
      date: futureDate,
      classGrade: 'Class 4',
      section: 'A',
      records: [{ studentId: String(studentId), status: 'present' }],
    });

    expect(error).toBeDefined();
    expect(error.message).toMatch(/cannot be in the future/);
  });

  /**
   * The client sends its own local calendar day. Any timezone ahead of UTC begins that
   * day before UTC does, so a bound of exactly `now` rejected the teacher's own date:
   * marking at 01:00 IST sends today, which parses to 00:00 UTC today — still hours
   * ahead by UTC reckoning.
   */
  test('validator accepts today even when the local day is ahead of UTC', () => {
    const { markAttendanceSchema } = require('../../src/modules/school/validators/school.validator');
    // Midnight UTC today is the worst case: it is in the future for every UTC-morning
    // moment, yet it is simply "today" for the teacher sending it.
    const now = new Date();
    const todayUtcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    const { error } = markAttendanceSchema.validate({
      date: todayUtcMidnight,
      classGrade: 'Class 4',
      section: 'A',
      records: [{ studentId: String(studentId), status: 'present' }],
    });

    expect(error).toBeUndefined();
  });

  /**
   * A parent is linked to a child two independent ways and both are load-bearing.
   * Resolving only ParentProfile -> Student.parentProfileIds is what left parents
   * staring at an empty attendance page while the push notification about that very
   * record reached them.
   */
  describe('parent link resolution', () => {
    const ChildProfile = require('../../src/database/models/ChildProfile');
    const askAsParent = (parentUserId) =>
      attendanceService.getAttendanceHistory(
        makeReq({ auth: { userId: parentUserId, role: 'parent' } }),
        {}
      );

    beforeEach(async () => {
      await attendanceService.markAttendance(adminReq, {
        date: new Date('2026-06-15T00:00:00.000Z'),
        classGrade: 'Class 4',
        section: 'A',
        records: [{ studentId, status: 'present' }],
      });
    });

    test('a parent linked only through ChildProfile sees their child', async () => {
      const parentUserId = new mongoose.Types.ObjectId();
      await ChildProfile.create({
        parentUserId,
        studentId,
        schoolId,
        name: 'Rahul Sharma',
        grade: 'Class 4',
      });

      const { data } = await askAsParent(parentUserId);
      expect(data).toHaveLength(1);
      expect(String(data[0].studentId)).toBe(String(studentId));
    });

    test('a parent with no children here gets an empty list, not an error', async () => {
      // A shop-only account: real user, no child at this school. This used to throw
      // and blank the whole screen.
      const { data } = await askAsParent(new mongoose.Types.ObjectId());
      expect(data).toEqual([]);
    });

    test('a ChildProfile at another school does not leak that child in', async () => {
      const otherSchool = await School.create({
        code: 'ATT-002',
        name: 'Other School',
        schoolRefNo: 'ATT-REF-002',
      });
      const outsider = await studentRepository.create({
        schoolId: otherSchool._id,
        name: 'Elsewhere',
        schoolRefNo: 'STU-ATT-009',
        classGrade: 'Class 4',
        section: 'A',
        status: 'active',
      });
      const parentUserId = new mongoose.Types.ObjectId();
      await ChildProfile.create({
        parentUserId,
        studentId: outsider._id,
        schoolId: otherSchool._id,
        name: 'Elsewhere',
        grade: 'Class 4',
      });

      const { data } = await askAsParent(parentUserId);
      expect(data).toEqual([]);
    });
  });

  /**
   * Correcting one student means pressing Save for the whole roster, so a re-save must
   * not destroy what is already recorded against the other students.
   */
  describe('remarks are preserved across re-saves', () => {
    const markWith = (records) =>
      attendanceService.markAttendance(adminReq, {
        date: new Date('2026-06-15T00:00:00.000Z'),
        classGrade: 'Class 4',
        section: 'A',
        records,
      });

    test('a re-save that sends no remark keeps the stored one', async () => {
      await markWith([{ studentId, status: 'absent', remarks: 'Fever, informed by parent' }]);

      const { records } = await markWith([{ studentId, status: 'present' }]);

      expect(records[0].status).toBe('present');
      expect(records[0].remarks).toBe('Fever, informed by parent');
    });

    test('an explicit empty remark still clears it', async () => {
      await markWith([{ studentId, status: 'absent', remarks: 'Fever' }]);

      const { records } = await markWith([{ studentId, status: 'absent', remarks: '' }]);

      expect(records[0].remarks).toBeNull();
    });
  });

  describe('date range filtering', () => {
    beforeEach(async () => {
      for (const day of ['2026-04-10', '2026-05-10', '2026-06-10']) {
        await attendanceService.markAttendance(adminReq, {
          date: new Date(`${day}T00:00:00.000Z`),
          classGrade: 'Class 4',
          section: 'A',
          records: [{ studentId, status: 'present' }],
        });
      }
    });

    test('from/to narrows to the requested window, inclusive of both ends', async () => {
      const { data } = await attendanceService.getAttendanceHistory(adminReq, {
        from: '2026-04-10',
        to: '2026-05-10',
      });

      expect(data.map((r) => r.date.toISOString().slice(0, 10)).sort()).toEqual([
        '2026-04-10',
        '2026-05-10',
      ]);
    });

    test('an open-ended range is allowed', async () => {
      const { data } = await attendanceService.getAttendanceHistory(adminReq, {
        from: '2026-05-01',
      });
      expect(data).toHaveLength(2);
    });
  });

  /**
   * Correcting a record is the same authority as marking one. This path had no class
   * check at all, so any teacher could amend any student's attendance by id.
   */
  describe('updateAttendance authorization', () => {
    const TeacherProfile = require('../../src/database/models/TeacherProfile');
    let recordId;

    beforeEach(async () => {
      const { records } = await attendanceService.markAttendance(adminReq, {
        date: new Date('2026-06-15T00:00:00.000Z'),
        classGrade: 'Class 4',
        section: 'A',
        records: [{ studentId, status: 'present' }],
      });
      recordId = records[0]._id;
    });

    const teacherReq = async (classAssignments) => {
      const userId = new mongoose.Types.ObjectId();
      await TeacherProfile.create({
        userId,
        schoolId,
        approvalStatus: 'approved',
        classAssignments,
      });
      return makeReq({ auth: { userId, role: 'teacher' } });
    };

    test('the class teacher may correct the record', async () => {
      const req = await teacherReq([{ class: 'Class 4', section: 'A', isClassTeacher: true }]);
      const updated = await attendanceService.updateAttendance(req, recordId, { status: 'late' });
      expect(updated.status).toBe('late');
    });

    test('a teacher of another class may not', async () => {
      const req = await teacherReq([{ class: 'Class 9', section: 'C', subjects: ['History'] }]);
      await expect(
        attendanceService.updateAttendance(req, recordId, { status: 'absent' })
      ).rejects.toMatchObject({ code: 'CLASS_ACCESS_DENIED' });
    });

    test('an admin may still correct any record', async () => {
      const updated = await attendanceService.updateAttendance(adminReq, recordId, {
        status: 'leave',
      });
      expect(updated.status).toBe('leave');
    });
  });
});

