const { success, created, paginated } = require('../../../common/response');
const asyncHandler = require('../../../utils/asyncHandler');
const { ROLES } = require('../../../constants/roles');
const checkoutService = require('../services/checkout.service');
const orderService = require('../services/order.service');
const cancellationService = require('../services/cancellation.service');
const refundService = require('../services/refund.service');
const returnService = require('../services/return.service');
const deliveryService = require('../services/delivery.service');
const invoiceService = require('../services/invoice.service');
const paymentService = require('../services/payment.service');
const orderAccessPolicy = require('../policies/orderAccess.policy');
const config = require('../../../config');

const ordersController = {
  validateCheckout: asyncHandler(async (req, res) => {
    const audience = checkoutService.resolveAudience(req.auth, req.query.audience || req.body.audience);
    const result = await checkoutService.validateCheckout(req.auth.userId, audience, req.body);
    return success(res, result, 'Checkout validation passed', undefined, req);
  }),

  getCheckoutSummary: asyncHandler(async (req, res) => {
    const audience = checkoutService.resolveAudience(req.auth, req.query.audience || req.body.audience);
    const summary = await checkoutService.getOrderSummary(req.auth.userId, audience, req.body);
    return success(res, { summary }, 'Checkout summary fetched', undefined, req);
  }),

  createOrder: asyncHandler(async (req, res) => {
    const audience = checkoutService.resolveAudience(req.auth, req.body.audience);
    const order = await orderService.createOrder(req.auth.userId, audience, req.body, req.auth);
    if (!order) {
      throw new BadRequestError('Failed to create order', null, 'ORDER_CREATION_FAILED');
    }
    const payment = await paymentService.getPaymentByOrder(order._id);

    const razorpayKeyId = config.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;

    const checkout =
      payment && payment.gateway === 'razorpay'
        ? {
            keyId: razorpayKeyId,
            razorpayOrderId: payment.gatewayOrderId,
            amountPaise: payment.amountPaise,
            currency: payment.currency || 'INR',
          }
        : null;

    return created(res, { order, payment, checkout }, 'Order created', req);
  }),

  listOrders: asyncHandler(async (req, res) => {
    let result;
    if (orderAccessPolicy.isPlatformAdmin(req.auth)) {
      result = await orderService.listAllOrders(req.query);
    } else if (
      req.auth.role === ROLES.SCHOOL_ADMIN &&
      req.query.scope === 'pickup' &&
      req.auth.tenantSchoolId
    ) {
      result = await orderService.listSchoolPickupOrders(req.auth.tenantSchoolId, req.query);
    } else {
      const audience = orderAccessPolicy.resolveAudience(req.auth);
      result = await orderService.listCustomerOrders(req.auth.userId, req.query, { audience });
    }
    return paginated(res, { orders: result.data }, result.pagination, 'Orders fetched', req);
  }),

  getOrder: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    return success(res, { order }, 'Order fetched', undefined, req);
  }),

  getOrderTimeline: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    return success(res, { timeline: orderService.getTimeline(order) }, 'Order timeline fetched', undefined, req);
  }),

  trackOrder: asyncHandler(async (req, res) => {
    const order = await orderService.getOrderByNumber(req.params.orderNumber);
    return success(
      res,
      {
        order: {
          orderNumber: order.orderNumber,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          placedAt: order.placedAt,
          deliveredAt: order.deliveredAt,
          timeline: order.statusHistory,
        },
      },
      'Order tracking fetched',
      undefined,
      req
    );
  }),

  cancelOrder: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    const role = orderAccessPolicy.isPlatformAdmin(req.auth) ? 'admin' : 'customer';
    const cancelled = await cancellationService.cancelOrder(
      req.params.orderId,
      { reason: req.body.reason, cancelledBy: req.auth.userId },
      { role }
    );
    return success(res, { order: cancelled }, 'Order cancelled', undefined, req);
  }),

  confirmPayment: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    if (order.orderStatus === 'cancelled') {
      throw new BadRequestError('Cannot confirm payment for a cancelled order', null, 'ORDER_CANCELLED');
    }
    const payment = await paymentService.confirmPayment(order._id, req.body);
    // Promotes a held online order into a real one — but only after re-reading the
    // captured total from the Payment collection, so reaching this endpoint is not by
    // itself enough to make an order fulfilable.
    const activated = await orderService.activateOrder(order._id);
    if (activated.orderStatus !== 'pending_payment' && activated.paymentStatus !== 'paid') {
      await orderService.updatePaymentStatus(order._id, 'paid');
    }
    return success(res, { payment, order: activated }, 'Payment confirmed', undefined, req);
  }),

  requestRefund: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    const payment = await refundService.requestRefund(req.params.orderId, req.body, req.auth);
    return success(res, { payment }, 'Refund requested', undefined, req);
  }),

  listRefunds: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    const refunds = await refundService.getRefunds(req.params.orderId);
    return success(res, { refunds }, 'Refunds fetched', undefined, req);
  }),

  approveRefund: asyncHandler(async (req, res) => {
    const payment = await refundService.approveRefund(req.params.orderId, req.params.refundId, req.auth);
    return success(res, { payment }, 'Refund approved', undefined, req);
  }),

  rejectRefund: asyncHandler(async (req, res) => {
    const payment = await refundService.rejectRefund(
      req.params.orderId,
      req.params.refundId,
      req.body.reason,
      req.auth
    );
    return success(res, { payment }, 'Refund rejected', undefined, req);
  }),

  createReturn: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    const returnRequest = await returnService.createReturn(req.auth.userId, req.params.orderId, req.body);
    return created(res, { return: returnRequest }, 'Return requested', req);
  }),

  listReturns: asyncHandler(async (req, res) => {
    const { data, pagination } = await returnService.listUserReturns(req.auth.userId, req.query);
    return paginated(res, { returns: data }, pagination, 'Returns fetched', req);
  }),

  getReturn: asyncHandler(async (req, res) => {
    const returnRequest = await returnService.getReturn(req.auth.userId, req.params.returnId);
    return success(res, { return: returnRequest }, 'Return fetched', undefined, req);
  }),

  listShipments: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    const shipments = await deliveryService.listShipments(req.params.orderId);
    return success(res, { shipments }, 'Shipments fetched', undefined, req);
  }),

  assignShipment: asyncHandler(async (req, res) => {
    const shipment = await deliveryService.assignShipment(
      req.params.orderId,
      req.body.vendorId,
      req.body,
      req.auth
    );
    return success(res, { shipment }, 'Shipment assigned', undefined, req);
  }),

  updateShipment: asyncHandler(async (req, res) => {
    const shipment = await deliveryService.updateShipmentStatus(
      req.params.orderId,
      req.params.shipmentId,
      req.body,
      req.auth
    );
    return success(res, { shipment }, 'Shipment updated', undefined, req);
  }),

  getTracking: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    const tracking = await deliveryService.getTracking(req.params.orderId, req.params.shipmentId);
    return success(res, tracking, 'Tracking fetched', undefined, req);
  }),

  generateInvoice: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    const invoice = await invoiceService.generateInvoice(req.params.orderId);
    return success(res, { invoice }, 'Invoice generated', undefined, req);
  }),

  getInvoice: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.params.orderId);
    await orderAccessPolicy.assertOrderAccess(req.auth, order);
    const invoice = await invoiceService.getInvoice(req.params.orderId);
    return success(res, { invoice }, 'Invoice fetched', undefined, req);
  }),

  updateOrderStatus: asyncHandler(async (req, res) => {
    const order = await orderService.transitionStatus(req.params.orderId, req.body, req.auth, {
      force: orderAccessPolicy.isPlatformAdmin(req.auth),
    });
    return success(res, { order }, 'Order status updated', undefined, req);
  }),
};

module.exports = ordersController;
