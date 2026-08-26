const mongoose = require('mongoose');
const auditPlugin = require('../plugins/audit.plugin');
const softDeletePlugin = require('../plugins/softDelete.plugin');

const orderSchema = new mongoose.Schema({
  orderNumber: { 
    type: String, 
    required: true, 
    unique: true,
    match: /^(ORD\d{10,}|PROC-\d{4,})$/
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  audience: {
    type: String,
    enum: ['parent', 'school'],
    required: true
  },
  schoolIdForPickup: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile', required: true },
    // Set only for kit line items: the school that authored the kit (earns the
    // school commission) and the kit itself. Left empty for ordinary products.
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    kitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kit' },
    // Set only for RFQ-awarded line items: traces the order back to the request
    // the school sent and the specific vendor quote that was accepted for it.
    rfqId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rfq' },
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
    // Snapshot of the kit's individual contents at order time, so the vendor has
    // a pick list even if the kit definition changes or items are later edited.
    kitItems: [{
      name: { type: String },
      category: { type: String },
      subcategory: { type: String },
      imageUrl: { type: String },
      qty: { type: Number },
      attributes: { type: mongoose.Schema.Types.Mixed },
      // The parent's actual choice out of `attributes.sizes`/`attributes.colors`
      // at the time this kit was ordered — what the vendor must actually pack,
      // as opposed to `attributes` which is just the full menu of options the
      // school made available. Null when the item didn't offer that choice.
      selectedSize: { type: String },
      selectedColor: { type: String },
      packed: { type: Boolean, default: false }
    }],
    // Commission split snapshotted at order time so a later rate change never
    // rewrites the economics of an order already placed. When present, settlement
    // uses these; when absent it falls back to the vendor's flat rate.
    commission: {
      adminPercent: { type: Number },
      schoolPercent: { type: Number }
    },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    image: { type: String },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductVariant' },
    pricePaise: { type: Number, required: true, min: 0 },
    mrpPaise: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    size: { type: String },
    taxRatePercent: { type: mongoose.Schema.Types.Decimal128 },
    taxPaise: { type: Number, required: true, min: 0 },
    lineTotalPaise: { type: Number, required: true, min: 0 },
    fulfilmentStatus: { type: String }
  }],
  vendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile' }], // Distinct vendors in order
  subtotalPaise: { type: Number, required: true, min: 0 },
  taxPaise: { type: Number, required: true, min: 0 },
  discountPaise: { type: Number, required: true, min: 0, default: 0 },
  platformFeePaise: { type: Number, required: true, min: 0, default: 0 },
  deliveryChargePaise: { type: Number, required: true, min: 0, default: 0 },
  handlingChargePaise: { type: Number, required: true, min: 0, default: 0 },
  totalPaise: { type: Number, required: true, min: 0 },
  // Portion of totalPaise paid from the customer's wallet balance. The gateway /
  // COD collects (totalPaise - walletAmountPaise). Refunded to the wallet on cancel.
  walletAmountPaise: { type: Number, required: true, min: 0, default: 0 },
  address: { type: mongoose.Schema.Types.Mixed, required: true }, // Embedded snapshot
  gstin: { type: String },
  deliveryType: {
    type: String,
    enum: ['home', 'school'],
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['online', 'cod'],
    required: true
  },
  paymentStatus: {
    type: String,
    // 'partially_paid': only the RFQ advance has been captured so far — the
    // remainder is still owed and collected later via a second payment.
    enum: ['pending', 'authorized', 'paid', 'partially_paid', 'failed', 'refunded', 'partially_refunded'],
    required: true,
    default: 'pending'
  },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  // Set only on orders created from an awarded RFQ quote. advancePaise is the
  // vendor-defined up-front amount (snapshotted from the quote); remainderPaise
  // is what's left of totalPaise after the advance. remainderPaymentId points at
  // the second Payment document once the balance has been paid — paymentId above
  // always continues to reference whichever payment was most recently made.
  rfqAdvance: {
    advancePaise: { type: Number, min: 0 },
    remainderPaise: { type: Number, min: 0 },
    // Both set once their respective payment is first created, and never
    // overwritten after — unlike paymentId above (which always points at
    // whichever payment was most recently made), these stay the reliable way
    // to look up "the advance payment" specifically once a remainder payment
    // also exists for the same order.
    advancePaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    remainderPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    remainderPaidAt: { type: Date }
  },
  orderStatus: {
    type: String,
    // 'pending_payment': an online order whose money has not been collected yet. It is
    // NOT a placed order — no vendor sees it, no stock leaves on it permanently, no
    // shipment or delivery job exists for it, and the customer's cart is still intact.
    // It becomes 'placed' only when a payment is actually captured, and is swept away
    // (with its stock restored) if that never happens. Creating online orders straight
    // into 'placed' is what let an unpaid order enter fulfilment.
    enum: ['pending_payment', 'placed', 'accepted', 'processed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    required: true,
    default: 'placed'
  },
  // When an unpaid online order stops being reservable. Used by the sweeper that
  // cancels abandoned checkouts and gives their stock back.
  paymentExpiresAt: { type: Date },
  statusHistory: [{
    status: { type: String, required: true },
    at: { type: Date, required: true, default: Date.now },
    note: { type: String },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  cancellation: {
    at: { type: Date },
    reason: { type: String },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    refundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' } // Assuming refund is managed in payment
  },
  placedAt: { type: Date },
  acceptedAt: { type: Date },
  deliveredAt: { type: Date },
  invoiceUrl: { type: String }
}, { collection: 'orders' });

// Plugins
orderSchema.plugin(auditPlugin);
orderSchema.plugin(softDeletePlugin);

// Indexes
// orderNumber is unique
orderSchema.index({ userId: 1, 'audit.createdAt': -1 });
orderSchema.index({ vendorIds: 1, orderStatus: 1, 'audit.createdAt': -1 });
orderSchema.index({ orderStatus: 1, 'audit.createdAt': -1 });
orderSchema.index({ paymentStatus: 1, 'audit.createdAt': -1 });
orderSchema.index(
  { schoolIdForPickup: 1, 'audit.createdAt': -1 },
  { sparse: true }
);
orderSchema.index({ 'audit.createdAt': -1 });

// Soft delete compound index
orderSchema.index({ 'softDelete.isDeleted': 1, 'audit.updatedAt': -1 });

module.exports = mongoose.model('Order', orderSchema);
