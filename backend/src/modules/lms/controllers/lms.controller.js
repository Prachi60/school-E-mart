const fs = require('fs');
const { success, created, paginated } = require('../../../common/response');
const asyncHandler = require('../../../utils/asyncHandler');
const { ForbiddenError, NotFoundError } = require('../../../common/errors');
const { ROLES } = require('../../../constants/roles');
const { resolvePrivatePath } = require('../../../utils/fileStorage');
const {
  assertCourseInSchool,
  assertTeacherCourseAccess,
  assertTeacherAssignmentAccess,
  assertManageAccess,
  assertEnrollmentAccess,
  assertDirectHomeworkAccess,
} = require('../policies/lmsAccess.policy');
const studentRepository = require('../repositories/student.repository');
const courseService = require('../services/course.service');
const chapterService = require('../services/chapter.service');
const lessonService = require('../services/lesson.service');
const assignmentService = require('../services/assignment.service');
const quizService = require('../services/quiz.service');
const progressService = require('../services/progress.service');
const certificateService = require('../services/certificate.service');
const noteService = require('../services/note.service');
const commentService = require('../services/comment.service');
const bookmarkService = require('../services/bookmark.service');

const PLATFORM_CONSUMER_ROLES = [ROLES.PARENT, ROLES.TEACHER, ROLES.SCHOOL_ADMIN];

const shouldIncludePlatformCourses = (role) => PLATFORM_CONSUMER_ROLES.includes(role);

const withCourse = async (req) => {
  const course = await assertCourseInSchool(req.schoolId, req.params.courseId);
  req.lmsCourse = course;
  return course;
};

