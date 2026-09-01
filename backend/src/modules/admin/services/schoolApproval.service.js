const { NotFoundError, BadRequestError } = require('../../../common/errors');
const schoolRepository = require('../../school/repositories/school.repository');
const schoolService = require('../../school/services/school.service');
const schoolAdminRegistrationService = require('../../school/services/schoolAdminRegistration.service');
const auditRepository = require('../../auth/repositories/audit.repository');
const reportRepository = require('../repositories/report.repository');
const logger = require('../../../common/logger');
const emailService = require('../../../common/email');
const User = require('../../../database/models/User');
const { runAtomic } = require('../../orders/utils/atomic');
const { mapSchoolDisplayStatus } = require('../../school/utils/status');

const SCHOOL_ACTIONS = ['school.approved', 'school.rejected', 'school.suspended', 'school.reactivated'];

/** The admin User owns the contact details and the status that distinguishes rejected from pending. */
const findAdminUser = (schoolId) =>
  User.findOne({ tenantSchoolId: schoolId, role: 'school' })
    .sort({ 'audit.createdAt': 1 })
    .lean();

/**
 * Efficiently computes total, loggedIn, and neverLoggedIn parent counts for a set of school IDs.
 */
const getParentStatsBySchoolIds = async (schoolIds) => {
  if (!schoolIds || !schoolIds.length) return new Map();

  const ChildProfile = require('../../../database/models/ChildProfile');
  const Student = require('../../../database/models/Student');
  const ParentProfile = require('../../../database/models/ParentProfile');
  const User = require('../../../database/models/User');

  // 1. Find parentUserIds via ChildProfile for each school
  const childProfiles = await ChildProfile.find({
    schoolId: { $in: schoolIds },
    'softDelete.isDeleted': { $ne: true },
  }).select('schoolId parentUserId').lean();

  const schoolParentUserMap = new Map();
  schoolIds.forEach((id) => schoolParentUserMap.set(String(id), new Set()));

  childProfiles.forEach((cp) => {
    if (cp.schoolId && cp.parentUserId) {
      const sId = String(cp.schoolId);
      if (schoolParentUserMap.has(sId)) {
        schoolParentUserMap.get(sId).add(String(cp.parentUserId));
      }
    }
  });

  // 2. Find parentUserIds via Student.parentProfileIds -> ParentProfile.userId
  const students = await Student.find({
    schoolId: { $in: schoolIds },
    'softDelete.isDeleted': { $ne: true },
  }).select('schoolId parentProfileIds').lean();

  const parentProfileIds = [];
  const schoolByParentProfileId = new Map();
  students.forEach((s) => {
    (s.parentProfileIds || []).forEach((pid) => {
      const pidStr = String(pid);
      parentProfileIds.push(pid);
      if (!schoolByParentProfileId.has(pidStr)) {
        schoolByParentProfileId.set(pidStr, new Set());
      }
      schoolByParentProfileId.get(pidStr).add(String(s.schoolId));
    });
  });

  if (parentProfileIds.length) {
    const parentProfiles = await ParentProfile.find({
      _id: { $in: parentProfileIds },
      'softDelete.isDeleted': { $ne: true },
    }).select('_id userId').lean();

    parentProfiles.forEach((pp) => {
      const pidStr = String(pp._id);
      const uIdStr = String(pp.userId);
      const sIds = schoolByParentProfileId.get(pidStr);
      if (sIds) {
        sIds.forEach((sId) => {
          if (schoolParentUserMap.has(sId)) {
            schoolParentUserMap.get(sId).add(uIdStr);
          }
        });
      }
    });
  }

  const allUserIdsFromLinks = new Set();
  schoolParentUserMap.forEach((userSet) => {
    userSet.forEach((uId) => allUserIdsFromLinks.add(uId));
  });

  // 3. Fetch all matching parent Users (either by tenantSchoolId or linked ID)
  const parentUsers = await User.find({
    role: 'parent',
    'softDelete.isDeleted': { $ne: true },
    $or: [
      { tenantSchoolId: { $in: schoolIds } },
      ...(allUserIdsFromLinks.size > 0 ? [{ _id: { $in: Array.from(allUserIdsFromLinks) } }] : []),
    ],
  }).select('_id tenantSchoolId loginCount lastLoginAt').lean();

  const statsMap = new Map();
  schoolIds.forEach((id) => {
    statsMap.set(String(id), { total: 0, loggedIn: 0, neverLoggedIn: 0 });
  });

  parentUsers.forEach((u) => {
    const uIdStr = String(u._id);
    const isLoggedIn = (u.loginCount > 0) || Boolean(u.lastLoginAt);

    const targetSchools = new Set();
    if (u.tenantSchoolId) {
      targetSchools.add(String(u.tenantSchoolId));
    }

    schoolParentUserMap.forEach((userSet, sId) => {
      if (userSet.has(uIdStr)) {
        targetSchools.add(sId);
      }
    });

    targetSchools.forEach((sId) => {
      if (statsMap.has(sId)) {
        const stats = statsMap.get(sId);
        stats.total += 1;
        if (isLoggedIn) {
          stats.loggedIn += 1;
        } else {
          stats.neverLoggedIn += 1;
        }
      }
    });
  });

  return statsMap;
};

