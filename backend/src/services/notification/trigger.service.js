const logger = require('../../common/logger');
const notificationService = require('./notification.service');
const VendorProfile = require('../../database/models/VendorProfile');
const ChildProfile = require('../../database/models/ChildProfile');
const Order = require('../../database/models/Order');

// classGrade and section are free text across the app ("5" / "Class 5", "A" /
// "Section A"). Every audience match here goes through these rather than comparing the
// raw strings, which is what used to drop whole classes from a broadcast.
const normalizeGradeValue = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/class|grade|std/g, '')
    .replace(/\s+/g, '')
    .trim();

const normalizeSectionValue = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/section/g, '')
    .replace(/\s+/g, '')
    .trim();

const notifySafe = (fn, ...args) => {
  return Promise.resolve()
    .then(() => fn(...args))
    .catch((error) => {
      logger.error('Notification trigger failed', {
        handler: fn.name,
        message: error.message,
      });
    });
};

const orderRoute = (order, audience) => {
  if (audience === 'school' || order?.audience === 'school') {
    return `/school/orders/${order._id}`;
  }
  return `/user/orders/${order._id}`;
};

const vendorOrderRoute = (orderId) => `/vendor/orders/${orderId}`;

const getVendorUserIds = async (vendorIds = []) => {
  const profiles = await VendorProfile.find({ _id: { $in: vendorIds } })
    .select('userId')
    .lean();
  return profiles.map((p) => p.userId).filter(Boolean);
};

/**
 * The same two-link resolution as parentUserIdsForStudents, but kept grouped by student
 * so a caller notifying a whole class can resolve everyone in one pass.
 *
 * Marking a 40-student roster used to call parentUserIdsForStudents once per student —
 * 120 sequential queries inside the request that marks attendance.
 *
 * Returns Map<studentId, string[] of parent userIds>.
 */
const parentUserIdsByStudent = async (studentIds) => {
  const byStudent = new Map((studentIds || []).map((id) => [String(id), new Set()]));
  if (!studentIds?.length) return byStudent;

  const ChildProfile = require('../../database/models/ChildProfile');
  const Student = require('../../database/models/Student');
  const ParentProfile = require('../../database/models/ParentProfile');

  const [children, students] = await Promise.all([
    ChildProfile.find({
      studentId: { $in: studentIds },
      'softDelete.isDeleted': { $ne: true },
    })
      .select('studentId parentUserId')
      .lean(),
    Student.find({
      _id: { $in: studentIds },
      'softDelete.isDeleted': { $ne: true },
    })
      .select('parentProfileIds')
      .lean(),
  ]);

  children.forEach((child) => {
    if (!child.parentUserId) return;
    byStudent.get(String(child.studentId))?.add(String(child.parentUserId));
  });

  const allProfileIds = students.flatMap((student) => student.parentProfileIds || []).filter(Boolean);
  if (allProfileIds.length) {
    const profiles = await ParentProfile.find({
      _id: { $in: allProfileIds },
      'softDelete.isDeleted': { $ne: true },
    })
      .select('userId')
      .lean();
    const userIdByProfile = new Map(profiles.map((p) => [String(p._id), String(p.userId)]));

    students.forEach((student) => {
      (student.parentProfileIds || []).forEach((profileId) => {
        const userId = userIdByProfile.get(String(profileId));
        if (userId) byStudent.get(String(student._id))?.add(userId);
      });
    });
  }

  return new Map([...byStudent].map(([studentId, set]) => [studentId, [...set]]));
};

const parentUserIdsForStudents = async (studentIds) => {
  if (!studentIds?.length) return [];

  const ChildProfile = require('../../database/models/ChildProfile');
  const Student = require('../../database/models/Student');
  const ParentProfile = require('../../database/models/ParentProfile');

  // Method A: parentUserId from ChildProfile
  const children = await ChildProfile.find({
    studentId: { $in: studentIds },
    'softDelete.isDeleted': { $ne: true },
  })
    .select('parentUserId')
    .lean();

  const userIdsA = children.map((c) => String(c.parentUserId)).filter(Boolean);

  // Method B: parentProfileIds from Student -> ParentProfile.userId
  const students = await Student.find({
    _id: { $in: studentIds },
    'softDelete.isDeleted': { $ne: true },
  })
    .select('parentProfileIds')
    .lean();

  const parentProfileIds = students.flatMap((s) => s.parentProfileIds || []).filter(Boolean);
  let userIdsB = [];
  if (parentProfileIds.length) {
    const parentProfiles = await ParentProfile.find({
      _id: { $in: parentProfileIds },
      'softDelete.isDeleted': { $ne: true },
    })
      .select('userId')
      .lean();
    userIdsB = parentProfiles.map((p) => String(p.userId)).filter(Boolean);
  }

  return [...new Set([...userIdsA, ...userIdsB])];
};

