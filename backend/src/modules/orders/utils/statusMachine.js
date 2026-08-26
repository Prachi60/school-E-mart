const ORDER_TRANSITIONS = {
  // An unpaid online order can only become a real order by being paid for, or go away.
  // Every fulfilment step is unreachable from here, so no vendor or admin action can
  // move an unpaid order down the pipeline.
  pending_payment: ['placed', 'cancelled'],
  placed: ['accepted', 'cancelled'],
  accepted: ['processed', 'cancelled'],
  processed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

const CUSTOMER_CANCELLABLE = new Set(['pending_payment', 'placed', 'accepted']);
const ADMIN_CANCELLABLE = new Set(['pending_payment', 'placed', 'accepted', 'processed', 'packed']);
// Vendors never see an unpaid order, so they have nothing to cancel there.
const VENDOR_CANCELLABLE = new Set(['placed', 'accepted', 'processed', 'packed']);

const RETURN_ELIGIBLE = new Set(['delivered']);

// Statuses that are not yet a real order. Fulfilment surfaces (vendor, school pickup,
// admin operations) filter these out, and reporting must not count them as sales.
const AWAITING_PAYMENT = 'pending_payment';

const isAwaitingPayment = (status) => status === AWAITING_PAYMENT;

const canTransition = (from, to) => (ORDER_TRANSITIONS[from] || []).includes(to);

const canCustomerCancel = (status) => CUSTOMER_CANCELLABLE.has(status);

const canAdminCancel = (status) => ADMIN_CANCELLABLE.has(status);

const canVendorCancel = (status) => VENDOR_CANCELLABLE.has(status);

module.exports = {
  ORDER_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  ADMIN_CANCELLABLE,
  VENDOR_CANCELLABLE,
  RETURN_ELIGIBLE,
  AWAITING_PAYMENT,
  isAwaitingPayment,
  canTransition,
  canCustomerCancel,
  canAdminCancel,
  canVendorCancel,
};
