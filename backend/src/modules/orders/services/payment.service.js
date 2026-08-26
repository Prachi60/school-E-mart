const { NotFoundError, ConflictError, BadRequestError } = require('../../../common/errors');
const paymentRepository = require('../repositories/payment.repository');
const paymentGateway = require('../../../services/paymentGateway');
const Payment = require('../../../database/models/Payment');
const Order = require('../../../database/models/Order');
const { triggerService } = require('../../../services/notification');

/**
 * Whether an online payment may be "captured" through the internal stub gateway.
 *
 * Only ever true where no real money exists: the automated tests, and a local dev
 * machine that has deliberately opted in. In every other environment a missing
 * Razorpay configuration must fail the payment rather than hand out a free capture.
 */
const allowStubCapture = () =>
  process.env.NODE_ENV === 'test' || process.env.ALLOW_STUB_PAYMENTS === 'true';

const paymentService = {
  allowStubCapture,

  async createPaymentForOrder(order, { method, amountPaise, session = null }) {
    // The gateway collects only what the wallet did not cover. Defaults to the
    // full total when no explicit amount is given (unchanged legacy behaviour).
    const chargePaise = amountPaise == null ? order.totalPaise : amountPaise;

    // Derived from what the payment IS, not from a fresh random string. The key used to
    // be `order-<id>-<random>`, which differed on every call — so the lookup below could
    // never match and the idempotency this function advertises did not exist: a retried
    // checkout silently created a second Payment (and a second gateway intent) for the
    // same money. An RFQ order legitimately has two payments (advance, then remainder),
    // and those differ by amount, so the amount is part of the key.
    const idempotencyKey = `order-${order._id}-${method === 'cod' ? 'cod' : 'online'}-${chargePaise}`;
    const existing = await paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) return existing;

    const opts = session ? { session } : {};

    // Fully wallet-paid: nothing to collect, so skip the gateway and record a
    // captured wallet payment directly.
    if (chargePaise <= 0) {
      const [walletPayment] = await Payment.create(
        [
          {
            orderId: order._id,
            userId: order.userId,
            amountPaise: 0,
            currency: 'INR',
            method: 'wallet',
            gateway: 'internal',
            status: 'captured',
            idempotencyKey,
          },
        ],
        opts
      );
      return walletPayment;
    }

    const intent = await paymentGateway.createPaymentIntent({
      orderId: order._id,
      amountPaise: chargePaise,
      method: method === 'cod' ? 'cod' : 'upi',
    });

    const [payment] = await Payment.create(
      [
        {
          orderId: order._id,
          userId: order.userId,
          amountPaise: chargePaise,
          currency: 'INR',
          method: method === 'cod' ? 'cod' : 'upi',
          gateway: intent.gateway,
          gatewayOrderId: intent.gatewayOrderId,
          status: method === 'cod' ? 'authorized' : 'initiated',
          idempotencyKey,
        },
      ],
      opts
    );

    return payment;
  },

  async confirmPayment(
    orderId,
    { paymentId, razorpayPaymentId, razorpayOrderId, razorpaySignature, session = null } = {}
  ) {
    const opts = session ? { session } : {};
    // Within an active transaction (e.g. COD confirmation right after order
    // creation), the payment was just inserted in this same session — a
    // session-less read would miss it under snapshot isolation and 404 here.
    //
    // `findByOrderId` is a bare findOne({orderId}) — fine while an order only
    // ever has one Payment, but an RFQ order gets a second one for the
    // remainder after the advance is captured. Callers that know exactly
    // which payment they mean (advance vs remainder) pass paymentId to
    // target it directly instead of relying on find-the-only-one-for-order.
    const payment = paymentId
      ? await paymentRepository.findById(paymentId, {}, opts)
      : await paymentRepository.findByOrderId(orderId, opts);
    if (!payment) throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
    if (String(payment.orderId) !== String(orderId)) {
      throw new BadRequestError('Payment does not belong to this order', null, 'PAYMENT_ORDER_MISMATCH');
    }
    if (payment.status === 'captured') return payment;

    let gatewayPaymentId;

    if (payment.gateway === 'razorpay') {
      if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
        throw new BadRequestError(
          'Razorpay payment details are required',
          null,
          'RAZORPAY_DETAILS_REQUIRED'
        );
      }
      if (payment.gatewayOrderId !== razorpayOrderId) {
        throw new BadRequestError('Payment order mismatch', null, 'PAYMENT_ORDER_MISMATCH');
      }
      const valid = paymentGateway.verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      if (!valid) {
        throw new BadRequestError('Invalid payment signature', null, 'INVALID_PAYMENT_SIGNATURE');
      }
      gatewayPaymentId = razorpayPaymentId;
    } else if (payment.method === 'cod' || payment.method === 'wallet') {
      // COD is "captured" at placement because the courier collects later, and a
      // wallet payment was already debited from a real balance. Neither involves a
      // gateway, so there is nothing to verify.
      const capture = await paymentGateway.capturePayment({
        gatewayOrderId: payment.gatewayOrderId,
        gateway: payment.gateway,
      });
      gatewayPaymentId = capture.gatewayPaymentId;
    } else {
      // An online payment on the internal gateway means Razorpay was not configured
      // when the intent was created. The internal gateway is a stub: its
      // capturePayment fabricates an id and reports success without any money
      // moving. Capturing through it marked online orders paid for free — and the
      // checkout page calls this endpoint with an empty body in exactly that case,
      // so the hole was reachable by every customer, not just an attacker.
      //
      // Outside test/dev this is a misconfiguration, and the safe response to
      // "payments are not set up" is to refuse the payment, never to grant it.
      if (!allowStubCapture()) {
        throw new BadRequestError(
          'Online payments are not available right now. Please try again later or choose Cash on Delivery.',
          null,
          'PAYMENT_GATEWAY_UNAVAILABLE'
        );
      }
      const capture = await paymentGateway.capturePayment({
        gatewayOrderId: payment.gatewayOrderId,
        gateway: payment.gateway,
      });
      gatewayPaymentId = capture.gatewayPaymentId;
    }

    const updated = await Payment.findByIdAndUpdate(
      payment._id,
      {
        $set: {
          status: 'captured',
          gatewayPaymentId,
          ...(razorpaySignature ? { gatewaySignature: razorpaySignature } : {}),
        },
      },
      { new: true, ...opts }
    ).lean();

    const order = await Order.findById(orderId).lean();
    if (order) {
      triggerService.notifyPaymentSuccess(order);
    }

    return updated;
  },

  async getPaymentByOrder(orderId) {
    const payment = await paymentRepository.findByOrderId(orderId);
    if (!payment) throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
    return payment;
  },

  async initiateRefund(orderId, { amountPaise, reason, actorUserId }, { session = null } = {}) {
    const opts = session ? { session } : {};
    const payment = await paymentRepository.findByOrderId(orderId, opts);
    if (!payment) throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
    if (!['captured', 'authorized', 'partially_refunded'].includes(payment.status)) {
      throw new BadRequestError('Payment is not refundable', null, 'PAYMENT_NOT_REFUNDABLE');
    }

    const refundAmount = amountPaise || payment.amountPaise;
    if (refundAmount > payment.amountPaise) {
      throw new BadRequestError('Refund amount exceeds payment', null, 'REFUND_AMOUNT_EXCEEDED');
    }

    const gatewayRefund = await paymentGateway.initiateRefund({
      gatewayPaymentId: payment.gatewayPaymentId || payment.gatewayOrderId,
      amountPaise: refundAmount,
      reason,
      gateway: payment.gateway,
    });

    const refundEntry = {
      refundId: gatewayRefund.refundId,
      amountPaise: refundAmount,
      at: new Date(),
      reason,
      status: 'initiated',
      requestedBy: actorUserId,
    };

    const newStatus = refundAmount >= payment.amountPaise ? 'refunded' : 'partially_refunded';
    return Payment.findByIdAndUpdate(
      payment._id,
      {
        $set: { status: newStatus },
        $push: { refunds: refundEntry },
      },
      { new: true, ...opts }
    ).lean();
  },

  async approveRefund(orderId, refundId, actorUserId) {
    const payment = await paymentRepository.findByOrderId(orderId);
    if (!payment) throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');

    const refund = (payment.refunds || []).find((r) => r.refundId === refundId);
    if (!refund) throw new NotFoundError('Refund not found', 'REFUND_NOT_FOUND');
    if (refund.status === 'completed') {
      throw new ConflictError('Refund already completed', 'REFUND_ALREADY_COMPLETED');
    }

    return Payment.findOneAndUpdate(
      { _id: payment._id, 'refunds.refundId': refundId },
      {
        $set: {
          'refunds.$.status': 'completed',
          'refunds.$.approvedBy': actorUserId,
          'refunds.$.approvedAt': new Date(),
        },
      },
      { new: true }
    ).lean();
  },

  async rejectRefund(orderId, refundId, reason, actorUserId) {
    const payment = await paymentRepository.findByOrderId(orderId);
    if (!payment) throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');

    return Payment.findOneAndUpdate(
      { _id: payment._id, 'refunds.refundId': refundId },
      {
        $set: {
          'refunds.$.status': 'rejected',
          'refunds.$.rejectionReason': reason,
          'refunds.$.rejectedBy': actorUserId,
          'refunds.$.rejectedAt': new Date(),
        },
      },
      { new: true }
    ).lean();
  },
};

module.exports = paymentService;
