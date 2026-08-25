import apiClient from './apiClient';
import { unwrapData } from '../utils/apiHelpers';

const lmsPath = (schoolId, suffix = '') => `/schools/${schoolId}/lms${suffix}`;

const extractPaginated = (response, key) => {
  const { data, pagination } = response.data;
  return {
    data: data?.[key] || [],
    pagination: pagination || null,
  };
};

export const listCourses = async (schoolId, params = {}) => {
  const response = await apiClient.get(lmsPath(schoolId, '/courses'), { params });
  return extractPaginated(response, 'courses');
};

export const createCourse = async (schoolId, payload) => {
  const response = await apiClient.post(lmsPath(schoolId, '/courses'), payload);
  return unwrapData(response)?.course;
};

export const updateCourse = async (schoolId, courseId, payload) => {
  const response = await apiClient.patch(lmsPath(schoolId, `/courses/${courseId}`), payload);
  return unwrapData(response)?.course;
};

export const listDirectAssignments = async (schoolId, params = {}) => {
  const response = await apiClient.get(lmsPath(schoolId, '/assignments'), { params });
  return extractPaginated(response, 'assignments');
};

export const createDirectAssignment = async (schoolId, payload) => {
  const response = await apiClient.post(lmsPath(schoolId, '/assignments'), payload);
  return unwrapData(response)?.assignment;
};

export const updateDirectAssignment = async (schoolId, assignmentId, payload) => {
  const response = await apiClient.patch(lmsPath(schoolId, `/assignments/${assignmentId}`), payload);
  return unwrapData(response)?.assignment;
};

export const deleteDirectAssignment = async (schoolId, assignmentId) => {
  const response = await apiClient.delete(lmsPath(schoolId, `/assignments/${assignmentId}`));
  return unwrapData(response);
};

export const getDirectSubmissionRoster = async (schoolId, assignmentId) => {
  const response = await apiClient.get(lmsPath(schoolId, `/assignments/${assignmentId}/roster`));
  const data = unwrapData(response);
  return { assignment: data?.assignment || null, roster: data?.roster || [] };
};

export const listAssignments = async (schoolId, courseId, params = {}) => {
  if (!courseId) return listDirectAssignments(schoolId, params);
  const response = await apiClient.get(lmsPath(schoolId, `/courses/${courseId}/assignments`), { params });
  return extractPaginated(response, 'assignments');
};

export const createAssignment = async (schoolId, courseIdOrPayload, payloadArg) => {
  if (typeof courseIdOrPayload === 'object' && courseIdOrPayload !== null) {
    return createDirectAssignment(schoolId, courseIdOrPayload);
  }
  if (!courseIdOrPayload) return createDirectAssignment(schoolId, payloadArg);
  const response = await apiClient.post(lmsPath(schoolId, `/courses/${courseIdOrPayload}/assignments`), payloadArg);
  return unwrapData(response)?.assignment;
};

// Both of these are called in two shapes — (schoolId, assignmentId, ...) for homework
// that hangs off no course, and (schoolId, courseId, assignmentId, ...) for homework
// that does. Choosing the shape on argument count alone was not enough: homework set
// from the teacher app has no course, so callers that always pass a courseId slot sent
// a literal `/courses/undefined/...`, which fails param validation with a 400. The
// course-scoped path is taken only when there is an actual course id to put in it —
// the same guard submitAssignment and evaluateSubmission already apply.
export const updateAssignment = async (schoolId, courseIdOrAssignmentId, assignmentIdOrPayload, payloadArg) => {
  if (payloadArg !== undefined) {
    if (!courseIdOrAssignmentId) {
      return updateDirectAssignment(schoolId, assignmentIdOrPayload, payloadArg);
    }
    const response = await apiClient.patch(
      lmsPath(schoolId, `/courses/${courseIdOrAssignmentId}/assignments/${assignmentIdOrPayload}`),
      payloadArg
    );
    return unwrapData(response)?.assignment;
  }
  return updateDirectAssignment(schoolId, courseIdOrAssignmentId, assignmentIdOrPayload);
};

export const deleteAssignment = async (schoolId, courseIdOrAssignmentId, optionalAssignmentId) => {
  if (optionalAssignmentId) {
    if (!courseIdOrAssignmentId) {
      return deleteDirectAssignment(schoolId, optionalAssignmentId);
    }
    const response = await apiClient.delete(
      lmsPath(schoolId, `/courses/${courseIdOrAssignmentId}/assignments/${optionalAssignmentId}`)
    );
    return unwrapData(response);
  }
  return deleteDirectAssignment(schoolId, courseIdOrAssignmentId);
};

export const submitAssignment = async (schoolId, courseId, assignmentId, payload) => {
  const actualAssignmentId = assignmentId || courseId;
  const actualPayload = payload !== undefined ? payload : assignmentId;
  const url = (courseId && assignmentId)
    ? lmsPath(schoolId, `/courses/${courseId}/assignments/${assignmentId}/submissions`)
    : lmsPath(schoolId, `/assignments/${actualAssignmentId}/submissions`);
  const response = await apiClient.post(url, actualPayload);
  return unwrapData(response)?.submission;
};