/**
 * Computes teacher stats, student stats, attendance today, and daily platform usage status for school IDs.
 */
const getActivityStatsBySchoolIds = async (schoolIds) => {
  const statsMap = new Map();
  if (!schoolIds || !schoolIds.length) return statsMap;

  schoolIds.forEach((id) => {
    statsMap.set(String(id), {
      teacherStats: { total: 0, active: 0, activeToday: 0 },
      studentStats: { total: 0, active: 0, attendanceToday: false, lastAttendanceDate: null },
      dailyUsage: { status: 'inactive', label: 'Inactive', lastActivityAt: null, attendanceMarkedToday: false, noticeSentToday: false },
    });
  });

  const TeacherProfile = require('../../../database/models/TeacherProfile');
  const Student = require('../../../database/models/Student');
  const AttendanceRecord = require('../../../database/models/AttendanceRecord');
  const Notice = require('../../../database/models/Notice');
  const User = require('../../../database/models/User');

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // 1. Fetch Teachers per School
  const teachers = await TeacherProfile.find({
    schoolId: { $in: schoolIds },
    'softDelete.isDeleted': { $ne: true },
  }).select('schoolId approvalStatus userId').lean();

  const teacherUserIds = teachers.map((t) => t.userId).filter(Boolean);

  let teacherUsersMap = new Map();
  if (teacherUserIds.length) {
    const teacherUsers = await User.find({
      _id: { $in: teacherUserIds },
      'softDelete.isDeleted': { $ne: true },
    }).select('_id lastLoginAt').lean();
    teacherUsersMap = new Map(teacherUsers.map((u) => [String(u._id), u.lastLoginAt]));
  }

  teachers.forEach((t) => {
    const sId = String(t.schoolId);
    if (!statsMap.has(sId)) return;
    const stats = statsMap.get(sId);
    stats.teacherStats.total += 1;
    if (t.approvalStatus === 'approved') {
      stats.teacherStats.active += 1;
    }
    const lastLogin = teacherUsersMap.get(String(t.userId));
    if (lastLogin && new Date(lastLogin) >= startOfToday) {
      stats.teacherStats.activeToday += 1;
    }
  });

  // 2. Fetch Students per School
  const students = await Student.find({
    schoolId: { $in: schoolIds },
    'softDelete.isDeleted': { $ne: true },
  }).select('schoolId status').lean();

  students.forEach((s) => {
    const sId = String(s.schoolId);
    if (!statsMap.has(sId)) return;
    const stats = statsMap.get(sId);
    stats.studentStats.total += 1;
    if (s.status === 'active') {
      stats.studentStats.active += 1;
    }
  });

  // 3. Fetch Attendance Records for today and last activity
  const attendanceRecords = await AttendanceRecord.find({
    schoolId: { $in: schoolIds },
  }).select('schoolId date audit').sort({ date: -1 }).lean();

  attendanceRecords.forEach((att) => {
    const sId = String(att.schoolId);
    if (!statsMap.has(sId)) return;
    const stats = statsMap.get(sId);
    const attDate = new Date(att.date || att.audit?.createdAt);
    if (attDate >= startOfToday) {
      stats.studentStats.attendanceToday = true;
      stats.dailyUsage.attendanceMarkedToday = true;
    }
    if (!stats.studentStats.lastAttendanceDate || attDate > new Date(stats.studentStats.lastAttendanceDate)) {
      stats.studentStats.lastAttendanceDate = attDate;
    }
  });

  // 4. Fetch Notices for today
  const recentNotices = await Notice.find({
    schoolId: { $in: schoolIds },
    publishDate: { $gte: sevenDaysAgo },
  }).select('schoolId publishDate audit').lean();

  recentNotices.forEach((notice) => {
    const sId = String(notice.schoolId);
    if (!statsMap.has(sId)) return;
    const stats = statsMap.get(sId);
    const pubDate = new Date(notice.publishDate || notice.audit?.createdAt);
    if (pubDate >= startOfToday) {
      stats.dailyUsage.noticeSentToday = true;
    }
  });

  // 5. Finalize Daily Usage Status for each school
  statsMap.forEach((stats) => {
    const hasTodayActivity = stats.dailyUsage.attendanceMarkedToday || stats.dailyUsage.noticeSentToday || stats.teacherStats.activeToday > 0;
    const lastAtt = stats.studentStats.lastAttendanceDate ? new Date(stats.studentStats.lastAttendanceDate) : null;
    const hasWeekActivity = hasTodayActivity || (lastAtt && lastAtt >= sevenDaysAgo);

    if (hasTodayActivity) {
      stats.dailyUsage.status = 'active_today';
      stats.dailyUsage.label = 'Active Today';
    } else if (hasWeekActivity) {
      stats.dailyUsage.status = 'active_week';
      stats.dailyUsage.label = 'Active This Week';
    } else {
      stats.dailyUsage.status = 'inactive';
      stats.dailyUsage.label = 'Inactive';
    }
    stats.dailyUsage.lastActivityAt = lastAtt;
  });

  return statsMap;
};

