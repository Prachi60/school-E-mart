const mongoose = require('mongoose');
const orderService = require('../../src/modules/orders/services/order.service');
const paymentService = require('../../src/modules/orders/services/payment.service');
const vendorOrderService = require('../../src/modules/vendor/services/order.service');
const Order = require('../../src/database/models/Order');
const Payment = require('../../src/database/models/Payment');
const Product = require('../../src/database/models/Product');
const Cart = require('../../src/database/models/Cart');
const OrderShipment = require('../../src/database/models/OrderShipment');
const { createParentUser, seedCartForUser, defaultAddress } = require('./helpers');

/**
 * The rule this file exists to defend: an ONLINE order is not an order until the money
 * is actually in. COD is the deliberate exception — the courier collects on delivery,
 * so a COD order is real the moment it is placed.
 */
describe('payment integrity: no online order without payment', () => {
  const placeOnline = async (userId) =>
    orderService.createOrder(
      userId,
      'parent',
      { address: defaultAddress, deliveryType: 'home', paymentMethod: 'online' },
      { userId, role: 'parent' }
    );

  const placeCod = async (userId) =>
    orderService.createOrder(
      userId,
      'parent',
      { address: defaultAddress, deliveryType: 'home', paymentMethod: 'cod' },
      { userId, role: 'parent' }
    );

  describe('an unpaid online order is not a real order', () => {
    test('it is held awaiting payment, not placed', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);

      const order = await placeOnline(user._id);

      expect(order.orderStatus).toBe('pending_payment');
      expect(order.paymentStatus).toBe('pending');
      expect(order.paymentExpiresAt).toBeTruthy();
    });

    test('no vendor shipment exists for it and no vendor can see it', async () => {
      const user = await createParentUser();
      const { vendorId } = await seedCartForUser(user._id);

      const order = await placeOnline(user._id);

      // Nothing for a vendor to pack against money that has not arrived.
      const shipments = await OrderShipment.find({ orderId: order._id });
      expect(shipments).toHaveLength(0);

      const { data } = await vendorOrderService.listOrders(vendorId, {});
      expect(data.map((o) => String(o._id))).not.toContain(String(order._id));

      // Nor by guessing the id.
      await expect(vendorOrderService.getOrder(vendorId, order._id)).rejects.toMatchObject({
        code: 'ORDER_NOT_FOUND',
      });
    });

    test('the cart is left intact so the customer can still retry', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);

      await placeOnline(user._id);

      const cart = await Cart.findOne({ userId: user._id, audience: 'parent' });
      expect(cart.items).toHaveLength(1);
    });

    test('it is kept out of the admin operations list', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);
      const order = await placeOnline(user._id);

      const { data } = await orderService.listAllOrders({});
      expect(data.map((o) => String(o._id))).not.toContain(String(order._id));
    });

    test('no fulfilment transition can move it forward', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);
      const order = await placeOnline(user._id);

      await expect(
        orderService.transitionStatus(order._id, { status: 'accepted' }, { userId: user._id })
      ).rejects.toMatchObject({ code: 'INVALID_ORDER_TRANSITION' });
    });
  });

  describe('activation requires money that actually arrived', () => {
    test('activateOrder refuses while nothing is captured', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);
      const order = await placeOnline(user._id);

      // Reaching the activation path is not itself proof of payment — the captured
      // total is re-read from the Payment collection.
      await expect(orderService.activateOrder(order._id)).rejects.toMatchObject({
        code: 'ORDER_NOT_PAID',
      });

      const stillHeld = await Order.findById(order._id).lean();
      expect(stillHeld.orderStatus).toBe('pending_payment');
    });

    test('a short capture does not activate the order', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);
      const order = await placeOnline(user._id);

      // Someone captured a rupee against a much larger order.
      await Payment.updateOne(
        { orderId: order._id },
        { $set: { status: 'captured', amountPaise: 100 } }
      );

      await expect(orderService.activateOrder(order._id)).rejects.toMatchObject({
        code: 'ORDER_NOT_PAID',
      });
    });

    test('a full capture promotes it into a real, fulfilable order', async () => {
      const user = await createParentUser();
      const { vendorId } = await seedCartForUser(user._id);
      const order = await placeOnline(user._id);

      await Payment.updateOne({ orderId: order._id }, { $set: { status: 'captured' } });
      const activated = await orderService.activateOrder(order._id);

      expect(activated.orderStatus).toBe('placed');
      expect(activated.paymentStatus).toBe('paid');
      expect(activated.paymentExpiresAt).toBeFalsy();

      // The deferred side effects run exactly now, not at creation.
      const shipments = await OrderShipment.find({ orderId: order._id });
      expect(shipments).toHaveLength(1);
      const cart = await Cart.findOne({ userId: user._id, audience: 'parent' });
      expect(cart.items).toHaveLength(0);

      const { data } = await vendorOrderService.listOrders(vendorId, {});
      expect(data.map((o) => String(o._id))).toContain(String(order._id));
    });

    test('activating twice does not duplicate the vendor shipment', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);
      const order = await placeOnline(user._id);
      await Payment.updateOne({ orderId: order._id }, { $set: { status: 'captured' } });

      // The client callback and the Razorpay webhook both land here.
      await orderService.activateOrder(order._id);
      await orderService.activateOrder(order._id);

      const shipments = await OrderShipment.find({ orderId: order._id });
      expect(shipments).toHaveLength(1);
    });
  });

  describe('COD is still allowed to create a real order without prepayment', () => {
    test('a COD order is placed and fulfilable immediately', async () => {
      const user = await createParentUser();
      const { vendorId } = await seedCartForUser(user._id);

      const order = await placeCod(user._id);

      expect(order.orderStatus).toBe('placed');
      const shipments = await OrderShipment.find({ orderId: order._id });
      expect(shipments).toHaveLength(1);
      const cart = await Cart.findOne({ userId: user._id, audience: 'parent' });
      expect(cart.items).toHaveLength(0);

      const { data } = await vendorOrderService.listOrders(vendorId, {});
      expect(data.map((o) => String(o._id))).toContain(String(order._id));
    });
  });

  describe('abandoned checkouts are released', () => {
    test('an expired unpaid order is cancelled and its stock returned', async () => {
      const user = await createParentUser();
      const { product } = await seedCartForUser(user._id);
      const stockBefore = (await Product.findById(product._id)).stock;

      const order = await placeOnline(user._id);
      // Stock is held while the customer is paying...
      expect((await Product.findById(product._id)).stock).toBe(stockBefore - 1);

      await Order.updateOne(
        { _id: order._id },
        { $set: { paymentExpiresAt: new Date(Date.now() - 1000) } }
      );
      const expired = await orderService.expireUnpaidOrders();

      expect(expired.map((o) => String(o._id))).toContain(String(order._id));
      const swept = await Order.findById(order._id).lean();
      expect(swept.orderStatus).toBe('cancelled');
      // ...and handed back when they never do.
      expect((await Product.findById(product._id)).stock).toBe(stockBefore);
    });

    test('an order that has been paid for is never swept', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);
      const order = await placeOnline(user._id);

      await Payment.updateOne({ orderId: order._id }, { $set: { status: 'captured' } });
      await orderService.activateOrder(order._id);
      await Order.updateOne(
        { _id: order._id },
        { $set: { paymentExpiresAt: new Date(Date.now() - 1000) } }
      );

      const expired = await orderService.expireUnpaidOrders();
      expect(expired.map((o) => String(o._id))).not.toContain(String(order._id));
      expect((await Order.findById(order._id).lean()).orderStatus).toBe('placed');
    });
  });

  describe('the stub gateway cannot hand out free captures in production', () => {
    const withNodeEnv = async (value, fn) => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = value;
      try {
        await fn();
      } finally {
        process.env.NODE_ENV = previous;
      }
    };

    test('confirming an internal-gateway online payment is refused outside test/dev', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);
      const order = await placeOnline(user._id);

      // The checkout page called confirmPayment with an empty body whenever Razorpay
      // was unconfigured, and the internal stub reported success — marking the order
      // paid without a rupee moving.
      await withNodeEnv('production', async () => {
        await expect(paymentService.confirmPayment(order._id, {})).rejects.toMatchObject({
          code: 'PAYMENT_GATEWAY_UNAVAILABLE',
        });
      });

      const payment = await Payment.findOne({ orderId: order._id }).lean();
      expect(payment.status).not.toBe('captured');
      const stillHeld = await Order.findById(order._id).lean();
      expect(stillHeld.orderStatus).toBe('pending_payment');
    });

    test('COD confirmation is unaffected by that guard', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);

      await withNodeEnv('production', async () => {
        const order = await placeCod(user._id);
        expect(order.orderStatus).toBe('placed');
        const payment = await Payment.findOne({ orderId: order._id }).lean();
        expect(payment.status).toBe('captured');
      });
    });
  });

  describe('payment creation is genuinely idempotent', () => {
    test('asking twice for the same charge reuses the same payment', async () => {
      const user = await createParentUser();
      await seedCartForUser(user._id);
      const order = await placeOnline(user._id);

      const orderDoc = await Order.findById(order._id).lean();
      const again = await paymentService.createPaymentForOrder(orderDoc, {
        method: 'online',
        amountPaise: orderDoc.totalPaise,
      });

      const payments = await Payment.find({ orderId: order._id }).lean();
      expect(payments).toHaveLength(1);
      expect(String(again._id)).toBe(String(payments[0]._id));
    });
  });
});
