const express = require('express');
const lmsController = require('../controllers/lms.controller');
const validators = require('../validators/lms.validator');
const { validateBody, validateParams, validateQuery } = require('../../../middlewares/validation');
const { protectedRoute } = require('../../../middlewares/auth/guards');
const { PERMISSIONS } = require('../../../constants/permissions');
const { ROLES } = require('../../../constants/roles');
const { resolveSchoolLms } = require('../middlewares/resolveSchoolLms');

const router = express.Router({ mergeParams: true });

const withLms = (guards) => [...guards, resolveSchoolLms()];

const lmsManage = protectedRoute({
  roles: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.TEACHER],
  permissions: [PERMISSIONS.LMS_MANAGE],
  tenant: {
    requireTenantId: false,
    roles: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.TEACHER],
  },
});
const lmsRead = protectedRoute({
  roles: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.TEACHER, ROLES.PARENT],
  permissions: [PERMISSIONS.LMS_READ],
});
const lmsWrite = protectedRoute({
  roles: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.TEACHER],
  permissions: [PERMISSIONS.LMS_WRITE],
  tenant: {
    requireTenantId: false,
    roles: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.TEACHER],
  },
});
const learner = protectedRoute({
  roles: [ROLES.PARENT],
  permissions: [PERMISSIONS.LMS_READ],
});

router.post(
  '/:schoolId/lms/courses',
  ...withLms(lmsManage),
  validateBody(validators.createCourseSchema),
  lmsController.createCourse
);
router.get(
  '/:schoolId/lms/courses',
  ...withLms(lmsRead),
  validateQuery(validators.paginationQuery),
  lmsController.listCourses
);
router.get(
  '/:schoolId/lms/courses/:courseId',
  ...withLms(lmsRead),
  validateParams(validators.courseIdParam),
  lmsController.getCourse
);
router.patch(
  '/:schoolId/lms/courses/:courseId',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  validateBody(validators.updateCourseSchema),
  lmsController.updateCourse
);
router.delete(
  '/:schoolId/lms/courses/:courseId',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  lmsController.deleteCourse
);
router.patch(
  '/:schoolId/lms/courses/:courseId/status',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  validateBody(validators.courseStatusSchema),
  lmsController.setCourseStatus
);

router.post(
  '/:schoolId/lms/courses/:courseId/enrollments',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  validateBody(validators.enrollStudentSchema),
  lmsController.enrollStudent
);

router.get(
  '/:schoolId/lms/courses/:courseId/chapters',
  ...withLms(lmsRead),
  validateParams(validators.courseIdParam),
  lmsController.listChapters
);
router.post(
  '/:schoolId/lms/courses/:courseId/chapters',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  validateBody(validators.createChapterSchema),
  lmsController.createChapter
);
router.patch(
  '/:schoolId/lms/courses/:courseId/chapters/reorder',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  validateBody(validators.reorderSchema),
  lmsController.reorderChapters
);
router.patch(
  '/:schoolId/lms/courses/:courseId/chapters/:chapterId',
  ...withLms(lmsManage),
  validateParams(validators.chapterIdParam),
  validateBody(validators.updateChapterSchema),
  lmsController.updateChapter
);
router.delete(
  '/:schoolId/lms/courses/:courseId/chapters/:chapterId',
  ...withLms(lmsManage),
  validateParams(validators.chapterIdParam),
  lmsController.deleteChapter
);

