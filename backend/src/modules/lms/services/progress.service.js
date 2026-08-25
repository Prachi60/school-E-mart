const { NotFoundError } = require('../../../common/errors');
const { progressRepository, enrollmentRepository } = require('../repositories/progress.repository');
const lessonRepository = require('../repositories/lesson.repository');
const chapterRepository = require('../repositories/chapter.repository');
const { assignmentSubmissionRepository } = require('../repositories/assignment.repository');
const { quizAttemptRepository } = require('../repositories/quiz.repository');
const LmsAssignment = require('../../../database/models/LmsAssignment');
const LmsQuiz = require('../../../database/models/LmsQuiz');

const progressService = {
  async enrollStudent(schoolId, courseId, { studentId, userId }) {
    const existing = await enrollmentRepository.findEnrollment(schoolId, courseId, studentId);
    if (existing) return existing;
    return enrollmentRepository.create({
      schoolId,
      courseId,
      studentId,
      userId,
      status: 'active',
    });
  },

  async markLessonComplete(userId, lessonId, courseId, progressPercent = 100) {
    const payload = {
      status: progressPercent >= 100 ? 'completed' : 'started',
      progressPercent: Math.min(100, Math.max(0, progressPercent)),
      completedAt: progressPercent >= 100 ? new Date() : null,
    };
    return progressRepository.upsertProgress(userId, lessonId, courseId, payload);
  },

  async updateLessonProgress(userId, schoolId, courseId, lessonId, payload, studentId) {
    const progress = await progressRepository.upsertProgress(userId, lessonId, courseId, {
      progressPercent: payload.progressPercent,
      lastPositionSec: payload.lastPositionSec,
      status: payload.progressPercent >= 100 ? 'completed' : 'started',
      completedAt: payload.progressPercent >= 100 ? new Date() : null,
    });

    if (studentId) {
      await this.recalculateCourseProgress(userId, schoolId, courseId, studentId);
    }
    return progress;
  },

  async getCourseProgress(userId, courseId) {
    const lessons = await lessonRepository.findByCourse(courseId, {
      status: 'published',
      visibility: 'visible',
    });
    const progressRecords = await progressRepository.findByUserAndCourse(userId, courseId);
    const completedLessonIds = new Set(
      progressRecords.filter((p) => p.status === 'completed').map((p) => String(p.lessonId))
    );

    const chapters = await chapterRepository.findMany({ courseId });
    const chapterProgress = chapters.map((chapter) => {
      const chapterLessons = lessons.filter((l) => String(l.chapterId) === String(chapter._id));
      const completed = chapterLessons.filter((l) => completedLessonIds.has(String(l._id))).length;
      const total = chapterLessons.length;
      return {
        chapterId: chapter._id,
        title: chapter.title,
        completedLessons: completed,
        totalLessons: total,
        percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      };
    });

    const totalLessons = lessons.length;
    const completedLessons = lessons.filter((l) => completedLessonIds.has(String(l._id))).length;
    const completionPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

    return {
      courseId,
      completedLessons,
      totalLessons,
      completionPercent,
      chapters: chapterProgress,
      lessons: progressRecords,
    };
  },

  async getLearningHistory(userId, schoolId, query) {
    const enrollments = await enrollmentRepository.findByUser(userId, query.status || 'active');
    const schoolEnrollments = enrollments.filter((e) => String(e.schoolId) === String(schoolId));
    const history = await Promise.all(
      schoolEnrollments.map(async (enrollment) => ({
        enrollment,
        progress: await this.getCourseProgress(userId, enrollment.courseId),
      }))
    );
    return history;
  },

  async recalculateCourseProgress(userId, schoolId, courseId, studentId) {
    if (!courseId) return null;
    const progress = await this.getCourseProgress(userId, courseId);

    const assignments = await LmsAssignment.find({
      schoolId,
      courseId,
      status: 'published',
      'softDelete.isDeleted': { $ne: true },
    }).lean();
    const submissions = await assignmentSubmissionRepository.findMany({ schoolId, studentId });
    const gradedAssignments = assignments.filter((a) =>
      submissions.some((s) => String(s.assignmentId) === String(a._id) && s.status === 'graded')
    );

    const quizzes = await LmsQuiz.find({
      schoolId,
      courseId,
      status: 'published',
      'softDelete.isDeleted': { $ne: true },
    }).lean();
    const passedQuizzes = [];
    for (const quiz of quizzes) {
      const attempt = await quizAttemptRepository.findLatestAttempt(quiz._id, studentId);
      if (attempt?.passed) passedQuizzes.push(quiz._id);
    }

    const lessonsComplete = progress.completionPercent >= 100;
    const assignmentsComplete =
      assignments.length === 0 || gradedAssignments.length === assignments.length;
    const quizzesComplete = quizzes.length === 0 || passedQuizzes.length === quizzes.length;

    if (lessonsComplete && assignmentsComplete && quizzesComplete) {
      const enrollment = await enrollmentRepository.findEnrollment(schoolId, courseId, studentId);
      if (enrollment) {
        await enrollmentRepository.updateById(enrollment._id, {
          $set: { status: 'completed', completedAt: new Date() },
        });
      }
      const certificateService = require('./certificate.service');
      await certificateService.issueIfEligible(
        schoolId,
        courseId,
        studentId,
        userId,
        progress.completionPercent
      );
    }

    return progress;
  },
};

module.exports = progressService;