/**
 * Resolves each school's admin user in one query and folds in the computed
 * display status plus the contact fields the admin table needs. Without this the
 * list has no phone number and cannot tell a rejected school from a pending one.
 */
const decorateSchools = async (schools) => {
  if (!schools.length) return schools;

  const ids = schools.map((s) => s._id).filter(Boolean);
  const [admins, parentStatsMap, activityStatsMap] = await Promise.all([
    User.find({ tenantSchoolId: { $in: ids }, role: 'school' })
      .sort({ 'audit.createdAt': 1 })
      .lean(),
    getParentStatsBySchoolIds(ids),
    getActivityStatsBySchoolIds(ids),
  ]);

  // First admin per school wins, matching findAdminUser's ordering.
  const bySchool = new Map();
  admins.forEach((admin) => {
    const key = String(admin.tenantSchoolId);
    if (!bySchool.has(key)) bySchool.set(key, admin);
  });

  return schools.map((school) => {
    const admin = bySchool.get(String(school._id)) || {};
    const parentStats = parentStatsMap.get(String(school._id)) || { total: 0, loggedIn: 0, neverLoggedIn: 0 };
    const activityStats = activityStatsMap.get(String(school._id)) || {
      teacherStats: { total: 0, active: 0, activeToday: 0 },
      studentStats: { total: 0, active: 0, attendanceToday: false, lastAttendanceDate: null },
      dailyUsage: { status: 'inactive', label: 'Inactive', lastActivityAt: null, attendanceMarkedToday: false, noticeSentToday: false },
    };

    return {
      ...school,
      status: mapSchoolDisplayStatus(school, admin),
      adminName: admin.name || null,
      adminPhone: admin.phone || null,
      adminEmail: school.adminEmail || admin.email || null,
      adminUserStatus: admin.status || null,
      parentStats,
      activityStats,
    };
  });
};

