const crypto = require('crypto');
const WebhookEvent = require('../../database/models/WebhookEvent');
const Payment = require('../../database/models/Payment');
const Order = require('../../database/models/Order');
const paymentGateway = require('../../services/paymentGateway');
const logger = require('../../common/logger');
const { triggerService } = require('../../services/notification');

const DUPLICATE_KEY_CODE = 11000;

const resolveEventId = (headers, payload) => {
  const headerId = headers['x-razorpay-event-id'];
  if (headerId) return String(headerId);
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

const markPaymentCaptured = async (paymentEntity) => {
  const payment = await Payment.findOne({ gatewayOrderId: paymentEntity.order_id });
  if (!payment) {
    logger.warn('Webhook payment.captured: payment not found', { orderId: paymentEntity.order_id });
    return;
  }
  if (payment.status === 'captured') return;

  // Razorpay reports what was actually collected. Taking the event as proof of payment
  // without comparing it to what was owed meant a short capture — a partial payment, or
  // an intent whose amount was altered — still marked the order fully paid.
  const capturedPaise = Number(paymentEntity.amount);
  if (!Number.isFinite(capturedPaise) || capturedPaise < payment.amountPaise) {
    logger.warn('Webhook payment.captured: captured amount is short of the amount owed', {
      gatewayOrderId: paymentEntity.order_id,
      capturedPaise,
      expectedPaise: payment.amountPaise,
    });
    return;
  }

  await Payment.findByIdAndUpdate(payment._id, {
    $set: {
      status: 'captured',
      gatewayPaymentId: paymentEntity.id,
    },
  });

  await Order.findByIdAndUpdate(payment.orderId, { $set: { paymentStatus: 'paid' } });

  // The webhook is the authoritative confirmation — it arrives even when the customer
  // closes the tab before the client-side callback runs. Without this, an order that
  // was genuinely paid for stayed stuck awaiting payment and was eventually swept away.
  // activateOrder re-checks the captured total and is safe to reach twice, so the
  // client callback and this racing each other is fine.
  const orderService = require('../../modules/orders/services/order.service');
  try {
    await orderService.activateOrder(payment.orderId);
  } catch (activationError) {
    logger.warn('Webhook payment.captured: order activation failed', {
      orderId: String(payment.orderId),
      error: activationError.message,
    });
  }

  const order = await Order.findById(payment.orderId).lean();
  if (order) {
    triggerService.notifyPaymentSuccess(order);
  }
};

const markPaymentFailed = async (paymentEntity) => {
  const payment = await Payment.findOne({ gatewayOrderId: paymentEntity.order_id });
  if (!payment || payment.status === 'captured') return;

  await Payment.findByIdAndUpdate(payment._id, {
    $set: {
      status: 'failed',
      failureReason: paymentEntity.error_description || paymentEntity.error_reason || 'Payment failed',
    },
  });

  const order = await Order.findById(payment.orderId).lean();
  if (order) {
    triggerService.notifyPaymentFailed(
      order,
      paymentEntity.error_description || paymentEntity.error_reason
    );
  }
};

const handleRefundCreated = async (refundEntity) => {
  const payment = await Payment.findOne({ gatewayPaymentId: refundEntity.payment_id });
  if (!payment) return;

  const refundAmount = refundEntity.amount || payment.amountPaise;
  const newStatus = refundAmount >= payment.amountPaise ? 'refunded' : 'partially_refunded';

  await Payment.findByIdAndUpdate(payment._id, {
    $set: { status: newStatus },
    $push: {
      refunds: {
        refundId: refundEntity.id,
        amountPaise: refundAmount,
        at: new Date(),
        reason: refundEntity.notes?.reason || 'Webhook refund',
        status: 'completed',
      },
    },
  });
};

const dispatchEvent = async (eventType, payload) => {
  const entity = payload.payload?.payment?.entity || payload.payload?.refund?.entity;
  if (!entity) return;

  switch (eventType) {
    case 'payment.captured':
      await markPaymentCaptured(entity);
      break;
    case 'payment.failed':
      await markPaymentFailed(entity);
      break;
    case 'refund.created':
      await handleRefundCreated(entity);
      break;
    default:
      break;
  }
};

const processRazorpayWebhook = async (rawBody, headers) => {
  const signature = headers['x-razorpay-signature'];
  if (!paymentGateway.verifyWebhookSignature(rawBody, signature)) {
    const error = new Error('Invalid webhook signature');
    error.statusCode = 401;
    throw error;
  }

  const payload = JSON.parse(rawBody.toString('utf8'));
  const eventId = resolveEventId(headers, payload);
  const eventType = payload.event;

  let webhookEvent;
  try {
    [webhookEvent] = await WebhookEvent.create([
      {
        provider: 'razorpay',
        eventId,
        eventType,
        status: 'processing',
        payload,
      },
    ]);
  } catch (error) {
    if (error.code === DUPLICATE_KEY_CODE) {
      return { duplicate: true };
    }
    throw error;
  }

  try {
    await dispatchEvent(eventType, payload);
    await WebhookEvent.findByIdAndUpdate(webhookEvent._id, { $set: { status: 'processed' } });
    return { duplicate: false };
  } catch (error) {
    await WebhookEvent.findByIdAndUpdate(webhookEvent._id, {
      $set: { status: 'failed', error: error.message },
    });
    throw error;
  }
};

module.exports = { processRazorpayWebhook };