/**
 * Parents of every active student in the given classes. `targets` is a list of
 * { classGrade, sections? } — omitting sections means the whole grade.
 */
const getParentUserIdsForClasses = async (schoolId, targets = []) => {
  const Student = require('../../database/models/Student');
  if (!targets.length) return [];

  // Grade and section are free text everywhere ("5" / "Class 5", "A" / "Section A"),
  // so the match is made on the normalized form in memory. Querying them raw meant a
  // whole class of parents was quietly left out of "new homework" notifications
  // whenever the roster and the teacher's form spelled the class differently.
  const wanted = targets.map((entry) => ({
    grade: normalizeGradeValue(entry.classGrade),
    sections: (entry.sections || []).map(normalizeSectionValue).filter(Boolean),
  }));

  // A child with no section on record is in the grade but not in any one section, so
  // they receive the grade's notifications rather than none — the same rule the
  // homework feed applies when deciding what they can see.
  const isTargeted = (grade, section) =>
    wanted.some((target) => {
      if (target.grade !== normalizeGradeValue(grade)) return false;
      if (!target.sections.length) return true;
      const normalized = normalizeSectionValue(section);
      return !normalized || target.sections.includes(normalized);
    });

  const students = await Student.find({
    schoolId,
    status: 'active',
    'softDelete.isDeleted': { $ne: true },
  })
    .select('_id classGrade section')
    .lean();

  const studentIds = students
    .filter((student) => isTargeted(student.classGrade, student.section))
    .map((student) => student._id);

  const fromRoster = await parentUserIdsForStudents(studentIds);

  // Parents whose child the school has not added to the register yet have no Student
  // row to be found through — only their own ChildProfile. They can see the homework
  // (see the LMS student repository), so they are told about it too.
  const children = await ChildProfile.find({
    schoolId,
    studentId: null,
    'softDelete.isDeleted': { $ne: true },
  })
    .select('parentUserId grade')
    .lean();

  const fromChildProfiles = children
    .filter((child) => isTargeted(child.grade, null))
    .map((child) => String(child.parentUserId))
    .filter(Boolean);

  return [...new Set([...fromRoster, ...fromChildProfiles])];
};

const getSchoolStaffUserIds = async (schoolId) => {
  const User = require('../../database/models/User');
  const users = await User.find({
    role: 'school',
    tenantSchoolId: schoolId,
    'softDelete.isDeleted': { $ne: true },
  })
    .select('_id')
    .lean();
  return users.map((u) => String(u._id));
};

const getSchoolParentUserIds = async (schoolId, notice) => {
  if (notice?.targetAudience === 'specific_classes' && notice.targetClasses?.length) {
    return getParentUserIdsForClasses(schoolId, notice.targetClasses);
  }

  const ChildProfile = require('../../database/models/ChildProfile');
  const Student = require('../../database/models/Student');
  const ParentProfile = require('../../database/models/ParentProfile');

  // Method A: parentUserId from ChildProfile with this schoolId
  const children = await ChildProfile.find({
    schoolId,
    'softDelete.isDeleted': { $ne: true },
  })
    .select('parentUserId')
    .lean();
  const userIdsA = children.map((c) => String(c.parentUserId)).filter(Boolean);

  // Method B: Student records with this schoolId -> ParentProfile.userId
  const students = await Student.find({
    schoolId,
    status: 'active',
    'softDelete.isDeleted': { $ne: true },
  })
    .select('parentProfileIds')
    .lean();
  const parentProfileIds = students.flatMap((s) => s.parentProfileIds || []).filter(Boolean);
  let userIdsB = [];
  if (parentProfileIds.length) {
    const parentProfiles = await ParentProfile.find({
      _id: { $in: parentProfileIds },
      'softDelete.isDeleted': { $ne: true },
    })
      .select('userId')
      .lean();
    userIdsB = parentProfiles.map((p) => String(p.userId)).filter(Boolean);
  }

  return [...new Set([...userIdsA, ...userIdsB])];
};