/**
 * 'pending' and 'rejected' are both partnerStatus 'prospect' — they differ only by
 * the admin user's status, which lives in another collection. Narrow by school id
 * first so the difference can be expressed as an ordinary School filter.
 */
const applyDisplayStatusFilter = async (filter, status) => {
  if (status === 'active' || status === 'suspended') {
    return { ...filter, partnerStatus: status };
  }
  if (status !== 'pending' && status !== 'rejected') return filter;

  const admins = await User.find({ role: 'school', status: 'inactive' }, { tenantSchoolId: 1 }).lean();
  const rejectedIds = admins.map((a) => a.tenantSchoolId).filter(Boolean);

  return {
    ...filter,
    partnerStatus: 'prospect',
    _id: status === 'rejected' ? { $in: rejectedIds } : { $nin: rejectedIds },
  };
};

const buildSearchFilter = (query) => {
  const filter = {};
  if (query.search || query.q) {
    const term = query.search || query.q;
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { code: { $regex: term, $options: 'i' } },
      { schoolRefNo: { $regex: term, $options: 'i' } },
      { adminEmail: { $regex: term, $options: 'i' } },
    ];
  }
  return filter;
};

/**
 * ApiFeatures turns every unrecognised query param into a Mongo filter, so
 * forwarding these would add e.g. `{ status: 'all' }` to a School query — and
 * School has no `status` field, so it matched nothing. They are all handled
 * explicitly above; drop them before the repository sees them.
 */
const HANDLED_PARAMS = ['status', 'partnerStatus', 'q', 'search'];

const paginationOnly = (query = {}) => {
  const rest = { ...query };
  HANDLED_PARAMS.forEach((key) => delete rest[key]);
  return rest;
};