const lmsController = {
  createCourse: asyncHandler(async (req, res) => {
    const course = await courseService.createCourse(req.schoolId, req.body);
    return created(res, { course }, 'Course created successfully', req);
  }),

  listCourses: asyncHandler(async (req, res) => {
    const { data, pagination } = await courseService.listCourses(req.schoolId, req.query, {
      platformOnly: true,
    });
    return paginated(res, { courses: data }, pagination, 'Courses fetched successfully', req);
  }),

  getCourse: asyncHandler(async (req, res) => {
    const course = await courseService.getCourse(req.schoolId, req.params.courseId, {
      platformOnly: true,
    });
    return success(res, { course }, 'Course fetched successfully', undefined, req);
  }),

  updateCourse: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const updated = await courseService.updateCourse(req.schoolId, req.params.courseId, req.body);
    return success(res, { course: updated }, 'Course updated successfully', undefined, req);
  }),

  deleteCourse: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    await courseService.deleteCourse(req.schoolId, req.params.courseId, req.auth.userId);
    return success(res, null, 'Course deleted successfully', undefined, req);
  }),

  setCourseStatus: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const updated = await courseService.setCourseStatus(req.schoolId, req.params.courseId, req.body.status);
    return success(res, { course: updated }, 'Course status updated successfully', undefined, req);
  }),

  createChapter: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const chapter = await chapterService.createChapter(req.schoolId, req.params.courseId, req.body);
    return created(res, { chapter }, 'Chapter created successfully', req);
  }),

  listChapters: asyncHandler(async (req, res) => {
    const chapters = await chapterService.listChapters(req.schoolId, req.params.courseId);
    return success(res, { chapters }, 'Chapters fetched successfully', undefined, req);
  }),

  updateChapter: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const chapter = await chapterService.updateChapter(
      req.schoolId,
      req.params.courseId,
      req.params.chapterId,
      req.body
    );
    return success(res, { chapter }, 'Chapter updated successfully', undefined, req);
  }),

  deleteChapter: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    await chapterService.deleteChapter(
      req.schoolId,
      req.params.courseId,
      req.params.chapterId,
      req.auth.userId
    );
    return success(res, null, 'Chapter deleted successfully', undefined, req);
  }),

  reorderChapters: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const chapters = await chapterService.reorderChapters(
      req.schoolId,
      req.params.courseId,
      req.body.orderedIds
    );
    return success(res, { chapters }, 'Chapters reordered successfully', undefined, req);
  }),

  createLesson: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const lesson = await lessonService.createLesson(req.schoolId, req.params.courseId, req.body);
    return created(res, { lesson }, 'Lesson created successfully', req);
  }),

  listLessons: asyncHandler(async (req, res) => {
    const { data, pagination } = await lessonService.listLessons(req.schoolId, req.params.courseId, req.query, {
      platformOnly: true,
    });
    return paginated(res, { lessons: data }, pagination, 'Lessons fetched successfully', req);
  }),

  getLesson: asyncHandler(async (req, res) => {
    const lesson = await lessonService.getLesson(req.schoolId, req.params.courseId, req.params.lessonId, {
      platformOnly: true,
    });
    return success(res, { lesson }, 'Lesson fetched successfully', undefined, req);
  }),

  updateLesson: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const lesson = await lessonService.updateLesson(
      req.schoolId,
      req.params.courseId,
      req.params.lessonId,
      req.body
    );
    return success(res, { lesson }, 'Lesson updated successfully', undefined, req);
  }),

  deleteLesson: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    await lessonService.deleteLesson(
      req.schoolId,
      req.params.courseId,
      req.params.lessonId,
      req.auth.userId
    );
    return success(res, null, 'Lesson deleted successfully', undefined, req);
  }),

  reorderLessons: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const lessons = await lessonService.reorderLessons(req.schoolId, req.params.courseId, req.body.orderedIds);
    return success(res, { lessons }, 'Lessons reordered successfully', undefined, req);
  }),

  createAssignment: asyncHandler(async (req, res) => {
    if (req.params.courseId) {
      const course = await withCourse(req);
      await assertTeacherCourseAccess(req, course);
    } else {
      await assertTeacherAssignmentAccess(req, {
        classGrade: req.body.classGrade,
        subject: req.body.subject,
      });
    }
    const assignment = await assignmentService.createAssignment(
      req.schoolId,
      req.params.courseId || req.body.courseId || null,
      req.body,
      { userId: req.auth.userId }
    );
    return created(res, { assignment }, 'Assignment created successfully', req);
  }),

  listAssignments: asyncHandler(async (req, res) => {
    const query = { ...req.query };
    if (req.params.courseId) {
      const course = await withCourse(req);
      await assertTeacherCourseAccess(req, course);
    } else if (req.auth.role === ROLES.TEACHER) {
      await assertTeacherAssignmentAccess(req, {
        classGrade: req.query.classGrade,
        subject: req.query.subject,
      });
      // A teacher who names no class must not be handed the whole school's homework:
      // with no grade to check, the assertion above has nothing it can refuse. Scope
      // the listing to the classes on their own profile instead, which is what it
      // would have enforced had a class been named. An empty array is meaningful — a
      // teacher assigned to nothing lists nothing — so it is passed through as-is.
      if (!req.query.classGrade) {
        query.classGrades = (req.teacherProfile?.classAssignments || [])
          .map((assignment) => assignment.class)
          .filter(Boolean);
      }
    }
    const { data, pagination } = await assignmentService.listAssignments(
      req.schoolId,
      req.params.courseId || null,
      query
    );
    return paginated(res, { assignments: data }, pagination, 'Assignments fetched successfully', req);
  }),

  getAssignment: asyncHandler(async (req, res) => {
    const assignment = await assignmentService.getAssignment(
      req.schoolId,
      req.params.courseId || null,
      req.params.assignmentId
    );
    return success(res, { assignment }, 'Assignment fetched successfully', undefined, req);
  }),

  updateAssignment: asyncHandler(async (req, res) => {
    if (req.params.courseId) {
      const course = await withCourse(req);
      await assertTeacherCourseAccess(req, course);
    } else {
      const existing = await assignmentService.getAssignment(req.schoolId, req.params.assignmentId);
      await assertTeacherAssignmentAccess(req, {
        classGrade: existing.classGrade,
        subject: existing.subject,
      });
    }
    const assignment = await assignmentService.updateAssignment(
      req.schoolId,
      req.params.courseId || null,
      req.params.assignmentId,
      req.body
    );
    return success(res, { assignment }, 'Assignment updated successfully', undefined, req);
  }),

  deleteAssignment: asyncHandler(async (req, res) => {
    if (req.params.courseId) {
      const course = await withCourse(req);
      await assertTeacherCourseAccess(req, course);
    } else {
      const existing = await assignmentService.getAssignment(req.schoolId, req.params.assignmentId);
      await assertTeacherAssignmentAccess(req, {
        classGrade: existing.classGrade,
        subject: existing.subject,
      });
    }
    await assignmentService.deleteAssignment(
      req.schoolId,
      req.params.courseId || null,
      req.params.assignmentId,
      req.auth.userId
    );
    return success(res, null, 'Assignment deleted successfully', undefined, req);
  }),

  submitAssignment: asyncHandler(async (req, res) => {
    if (req.params.courseId) {
      await assertEnrollmentAccess(req, req.params.courseId, req.body.studentId);
    } else {
      await assertDirectHomeworkAccess(req, req.body.studentId);
    }
    const submission = await assignmentService.submitAssignment(
      req,
      req.schoolId,
      req.params.courseId || null,
      req.params.assignmentId,
      req.body
    );
    return success(res, { submission }, 'Assignment submitted successfully', undefined, req);
  }),

  evaluateSubmission: asyncHandler(async (req, res) => {
    if (req.params.courseId) {
      const course = await withCourse(req);
      await assertTeacherCourseAccess(req, course);
    } else {
      const existing = await assignmentService.getAssignment(req.schoolId, req.params.assignmentId);
      await assertTeacherAssignmentAccess(req, {
        classGrade: existing.classGrade,
        subject: existing.subject,
      });
    }
    const submission = await assignmentService.evaluateSubmission(
      req.schoolId,
      req.params.courseId || null,
      req.params.assignmentId,
      req.params.submissionId,
      req.body,
      { userId: req.auth.userId }
    );
    return success(res, { submission }, 'Submission evaluated successfully', undefined, req);
  }),

  returnSubmission: asyncHandler(async (req, res) => {
    if (req.params.courseId) {
      const course = await withCourse(req);
      await assertTeacherCourseAccess(req, course);
    } else {
      const existing = await assignmentService.getAssignment(req.schoolId, req.params.assignmentId);
      await assertTeacherAssignmentAccess(req, {
        classGrade: existing.classGrade,
        subject: existing.subject,
      });
    }
    const submission = await assignmentService.returnSubmission(
      req.schoolId,
      req.params.courseId || null,
      req.params.assignmentId,
      req.params.submissionId,
      req.body,
      { userId: req.auth.userId }
    );
    return success(res, { submission }, 'Submission returned for revision', undefined, req);
  }),

  listSubmissions: asyncHandler(async (req, res) => {
    if (req.params.courseId) {
      const course = await withCourse(req);
      await assertTeacherCourseAccess(req, course);
    } else {
      const existing = await assignmentService.getAssignment(req.schoolId, req.params.assignmentId);
      await assertTeacherAssignmentAccess(req, {
        classGrade: existing.classGrade,
        subject: existing.subject,
      });
    }
    const { data, pagination } = await assignmentService.listSubmissions(
      req.schoolId,
      req.params.courseId || null,
      req.params.assignmentId,
      req.query
    );
    return paginated(res, { submissions: data }, pagination, 'Submissions fetched successfully', req);
  }),

  getSubmissionRoster: asyncHandler(async (req, res) => {
    if (req.params.courseId) {
      const course = await withCourse(req);
      await assertTeacherCourseAccess(req, course);
    } else {
      const existing = await assignmentService.getAssignment(req.schoolId, req.params.assignmentId);
      await assertTeacherAssignmentAccess(req, {
        classGrade: existing.classGrade,
        subject: existing.subject,
      });
    }
    const { assignment, rows } = await assignmentService.getSubmissionRoster(
      req.schoolId,
      req.params.courseId || null,
      req.params.assignmentId
    );
    return success(res, { assignment, roster: rows }, 'Roster fetched successfully', undefined, req);
  }),

  getMySubmission: asyncHandler(async (req, res) => {
    if (req.params.courseId) {
      await assertEnrollmentAccess(req, req.params.courseId, req.query.studentId);
    } else {
      await assertDirectHomeworkAccess(req, req.query.studentId);
    }
    const submission = await assignmentService.getMySubmission(
      req,
      req.schoolId,
      req.params.courseId || null,
      req.params.assignmentId
    );
    return success(res, { submission }, 'Submission fetched successfully', undefined, req);
  }),

  getStudentHomework: asyncHandler(async (req, res) => {
    // Reading the class's homework only needs to know which child is being asked
    // about — not that the school has already added them to its roster. Submitting
    // still does, which is what `canSubmit` tells the client.
    const resolved = await studentRepository.resolveLearnerContext(
      req.schoolId,
      req.auth.userId,
      req.query.studentId
    );
    if (!resolved) {
      throw new ForbiddenError(
        'No child of yours is registered at this school',
        'STUDENT_REQUIRED'
      );
    }

    const homework = await assignmentService.getStudentHomeworkFeed(req.schoolId, resolved.student);
    return success(
      res,
      {
        homework,
        canSubmit: resolved.isLinked,
        // Which child the feed was actually built for. An empty list is ordinary —
        // the class may simply have no homework yet — but without naming the class it
        // is indistinguishable from a fault, which is what parents were reporting.
        student: {
          name: resolved.student.name || null,
          classGrade: resolved.student.classGrade || null,
          section: resolved.student.section || null,
        },
      },
      'Homework fetched successfully',
      undefined,
      req
    );
  }),

  streamSubmissionAttachment: asyncHandler(async (req, res) => {
    const { attachment, submission, assignment, isHomeworkAttachment } = await assignmentService.getAttachmentContext(
      req.schoolId,
      req.params.attachmentId
    );

    // A parent may only read their own child's work or homework attachments that are published.
    // Staff go through the same class + subject check as the rest of the grading surface.
    if (req.auth.role === ROLES.PARENT) {
      if (isHomeworkAttachment) {
        if (assignment.status !== 'published') {
          throw new ForbiddenError('You cannot access this attachment', 'ATTACHMENT_ACCESS_DENIED');
        }
      } else {
        if (String(submission.userId) !== String(req.auth.userId)) {
          throw new ForbiddenError('You cannot access this submission', 'SUBMISSION_ACCESS_DENIED');
        }
      }
    } else {
      // Homework no longer has to hang off a course, so this must not be gated on one:
      // requiring a course 404'd every course-less homework, and assertManageAccess
      // guards Learning Hub authoring (super admin only) rather than grading, so it
      // refused the very teachers who set the work. The grade/subject assertion is the
      // same one evaluate, return, roster and listSubmissions already use; it is a
      // no-op for school admins and super admins, and the route guard admits no one
      // else. Cross-school reads are already blocked: getAttachmentContext resolves the
      // assignment within req.schoolId, which is pinned to the caller's own tenant.
      let course = null;
      if (assignment.courseId) {
        try {
          course = await assertCourseInSchool(req.schoolId, assignment.courseId);
        } catch {
          course = null;
        }
      }
      await assertTeacherAssignmentAccess(req, {
        classGrade: assignment.classGrade || course?.gradeClass,
        subject: assignment.subject || course?.subject,
      });
    }

    const absolutePath = resolvePrivatePath(attachment.storageKey);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      throw new NotFoundError('Attachment file is missing', 'ATTACHMENT_FILE_MISSING');
    }

    res.setHeader('Content-Type', attachment.mime);
    res.setHeader('Content-Length', attachment.sizeBytes);
    res.setHeader('Content-Disposition', 'inline');
    // Student work must never be held by a shared cache.
    res.setHeader('Cache-Control', 'private, no-store');

    fs.createReadStream(absolutePath).pipe(res);
  }),

  createQuiz: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const quiz = await quizService.createQuiz(req.schoolId, req.params.courseId, req.body);
    return created(res, { quiz }, 'Quiz created successfully', req);
  }),

  listQuizzes: asyncHandler(async (req, res) => {
    const { data, pagination } = await quizService.listQuizzes(req.schoolId, req.params.courseId, req.query);
    return paginated(res, { quizzes: data }, pagination, 'Quizzes fetched successfully', req);
  }),

  updateQuiz: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const quiz = await quizService.updateQuiz(req.schoolId, req.params.courseId, req.params.quizId, req.body);
    return success(res, { quiz }, 'Quiz updated successfully', undefined, req);
  }),

  deleteQuiz: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    await quizService.deleteQuiz(req.schoolId, req.params.courseId, req.params.quizId, req.auth.userId);
    return success(res, null, 'Quiz deleted successfully', undefined, req);
  }),

  startQuizAttempt: asyncHandler(async (req, res) => {
    await assertEnrollmentAccess(req, req.params.courseId, req.body?.studentId);
    const attempt = await quizService.startAttempt(req, req.schoolId, req.params.courseId, req.params.quizId);
    return created(res, { attempt }, 'Quiz attempt started', req);
  }),

  submitQuizAttempt: asyncHandler(async (req, res) => {
    await assertEnrollmentAccess(req, req.params.courseId, req.body.studentId);
    const attempt = await quizService.submitAttempt(
      req,
      req.schoolId,
      req.params.courseId,
      req.params.quizId,
      req.params.attemptId,
      req.body.answers
    );
    return success(res, { attempt }, 'Quiz submitted successfully', undefined, req);
  }),

  getQuizAttempts: asyncHandler(async (req, res) => {
    const { data, pagination } = await quizService.getAttemptHistory(
      req.schoolId,
      req.params.courseId,
      req.params.quizId,
      req.query
    );
    return paginated(res, { attempts: data }, pagination, 'Quiz attempts fetched successfully', req);
  }),

  enrollStudent: asyncHandler(async (req, res) => {
    const course = await withCourse(req);
    await assertManageAccess(req, course);
    const enrollment = await progressService.enrollStudent(req.schoolId, req.params.courseId, req.body);
    return created(res, { enrollment }, 'Student enrolled successfully', req);
  }),

  updateLessonProgress: asyncHandler(async (req, res) => {
    await assertEnrollmentAccess(req, req.params.courseId, req.body.studentId);
    const progress = await progressService.updateLessonProgress(
      req.lmsUserId || req.auth.userId,
      req.schoolId,
      req.params.courseId,
      req.params.lessonId,
      req.body,
      req.lmsStudent?._id
    );
    return success(res, { progress }, 'Lesson progress updated successfully', undefined, req);
  }),

  getCourseProgress: asyncHandler(async (req, res) => {
    await assertEnrollmentAccess(req, req.params.courseId, req.query.studentId);
    const progress = await progressService.getCourseProgress(
      req.lmsUserId || req.auth.userId,
      req.params.courseId
    );
    return success(res, { progress }, 'Course progress fetched successfully', undefined, req);
  }),

  getLearningHistory: asyncHandler(async (req, res) => {
    const history = await progressService.getLearningHistory(req.auth.userId, req.schoolId, req.query);
    return success(res, { history }, 'Learning history fetched successfully', undefined, req);
  }),

  generateCertificate: asyncHandler(async (req, res) => {
    await assertEnrollmentAccess(req, req.params.courseId, req.body.studentId);
    const certificate = await certificateService.generateCertificate(
      req.schoolId,
      req.params.courseId,
      req.lmsStudent._id,
      req.lmsUserId || req.auth.userId
    );
    return created(res, { certificate }, 'Certificate issued successfully', req);
  }),

  listCertificates: asyncHandler(async (req, res) => {
    const userId = req.auth.role === 'parent' ? req.auth.userId : null;
    const { data, pagination } = await certificateService.listCertificates(req.schoolId, req.query, userId);
    return paginated(res, { certificates: data }, pagination, 'Certificates fetched successfully', req);
  }),

  getCertificate: asyncHandler(async (req, res) => {
    const certificate = await certificateService.getCertificate(req.schoolId, req.params.certificateId);
    return success(res, { certificate }, 'Certificate fetched successfully', undefined, req);
  }),

  createNote: asyncHandler(async (req, res) => {
    const note = await noteService.createNote(req.auth.userId, req.schoolId, req.body);
    return created(res, { note }, 'Note created successfully', req);
  }),

  listNotes: asyncHandler(async (req, res) => {
    const { data, pagination } = await noteService.listNotes(req.auth.userId, req.schoolId, req.query);
    return paginated(res, { notes: data }, pagination, 'Notes fetched successfully', req);
  }),

  updateNote: asyncHandler(async (req, res) => {
    const note = await noteService.updateNote(req.auth.userId, req.schoolId, req.params.noteId, req.body);
    return success(res, { note }, 'Note updated successfully', undefined, req);
  }),

  deleteNote: asyncHandler(async (req, res) => {
    await noteService.deleteNote(req.auth.userId, req.schoolId, req.params.noteId);
    return success(res, null, 'Note deleted successfully', undefined, req);
  }),

  addComment: asyncHandler(async (req, res) => {
    const comment = await commentService.addComment(
      req,
      req.schoolId,
      req.params.courseId,
      req.params.lessonId,
      req.body
    );
    return created(res, { comment }, 'Comment added successfully', req);
  }),

  listComments: asyncHandler(async (req, res) => {
    const { data, pagination } = await commentService.listComments(
      req.schoolId,
      req.params.courseId,
      req.params.lessonId,
      req.query
    );
    return paginated(res, { comments: data }, pagination, 'Comments fetched successfully', req);
  }),

  updateComment: asyncHandler(async (req, res) => {
    const comment = await commentService.updateComment(
      req,
      req.schoolId,
      req.params.courseId,
      req.params.lessonId,
      req.params.commentId,
      req.body
    );
    return success(res, { comment }, 'Comment updated successfully', undefined, req);
  }),

  deleteComment: asyncHandler(async (req, res) => {
    await commentService.deleteComment(
      req,
      req.schoolId,
      req.params.courseId,
      req.params.lessonId,
      req.params.commentId
    );
    return success(res, null, 'Comment deleted successfully', undefined, req);
  }),

  moderateComment: asyncHandler(async (req, res) => {
    const comment = await commentService.moderateComment(
      req.schoolId,
      req.params.courseId,
      req.params.lessonId,
      req.params.commentId,
      req.body.moderationStatus
    );
    return success(res, { comment }, 'Comment moderated successfully', undefined, req);
  }),

  addBookmark: asyncHandler(async (req, res) => {
    const bookmark = await bookmarkService.addBookmark(req.auth.userId, req.schoolId, req.body);
    return created(res, { bookmark }, 'Bookmark saved successfully', req);
  }),

  removeBookmark: asyncHandler(async (req, res) => {
    await bookmarkService.removeBookmark(
      req.auth.userId,
      req.schoolId,
      req.query.courseId,
      req.query.lessonId
    );
    return success(res, null, 'Bookmark removed successfully', undefined, req);
  }),

  listBookmarks: asyncHandler(async (req, res) => {
    const { data, pagination } = await bookmarkService.listBookmarks(req.auth.userId, req.schoolId, req.query);
    return paginated(res, { bookmarks: data }, pagination, 'Bookmarks fetched successfully', req);
  }),

  resumeLearning: asyncHandler(async (req, res) => {
    const resume = await bookmarkService.getResumeLearning(req.auth.userId, req.schoolId);
    return success(res, { resume }, 'Resume learning fetched successfully', undefined, req);
  }),
};

module.exports = lmsController;
