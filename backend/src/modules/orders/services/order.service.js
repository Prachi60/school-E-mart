const mongoose = require('mongoose');
const { NotFoundError, BadRequestError } = require('../../../common/errors');
const Order = require('../../../database/models/Order');
const OrderShipment = require('../../../database/models/OrderShipment');
const orderRepository = require('../repositories/order.repository');
const checkoutService = require('./checkout.service');
const commissionService = require('./commission.service');
const inventoryService = require('./inventory.service');
const paymentService = require('./payment.service');
const cartService = require('../../marketplace/services/cart.service');
const paymentRepository = require('../repositories/payment.repository');
const { generateOrderNumber } = require('../utils/orderNumber');
const { runAtomic } = require('../utils/atomic');
const { canTransition, AWAITING_PAYMENT } = require('../utils/statusMachine');

// How long an unpaid online order holds its stock before the sweeper releases it.
// Long enough for a customer to finish a UPI collect request, short enough that an
// abandoned checkout does not keep goods off the shelf.
const PENDING_PAYMENT_TTL_MS = 30 * 60 * 1000;
const settlementService = require('../../vendor/services/settlement.service');
const walletService = require('../../wallet/services/wallet.service');
const { deliveryShipmentQueue } = require('../../../queues/deliveryQueues');
const { triggerService } = require('../../../services/notification');

const stripPaginationMeta = (query = {}) => {
  const paginationQuery = { ...query };
  [
    'vendorId',
    'schoolId',
    'scope',
    'status',
    'paymentStatus',
    'audience',
    'userId',
    'search',
    'from',
    'to',
  ].forEach((key) => delete paginationQuery[key]);
  return paginationQuery;
};

