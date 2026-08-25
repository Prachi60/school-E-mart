const { Joi, schemas } = require('../../../common/validation');

const objectId = schemas.objectId;

// Base64 inflates the raw bytes by ~4/3, so a 5 MB file arrives as a ~6.8 MB string.
// This bound must stay above the writer's 5 MB decoded cap, or a file the writer would
// have accepted gets rejected here with a far less helpful message.
const MAX_BASE64_FILE_CHARS = 7 * 1024 * 1024;

const paginationQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().trim().optional(),
  fields: Joi.string().trim().optional(),
  search: Joi.string().trim().max(120).optional(),
});

// Listing homework is always scoped to a class, a section, a subject or a status —
// none of which paginationQuery declares. Because validation runs with
// `stripUnknown: true`, sending them against the bare pagination schema dropped every
// one of them without an error: the teacher's list silently answered with the whole
// school's homework (drafts and other grades included), and the controller's ownership
// check, which reads req.query.classGrade, had nothing left to refuse.
const assignmentListQuery = paginationQuery.keys({
  courseId: objectId.optional(),
  classGrade: Joi.string().trim().max(40).optional(),
  section: Joi.string().trim().max(20).optional(),
  subject: Joi.string().trim().max(100).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
});

const schoolIdParam = Joi.object({ schoolId: objectId.required() });
const courseIdParam = schoolIdParam.keys({ courseId: objectId.required() });
const chapterIdParam = courseIdParam.keys({ chapterId: objectId.required() });
const lessonIdParam = courseIdParam.keys({ lessonId: objectId.required() });
const assignmentIdParam = courseIdParam.keys({ assignmentId: objectId.required() });
const directAssignmentIdParam = schoolIdParam.keys({ assignmentId: objectId.required() });
const quizIdParam = courseIdParam.keys({ quizId: objectId.required() });
const submissionIdParam = assignmentIdParam.keys({ submissionId: objectId.required() });
const directSubmissionIdParam = directAssignmentIdParam.keys({ submissionId: objectId.required() });
const attemptIdParam = quizIdParam.keys({ attemptId: objectId.required() });
const commentIdParam = lessonIdParam.keys({ commentId: objectId.required() });
const noteIdParam = schoolIdParam.keys({ noteId: objectId.required() });
const certificateIdParam = schoolIdParam.keys({ certificateId: objectId.required() });

const createCourseSchema = Joi.object({
  title: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().max(5000).optional(),
  category: Joi.string().trim().optional(),
  subject: Joi.string().trim().optional(),
  gradeClass: Joi.string().trim().optional(),
  targetAudience: Joi.string().valid('parents', 'teachers', 'students', 'all').default('students'),
  instructorName: Joi.string().trim().optional(),
  instructorUserId: objectId.optional(),
  thumbnailId: objectId.optional(),
  thumbnailUrl: Joi.string().trim().max(2048).optional(),
  videoUrl: Joi.string().trim().max(2048).optional(),
  durationLabel: Joi.string().trim().max(40).optional(),
  tags: Joi.array().items(Joi.string().trim()).optional(),
  displayOrder: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
});

const updateCourseSchema = createCourseSchema.fork(['title'], (s) => s.optional());

const courseStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'published', 'archived').required(),
});

const createChapterSchema = Joi.object({
  title: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().max(3000).optional(),
  displayOrder: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('draft', 'published').optional(),
});

const updateChapterSchema = createChapterSchema.fork(['title'], (s) => s.optional());

const reorderSchema = Joi.object({
  orderedIds: Joi.array().items(objectId).min(1).required(),
});

const createLessonSchema = Joi.object({
  chapterId: objectId.optional(),
  title: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().max(5000).optional(),
  lessonType: Joi.string().valid('video', 'reading', 'quiz', 'assignment').default('video'),
  visibility: Joi.string().valid('visible', 'hidden').default('visible'),
  contentHtml: Joi.string().max(50000).optional(),
  videoId: objectId.optional(),
  durationSec: Joi.number().integer().min(0).optional(),
  resources: Joi.array().items(objectId).optional(),
  displayOrder: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid('draft', 'published').optional(),
});

const updateLessonSchema = createLessonSchema.fork(['title'], (s) => s.optional());

const createAssignmentSchema = Joi.object({
  courseId: objectId.allow('', null).optional(),
  chapterId: objectId.allow('', null).optional(),
  lessonId: objectId.allow('', null).optional(),
  title: Joi.string().trim().min(1).max(160).required(),
  description: Joi.string().trim().max(5000).allow('', null).optional(),
  instructions: Joi.string().trim().max(5000).allow('', null).optional(),
  dueDate: Joi.date().allow('', null).optional(),
  assignedDate: Joi.date().allow('', null).optional(),
  classGrade: Joi.string().trim().max(40).allow('', null).optional(),
  section: Joi.string().trim().max(20).allow('', null).optional(),
  subject: Joi.string().trim().max(100).allow('', null).optional(),
  homeworkType: Joi.string().valid('Written', 'Reading', 'Project', 'Online Quiz').allow('', null).optional(),
  priority: Joi.string().valid('High', 'Medium', 'Low').allow('', null).optional(),
  reference: Joi.object({
    textbook: Joi.string().trim().max(160).allow('', null).optional(),
    chapter: Joi.string().trim().max(160).allow('', null).optional(),
  }).allow(null).optional(),
  maxScore: Joi.number().min(0).default(100),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
  files: Joi.array().items(Joi.string().max(MAX_BASE64_FILE_CHARS)).max(5).optional(),
  bannerFile: Joi.string().max(MAX_BASE64_FILE_CHARS).allow('', null).optional(),
  removeBanner: Joi.boolean().optional(),
}).unknown(true);