router.get(
  '/:schoolId/lms/courses/:courseId/lessons',
  ...withLms(lmsRead),
  validateParams(validators.courseIdParam),
  validateQuery(validators.paginationQuery),
  lmsController.listLessons
);
router.post(
  '/:schoolId/lms/courses/:courseId/lessons',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  validateBody(validators.createLessonSchema),
  lmsController.createLesson
);
router.patch(
  '/:schoolId/lms/courses/:courseId/lessons/reorder',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  validateBody(validators.reorderSchema),
  lmsController.reorderLessons
);
router.get(
  '/:schoolId/lms/courses/:courseId/lessons/:lessonId',
  ...withLms(lmsRead),
  validateParams(validators.lessonIdParam),
  lmsController.getLesson
);
router.patch(
  '/:schoolId/lms/courses/:courseId/lessons/:lessonId',
  ...withLms(lmsManage),
  validateParams(validators.lessonIdParam),
  validateBody(validators.updateLessonSchema),
  lmsController.updateLesson
);
router.delete(
  '/:schoolId/lms/courses/:courseId/lessons/:lessonId',
  ...withLms(lmsManage),
  validateParams(validators.lessonIdParam),
  lmsController.deleteLesson
);
router.post(
  '/:schoolId/lms/courses/:courseId/lessons/:lessonId/progress',
  ...withLms(learner),
  validateParams(validators.lessonIdParam),
  validateBody(validators.lessonProgressSchema),
  lmsController.updateLessonProgress
);

router.get(
  '/:schoolId/lms/courses/:courseId/assignments',
  ...withLms(lmsRead),
  validateParams(validators.courseIdParam),
  validateQuery(validators.assignmentListQuery),
  lmsController.listAssignments
);
router.post(
  '/:schoolId/lms/courses/:courseId/assignments',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  validateBody(validators.createAssignmentSchema),
  lmsController.createAssignment
);
router.patch(
  '/:schoolId/lms/courses/:courseId/assignments/:assignmentId',
  ...withLms(lmsManage),
  validateParams(validators.assignmentIdParam),
  validateBody(validators.updateAssignmentSchema),
  lmsController.updateAssignment
);
router.delete(
  '/:schoolId/lms/courses/:courseId/assignments/:assignmentId',
  ...withLms(lmsManage),
  validateParams(validators.assignmentIdParam),
  lmsController.deleteAssignment
);
router.post(
  '/:schoolId/lms/courses/:courseId/assignments/:assignmentId/submissions',
  ...withLms(learner),
  validateParams(validators.assignmentIdParam),
  validateBody(validators.submitAssignmentSchema),
  lmsController.submitAssignment
);
router.get(
  '/:schoolId/lms/courses/:courseId/assignments/:assignmentId/submissions/mine',
  ...withLms(learner),
  validateParams(validators.assignmentIdParam),
  validateQuery(validators.studentIdQuerySchema),
  lmsController.getMySubmission
);
router.get(
  '/:schoolId/lms/courses/:courseId/assignments/:assignmentId/submissions',
  ...withLms(lmsManage),
  validateParams(validators.assignmentIdParam),
  validateQuery(validators.paginationQuery),
  lmsController.listSubmissions
);
router.get(
  '/:schoolId/lms/courses/:courseId/assignments/:assignmentId/roster',
  ...withLms(lmsManage),
  validateParams(validators.assignmentIdParam),
  lmsController.getSubmissionRoster
);
router.patch(
  '/:schoolId/lms/courses/:courseId/assignments/:assignmentId/submissions/:submissionId/evaluate',
  ...withLms(lmsManage),
  validateParams(validators.submissionIdParam),
  validateBody(validators.evaluateSubmissionSchema),
  lmsController.evaluateSubmission
);
router.patch(
  '/:schoolId/lms/courses/:courseId/assignments/:assignmentId/submissions/:submissionId/return',
  ...withLms(lmsManage),
  validateParams(validators.submissionIdParam),
  validateBody(validators.returnSubmissionSchema),
  lmsController.returnSubmission
);

