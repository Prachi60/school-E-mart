import { toAbsoluteUrl } from '../url';
import { attachmentFileName } from '../fileUpload';

export const parseClassGrade = (label = '') => {
  const trimmed = String(label).trim();
  if (/^class\s+/i.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `Class ${trimmed}`;
  return trimmed;
};

// classGrade is free text across the app ("5", "Class 5", "class  5"), so any grade
// comparison must go through this rather than string equality or (worse) substring
// matching — "Class 1".includes-style checks also match "Class 10/11/12".
export const normalizeGrade = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/class/g, '')
    .replace(/\s+/g, '')
    .trim();

export const parseSection = (label = '') =>
  String(label).replace(/^section\s*/i, '').trim().toUpperCase();

export const mapStudentForTeacherManage = (student) => {
  const firstParentProfile = (Array.isArray(student?.parentProfileIds) && student.parentProfileIds.length > 0)
    ? student.parentProfileIds[0]
    : (typeof student?.parentProfileIds === 'object' ? student.parentProfileIds : null);

  const parentUser = (firstParentProfile && typeof firstParentProfile.userId === 'object') 
    ? firstParentProfile.userId 
    : (student?.parentUserId && typeof student.parentUserId === 'object' ? student.parentUserId : (student?.parent || {}));

  const pName = parentUser?.name || student?.parentName || student?.fatherName || '—';
  const pPhone = parentUser?.phone || student?.parentPhone || student?.phone || '—';
  const pAltPhone = firstParentProfile?.altPhone || parentUser?.altPhone || student?.altPhone || '—';
  const pMotherName = student?.motherName || '—';

  return {
    id: student?._id?.toString?.() || student?.id,
    mongoId: student?._id?.toString?.() || student?.id,
    rollNo: student?.rollNo || '—',
    name: student?.name || '—',
    parentName: pName,
    fatherName: pName,
    motherName: pMotherName,
    phone: pPhone,
    altPhone: pAltPhone,
    gender: student?.gender === 'female' ? 'Female' : student?.gender === 'male' ? 'Male' : (student?.gender || '—'),
    dob: student?.dob ? new Date(student.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    admissionNo: student?.schoolRefNo || student?.studentId || '—',
    classGrade: student?.classGrade || '—',
    section: student?.section || '—',
    raw: student,
  };
};

// A student with no record yet is UNMARKED, never Present. Defaulting to 'P' meant
// saving an untouched roster silently recorded the whole class present.
export const UNMARKED = 'U';

// These two maps must stay exact inverses. When they were not, loading a day marked
// 'holiday' and saving it again rewrote it as 'leave'.
const UI_TO_API_STATUS = {
  P: 'present',
  A: 'absent',
  L: 'leave',
  Late: 'late',
  Half: 'half_day',
  H: 'holiday',
};

const API_TO_UI_STATUS = {
  present: 'P',
  absent: 'A',
  leave: 'L',
  late: 'Late',
  half_day: 'Half',
  holiday: 'H',
};

// The roster only offers P/A/L/Late. 'Half' and 'H' can arrive from records made
// elsewhere; they are shown read-only so re-saving a day cannot silently rewrite them.
export const MARKABLE_UI_STATUSES = ['P', 'A', 'L', 'Late'];

export const mapAttendanceRow = (row) => ({
  id: row?.student?._id?.toString?.(),
  mongoId: row?.student?._id?.toString?.(),
  // rollNo is optional, so it is display-only — never an identity. Rows are keyed by id.
  roll: row?.student?.rollNo || '—',
  name: row?.student?.name || 'Student',
  avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(row?.student?.name || 'S')}&background=3b2d7d&color=fff`,
  status: API_TO_UI_STATUS[row?.attendance?.status] || UNMARKED,
  statusRaw: row?.attendance?.status || null,
  raw: row,
});

export const mapUiStatusToApi = (status) => UI_TO_API_STATUS[status] || null;

export const mapAssignmentForHomework = (assignment, course) => ({
  id: assignment?._id?.toString?.(),
  mongoId: assignment?._id?.toString?.(),
  courseId: assignment?.courseId?.toString?.() || course?._id?.toString?.() || course?.id,
  title: assignment?.title,
  subject: assignment?.subject || course?.subject || 'General',
  classGrade: assignment?.classGrade || course?.gradeClass || '',
  section: assignment?.section || '',
  dateAssigned: assignment?.assignedDate || assignment?.audit?.createdAt || assignment?.createdAt,
  dueDate: assignment?.dueDate,
  type: assignment?.homeworkType || 'Written',
  priority: assignment?.priority || null,
  maxScore: assignment?.maxScore ?? 100,
  // The card thumbnail — a real field on the assignment now, never guessed at from the
  // attachment list, so it can't collide with or duplicate a reference attachment.
  bannerAttachmentId:
    assignment?.bannerAttachmentId?._id?.toString?.() ||
    assignment?.bannerAttachmentId?.toString?.() ||
    null,
  attachments: (assignment?.attachments || []).map((attachment, idx) => ({
    id: attachment?._id?.toString?.() || attachment?.toString?.(),
    name: attachmentFileName(attachment?.mime, idx),
    mime: attachment?.mime || '',
    isImage: String(attachment?.mime || '').startsWith('image/'),
  })),
  raw: assignment,
});

// The teacher grades with letters but the API stores a numeric score, so map back
// to the nearest letter for display and to preselect the grade buttons.
const SCORE_TO_GRADE = [
  [95, 'A+'],
  [90, 'A'],
  [85, 'B+'],
  [80, 'B'],
  [70, 'C'],
  [60, 'D'],
];

export const scoreToGrade = (score) => {
  if (score == null) return '';
  const match = SCORE_TO_GRADE.find(([min]) => Number(score) >= min);
  return match ? match[1] : 'F';
};

/**
 * Map one roster row — a student plus their submission, or null if they have not handed
 * anything in. The server does the join, so the name and roll number are always present
 * rather than depending on a client-side lookup that could miss.
 */
export const mapRosterRowForCheck = ({ student, submission }) => {
  const status = submission?.status;
  const graded = status === 'graded';
  const returned = status === 'returned';
  const submitted = status === 'submitted';

  // Submitted work is private: it is fetched through an authorized endpoint by id, not
  // linked to as a static URL.
  const files = (submission?.attachments || []).map((attachment, idx) => ({
    id: attachment?._id?.toString?.(),
    name: attachmentFileName(attachment?.mime, idx),
    mime: attachment?.mime || '',
    isImage: String(attachment?.mime || '').startsWith('image/'),
    kind: attachment?.mime === 'application/pdf' ? 'pdf' : 'image',
  }));

  // Submissions made before attachments became Attachment records still hold raw public
  // paths. Keep reading them so old homework does not appear to have lost its files.
  const legacyFiles = (submission?.attachmentUrls || []).map((url, idx) => {
    const name = url.split('/').pop() || `Attachment ${idx + 1}`;
    const isImage = /\.(png|jpe?g|webp|gif)$/i.test(name);
    return {
      id: null,
      name,
      url: toAbsoluteUrl(url),
      isImage,
      kind: isImage ? 'image' : /\.pdf$/i.test(name) ? 'pdf' : 'file',
      legacy: true,
    };
  });

  let displayStatus = 'Not Submitted';
  if (graded) displayStatus = 'Checked';
  else if (returned) displayStatus = 'Returned';
  else if (submitted) displayStatus = 'Submitted';

  return {
    roll: Number(student?.rollNo) || 0,
    mongoId: submission?._id?.toString?.() || null,
    studentId: student?._id?.toString?.(),
    name: student?.name || 'Student',
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(student?.name || 'S')}&background=3b2d7d&color=fff`,
    status: displayStatus,
    isLate: Boolean(submission?.isLate),
    submittedAt: submission?.submittedAt
      ? new Date(submission.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : null,
    files: [...files, ...legacyFiles],
    content: submission?.content || '',
    score: submission?.score ?? null,
    // Prefer the letter the teacher actually chose over one re-derived from the score.
    grade: submission?.letterGrade || scoreToGrade(submission?.score),
    remarks: submission?.feedback || '',
    raw: submission,
  };
};