const schoolApprovalService = {
  async listPendingSchools(query) {
    const filter = await applyDisplayStatusFilter(buildSearchFilter(query), 'pending');
    const result = await schoolRepository.paginateSchools(filter, paginationOnly(query));
    return { ...result, data: await decorateSchools(result.data) };
  },

  async listSchools(query) {
    let filter = buildSearchFilter(query);

    // `status` is the computed display status; `partnerStatus` is the raw stored
    // value. Support both so existing callers keep working.
    if (query.status && query.status !== 'all') {
      filter = await applyDisplayStatusFilter(filter, query.status);
    } else if (query.partnerStatus) {
      filter.partnerStatus = query.partnerStatus;
    }

    const result = await schoolRepository.paginateSchools(filter, paginationOnly(query));
    return { ...result, data: await decorateSchools(result.data) };
  },

  async getSchool(schoolId) {
    const school = await schoolService.getSchool(schoolId);
    if (!school) throw new NotFoundError('School not found', 'SCHOOL_NOT_FOUND');
    const [decorated] = await decorateSchools([school]);
    return decorated;
  },

  // Master-admin-only. Schools cannot set their own commission — only this
  // superadmin path writes School.commission.
  async setCommission(schoolId, { kitPercent, retailPercent }, actor = {}) {
    const existing = await schoolService.getSchool(schoolId);
    if (!existing) throw new NotFoundError('School not found', 'SCHOOL_NOT_FOUND');
    const school = await schoolService.updateSchool(schoolId, {
      commission: { kitPercent, retailPercent },
    });
    await auditRepository.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'school.commission.updated',
      entityType: 'School',
      entityId: schoolId,
      after: { commission: { kitPercent, retailPercent } },
    });
    return school;
  },

  /**
   * Admin-entered schools are created already approved — the admin doing the
   * entering is the reviewer, so routing them through 'prospect' would mean
   * approving one's own submission.
   */
  async createSchool(payload, actor = {}) {
    const { user, school, schoolRefNo } = await schoolAdminRegistrationService.createByAdmin(payload);

    await auditRepository.log({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'school.created',
      entityType: 'School',
      entityId: school._id,
      after: { schoolRefNo, adminUserId: user._id },
    });

    const [decorated] = await decorateSchools([school.toObject ? school.toObject() : school]);
    return decorated;
  },

  async approveSchool(schoolId, actor = {}, note) {
    return runAtomic(async () => {
      const school = await schoolRepository.findById(schoolId);
      if (!school) throw new NotFoundError('School not found', 'SCHOOL_NOT_FOUND');
      if (school.partnerStatus === 'active') {
        throw new BadRequestError('School is already approved', null, 'SCHOOL_ALREADY_APPROVED');
      }

      const updated = await schoolRepository.updateById(schoolId, {
        $set: { partnerStatus: 'active' },
      });

      await User.updateMany({ tenantSchoolId: schoolId, role: 'school' }, { $set: { status: 'active' } });

      await auditRepository.log({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action: 'school.approved',
        entityType: 'School',
        entityId: schoolId,
        after: { note },
      });

      // Login is gated on approval, so this mail is the school's only signal that
      // they can now sign in. Best-effort: a dead SMTP host must not roll back an
      // approval that already committed.
      const admin = await findAdminUser(schoolId);
      if (admin?.email) {
        try {
          await emailService.sendSchoolApprovedEmail({
            to: admin.email,
            name: admin.name,
            schoolName: updated?.name || school.name,
          });
        } catch (error) {
          logger.error('School approval email failed to send', { schoolId, error: error.message });
        }
      }

      return updated;
    });
  },

  async rejectSchool(schoolId, actor = {}, reason) {
    return runAtomic(async () => {
      const school = await schoolRepository.findById(schoolId);
      if (!school) throw new NotFoundError('School not found', 'SCHOOL_NOT_FOUND');

      const updated = await schoolRepository.updateById(schoolId, {
        $set: { partnerStatus: 'prospect' },
      });

      await User.updateMany({ tenantSchoolId: schoolId, role: 'school' }, { $set: { status: 'inactive' } });

      await auditRepository.log({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action: 'school.rejected',
        entityType: 'School',
        entityId: schoolId,
        after: { reason },
      });

      return updated;
    });
  },

  async suspendSchool(schoolId, actor = {}, reason) {
    return runAtomic(async () => {
      const school = await schoolRepository.findById(schoolId);
      if (!school) throw new NotFoundError('School not found', 'SCHOOL_NOT_FOUND');

      const updated = await schoolRepository.updateById(schoolId, {
        $set: { partnerStatus: 'suspended' },
      });

      await User.updateMany({ tenantSchoolId: schoolId }, { $set: { status: 'suspended' } });

      await auditRepository.log({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action: 'school.suspended',
        entityType: 'School',
        entityId: schoolId,
        after: { reason },
      });

      return updated;
    });
  },

  async reactivateSchool(schoolId, actor = {}, note) {
    return runAtomic(async () => {
      const school = await schoolRepository.findById(schoolId);
      if (!school) throw new NotFoundError('School not found', 'SCHOOL_NOT_FOUND');

      const updated = await schoolRepository.updateById(schoolId, {
        $set: { partnerStatus: 'active' },
      });

      await User.updateMany({ tenantSchoolId: schoolId }, { $set: { status: 'active' } });

      await auditRepository.log({
        actorUserId: actor.userId,
        actorRole: actor.role,
        action: 'school.reactivated',
        entityType: 'School',
        entityId: schoolId,
        after: { note },
      });

      return updated;
    });
  },

  getApprovalHistory(schoolId, query = {}) {
    return reportRepository.paginateAuditLogs(
      {
        entityType: 'School',
        entityId: schoolId,
        action: { $in: SCHOOL_ACTIONS },
      },
      query
    );
  },

  async getApprovalTimeline(schoolId) {
    const school = await schoolService.getSchool(schoolId);
    const history = await reportRepository.getApprovalHistory('School', schoolId);
    return { school, timeline: history };
  },
};

module.exports = schoolApprovalService;