// Standalone Direct Homework Routes for Teachers & School Staff
router.get(
  '/:schoolId/lms/assignments',
  ...withLms(lmsRead),
  validateQuery(validators.assignmentListQuery),
  lmsController.listAssignments
);
router.post(
  '/:schoolId/lms/assignments',
  ...withLms(lmsManage),
  validateBody(validators.createAssignmentSchema),
  lmsController.createAssignment
);
router.get(
  '/:schoolId/lms/assignments/:assignmentId',
  ...withLms(lmsRead),
  validateParams(validators.directAssignmentIdParam),
  lmsController.getAssignment
);
router.patch(
  '/:schoolId/lms/assignments/:assignmentId',
  ...withLms(lmsManage),
  validateParams(validators.directAssignmentIdParam),
  validateBody(validators.updateAssignmentSchema),
  lmsController.updateAssignment
);
router.delete(
  '/:schoolId/lms/assignments/:assignmentId',
  ...withLms(lmsManage),
  validateParams(validators.directAssignmentIdParam),
  lmsController.deleteAssignment
);
router.get(
  '/:schoolId/lms/assignments/:assignmentId/roster',
  ...withLms(lmsManage),
  validateParams(validators.directAssignmentIdParam),
  lmsController.getSubmissionRoster
);
router.patch(
  '/:schoolId/lms/assignments/:assignmentId/submissions/:submissionId/evaluate',
  ...withLms(lmsManage),
  validateParams(validators.directSubmissionIdParam),
  validateBody(validators.evaluateSubmissionSchema),
  lmsController.evaluateSubmission
);
router.patch(
  '/:schoolId/lms/assignments/:assignmentId/submissions/:submissionId/return',
  ...withLms(lmsManage),
  validateParams(validators.directSubmissionIdParam),
  validateBody(validators.returnSubmissionSchema),
  lmsController.returnSubmission
);
router.post(
  '/:schoolId/lms/assignments/:assignmentId/submissions',
  ...withLms(learner),
  validateParams(validators.directAssignmentIdParam),
  validateBody(validators.submitAssignmentSchema),
  lmsController.submitAssignment
);
router.get(
  '/:schoolId/lms/assignments/:assignmentId/submissions/mine',
  ...withLms(learner),
  validateParams(validators.directAssignmentIdParam),
  validateQuery(validators.studentIdQuerySchema),
  lmsController.getMySubmission
);
router.get(
  '/:schoolId/lms/assignments/:assignmentId/submissions',
  ...withLms(lmsManage),
  validateParams(validators.directAssignmentIdParam),
  validateQuery(validators.paginationQuery),
  lmsController.listSubmissions
);

// The parent's homework feed. One call replaces a per-course + per-assignment fan-out,
// and section filtering happens server side so a child only ever sees their own work.
router.get(
  '/:schoolId/lms/homework',
  ...withLms(learner),
  validateQuery(validators.studentIdQuerySchema),
  lmsController.getStudentHomework
);

// Submitted work is not served statically. Every read goes through this authorization.
router.get(
  '/:schoolId/lms/submission-attachments/:attachmentId',
  ...withLms(lmsRead),
  validateParams(validators.attachmentIdParam),
  lmsController.streamSubmissionAttachment
);

router.get(
  '/:schoolId/lms/courses/:courseId/quizzes',
  ...withLms(lmsRead),
  validateParams(validators.courseIdParam),
  validateQuery(validators.paginationQuery),
  lmsController.listQuizzes
);
router.post(
  '/:schoolId/lms/courses/:courseId/quizzes',
  ...withLms(lmsManage),
  validateParams(validators.courseIdParam),
  validateBody(validators.createQuizSchema),
  lmsController.createQuiz
);
router.patch(
  '/:schoolId/lms/courses/:courseId/quizzes/:quizId',
  ...withLms(lmsManage),
  validateParams(validators.quizIdParam),
  validateBody(validators.updateQuizSchema),
  lmsController.updateQuiz
);
router.delete(
  '/:schoolId/lms/courses/:courseId/quizzes/:quizId',
  ...withLms(lmsManage),
  validateParams(validators.quizIdParam),
  lmsController.deleteQuiz
);
router.post(
  '/:schoolId/lms/courses/:courseId/quizzes/:quizId/attempts',
  ...withLms(learner),
  validateParams(validators.quizIdParam),
  lmsController.startQuizAttempt
);
router.post(
  '/:schoolId/lms/courses/:courseId/quizzes/:quizId/attempts/:attemptId/submit',
  ...withLms(learner),
  validateParams(validators.attemptIdParam),
  validateBody(validators.submitQuizSchema),
  lmsController.submitQuizAttempt
);
router.get(
  '/:schoolId/lms/courses/:courseId/quizzes/:quizId/attempts',
  ...withLms(lmsRead),
  validateParams(validators.quizIdParam),
  validateQuery(validators.paginationQuery),
  lmsController.getQuizAttempts
);