const orderService = {
  async createOrder(userId, audience, payload, actor = {}) {
    const summary = await checkoutService.getOrderSummary(userId, audience, payload);
    checkoutService.validateShipping({
      address: payload.address,
      deliveryType: payload.deliveryType || 'home',
      schoolIdForPickup: payload.schoolIdForPickup,
    });

    const paymentMethod = payload.paymentMethod || 'cod';
    const vendorIds = [...new Set(summary.items.map((item) => item.vendorId))];

    // Snapshot the commission split onto each line so payouts are fixed at order
    // time and never re-priced by a later rate change.
    const commissionSplits = await commissionService.resolveItemsCommission(summary.items, {
      userId,
      audience,
    });

    // Wallet application: clamp the requested amount to the wallet balance and the
    // order total; the gateway / COD collects only the remaining payable amount.
    const walletBalance = await walletService.getBalance(userId);
    const requestedWallet = Math.max(0, Math.round(Number(payload.walletAmountPaise) || 0));
    const walletAmountPaise = Math.min(requestedWallet, walletBalance.balancePaise, summary.totalPaise);
    const payablePaise = summary.totalPaise - walletAmountPaise;

    return runAtomic(async (session) => {
      const opts = session ? { session } : {};

      // Block duplicate kit purchases for the same parent
      const Kit = require('../../../database/models/Kit');
      const kitIdsInOrder = [];
      for (const item of summary.items) {
        const idToCheck = item.kitId || item.productId;
        if (idToCheck) {
          const isKit = await Kit.exists({ _id: idToCheck });
          if (isKit) kitIdsInOrder.push(idToCheck);
        }
      }

      if (kitIdsInOrder.length) {
        const existingKitOrder = await Order.findOne({
          userId,
          orderStatus: { $nin: ['cancelled', 'returned'] },
          $or: [
            { 'items.kitId': { $in: kitIdsInOrder } },
            { 'items.productId': { $in: kitIdsInOrder } },
          ],
        }).session(session).lean();

        if (existingKitOrder) {
          throw new BadRequestError('You have already purchased this kit.', null, 'KIT_ALREADY_PURCHASED');
        }
      }

      await inventoryService.deductStock(summary.items, session);

      const orderNumber = generateOrderNumber();

      // An online order with money still to collect is not a placed order. It is held
      // as 'pending_payment' — no vendor sees it, no shipment or delivery job exists
      // for it, the cart is left intact, and nobody is told an order was placed — until
      // a payment is actually captured. COD is different by design: the courier
      // collects on delivery, so the order is real the moment it is placed. A fully
      // wallet-paid or zero-total order is already paid, so it is real too.
      const requiresPrepayment = paymentMethod === 'online' && payablePaise > 0;
      const initialStatus = requiresPrepayment ? 'pending_payment' : 'placed';
      const paymentStatus = payablePaise === 0 ? 'paid' : 'pending';

      const [order] = await Order.create(
        [
          {
            orderNumber,
            userId,
            audience,
            items: summary.items.map((item, idx) => ({
              productId: item.productId,
              vendorId: item.vendorId,
              name: item.name,
              sku: item.sku,
              image: item.image,
              variantId: item.variantId,
              pricePaise: item.pricePaise,
              mrpPaise: item.mrpPaise,
              quantity: item.quantity,
              size: item.size,
              taxRatePercent: item.taxRatePercent,
              taxPaise: item.taxPaise,
              lineTotalPaise: item.lineTotalPaise,
              // Commission snapshot (see commission.service). schoolId is the
              // school that earns the school share on this line, if any.
              kitId: item.kitId || undefined,
              kitItems: item.kitItems || undefined,
              schoolId: commissionSplits[idx]?.schoolId || undefined,
              commission: {
                adminPercent: commissionSplits[idx]?.adminPercent ?? 0,
                schoolPercent: commissionSplits[idx]?.schoolPercent ?? 0,
              },
              fulfilmentStatus: 'placed',
            })),
            vendorIds,
            subtotalPaise: summary.subtotalPaise,
            taxPaise: summary.taxPaise,
            discountPaise: summary.discountPaise,
            platformFeePaise: summary.platformFeePaise,
            deliveryChargePaise: summary.deliveryChargePaise,
            handlingChargePaise: summary.handlingChargePaise,
            totalPaise: summary.totalPaise,
            walletAmountPaise,
            address: payload.address,
            gstin: payload.gstin,
            deliveryType: payload.deliveryType || 'home',
            schoolIdForPickup: payload.schoolIdForPickup,
            paymentMethod,
            paymentStatus,
            orderStatus: initialStatus,
            ...(requiresPrepayment
              ? { paymentExpiresAt: new Date(Date.now() + PENDING_PAYMENT_TTL_MS) }
              : {}),
            statusHistory: [
              {
                status: initialStatus,
                at: new Date(),
                note: requiresPrepayment ? 'Awaiting online payment' : 'Order placed',
                byUserId: actor.userId || userId,
              },
            ],
            placedAt: new Date(),
          },
        ],
        opts
      );

      // Debit the wallet portion first so an insufficient balance aborts before
      // any gateway work (the amount was already clamped, so this rarely throws).
      if (walletAmountPaise > 0) {
        await walletService.postTransaction(userId, {
          type: 'debit',
          category: 'order_payment',
          amountPaise: walletAmountPaise,
          reference: { kind: 'Order', id: order._id },
          description: `Wallet applied to order ${orderNumber}`,
        });
      }

      const payment = await paymentService.createPaymentForOrder(order, {
        method: paymentMethod,
        amountPaise: payablePaise,
        session,
      });
      if (paymentMethod === 'cod' && payablePaise > 0) {
        await paymentService.confirmPayment(order._id, { session });
      }

      await Order.findByIdAndUpdate(order._id, { $set: { paymentId: payment._id } }, opts);

      // Everything below turns a record into a live order that vendors work on. None of
      // it may happen for an online order that has not been paid for — doing it at
      // creation is precisely what let an unpaid order reach fulfilment. It runs again,
      // once, from activateOrder when the payment is captured.
      if (!requiresPrepayment) {
        await this.applyPlacementEffects(order, summary.items, { session });
        await cartService.clearCart(userId, audience);
      }

      return (await orderRepository.findById(order._id)) || order;
    });
  },

  /**
   * The side effects of an order becoming real: vendor shipments, the delivery job, and
   * telling the customer it was placed. Split out of createOrder so a prepaid online
   * order can run exactly the same steps at the moment its payment is captured.
   *
   * Every step is idempotent or guarded, because activation can be reached twice — once
   * from the client confirming the payment and once from the Razorpay webhook.
   */
  async applyPlacementEffects(order, items, { session = null } = {}) {
    const opts = session ? { session } : {};
    const vendorIds = [...new Set((order.vendorIds || []).map(String))];
    const validVendorIds = vendorIds.filter((vId) => vId && mongoose.Types.ObjectId.isValid(vId));

    const shipmentDocs = [];
    for (const vendorId of validVendorIds) {
      // Guarded rather than blindly created: activation can arrive twice, and a
      // duplicate shipment would show the vendor the same order to pack twice.
      const exists = await OrderShipment.exists({ orderId: order._id, vendorId });
      if (exists) continue;
      shipmentDocs.push({
        orderId: order._id,
        vendorId,
        items: items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => String(item.vendorId) === String(vendorId))
          .map(({ item, index }) => ({ orderItemIndex: index, quantity: item.quantity })),
        status: 'placed',
      });
    }
    if (shipmentDocs.length) {
      await OrderShipment.create(shipmentDocs, opts);
    }

    const address = order.address || {};
    try {
      await deliveryShipmentQueue.add({
        orderId: String(order.orderNumber),
        orderMongoId: order._id,
        pickup: {
          name: 'School E-Mart',
          phone: '9999999999',
          address: 'Default pickup location',
          pincode: address.pinCode || address.pincode || '',
        },
        drop: {
          name: address.name || 'Customer',
          phone: address.phone || '9999999999',
          address: address.line1 || '',
          pincode: address.pinCode || address.pincode || '',
        },
        items: items.map((item) => ({
          name: item.name,
          qty: item.quantity,
          weight: 0.5,
          value: Math.round((item.lineTotalPaise || 0) / 100),
        })),
        paymentMode: order.paymentMethod === 'cod' ? 'COD' : 'PREPAID',
        totalValue: Math.round((order.totalPaise || 0) / 100),
        weight: Math.max(0.5, items.length * 0.5),
        // The queue de-duplicates on this, so a second activation cannot book a
        // second courier pickup for the same order.
        idempotencyKey: `shipment:create:${order.orderNumber}`,
      });
    } catch (shipErr) {
      // Background delivery queue warning should not block order placement
    }

    try {
      const hydrated = (await orderRepository.findById(order._id)) || order;
      if (hydrated && hydrated.userId) {
        triggerService.notifyOrderPlaced(hydrated);
      }
    } catch (notifyErr) {
      // Notification warning should not block order placement
    }
  },

  async getOrder(orderId) {
    let order = null;
    if (mongoose.Types.ObjectId.isValid(String(orderId))) {
      order = await orderRepository.findById(orderId);
    }
    if (!order) {
      order = await orderRepository.findByOrderNumber(orderId);
    }
    if (!order) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    return order;
  },

  async getOrderByNumber(orderNumber) {
    const order = await orderRepository.findByOrderNumber(orderNumber);
    if (!order) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    return order;
  },

  listCustomerOrders(userId, query, { audience } = {}) {
    const filter = { userId };
    if (audience) filter.audience = audience;
    if (query.status) filter.orderStatus = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.search) filter.orderNumber = { $regex: query.search, $options: 'i' };
    if (query.from || query.to) {
      filter['audit.createdAt'] = {};
      if (query.from) filter['audit.createdAt'].$gte = new Date(query.from);
      if (query.to) filter['audit.createdAt'].$lte = new Date(query.to);
    }
    return orderRepository.paginateOrders(filter, stripPaginationMeta(query));
  },

  listAllOrders(query) {
    const filter = {};
    // An unpaid online order is not a sale. It stays out of the operations list and
    // out of every total computed from it unless someone asks for it by name.
    if (!query.status) filter.orderStatus = { $ne: AWAITING_PAYMENT };
    if (query.status) filter.orderStatus = query.status;
    if (query.audience) filter.audience = query.audience;
    if (query.userId) filter.userId = query.userId;
    if (query.vendorId) filter.vendorIds = query.vendorId;
    if (query.schoolId) filter.schoolIdForPickup = query.schoolId;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.search) filter.orderNumber = { $regex: query.search, $options: 'i' };
    if (query.from || query.to) {
      filter['audit.createdAt'] = {};
      if (query.from) filter['audit.createdAt'].$gte = new Date(query.from);
      if (query.to) filter['audit.createdAt'].$lte = new Date(query.to);
    }
    return orderRepository.paginateOrders(filter, stripPaginationMeta(query));
  },

  listSchoolPickupOrders(schoolId, query) {
    const filter = {};
    // Same rule as the admin list: a school must not be told to expect a delivery for
    // an order nobody has paid for.
    if (!query.status) filter.orderStatus = { $ne: AWAITING_PAYMENT };
    if (query.status) filter.orderStatus = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.search) filter.orderNumber = { $regex: query.search, $options: 'i' };
    if (query.from || query.to) {
      filter['audit.createdAt'] = {};
      if (query.from) filter['audit.createdAt'].$gte = new Date(query.from);
      if (query.to) filter['audit.createdAt'].$lte = new Date(query.to);
    }
    return orderRepository.paginateSchoolPickupOrders(schoolId, stripPaginationMeta(query), filter);
  },

  /**
   * Promote a paid online order into a real, placed order.
   *
   * This is the ONLY way a 'pending_payment' order becomes fulfilable, and it refuses
   * to run unless a captured payment covering the outstanding balance actually exists —
   * so it cannot be driven by a client simply calling the confirm endpoint. Safe to
   * call more than once: the client callback and the Razorpay webhook both land here,
   * and whichever arrives second is a no-op.
   */
  async activateOrder(orderId, { expectedPaidPaise = null } = {}) {
    const order = await Order.findById(orderId).lean();
    if (!order) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    if (order.orderStatus !== AWAITING_PAYMENT) return order;

    if (order.orderStatus === 'cancelled') {
      throw new BadRequestError('Order was cancelled', null, 'ORDER_CANCELLED');
    }

    // Trust the Payment collection, never the caller. The money owed to the gateway is
    // the total less whatever the wallet already covered.
    const owedPaise =
      expectedPaidPaise == null
        ? Math.max(0, (order.totalPaise || 0) - (order.walletAmountPaise || 0))
        : expectedPaidPaise;
    const capturedPaise = await paymentRepository.sumCapturedForOrder(orderId);
    if (capturedPaise < owedPaise) {
      throw new BadRequestError(
        'Order is not fully paid',
        null,
        'ORDER_NOT_PAID'
      );
    }

    // Conditional on still being unpaid, so two concurrent activations (client callback
    // racing the webhook) cannot both pass this point and double-run the effects.
    const promoted = await Order.findOneAndUpdate(
      { _id: orderId, orderStatus: AWAITING_PAYMENT },
      {
        $set: {
          orderStatus: 'placed',
          paymentStatus: 'paid',
          placedAt: new Date(),
          paymentExpiresAt: null,
        },
        $push: {
          statusHistory: { status: 'placed', at: new Date(), note: 'Payment received' },
        },
      },
      { new: true }
    ).lean();
    if (!promoted) return Order.findById(orderId).lean();

    await this.applyPlacementEffects(promoted, promoted.items || []);
    // Only now is the basket actually spent.
    await cartService.clearCart(promoted.userId, promoted.audience);

    return promoted;
  },

  /**
   * Release an online order that was never paid for, returning its stock to the shelf.
   * Without this, an abandoned checkout held its items out of stock permanently.
   */
  async expireUnpaidOrders({ now = new Date(), limit = 200 } = {}) {
    const stale = await Order.find({
      orderStatus: AWAITING_PAYMENT,
      paymentExpiresAt: { $lte: now },
    })
      .limit(limit)
      .lean();

    const expired = [];
    for (const order of stale) {
      // Conditional again: a payment landing at the same moment must win over the
      // sweeper, so the order is only cancelled while it is still unpaid.
      const cancelled = await Order.findOneAndUpdate(
        { _id: order._id, orderStatus: AWAITING_PAYMENT },
        {
          $set: {
            orderStatus: 'cancelled',
            paymentStatus: 'failed',
            cancellation: { at: new Date(), reason: 'Payment was not completed in time' },
          },
          $push: {
            statusHistory: {
              status: 'cancelled',
              at: new Date(),
              note: 'Payment not completed',
            },
          },
        },
        { new: true }
      ).lean();
      if (!cancelled) continue;

      await inventoryService.restoreStock(order.items || []);

      // The wallet portion was debited at creation, so it has to come back too.
      if (order.walletAmountPaise > 0) {
        try {
          await walletService.postTransaction(order.userId, {
            type: 'credit',
            category: 'order_refund',
            amountPaise: order.walletAmountPaise,
            reference: { kind: 'Order', id: order._id },
            description: `Wallet returned — payment not completed for ${order.orderNumber}`,
          });
        } catch (walletErr) {
          // A failed wallet return must not strand the rest of the sweep.
        }
      }
      expired.push(cancelled);
    }

    return expired;
  },

  async updatePaymentStatus(orderId, paymentStatus, { session = null } = {}) {
    const opts = session ? { session } : {};
    const updated = await Order.findByIdAndUpdate(
      orderId,
      { $set: { paymentStatus } },
      { new: true, ...opts }
    ).lean();
    if (!updated) throw new NotFoundError('Order not found', 'ORDER_NOT_FOUND');
    return updated;
  },

  getTimeline(order) {
    return order.statusHistory || [];
  },

  async transitionStatus(orderId, { status, note }, actor = {}, { force = false } = {}) {
    const order = await this.getOrder(orderId);
    if (!force && !canTransition(order.orderStatus, status)) {
      throw new BadRequestError(
        `Cannot transition from ${order.orderStatus} to ${status}`,
        null,
        'INVALID_ORDER_TRANSITION'
      );
    }

    const statusEntry = {
      status,
      at: new Date(),
      note,
      byUserId: actor.userId,
    };

    const update = {
      $set: { orderStatus: status },
      $push: { statusHistory: statusEntry },
    };

    if (status === 'accepted') update.$set.acceptedAt = new Date();
    if (status === 'delivered') {
      update.$set.deliveredAt = new Date();
      update.$set.paymentStatus = order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus;
    }
    if (status === 'returned') update.$set.orderStatus = 'returned';

    const updated = await Order.findByIdAndUpdate(orderId, update, { new: true }).lean();

    if (status === 'delivered') {
      for (const vendorId of updated.vendorIds || []) {
        await settlementService.recordOrderSettlement(vendorId, updated._id);
      }
      // One-time referral bonus on the invitee's first delivered order.
      const referralRewardService = require('../../wallet/services/referralReward.service');
      await referralRewardService.processOrderDelivered(updated);
    }

    triggerService.notifyOrderStatusChange(updated, status, note);
    return updated;
  },
};

module.exports = orderService;