const updateAssignmentSchema = createAssignmentSchema.fork(['title'], (s) => s.optional());

const submitAssignmentSchema = Joi.object({
  content: Joi.string().trim().max(10000).allow('').optional(),
  // Base64 data URIs of the completed work (photos/PDF). Kept small and few because
  // they are inlined in the request body.
  files: Joi.array().items(Joi.string().max(MAX_BASE64_FILE_CHARS)).max(5).optional(),
  studentId: objectId.optional(),
});

const evaluateSubmissionSchema = Joi.object({
  score: Joi.number().min(0).required(),
  // The teacher's actual choice, kept alongside the number so the letter shown back to
  // them is the one they picked rather than a re-derived approximation.
  letterGrade: Joi.string().trim().max(4).optional(),
  feedback: Joi.string().trim().max(3000).allow('').optional(),
});

const returnSubmissionSchema = Joi.object({
  feedback: Joi.string().trim().max(3000).required(),
});

const attachmentIdParam = schoolIdParam.keys({ attachmentId: objectId.required() });

const quizQuestionSchema = Joi.object({
  question: Joi.string().trim().required(),
  options: Joi.array().items(Joi.string().trim()).min(2).required(),
  correctIndex: Joi.number().integer().min(0).required(),
  points: Joi.number().min(0).default(1),
});

const createQuizSchema = Joi.object({
  lessonId: objectId.optional(),
  title: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().max(3000).optional(),
  passingScorePercent: Joi.number().min(0).max(100).default(60),
  timeLimitMin: Joi.number().integer().min(1).optional(),
  maxAttempts: Joi.number().integer().min(1).default(1),
  questions: Joi.array().items(quizQuestionSchema).default([]),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
});

const updateQuizSchema = createQuizSchema.fork(['title'], (s) => s.optional());

const submitQuizSchema = Joi.object({
  answers: Joi.array()
    .items(
      Joi.object({
        questionId: objectId.required(),
        selectedIndex: Joi.number().integer().min(0).required(),
      })
    )
    .required(),
  studentId: objectId.optional(),
});

const lessonProgressSchema = Joi.object({
  progressPercent: Joi.number().min(0).max(100).required(),
  lastPositionSec: Joi.number().integer().min(0).default(0),
  studentId: objectId.optional(),
});

const enrollStudentSchema = Joi.object({
  studentId: objectId.required(),
  userId: objectId.required(),
});

const createNoteSchema = Joi.object({
  courseId: objectId.optional(),
  lessonId: objectId.optional(),
  title: Joi.string().trim().max(120).optional(),
  content: Joi.string().trim().min(1).max(10000).required(),
});

const updateNoteSchema = createNoteSchema.fork(['content'], (s) => s.optional());

const createCommentSchema = Joi.object({
  text: Joi.string().trim().min(1).max(1000).required(),
  parentCommentId: objectId.optional(),
});

const updateCommentSchema = Joi.object({
  text: Joi.string().trim().min(1).max(1000).required(),
});

const moderateCommentSchema = Joi.object({
  moderationStatus: Joi.string().valid('visible', 'hidden', 'flagged').required(),
});

const bookmarkSchema = Joi.object({
  courseId: objectId.required(),
  lessonId: objectId.optional(),
  lastPositionSec: Joi.number().integer().min(0).default(0),
});

const generateCertificateSchema = Joi.object({
  studentId: objectId.optional(),
});

const certificateQuerySchema = paginationQuery.keys({
  courseId: objectId.optional(),
  studentId: objectId.optional(),
});

const studentIdQuerySchema = Joi.object({
  studentId: objectId.optional(),
});

module.exports = {
  paginationQuery,
  assignmentListQuery,
  schoolIdParam,
  courseIdParam,
  chapterIdParam,
  lessonIdParam,
  assignmentIdParam,
  directAssignmentIdParam,
  quizIdParam,
  submissionIdParam,
  directSubmissionIdParam,
  attemptIdParam,
  commentIdParam,
  noteIdParam,
  certificateIdParam,
  createCourseSchema,
  updateCourseSchema,
  courseStatusSchema,
  createChapterSchema,
  updateChapterSchema,
  reorderSchema,
  createLessonSchema,
  updateLessonSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  attachmentIdParam,
  submitAssignmentSchema,
  evaluateSubmissionSchema,
  returnSubmissionSchema,
  createQuizSchema,
  updateQuizSchema,
  submitQuizSchema,
  lessonProgressSchema,
  enrollStudentSchema,
  createNoteSchema,
  updateNoteSchema,
  createCommentSchema,
  updateCommentSchema,
  moderateCommentSchema,
  bookmarkSchema,
  generateCertificateSchema,
  certificateQuerySchema,
  studentIdQuerySchema,
};
