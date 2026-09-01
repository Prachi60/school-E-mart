const orderService = require('../../src/modules/orders/services/order.service');
const returnService = require('../../src/modules/orders/services/return.service');
const invoiceService = require('../../src/modules/orders/services/invoice.service');
const deliveryService = require('../../src/modules/orders/services/delivery.service');
const refundService = require('../../src/modules/orders/services/refund.service');
const { createParentUser, createSchoolUser, seedCartForUser, defaultAddress, createVendorUser } = require('./helpers');
const { createAdminUser, authHeaderFor } = require('../vendor/helpers');

describe('orders workflows', () => {
  let user;
  let order;
  let vendorId;

  beforeEach(async () => {
    user = await createParentUser();
    const seeded = await seedCartForUser(user._id);
    vendorId = seeded.vendorId;
    order = await orderService.createOrder(user._id, 'parent', {
      address: defaultAddress,
      deliveryType: 'home',
      paymentMethod: 'cod',
    });
    await orderService.transitionStatus(order._id, { status: 'accepted' }, { userId: user._id });
    await orderService.transitionStatus(order._id, { status: 'processed' }, { userId: user._id });
    await orderService.transitionStatus(order._id, { status: 'packed' }, { userId: user._id });
    await orderService.transitionStatus(order._id, { status: 'shipped' }, { userId: user._id });
    await orderService.transitionStatus(order._id, { status: 'out_for_delivery' }, { userId: user._id });
    await orderService.transitionStatus(order._id, { status: 'delivered' }, { userId: user._id });
  });

  test('creates return request for delivered order', async () => {
    const returnRequest = await returnService.createReturn(user._id, order._id, {
      orderItemIndex: 0,
      reason: 'Damaged product',
    });
    expect(returnRequest.status).toBe('requested');
    expect(String(returnRequest.vendorId)).toBe(String(vendorId));
  });

  test('generates invoice with tax breakdown', async () => {
    const invoice = await invoiceService.generateInvoice(order._id);
    expect(invoice.invoiceNumber).toMatch(/^INV-ORD/);
    expect(invoice.totalPaise).toBe(order.totalPaise);
    expect(invoice.downloadMeta.format).toBe('json');
  });

  test('generates invoice with student, class, and designated class teacher info', async () => {
    const School = require('../../src/database/models/School');
    const TeacherProfile = require('../../src/database/models/TeacherProfile');
    const ParentProfile = require('../../src/database/models/ParentProfile');
    const ChildProfile = require('../../src/database/models/ChildProfile');
    const User = require('../../src/database/models/User');
    const { generateUserRefId } = require('../../src/modules/school/utils/refId');

    const school = await School.create({
      code: `SCH-${Date.now()}`,
      name: 'St. Mark Public School',
      schoolRefNo: `REF-${Date.now()}`,
    });

    const teacherUser = await User.create({
      refId: generateUserRefId('TCH'),
      phone: `98${Math.floor(10000000 + Math.random() * 9000000)}`,
      name: 'Mrs. Suman Sharma',
      role: 'teacher',
    });

    const nonClassTeacherUser = await User.create({
      refId: generateUserRefId('TCH'),
      phone: `97${Math.floor(10000000 + Math.random() * 9000000)}`,
      name: 'Mr. Subject Teacher',
      role: 'teacher',
    });

    // Create Class Teacher profile (isClassTeacher: true for Grade 10, section A)
    await TeacherProfile.create({
      userId: teacherUser._id,
      schoolId: school._id,
      approvalStatus: 'approved',
      classAssignments: [{ class: '10', section: 'A', isClassTeacher: true }],
    });

    // Create non-class teacher profile for same class (isClassTeacher: false)
    await TeacherProfile.create({
      userId: nonClassTeacherUser._id,
      schoolId: school._id,
      approvalStatus: 'approved',
      classAssignments: [{ class: '10', section: 'A', isClassTeacher: false }],
    });

    // Create ChildProfile for parent user
    const child = await ChildProfile.create({
      parentUserId: user._id,
      name: 'Aarav Kumar',
      schoolId: school._id,
      grade: '10',
    });

    await ParentProfile.create({
      userId: user._id,
      activeChildId: child._id,
      referralCode: `EMART${Math.floor(1000 + Math.random() * 9000)}`,
    });

    const invoice = await invoiceService.generateInvoice(order._id);
    expect(invoice.studentDetails).toBeDefined();
    expect(invoice.studentDetails.studentName).toBe('Aarav Kumar');
    expect(invoice.studentDetails.className).toBe('Class 10');
    expect(invoice.studentDetails.schoolName).toBe('St. Mark Public School');
    expect(invoice.studentDetails.classTeacherName).toBe('Mrs. Suman Sharma');
    expect(invoice.studentDetails.classTeacherName).not.toBe('Mr. Subject Teacher');
  });

  test('assigns shipment and records tracking', async () => {
    const freshUser = await createParentUser();
    const { vendorId: vid } = await seedCartForUser(freshUser._id);
    const freshOrder = await orderService.createOrder(freshUser._id, 'parent', {
      address: defaultAddress,
      deliveryType: 'home',
      paymentMethod: 'cod',
    });

    const admin = await createAdminUser();
    const shipment = await deliveryService.assignShipment(
      freshOrder._id,
      vid,
      { courier: 'BlueDart', awbNumber: `AWB${Date.now()}` },
      { userId: admin._id, role: 'admin' }
    );
    expect(shipment.courier).toBe('BlueDart');

    const tracking = await deliveryService.getTracking(freshOrder._id, shipment._id);
    expect(tracking.events.length).toBeGreaterThanOrEqual(1);
  });

  test('requests and approves refund', async () => {
    const payment = await refundService.requestRefund(
      order._id,
      { reason: 'Customer complaint' },
      { userId: user._id }
    );
    const refundId = payment.refunds[0].refundId;

    const admin = await createAdminUser();
    const approved = await refundService.approveRefund(order._id, refundId, { userId: admin._id });
    expect(approved.refunds[0].status).toBe('completed');
  });

  test('completes return via vendor workflow and restores inventory', async () => {
    const vendorReturnService = require('../../src/modules/vendor/services/return.service');
    const Product = require('../../src/database/models/Product');

    const returnRequest = await returnService.createReturn(user._id, order._id, {
      orderItemIndex: 0,
      reason: 'Wrong size',
    });

    const stockBefore = (await Product.findById(order.items[0].productId)).stock;
    const admin = await createAdminUser();
    await vendorReturnService.updateReturnStatus(
      vendorId,
      returnRequest._id,
      { status: 'approved', note: 'Approved' },
      { userId: admin._id }
    );
    await vendorReturnService.updateReturnStatus(
      vendorId,
      returnRequest._id,
      { status: 'qc_passed', note: 'QC passed' },
      { userId: admin._id }
    );
    await vendorReturnService.updateReturnStatus(
      vendorId,
      returnRequest._id,
      { status: 'pickup_assigned', note: 'Pickup scheduled' },
      { userId: admin._id }
    );
    await vendorReturnService.updateReturnStatus(
      vendorId,
      returnRequest._id,
      { status: 'in_transit', note: 'In transit' },
      { userId: admin._id }
    );
    const completed = await vendorReturnService.updateReturnStatus(
      vendorId,
      returnRequest._id,
      { status: 'completed', note: 'Received' },
      { userId: admin._id }
    );

    expect(completed.status).toBe('completed');
    const stockAfter = (await Product.findById(order.items[0].productId)).stock;
    expect(stockAfter).toBe(stockBefore + order.items[0].quantity);
  });
});
