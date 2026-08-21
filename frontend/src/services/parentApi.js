import apiClient from './apiClient';
import { submitAssignment, getStudentHomework } from './lmsApi';

const extractRecords = (response) => response.data?.data?.records || [];

/**
 * A parent's attendance records. `studentId` only narrows the result — the server
 * already resolves which children belong to this parent — so a missing or stale one is
 * dropped rather than sent: the API rejects anything that is not an ObjectId, which
 * turned the whole attendance page into a 400 for parents whose stored id had gone bad.
 */
export const getAttendanceHistory = async (schoolId, { studentId, ...params } = {}) => {
  const id = asObjectId(studentId);
  const response = await apiClient.get(`/schools/${schoolId}/attendance/history`, {
    params: id ? { ...params, studentId: id } : params,
  });
  return {
    data: extractRecords(response),
    pagination: response.data?.pagination || null,
  };
};

// A studentId only ever comes from stored client state, so it can be stale or the
// literal strings "undefined"/"null". Sending one the API rejects turns the whole
// homework page into a 400; leaving it off just lets the server resolve the child.
const asObjectId = (value) =>
  /^[0-9a-fA-F]{24}$/.test(String(value || '')) ? String(value) : null;

/**
 * The server returns the child's homework already filtered to their class AND section,
 * with each submission joined on. Previously this walked every course and then every
 * assignment one request at a time, and — because it only ever filtered by grade — showed
 * a child the homework set for other sections.
 *
 * Resolves to `{ homework, canSubmit }`.
 */
export const fetchParentHomework = async (schoolId, gradeLabel, studentId) => {
  const id = asObjectId(studentId);
  return getStudentHomework(schoolId, id ? { studentId: id } : {});
};

export const listParentNotices = async (schoolId, params = {}) => {
  const response = await apiClient.get(`/schools/${schoolId}/notices`, { params });
  const { data, pagination } = response.data;
  return { data: data?.notices || [], pagination: pagination || null };
};

export const acknowledgeParentNotice = async (schoolId, noticeId, params = {}) => {
  const cleanParams = {};
  if (params?.studentId && params.studentId !== 'undefined' && params.studentId !== 'null') {
    cleanParams.studentId = params.studentId;
  }
  const response = await apiClient.post(
    `/schools/${schoolId}/notices/${noticeId}/acknowledge`,
    null,
    Object.keys(cleanParams).length ? { params: cleanParams } : undefined
  );
  return response.data?.data;
};

export const listParentDiary = async (schoolId, params = {}) => {
  const response = await apiClient.get(`/schools/${schoolId}/diary`, { params });
  const { data, pagination } = response.data;
  return { data: data?.entries || [], pagination: pagination || null };
};

export const markParentDiaryRead = async (schoolId, entryId, params = {}) => {
  const response = await apiClient.patch(`/schools/${schoolId}/diary/${entryId}/read`, null, { params });
  return response.data?.data?.entry;
};

export const submitHomework = async (schoolId, courseId, assignmentId, payload) => {
  const studentId = asObjectId(payload?.studentId);
  return submitAssignment(schoolId, courseId, assignmentId, {
    ...payload,
    ...(studentId ? { studentId } : { studentId: undefined }),
  });
};

export const getMyProfile = async () => {
  const response = await apiClient.get('/users/me');
  return response.data?.data;
};

export const updateMyProfile = async (payload) => {
  const response = await apiClient.patch('/users/me', payload);
  return response.data?.data;
};

// Switch the active linked child. Returns the fresh profile (childProfile +
// children) so the caller can re-sync childInfo for the whole app.
export const setActiveChild = async (childProfileId) => {
  const response = await apiClient.post('/users/me/active-child', { childProfileId });
  return response.data?.data;
};