router.get(
  '/:schoolId/lms/courses/:courseId/progress',
  ...withLms(learner),
  validateParams(validators.courseIdParam),
  lmsController.getCourseProgress
);
router.get(
  '/:schoolId/lms/learning-history',
  ...withLms(learner),
  lmsController.getLearningHistory
);

router.post(
  '/:schoolId/lms/courses/:courseId/certificates',
  ...withLms(learner),
  validateParams(validators.courseIdParam),
  validateBody(validators.generateCertificateSchema),
  lmsController.generateCertificate
);
router.get(
  '/:schoolId/lms/certificates',
  ...withLms(lmsRead),
  validateQuery(validators.certificateQuerySchema),
  lmsController.listCertificates
);
router.get(
  '/:schoolId/lms/certificates/:certificateId',
  ...withLms(lmsRead),
  validateParams(validators.certificateIdParam),
  lmsController.getCertificate
);

router.post(
  '/:schoolId/lms/notes',
  ...withLms(learner),
  validateBody(validators.createNoteSchema),
  lmsController.createNote
);
router.get(
  '/:schoolId/lms/notes',
  ...withLms(learner),
  validateQuery(validators.paginationQuery),
  lmsController.listNotes
);
router.patch(
  '/:schoolId/lms/notes/:noteId',
  ...withLms(learner),
  validateParams(validators.noteIdParam),
  validateBody(validators.updateNoteSchema),
  lmsController.updateNote
);
router.delete(
  '/:schoolId/lms/notes/:noteId',
  ...withLms(learner),
  validateParams(validators.noteIdParam),
  lmsController.deleteNote
);

router.get(
  '/:schoolId/lms/courses/:courseId/lessons/:lessonId/comments',
  ...withLms(lmsRead),
  validateParams(validators.lessonIdParam),
  validateQuery(validators.paginationQuery),
  lmsController.listComments
);
router.post(
  '/:schoolId/lms/courses/:courseId/lessons/:lessonId/comments',
  ...withLms(lmsRead),
  validateParams(validators.lessonIdParam),
  validateBody(validators.createCommentSchema),
  lmsController.addComment
);
router.patch(
  '/:schoolId/lms/courses/:courseId/lessons/:lessonId/comments/:commentId',
  ...withLms(lmsRead),
  validateParams(validators.commentIdParam),
  validateBody(validators.updateCommentSchema),
  lmsController.updateComment
);
router.delete(
  '/:schoolId/lms/courses/:courseId/lessons/:lessonId/comments/:commentId',
  ...withLms(lmsRead),
  validateParams(validators.commentIdParam),
  lmsController.deleteComment
);
router.patch(
  '/:schoolId/lms/courses/:courseId/lessons/:lessonId/comments/:commentId/moderate',
  ...withLms(lmsManage),
  validateParams(validators.commentIdParam),
  validateBody(validators.moderateCommentSchema),
  lmsController.moderateComment
);

router.post(
  '/:schoolId/lms/bookmarks',
  ...withLms(learner),
  validateBody(validators.bookmarkSchema),
  lmsController.addBookmark
);
router.get(
  '/:schoolId/lms/bookmarks',
  ...withLms(learner),
  validateQuery(validators.paginationQuery),
  lmsController.listBookmarks
);
router.get(
  '/:schoolId/lms/bookmarks/resume',
  ...withLms(learner),
  lmsController.resumeLearning
);
router.delete(
  '/:schoolId/lms/bookmarks',
  ...withLms(learner),
  validateQuery(validators.bookmarkSchema),
  lmsController.removeBookmark
);

module.exports = router;