const HOMEWORK_PARENT_ROUTE = '/parent/homework';

const triggerService = {
  notifyOrderPlaced(order) {
    notifySafe(async () => {
      // 1. Notify Buyer
      await notificationService.sendToUser(order.userId, {
        type: 'order_update',
        notification: {
          title: 'Order Placed',
          body: `Your order #${order.orderNumber} has been placed successfully.`,
        },
        data: {
          type: 'order_placed',
          route: orderRoute(order),
          entityId: String(order._id),
          orderNumber: order.orderNumber,
        },
      });

      // 2. Notify Vendor(s)
      const vendorUserIds = await getVendorUserIds(order.vendorIds || []);
      if (vendorUserIds.length) {
        await notificationService.sendToUsers(vendorUserIds, {
          type: 'order_update',
          notification: {
            title: 'New Order Received',
            body: `New order #${order.orderNumber} received.`,
          },
          data: {
            type: 'order_new',
            route: vendorOrderRoute(order._id),
            entityId: String(order._id),
            orderNumber: order.orderNumber,
          },
        });
      }

      // 3. If School Bulk Order, Notify School Admin / Staff
      if (order.audience === 'school' && order.schoolId) {
        const schoolStaffUserIds = await getSchoolStaffUserIds(order.schoolId);
        if (schoolStaffUserIds.length) {
          await notificationService.sendToUsers(schoolStaffUserIds, {
            type: 'order_update',
            notification: {
              title: 'School Bulk Order Placed',
              body: `Bulk order #${order.orderNumber} has been placed for your school.`,
            },
            data: {
              type: 'school_order_placed',
              route: `/school/orders/${order._id}`,
              entityId: String(order._id),
              orderNumber: order.orderNumber,
            },
          });
        }
      }
    });
  },

  notifyOrderStatusChange(order, status, note) {
    notifySafe(async () => {
      const statusLabels = {
        accepted: 'accepted',
        processed: 'being processed',
        packed: 'packed',
        shipped: 'shipped',
        out_for_delivery: 'out for delivery',
        delivered: 'delivered',
        cancelled: 'cancelled',
      };
      const label = statusLabels[status] || status;

      await notificationService.sendToUser(order.userId, {
        type: 'order_update',
        notification: {
          title: 'Order Update',
          body: `Order #${order.orderNumber} is ${label}.${note ? ` ${note}` : ''}`,
        },
        data: {
          type: 'order_status',
          route: orderRoute(order),
          entityId: String(order._id),
          status,
          orderNumber: order.orderNumber,
        },
      });
    });
  },

  notifyOrderCancelled(order, cancelledByRole) {
    notifySafe(async () => {
      await notificationService.sendToUser(order.userId, {
        type: 'order_update',
        notification: {
          title: 'Order Cancelled',
          body: `Order #${order.orderNumber} has been cancelled.`,
        },
        data: {
          type: 'order_cancelled',
          route: orderRoute(order),
          entityId: String(order._id),
          cancelledBy: cancelledByRole,
        },
      });

      const vendorUserIds = await getVendorUserIds(order.vendorIds || []);
      await notificationService.sendToUsers(vendorUserIds, {
        type: 'order_update',
        notification: {
          title: 'Order Cancelled',
          body: `Order #${order.orderNumber} was cancelled.`,
        },
        data: {
          type: 'order_cancelled',
          route: vendorOrderRoute(order._id),
          entityId: String(order._id),
        },
      });
    });
  },

  notifyPaymentSuccess(order) {
    notifySafe(async () => {
      await notificationService.sendToUser(order.userId, {
        type: 'order_update',
        notification: {
          title: 'Payment Successful',
          body: `Payment for order #${order.orderNumber} was successful.`,
        },
        data: {
          type: 'payment_success',
          route: orderRoute(order),
          entityId: String(order._id),
          orderNumber: order.orderNumber,
        },
      });
    });
  },

  notifyPaymentFailed(order, reason) {
    notifySafe(async () => {
      await notificationService.sendToUser(order.userId, {
        type: 'order_update',
        notification: {
          title: 'Payment Failed',
          body: reason || `Payment for order #${order.orderNumber} failed. Please retry.`,
        },
        data: {
          type: 'payment_failed',
          route: orderRoute(order),
          entityId: String(order._id),
          orderNumber: order.orderNumber,
        },
      });
    });
  },

  notifyVendorOrderAction(order, vendorId, action) {
    notifySafe(async () => {
      const titles = {
        accepted: 'Order Accepted',
        rejected: 'Order Rejected',
        processed: 'Order Processing',
        packed: 'Order Packed',
        shipped: 'Order Shipped',
      };
      const bodies = {
        accepted: `Vendor accepted order #${order.orderNumber}.`,
        rejected: `Vendor rejected order #${order.orderNumber}.`,
        processed: `Order #${order.orderNumber} is being processed.`,
        packed: `Order #${order.orderNumber} has been packed.`,
        shipped: `Order #${order.orderNumber} has been shipped.`,
      };

      await notificationService.sendToUser(order.userId, {
        type: 'order_update',
        notification: {
          title: titles[action] || 'Order Update',
          body: bodies[action] || `Order #${order.orderNumber} updated.`,
        },
        data: {
          type: `vendor_${action}`,
          route: orderRoute(order),
          entityId: String(order._id),
          vendorId: String(vendorId),
        },
      });
    });
  },

  notifySchoolNoticePublished(schoolId, notice) {
    notifySafe(async () => {
      let recipientUserIds = [];

      const audience = notice?.targetAudience;
      if (audience === 'teachers' || audience === 'staff') {
        recipientUserIds = await getSchoolStaffUserIds(schoolId);
      } else if (audience === 'all') {
        const parents = await getSchoolParentUserIds(schoolId, notice);
        const staff = await getSchoolStaffUserIds(schoolId);
        recipientUserIds = [...new Set([...parents, ...staff])];
      } else {
        recipientUserIds = await getSchoolParentUserIds(schoolId, notice);
      }

      if (!recipientUserIds.length) return;

      await notificationService.sendToUsers(recipientUserIds, {
        type: 'school_notice',
        notification: {
          title: notice.title || 'School Notice',
          body: notice.content?.slice(0, 120) || 'A new notice has been published.',
        },
        data: {
          type: 'school_notice',
          route: '/school/parent/notices',
          entityId: String(notice._id),
          schoolId: String(schoolId),
        },
      });
    });
  },

  notifyHomeworkPublished(schoolId, assignment, course) {
    notifySafe(async () => {
      const classGrade = assignment.classGrade || course?.gradeClass;
      if (!classGrade) return;

      // A homework targets one section; with no section it applies to the whole grade.
      const parentUserIds = await getParentUserIdsForClasses(schoolId, [
        { classGrade, sections: assignment.section ? [assignment.section] : [] },
      ]);

      // Resolve student user accounts for this class/section as well. Filtered in
      // memory on the normalized grade/section for the same reason as the parent
      // lookup above — "Class 5" and "5" are one class.
      const Student = require('../../database/models/Student');
      const targetGrade = normalizeGradeValue(classGrade);
      const targetSection = normalizeSectionValue(assignment.section);

      const students = await Student.find({
        schoolId,
        status: 'active',
        'softDelete.isDeleted': { $ne: true },
      })
        .select('userId classGrade section')
        .lean();

      const studentUserIds = students
        .filter((student) => {
          if (normalizeGradeValue(student.classGrade) !== targetGrade) return false;
          const section = normalizeSectionValue(student.section);
          return !targetSection || !section || section === targetSection;
        })
        .map((s) => String(s.userId))
        .filter(Boolean);

      const recipientUserIds = [...new Set([...parentUserIds, ...studentUserIds])];
      if (!recipientUserIds.length) return;

      // The assignment carries its own subject since homework stopped hanging off a
      // course, so reading the course first titled every course-less homework — i.e.
      // everything the teacher app sets — "New Homework Homework" instead of naming
      // the subject. With neither, the subject is left out rather than repeated.
      const subject = assignment.subject || course?.subject || null;
      await notificationService.sendToUsers(recipientUserIds, {
        type: 'homework',
        notification: {
          title: subject ? `New ${subject} Homework` : 'New Homework',
          body: assignment.title || 'New homework has been assigned.',
        },
        data: {
          type: 'homework_published',
          route: HOMEWORK_PARENT_ROUTE,
          entityId: String(assignment._id),
          schoolId: String(schoolId),
        },
      });
    });
  },

  notifyHomeworkSubmitted(assignment, submission, student) {
    notifySafe(async () => {
      // Course-level teachers are not tracked per assignment, so the teacher who set
      // the work is the one who wants to know it came in.
      const teacherUserId = assignment.assignedByUserId;
      if (!teacherUserId) return;

      const name = student?.name || 'A student';
      await notificationService.sendToUser(teacherUserId, {
        type: 'homework',
        notification: {
          title: submission.isLate ? 'Late homework submitted' : 'Homework submitted',
          body: `${name} submitted "${assignment.title}".`,
        },
        data: {
          type: 'homework_submitted',
          route: '/school/teacher/check-homework',
          entityId: String(submission._id),
          assignmentId: String(assignment._id),
        },
      });
    });
  },

  notifyHomeworkGraded(assignment, submission) {
    notifySafe(async () => {
      const parentUserIds = await parentUserIdsForStudents([submission.studentId]);
      if (!parentUserIds.length) return;

      const grade = submission.letterGrade || `${submission.score}/${assignment.maxScore ?? 100}`;
      await notificationService.sendToUsers(parentUserIds, {
        type: 'homework',
        notification: {
          title: 'Homework checked',
          body: `"${assignment.title}" has been graded: ${grade}.`,
        },
        data: {
          type: 'homework_graded',
          route: HOMEWORK_PARENT_ROUTE,
          entityId: String(submission._id),
          assignmentId: String(assignment._id),
        },
      });
    });
  },

  notifyHomeworkReturned(assignment, submission) {
    notifySafe(async () => {
      const parentUserIds = await parentUserIdsForStudents([submission.studentId]);
      if (!parentUserIds.length) return;

      await notificationService.sendToUsers(parentUserIds, {
        type: 'homework',
        notification: {
          title: 'Homework needs revision',
          body: `"${assignment.title}" was sent back by the teacher. Please review and submit again.`,
        },
        data: {
          type: 'homework_returned',
          route: HOMEWORK_PARENT_ROUTE,
          entityId: String(submission._id),
          assignmentId: String(assignment._id),
        },
      });
    });
  },

  notifyUserAction(userId, { title, body, type = 'system', route, entityId, extra }) {
    notifySafe(async () => {
      await notificationService.sendToUser(userId, {
        type,
        notification: { title, body },
        data: {
          type: type,
          route: route || '/user/notifications',
          entityId: entityId ? String(entityId) : '',
          extra: extra ? JSON.stringify(extra) : '',
        },
      });
    });
  },

  notifyDeliveryUpdate(orderMongoId, status, orderNumber) {
    notifySafe(async () => {
      const order = await Order.findById(orderMongoId).select('userId audience _id orderNumber').lean();
      if (!order) return;

      await notificationService.sendToUser(order.userId, {
        type: 'order_update',
        notification: {
          title: 'Delivery Update',
          body: `Order #${orderNumber || order.orderNumber} — ${status?.replace(/_/g, ' ') || 'updated'}.`,
        },
        data: {
          type: 'delivery_update',
          route: orderRoute(order),
          entityId: String(order._id),
          status: status || '',
        },
      });
    });
  },

  /** A quotation request goes live for one or more vendors — first publish, or new vendors added later. */
  notifyRfqPublished(rfq, vendorIds = []) {
    notifySafe(async () => {
      if (!vendorIds.length) return;
      const vendorUserIds = await getVendorUserIds(vendorIds);
      if (!vendorUserIds.length) return;

      await notificationService.sendToUsers(vendorUserIds, {
        type: 'rfq_update',
        notification: {
          title: 'New Quotation Request',
          body: `${rfq.title} — a school has invited you to submit a quote.`,
        },
        data: {
          type: 'rfq_invited',
          route: '/vendor/quotations',
          entityId: String(rfq._id),
          rfqNumber: rfq.rfqNumber,
        },
      });
    });
  },

  /** A vendor submitted (priced) a quote — let the school know a response is waiting. */
  notifyQuoteSubmitted(schoolId, rfq, vendorName) {
    notifySafe(async () => {
      const schoolUserIds = await getSchoolStaffUserIds(schoolId);
      if (!schoolUserIds.length) return;

      await notificationService.sendToUsers(schoolUserIds, {
        type: 'rfq_update',
        notification: {
          title: 'New Quote Received',
          body: `${vendorName || 'A vendor'} submitted a quote for "${rfq.title}".`,
        },
        data: {
          type: 'rfq_quote_submitted',
          route: '/school/quotations',
          entityId: String(rfq._id),
          rfqNumber: rfq.rfqNumber,
        },
      });
    });
  },

  /** The school awarded the contract to a vendor's quote. */
  notifyQuoteAwarded(rfq, winningVendorId) {
    notifySafe(async () => {
      const vendorUserIds = await getVendorUserIds([winningVendorId]);
      if (!vendorUserIds.length) return;

      await notificationService.sendToUsers(vendorUserIds, {
        type: 'rfq_update',
        notification: {
          title: 'Contract Awarded 🎉',
          body: `You've been awarded the contract for "${rfq.title}".`,
        },
        data: {
          type: 'rfq_awarded',
          route: '/vendor/quotations',
          entityId: String(rfq._id),
          rfqNumber: rfq.rfqNumber,
        },
      });
    });
  },

  /** Every other vendor who quoted lost this RFQ once one of them was awarded. */
  notifyQuoteRejected(rfq, rejectedVendorIds = []) {
    notifySafe(async () => {
      if (!rejectedVendorIds.length) return;
      const vendorUserIds = await getVendorUserIds(rejectedVendorIds);
      if (!vendorUserIds.length) return;

      await notificationService.sendToUsers(vendorUserIds, {
        type: 'rfq_update',
        notification: {
          title: 'Quotation Not Selected',
          body: `Your quote for "${rfq.title}" was not selected this time.`,
        },
        data: {
          type: 'rfq_rejected',
          route: '/vendor/quotations',
          entityId: String(rfq._id),
          rfqNumber: rfq.rfqNumber,
        },
      });
    });
  },

  /** The school cancelled a live RFQ — every invited vendor stops seeing it as
   *  something to act on, so anyone mid-quote needs to be told why it vanished. */
  notifyRfqCancelled(rfq, vendorIds = []) {
    notifySafe(async () => {
      if (!vendorIds.length) return;
      const vendorUserIds = await getVendorUserIds(vendorIds);
      if (!vendorUserIds.length) return;

      await notificationService.sendToUsers(vendorUserIds, {
        type: 'rfq_update',
        notification: {
          title: 'Quotation Request Cancelled',
          body: `"${rfq.title}" was cancelled by the school and is no longer accepting quotes.`,
        },
        data: {
          type: 'rfq_cancelled',
          route: '/vendor/quotations',
          entityId: String(rfq._id),
          rfqNumber: rfq.rfqNumber,
        },
      });
    });
  },

  /** The school captured the RFQ advance — the awarded vendor can start work. */
  notifyRfqAdvancePaid(order) {
    notifySafe(async () => {
      const vendorIds = order.vendorIds || [];
      if (!vendorIds.length) return;
      const vendorUserIds = await getVendorUserIds(vendorIds);
      if (!vendorUserIds.length) return;

      await notificationService.sendToUsers(vendorUserIds, {
        type: 'order_update',
        notification: {
          title: 'Advance Payment Received',
          body: `The advance for order #${order.orderNumber} has been paid. You can start fulfilling it.`,
        },
        data: {
          type: 'rfq_advance_paid',
          route: vendorOrderRoute(order._id),
          entityId: String(order._id),
        },
      });
    });
  },

  /** The school paid off the remaining balance on an RFQ order — it's now fully settled. */
  notifyRfqRemainderPaid(order) {
    notifySafe(async () => {
      const vendorIds = order.vendorIds || [];
      if (!vendorIds.length) return;
      const vendorUserIds = await getVendorUserIds(vendorIds);
      if (!vendorUserIds.length) return;

      await notificationService.sendToUsers(vendorUserIds, {
        type: 'order_update',
        notification: {
          title: 'Order Fully Paid',
          body: `The remaining balance for order #${order.orderNumber} has been paid — it's now fully settled.`,
        },
        data: {
          type: 'rfq_remainder_paid',
          route: vendorOrderRoute(order._id),
          entityId: String(order._id),
        },
      });
    });
  },

  notifyRefundUpdate(order, status) {
    notifySafe(async () => {
      await notificationService.sendToUser(order.userId, {
        type: 'order_update',
        notification: {
          title: 'Refund Update',
          body: `Refund for order #${order.orderNumber} is ${status}.`,
        },
        data: {
          type: 'refund_update',
          route: orderRoute(order),
          entityId: String(order._id),
          status,
        },
      });
    });
  },

  notifyAttendanceMarked(schoolId, attendanceRecords, studentsById, dateStr) {
    notifySafe(async () => {
      if (!attendanceRecords?.length || !studentsById) return;

      const dateFormatted = dateStr ? new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) : 'Today';

      // Resolved for the whole class up front rather than once per student inside the
      // loop, which turned marking a 40-student roster into 120 sequential queries.
      const known = attendanceRecords
        .filter((record) => studentsById.has(String(record.studentId)))
        .map((record) => record.studentId);
      const parentsByStudent = await parentUserIdsByStudent(known);

      for (const record of attendanceRecords) {
        const student = studentsById.get(String(record.studentId));
        if (!student) continue;

        const parentUserIds = parentsByStudent.get(String(record.studentId)) || [];
        const recipientUserIds = [...new Set([...parentUserIds, ...(student.userId ? [String(student.userId)] : [])])];
        if (!recipientUserIds.length) continue;

        const studentName = student.name || 'Student';
        const statusRaw = (record.status || 'marked').toLowerCase();
        const statusUpper = statusRaw.toUpperCase();

        let title = `Attendance Alert: ${statusUpper}`;
        let body = `${studentName} has been marked ${statusUpper} for ${dateFormatted}.`;

        if (statusRaw === 'absent') {
          title = `⚠️ Attendance Alert: ABSENT`;
          body = `${studentName} has been marked ABSENT for ${dateFormatted}.`;
        } else if (statusRaw === 'present') {
          title = `✅ Attendance Update: PRESENT`;
          body = `${studentName} has been marked PRESENT for ${dateFormatted}.`;
        } else if (statusRaw === 'late') {
          title = `⏰ Attendance Alert: LATE`;
          body = `${studentName} has been marked LATE for ${dateFormatted}.`;
        }

        await notificationService.sendToUsers(recipientUserIds, {
          type: 'attendance',
          notification: {
            title,
            body,
          },
          data: {
            type: 'attendance_marked',
            status: statusRaw,
            studentId: String(record.studentId),
            schoolId: String(schoolId),
            route: '/school/parent/attendance',
          },
        });
      }
    });
  },

  checkAndNotifyStudentBirthdays(targetDate = new Date()) {
    return notifySafe(async () => {
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        logger.warn('Skipping birthday notification check: MongoDB connection not ready');
        return;
      }

      const Student = require('../../database/models/Student');
      const ChildProfile = require('../../database/models/ChildProfile');
      const ParentProfile = require('../../database/models/ParentProfile');
      const TeacherProfile = require('../../database/models/TeacherProfile');
      const User = require('../../database/models/User');
      const Notification = require('../../database/models/Notification');

      const dateObj = new Date(targetDate);
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const utcMonth = dateObj.getUTCMonth() + 1;
      const utcDay = dateObj.getUTCDate();

      const isBirthdayToday = (dobDate) => {
        if (!dobDate) return false;
        const d = new Date(dobDate);
        if (isNaN(d.getTime())) return false;
        const m = d.getMonth() + 1;
        const dy = d.getDate();
        const um = d.getUTCMonth() + 1;
        const udy = d.getUTCDate();
        return (m === month && dy === day) || (um === utcMonth && udy === utcDay) || (m === utcMonth && dy === utcDay) || (um === month && udy === day);
      };

      // Find active Students whose DOB month and day match today
      const allStudents = await Student.find({
        dob: { $ne: null },
        status: 'active',
        'softDelete.isDeleted': { $ne: true },
      }).lean();

      const students = allStudents.filter((s) => isBirthdayToday(s.dob));

      // Also find active ChildProfiles whose DOB month and day match today
      const allChildren = await ChildProfile.find({
        dob: { $ne: null },
        'softDelete.isDeleted': { $ne: true },
      }).lean();

      const children = allChildren.filter((c) => isBirthdayToday(c.dob));

      // Combine student candidates
      const candidates = [];
      const seenStudentKeys = new Set();

      for (const s of students) {
        const key = String(s._id);
        seenStudentKeys.add(key);
        candidates.push({
          studentId: s._id,
          name: s.name,
          schoolId: s.schoolId,
          classGrade: s.classGrade,
          section: s.section,
          parentProfileIds: s.parentProfileIds || [],
          parentUserId: null,
        });
      }

      for (const c of children) {
        const key = c.studentId ? String(c.studentId) : `child_${c._id}`;
        if (!seenStudentKeys.has(key)) {
          seenStudentKeys.add(key);
          candidates.push({
            studentId: c.studentId || c._id,
            name: c.name,
            schoolId: c.schoolId,
            classGrade: c.grade,
            section: null,
            parentProfileIds: [],
            parentUserId: c.parentUserId || null,
          });
        }
      }

      if (!candidates.length) return;

      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);

      for (const candidate of candidates) {
        const studentIdStr = String(candidate.studentId);

        // Deduplication check: skip if birthday notification already sent today for this student
        const alreadySent = await Notification.exists({
          'payload.data.type': 'birthday',
          'payload.data.studentId': studentIdStr,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        });

        if (alreadySent) continue;

        const studentName = candidate.name || 'Student';
        const classGrade = candidate.classGrade || '';
        const section = candidate.section || '';
        const classLabel = classGrade
          ? section
            ? `Class ${classGrade} - ${section}`
            : `Class ${classGrade}`
          : 'Class';

        // 1. Resolve Parent User IDs using helper
        const parentsMap = await parentUserIdsByStudent([candidate.studentId]);
        const parentUserIds = parentsMap.get(studentIdStr) || new Set();
        if (candidate.parentUserId) {
          parentUserIds.add(String(candidate.parentUserId));
        }

        // 2. Resolve Class Teacher User ID (isClassTeacher: true only!)
        const teacherUserIds = new Set();
        if (candidate.schoolId && candidate.classGrade) {
          const teachers = await TeacherProfile.find({
            schoolId: candidate.schoolId,
            approvalStatus: 'approved',
            'softDelete.isDeleted': { $ne: true },
          }).lean();

          teachers.forEach((teacher) => {
            const isClassTeacher = (teacher.classAssignments || []).some((assignment) => {
              if (!assignment.isClassTeacher) return false;
              const classMatches =
                assignment.class &&
                String(assignment.class).trim().toLowerCase() === String(candidate.classGrade).trim().toLowerCase();
              if (!classMatches) return false;
              if (candidate.section && assignment.section) {
                return String(assignment.section).trim().toLowerCase() === String(candidate.section).trim().toLowerCase();
              }
              return true;
            });

            if (isClassTeacher && teacher.userId) {
              teacherUserIds.add(String(teacher.userId));
            }
          });
        }

        // 3. Resolve School Admin User IDs
        const schoolAdminUserIds = new Set();
        if (candidate.schoolId) {
          const schoolAdmins = await User.find({
            role: 'school',
            tenantSchoolId: candidate.schoolId,
            status: 'active',
            'softDelete.isDeleted': { $ne: true },
          })
            .select('_id')
            .lean();
          schoolAdmins.forEach((sa) => schoolAdminUserIds.add(String(sa._id)));
        }

        // Send Notification to Parent(s)
        const parentUserArr = Array.from(parentUserIds || []);
        if (parentUserArr.length) {
          await notificationService.sendToUsers(parentUserArr, {
            type: 'event',
            notification: {
              title: `🎂 Happy Birthday ${studentName}!`,
              body: `Wishing ${studentName} a very Happy Birthday! 🎉 May all their dreams come true!`,
            },
            data: {
              type: 'birthday',
              targetAudience: 'parent',
              studentId: studentIdStr,
              route: '/notifications',
            },
          });
        }

        // Send Notification to Class Teacher(s)
        if (teacherUserIds.size) {
          await notificationService.sendToUsers(Array.from(teacherUserIds), {
            type: 'event',
            notification: {
              title: `🎂 Birthday Alert: ${studentName}`,
              body: `Today is ${studentName}'s birthday (${classLabel}). Wish them a happy birthday! 🎉`,
            },
            data: {
              type: 'birthday',
              targetAudience: 'teacher',
              studentId: studentIdStr,
              route: '/notifications',
            },
          });
        }

        // Send Notification to School Admin(s)
        if (schoolAdminUserIds.size) {
          await notificationService.sendToUsers(Array.from(schoolAdminUserIds), {
            type: 'event',
            notification: {
              title: `🎂 Student Birthday Alert: ${studentName}`,
              body: `Today is ${studentName}'s birthday (${classLabel}). 🎉`,
            },
            data: {
              type: 'birthday',
              targetAudience: 'school',
              studentId: studentIdStr,
              route: '/notifications',
            },
          });
        }
      }
    });
  },
};

module.exports = triggerService;
