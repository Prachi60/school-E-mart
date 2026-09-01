import { formatOrderDateShort } from './orderMapper';

// The backend returns a computed `status` ('pending' | 'active' | 'suspended' |
// 'rejected'). 'rejected' is not a stored value: it is partnerStatus 'prospect'
// plus an inactive admin user, resolved server-side.
const STATUS_LABELS = {
  pending: 'Pending',
  active: 'Active',
  suspended: 'Suspended',
  rejected: 'Rejected',
};

// Older responses only carried the raw partnerStatus, so fall back to it.
const PARTNER_STATUS_FALLBACK = {
  prospect: 'pending',
  active: 'active',
  suspended: 'suspended',
};

const addressLine = (address = {}) =>
  [address.line1, address.line2, address.city, address.state, address.pinCode]
    .filter(Boolean)
    .join(', ');

export const mapAdminSchoolForList = (school) => {
  const address = school?.address || {};
  const partnerStatus = school?.partnerStatus || 'prospect';
  const status = school?.status || PARTNER_STATUS_FALLBACK[partnerStatus] || 'pending';

  return {
    mongoId: school?._id?.toString?.() || school?.id,
    // These feed the detail view as well as the table, so they stay raw ('' when
    // absent). Baking a placeholder in here means anything that later edits a
    // record has to strip it back out, and a missed field saves a literal dash.
    id: school?.schoolRefNo || '',
    name: school?.name || '',
    code: school?.code || '',
    principalName: school?.principalName || '',
    adminName: school?.adminName || '',
    adminEmail: school?.adminEmail || '',
    adminPhone: school?.adminPhone || '',

    address: {
      line1: address.line1 || '',
      line2: address.line2 || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || 'India',
      pinCode: address.pinCode || '',
    },
    addressLine: addressLine(address),
    city: address.city || '',
    state: address.state || '',

    academicYear: school?.academicYearCurrent || '',
    gradesOffered: school?.gradesOffered || [],
    gradesCount: school?.gradesOffered?.length || 0,
    classesCount: school?.sectionsConfig?.length || 0,

    status: STATUS_LABELS[status] || 'Pending',
    statusRaw: status,
    partnerStatus,
    // Approve/reject only make sense before a decision has been made.
    needsDecision: status === 'pending',

    parentStats: school?.parentStats || { total: 0, loggedIn: 0, neverLoggedIn: 0 },

    activityStats: school?.activityStats || {
      teacherStats: { total: 0, active: 0, activeToday: 0 },
      studentStats: { total: 0, active: 0, attendanceToday: false, lastAttendanceDate: null },
      dailyUsage: { status: 'inactive', label: 'Inactive', lastActivityAt: null, attendanceMarkedToday: false, noticeSentToday: false },
    },

    registeredOn: school?.audit?.createdAt
      ? formatOrderDateShort(school.audit.createdAt)
      : '',
    createdAt: school?.audit?.createdAt || null,
    raw: school,
  };
};