export const listSubmissions = async (schoolId, courseId, assignmentId, params = {}) => {
  const actualAssignmentId = assignmentId || courseId;
  const actualParams = typeof assignmentId === 'object' ? assignmentId : params;
  const url = (courseId && assignmentId && typeof assignmentId !== 'object')
    ? lmsPath(schoolId, `/courses/${courseId}/assignments/${assignmentId}/submissions`)
    : lmsPath(schoolId, `/assignments/${actualAssignmentId}/submissions`);
  const response = await apiClient.get(url, { params: actualParams });
  return extractPaginated(response, 'submissions');
};

export const getMySubmission = async (schoolId, courseId, assignmentId, params = {}) => {
  const actualAssignmentId = assignmentId || courseId;
  const actualParams = typeof assignmentId === 'object' ? assignmentId : params;
  const url = (courseId && assignmentId && typeof assignmentId !== 'object')
    ? lmsPath(schoolId, `/courses/${courseId}/assignments/${assignmentId}/submissions/mine`)
    : lmsPath(schoolId, `/assignments/${actualAssignmentId}/submissions/mine`);
  const response = await apiClient.get(url, { params: actualParams });
  return unwrapData(response)?.submission || null;
};

export const evaluateSubmission = async (schoolId, courseId, assignmentId, submissionId, payload) => {
  const url = (courseId && assignmentId)
    ? lmsPath(schoolId, `/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/evaluate`)
    : lmsPath(schoolId, `/assignments/${assignmentId}/submissions/${submissionId}/evaluate`);
  const response = await apiClient.patch(url, payload);
  return unwrapData(response)?.submission;
};

export const returnSubmission = async (schoolId, courseId, assignmentId, submissionId, payload) => {
  const url = (courseId && assignmentId)
    ? lmsPath(schoolId, `/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/return`)
    : lmsPath(schoolId, `/assignments/${assignmentId}/submissions/${submissionId}/return`);
  const response = await apiClient.patch(url, payload);
  return unwrapData(response)?.submission;
};

/**
 * Every student the homework was set for, each with their submission or null.
 * Server-side join, so names and roll numbers are always resolved and no student is
 * lost to a page limit.
 */
export const getSubmissionRoster = async (schoolId, courseId, assignmentId) => {
  const actualAssignmentId = assignmentId || courseId;
  const url = (courseId && assignmentId)
    ? lmsPath(schoolId, `/courses/${courseId}/assignments/${assignmentId}/roster`)
    : lmsPath(schoolId, `/assignments/${actualAssignmentId}/roster`);
  const response = await apiClient.get(url);
  const data = unwrapData(response);
  return { assignment: data?.assignment || null, roster: data?.roster || [] };
};

/** All published homework for one student, already filtered to their class AND section. */
/**
 * Returns `{ homework, canSubmit, student }`. `canSubmit` is false when the school has
 * not yet linked the child to a roster student — the class's homework is still
 * readable, only handing work in needs the link. `student` carries the class the feed
 * was built for, so an empty list can name it instead of looking like a fault.
 */
export const getStudentHomework = async (schoolId, params = {}) => {
  const response = await apiClient.get(lmsPath(schoolId, '/homework'), { params });
  const data = unwrapData(response);
  return {
    homework: data?.homework || [],
    canSubmit: data?.canSubmit !== false,
    student: data?.student || null,
  };
};

/**
 * Submitted work is not public. It is fetched through an authorized endpoint, so the
 * browser must send credentials rather than pointing an <img> at a static path.
 */
export const fetchSubmissionAttachment = async (schoolId, attachmentId) => {
  const response = await apiClient.get(
    lmsPath(schoolId, `/submission-attachments/${attachmentId}`),
    { responseType: 'blob' }
  );
  return URL.createObjectURL(response.data);
};

export const getLearningHistory = async (schoolId, params = {}) => {
  const response = await apiClient.get(lmsPath(schoolId, '/learning-history'), { params });
  return extractPaginated(response, 'history');
};

export const getResumeBookmark = async (schoolId, params = {}) => {
  const response = await apiClient.get(lmsPath(schoolId, '/bookmarks/resume'), { params });
  return unwrapData(response)?.bookmark || null;
};

export const listLessons = async (schoolId, courseId, params = {}) => {
  const response = await apiClient.get(lmsPath(schoolId, `/courses/${courseId}/lessons`), { params });
  return extractPaginated(response, 'lessons');
};

export const getCourseProgress = async (schoolId, courseId, params = {}) => {
  const response = await apiClient.get(lmsPath(schoolId, `/courses/${courseId}/progress`), { params });
  return unwrapData(response)?.progress || null;
};

/**
 * Record how far a learner got through a lesson. progressPercent is required by
 * the server; pass 100 to complete it.
 */
export const updateLessonProgress = async (schoolId, courseId, lessonId, payload) => {
  const response = await apiClient.post(
    lmsPath(schoolId, `/courses/${courseId}/lessons/${lessonId}/progress`),
    payload
  );
  return unwrapData(response)?.progress || null;
};
