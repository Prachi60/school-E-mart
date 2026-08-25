const mongoose = require('mongoose');
const assignmentService = require('../../src/modules/lms/services/assignment.service');
const courseService = require('../../src/modules/lms/services/course.service');
const lmsController = require('../../src/modules/lms/controllers/lms.controller');
const { ROLES } = require('../../src/constants/roles');
const TeacherProfile = require('../../src/database/models/TeacherProfile');
const School = require('../../src/database/models/School');
const Student = require('../../src/database/models/Student');
const ChildProfile = require('../../src/database/models/ChildProfile');
const Attachment = require('../../src/database/models/Attachment');
const Notification = require('../../src/database/models/Notification');
const { PRIVATE_UPLOADS_DIR, resolvePrivatePath } = require('../../src/utils/fileStorage');

const fs = require('fs');

// A 1x1 png, small enough to be accepted by the writer.
const PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const DAY = 24 * 60 * 60 * 1000;

describe('homework flow: assign -> submit -> grade -> return', () => {
  let schoolId;
  let teacherUserId;
  let parentUserId;
  let course;
  let studentA;
  let studentB;

  // Stands in for the request object the submit path reads the acting student from.
  const parentReq = (student) => ({
    lmsStudent: student,
    lmsUserId: parentUserId,
    auth: { userId: parentUserId },
  });

  beforeEach(async () => {
    const school = await School.create({
      code: 'HW-001',
      name: 'Homework Test School',
      schoolRefNo: 'HW-REF-001',
    });
    schoolId = school._id;
    teacherUserId = new mongoose.Types.ObjectId();
    parentUserId = new mongoose.Types.ObjectId();

    course = await courseService.createCourse(schoolId, {
      title: 'Mathematics - 5',
      subject: 'Mathematics',
      gradeClass: '5',
      status: 'published',
      targetAudience: 'students',
    });

    // Two students in the same grade but different sections — the section split is what
    // the parent feed must respect.
    studentA = await Student.create({
      schoolId, name: 'Asha', schoolRefNo: 'S-1', rollNo: '1',
      classGrade: '5', section: 'A', status: 'active',
    });
    studentB = await Student.create({
      schoolId, name: 'Bilal', schoolRefNo: 'S-2', rollNo: '2',
      classGrade: '5', section: 'B', status: 'active',
    });

    await ChildProfile.create({
      parentUserId, studentId: studentA._id, schoolId, grade: '5', name: 'Asha',
    });
  });

  const createHomework = (overrides = {}) =>
    assignmentService.createAssignment(
      schoolId,
      course._id,
      {
        title: 'Fractions Worksheet',
        section: 'A',
        classGrade: '5',
        maxScore: 20,
        dueDate: new Date(Date.now() + DAY),
        status: 'published',
        ...overrides,
      },
      { userId: teacherUserId }
    );

  test('teacher can assign direct homework without a courseId and it reaches parents/students', async () => {
    const directHomework = await assignmentService.createAssignment(
      schoolId,
      {
        title: 'Direct Hindi Homework',
        classGrade: '5',
        section: 'A',
        subject: 'Hindi',
        maxScore: 50,
        dueDate: new Date(Date.now() + DAY),
        status: 'published',
      },
      { userId: teacherUserId }
    );

    expect(directHomework.courseId).toBeNull();
    expect(directHomework.subject).toBe('Hindi');

    const feed = await assignmentService.getStudentHomeworkFeed(schoolId, studentA);
    const directItem = feed.find((r) => String(r.assignment._id) === String(directHomework._id));
    expect(directItem).toBeTruthy();
    expect(directItem.assignment.title).toBe('Direct Hindi Homework');
  });

  test('a student only sees homework set for their own section', async () => {
    await createHomework({ title: 'For 5-A', section: 'A' });
    await createHomework({ title: 'For 5-B', section: 'B' });
    await createHomework({ title: 'Whole grade', section: undefined });

    const feedA = await assignmentService.getStudentHomeworkFeed(schoolId, studentA);
    const titlesA = feedA.map((row) => row.assignment.title).filter((t) => t !== 'Direct Hindi Homework').sort();
    expect(titlesA).toEqual(['For 5-A', 'Whole grade']);

    const feedB = await assignmentService.getStudentHomeworkFeed(schoolId, studentB);
    const titlesB = feedB.map((row) => row.assignment.title).filter((t) => t !== 'Direct Hindi Homework').sort();
    expect(titlesB).toEqual(['For 5-B', 'Whole grade']);
  });

  test('submitting stores the files privately and the teacher can see them', async () => {
    const assignment = await createHomework();

    const submission = await assignmentService.submitAssignment(
      parentReq(studentA),
      schoolId,
      course._id,
      assignment._id,
      { files: [PNG_DATA_URI], content: 'Q4 was hard' }
    );

    expect(submission.status).toBe('submitted');
    expect(submission.attachments).toHaveLength(1);
    expect(submission.isLate).toBe(false);

    // The bytes must land outside the statically-served /uploads dir.
    const attachment = await Attachment.findById(submission.attachments[0]).lean();
    expect(attachment.purpose).toBe('submission');
    expect(attachment.storageKey).not.toMatch(/^\/uploads\//);
    const onDisk = resolvePrivatePath(attachment.storageKey);
    expect(onDisk.startsWith(PRIVATE_UPLOADS_DIR)).toBe(true);
    expect(fs.existsSync(onDisk)).toBe(true);

    // The teacher's roster is the thing that was broken: it must list every student in
    // the section, name and roll intact, with the submitted files attached.
    const { rows } = await assignmentService.getSubmissionRoster(
      schoolId,
      course._id,
      assignment._id
    );

    expect(rows).toHaveLength(1); // only 5-A
    expect(rows[0].student.name).toBe('Asha');
    expect(rows[0].student.rollNo).toBe('1');
    expect(rows[0].submission.content).toBe('Q4 was hard');
    expect(rows[0].submission.attachments[0].mime).toBe('image/png');
  });

  test('the roster lists students who have not submitted', async () => {
    const assignment = await createHomework({ section: undefined });

    const { rows } = await assignmentService.getSubmissionRoster(
      schoolId,
      course._id,
      assignment._id
    );

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.submission === null)).toBe(true);
    expect(rows.map((row) => row.student.name).sort()).toEqual(['Asha', 'Bilal']);
  });

  test('the roster works for direct homework created without a courseId', async () => {
    const directAssignment = await assignmentService.createAssignment(
      schoolId,
      null,
      {
        title: 'Direct Math Homework',
        classGrade: 'Class 5',
        section: 'A',
        status: 'published',
      },
      { userId: teacherUserId }
    );

    const { rows } = await assignmentService.getSubmissionRoster(
      schoolId,
      null,
      directAssignment._id
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].student.name).toBe('Asha');
  });

  test('an oversized or unsupported file is reported, never silently dropped', async () => {
    const assignment = await createHomework();

    await expect(
      assignmentService.submitAssignment(parentReq(studentA), schoolId, course._id, assignment._id, {
        files: ['data:application/x-msdownload;base64,AAAA'],
      })
    ).rejects.toMatchObject({ code: 'UPLOAD_REJECTED' });

    // Nothing should have been recorded for a submission that failed.
    const roster = await assignmentService.getSubmissionRoster(schoolId, course._id, assignment._id);
    expect(roster.rows[0].submission).toBeNull();
  });

  test('work submitted after the due date is flagged late', async () => {
    const assignment = await createHomework({ dueDate: new Date(Date.now() - DAY) });

    const submission = await assignmentService.submitAssignment(
      parentReq(studentA),
      schoolId,
      course._id,
      assignment._id,
      { files: [PNG_DATA_URI] }
    );

    expect(submission.isLate).toBe(true);
  });

  test('grading records the score and the letter, and rejects a score above the maximum', async () => {
    const assignment = await createHomework(); // maxScore: 20
    const submission = await assignmentService.submitAssignment(
      parentReq(studentA), schoolId, course._id, assignment._id, { files: [PNG_DATA_URI] }
    );

    // The old letter->score mapping sent 90 for an "A", which is impossible out of 20.
    await expect(
      assignmentService.evaluateSubmission(schoolId, course._id, assignment._id, submission._id, {
        score: 90,
      })
    ).rejects.toMatchObject({ code: 'SCORE_EXCEEDS_MAX' });

    const graded = await assignmentService.evaluateSubmission(
      schoolId, course._id, assignment._id, submission._id,
      { score: 18, letterGrade: 'A', feedback: 'Neat work' },
      { userId: teacherUserId }
    );

    expect(graded.status).toBe('graded');
    expect(graded.score).toBe(18);
    expect(graded.letterGrade).toBe('A');
    expect(graded.feedback).toBe('Neat work');
    expect(String(graded.gradedBy)).toBe(String(teacherUserId));

    // The parent must actually be able to read the grade back.
    const [row] = await assignmentService.getStudentHomeworkFeed(schoolId, studentA);
    expect(row.submission.score).toBe(18);
    expect(row.submission.feedback).toBe('Neat work');
  });

  test('graded work cannot be resubmitted until the teacher sends it back', async () => {
    const assignment = await createHomework();
    const submission = await assignmentService.submitAssignment(
      parentReq(studentA), schoolId, course._id, assignment._id, { files: [PNG_DATA_URI] }
    );
    await assignmentService.evaluateSubmission(
      schoolId, course._id, assignment._id, submission._id, { score: 10 }
    );

    await expect(
      assignmentService.submitAssignment(parentReq(studentA), schoolId, course._id, assignment._id, {
        files: [PNG_DATA_URI],
      })
    ).rejects.toMatchObject({ code: 'ASSIGNMENT_ALREADY_GRADED' });

    // Sending it back reopens submission and clears the stale score.
    const returned = await assignmentService.returnSubmission(
      schoolId, course._id, assignment._id, submission._id,
      { feedback: 'Redo question 3' },
      { userId: teacherUserId }
    );
    expect(returned.status).toBe('returned');
    expect(returned.score).toBeNull();

    const resubmitted = await assignmentService.submitAssignment(
      parentReq(studentA), schoolId, course._id, assignment._id, { files: [PNG_DATA_URI] }
    );
    expect(resubmitted.status).toBe('submitted');
    expect(resubmitted.returnedAt).toBeNull();
  });

  test('publishing homework notifies the parents of that section only', async () => {
    await Notification.deleteMany({});
    // The parent of the 5-B student must not be told about 5-A homework.
    const otherParentUserId = new mongoose.Types.ObjectId();
    await ChildProfile.create({
      parentUserId: otherParentUserId, studentId: studentB._id, schoolId, grade: '5', name: 'Bilal',
    });

    await createHomework({ section: 'A' });

    // Triggers are fire-and-forget, so let the microtask queue drain.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const notifications = await Notification.find({ type: 'homework' }).lean();
    expect(notifications).toHaveLength(1);
    expect(String(notifications[0].userId)).toBe(String(parentUserId));
    expect(notifications[0].title).toContain('Mathematics');
  });

  test('submitting notifies the teacher who set the work', async () => {
    const assignment = await createHomework();

    // Publishing fires its own notification asynchronously; let it land before clearing,
    // otherwise it races and shows up as an extra row below.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await Notification.deleteMany({});

    await assignmentService.submitAssignment(
      parentReq(studentA), schoolId, course._id, assignment._id, { files: [PNG_DATA_URI] }
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    const notifications = await Notification.find({ type: 'homework' }).lean();
    expect(notifications).toHaveLength(1);
    expect(String(notifications[0].userId)).toBe(String(teacherUserId));
    expect(notifications[0].body).toContain('Asha');
  });

  test('creating homework with files stores them as homework_attachment and lets students access them', async () => {
    const assignment = await createHomework({
      files: [PNG_DATA_URI],
    });

    expect(assignment.attachments).toHaveLength(1);

    const attachment = await Attachment.findById(assignment.attachments[0]).lean();
    expect(attachment.purpose).toBe('homework_attachment');
    expect(attachment.storageKey).not.toMatch(/^\/uploads\//);
    const onDisk = resolvePrivatePath(attachment.storageKey);
    expect(fs.existsSync(onDisk)).toBe(true);

    // Verify it is returned in the student homework feed
    const feed = await assignmentService.getStudentHomeworkFeed(schoolId, studentA);
    expect(feed[0].assignment.attachments).toHaveLength(1);
    expect(String(feed[0].assignment.attachments[0]._id)).toBe(String(attachment._id));
    expect(feed[0].assignment.attachments[0].storageKey).toBe(attachment.storageKey);

    // Verify the attachment context can be retrieved for the teacher homework attachment
    const context = await assignmentService.getAttachmentContext(schoolId, attachment._id);
    expect(context.isHomeworkAttachment).toBe(true);
    expect(String(context.assignment._id)).toBe(String(assignment._id));
    expect(String(context.attachment._id)).toBe(String(attachment._id));
  });

  describe('homework banner image', () => {
    test('is stored separately from the reference attachments, never mixed in', async () => {
      const assignment = await createHomework({
        files: [PNG_DATA_URI],
        bannerFile: PNG_DATA_URI,
      });

      // One reference attachment, one banner — the banner must not inflate the
      // attachments list a parent sees as downloadable reference files.
      expect(assignment.attachments).toHaveLength(1);
      expect(assignment.bannerAttachmentId).toBeTruthy();
      expect(String(assignment.bannerAttachmentId)).not.toBe(String(assignment.attachments[0]));

      const bannerAttachment = await Attachment.findById(assignment.bannerAttachmentId).lean();
      expect(bannerAttachment.purpose).toBe('homework_attachment');

      // The parent-facing feed must resolve the banner as its own field too, not fold
      // it into the attachments array.
      const feed = await assignmentService.getStudentHomeworkFeed(schoolId, studentA);
      expect(feed[0].assignment.attachments).toHaveLength(1);
      expect(String(feed[0].assignment.bannerAttachmentId._id)).toBe(String(bannerAttachment._id));

      // And it must resolve through the same authorized attachment-context lookup as
      // any other homework attachment.
      const context = await assignmentService.getAttachmentContext(schoolId, bannerAttachment._id);
      expect(context.isHomeworkAttachment).toBe(true);
      expect(String(context.assignment._id)).toBe(String(assignment._id));
    });

    test('editing without touching the banner leaves it exactly as it was', async () => {
      const assignment = await createHomework({ bannerFile: PNG_DATA_URI });
      const originalBannerId = String(assignment.bannerAttachmentId);

      const updated = await assignmentService.updateAssignment(schoolId, course._id, assignment._id, {
        title: 'Fractions Worksheet (revised)',
      });

      expect(String(updated.bannerAttachmentId)).toBe(originalBannerId);
    });

    test('a new bannerFile on update replaces the old banner', async () => {
      const assignment = await createHomework({ bannerFile: PNG_DATA_URI });
      const originalBannerId = String(assignment.bannerAttachmentId);

      const updated = await assignmentService.updateAssignment(schoolId, course._id, assignment._id, {
        bannerFile: PNG_DATA_URI,
      });

      expect(updated.bannerAttachmentId).toBeTruthy();
      expect(String(updated.bannerAttachmentId)).not.toBe(originalBannerId);
    });

    test('removeBanner clears it', async () => {
      const assignment = await createHomework({ bannerFile: PNG_DATA_URI });
      expect(assignment.bannerAttachmentId).toBeTruthy();

      const updated = await assignmentService.updateAssignment(schoolId, course._id, assignment._id, {
        removeBanner: true,
      });

      expect(updated.bannerAttachmentId).toBeNull();
    });

    test('homework created without a banner has none, and attachments are unaffected', async () => {
      const assignment = await createHomework({ files: [PNG_DATA_URI] });
      expect(assignment.bannerAttachmentId).toBeFalsy();
      expect(assignment.attachments).toHaveLength(1);
    });
  });

  /**
   * Reading the work back. The teacher who set the homework has to be able to open what
   * the student handed in: this endpoint used to run assertManageAccess, which guards
   * Learning Hub *authoring* and admits super admins only, behind a course lookup that
   * course-less homework could never satisfy. Both refusals were swallowed by the UI,
   * so the file tiles simply span forever.
   */
  describe('opening submitted work as staff', () => {
    const streamAs = (auth, attachmentId) => {
      const req = { schoolId: String(schoolId), params: { attachmentId }, auth };
      // A real writable stands in for the response so fs.createReadStream().pipe(res)
      // has somewhere to go; headers are captured off it.
      const res = new (require('stream').Writable)({ write: (c, e, cb) => cb() });
      res.headers = {};
      res.setHeader = (key, value) => { res.headers[key] = value; };
      return new Promise((resolve, reject) => {
        lmsController.streamSubmissionAttachment(req, res, reject);
        res.on('finish', () => resolve(res));
        res.on('error', reject);
      });
    };

    const submitWork = async (assignment) => {
      const submission = await assignmentService.submitAssignment(
        parentReq(studentA), schoolId, assignment.courseId, assignment._id, { files: [PNG_DATA_URI] }
      );
      return String(submission.attachments[0]);
    };

    beforeEach(async () => {
      await TeacherProfile.create({
        userId: teacherUserId,
        schoolId,
        approvalStatus: 'approved',
        classAssignments: [{ class: 'Class 5', section: 'A', subjects: ['Mathematics'] }],
      });
    });

    test('the teacher who set course-less homework can open the submitted file', async () => {
      const assignment = await assignmentService.createAssignment(
        schoolId,
        null,
        { title: 'Direct HW', classGrade: 'Class 5', section: 'A', subject: 'Mathematics', status: 'published' },
        { userId: teacherUserId }
      );
      const attachmentId = await submitWork(assignment);

      const res = await streamAs({ role: ROLES.TEACHER, userId: teacherUserId }, attachmentId);
      expect(res.headers['Content-Type']).toBe('image/png');
      // Student work must never be held by a shared cache.
      expect(res.headers['Cache-Control']).toBe('private, no-store');
    });

    test('a teacher not assigned to that class is still refused', async () => {
      const assignment = await assignmentService.createAssignment(
        schoolId,
        null,
        { title: 'Direct HW', classGrade: 'Class 5', section: 'A', subject: 'Mathematics', status: 'published' },
        { userId: teacherUserId }
      );
      const attachmentId = await submitWork(assignment);

      const strangerId = new mongoose.Types.ObjectId();
      await TeacherProfile.create({
        userId: strangerId,
        schoolId,
        approvalStatus: 'approved',
        classAssignments: [{ class: 'Class 9', section: 'C', subjects: ['History'] }],
      });

      await expect(
        streamAs({ role: ROLES.TEACHER, userId: strangerId }, attachmentId)
      ).rejects.toMatchObject({ code: 'LMS_COURSE_NOT_ASSIGNED' });
    });

    test('homework that does hang off a course is still readable by its teacher', async () => {
      const assignment = await createHomework({ subject: 'Mathematics' });
      const attachmentId = await submitWork(assignment);

      const res = await streamAs({ role: ROLES.TEACHER, userId: teacherUserId }, attachmentId);
      expect(res.headers['Content-Type']).toBe('image/png');
    });
  });

  /**
   * The teacher's Manage/Check Homework lists. These filters used to be dropped before
   * they ever reached the query — the list schema did not declare them and validation
   * strips what it does not know — so a teacher asking for one class was answered with
   * the whole school's homework, drafts and other grades included.
   */
  describe('listing homework for one class', () => {
    const direct = (payload) =>
      assignmentService.createAssignment(
        schoolId,
        null,
        { status: 'published', ...payload },
        { userId: teacherUserId }
      );

    const titles = async (query) => {
      const { data } = await assignmentService.listAssignments(schoolId, null, query);
      return data.map((row) => row.title).sort();
    };

    test('scopes to the requested class, matching on the normalized grade', async () => {
      await direct({ title: 'Five Spelled Out', classGrade: 'Class 5' });
      await direct({ title: 'Five Bare', classGrade: '5' });
      await direct({ title: 'Other Grade', classGrade: 'Class 6' });

      // "5" and "Class 5" are one class, however each row happens to be spelled.
      expect(await titles({ classGrade: '5' })).toEqual(['Five Bare', 'Five Spelled Out']);
      expect(await titles({ classGrade: 'Class 5' })).toEqual(['Five Bare', 'Five Spelled Out']);
      expect(await titles({ classGrade: 'Class 6' })).toEqual(['Other Grade']);
    });

    test('a section filter keeps whole-grade homework and excludes other sections', async () => {
      await direct({ title: 'For A', classGrade: '5', section: 'A' });
      await direct({ title: 'For B', classGrade: '5', section: 'B' });
      await direct({ title: 'Whole Grade', classGrade: '5' });

      // Homework with no section is set for the entire grade, so it belongs to A too.
      expect(await titles({ classGrade: '5', section: 'A' })).toEqual(['For A', 'Whole Grade']);
      // Section is free text, so 'Section A' and 'a' name the same section as 'A'.
      expect(await titles({ classGrade: '5', section: 'Section A' })).toEqual(['For A', 'Whole Grade']);
    });

    test('drafts are excluded when the caller asks for published homework', async () => {
      await direct({ title: 'Live', classGrade: '5' });
      await direct({ title: 'Draft', classGrade: '5', status: 'draft' });

      expect(await titles({ classGrade: '5', status: 'published' })).toEqual(['Live']);
      expect(await titles({ classGrade: '5' })).toEqual(['Draft', 'Live']);
    });

    test('classGrades scopes a teacher who named no class to their own classes', async () => {
      await direct({ title: 'Mine', classGrade: 'Class 5' });
      await direct({ title: 'Theirs', classGrade: 'Class 6' });

      expect(await titles({ classGrades: ['5'] })).toEqual(['Mine']);
      // A teacher assigned to nothing lists nothing — never the whole school.
      expect(await titles({ classGrades: [] })).toEqual([]);
    });
  });
});
