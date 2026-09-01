const mongoose = require('mongoose');
const auditPlugin = require('../plugins/audit.plugin');
const softDeletePlugin = require('../plugins/softDelete.plugin');

const kitSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  // Assigned vendor for fulfillment
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorProfile' },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  classGrade: { type: String },
  category: { type: String },
  description: { type: String },
  imageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' },
  imageUrl: { type: String },
  items: [{
    masterProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterKitProduct' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String },
    category: { type: String },
    subcategory: { type: String },
    imageUrl: { type: String },
    qty: { type: Number, required: true, min: 1, default: 1 },
    attributes: {
      // Deprecated single free-text color, kept for backward compatibility with
      // kits created before `colors` existed. New kits should populate `colors`
      // instead — a list of options, mirroring `sizes`, that a parent picks one
      // of when ordering. Neither the create/edit UI nor the parent order flow
      // reads `color` anymore.
      color: { type: String },
      sizes: [{ type: String }],
      colors: [{ type: String }],
      gender: { type: String },
      publisher: { type: String },
      subject: { type: String },
      packDetails: { type: String }
    }
  }],
  pricePaise: { type: Number, required: true, min: 0 },
  mrpPaise: { type: Number, required: true, min: 0 },
  sku: { type: String },
  status: {
    type: String,
    enum: ['active', 'draft'],
    required: true,
    default: 'active'
  },
  // When this kit last went live. The admin's kit purchase window (see
  // kitPurchaseWindow.util.js) is measured from here, not from creation, so a
  // kit drafted in March and published in June gets its full window in June.
  // Null while the kit has never been published; kits saved before this field
  // existed fall back to audit.createdAt.
  publishedAt: { type: Date, default: null },
  flags: {
    showOnApp: { type: Boolean, default: true },
    availableOnline: { type: Boolean, default: true },
    allowPreorders: { type: Boolean, default: false }
  }
}, { collection: 'kits' });

// Plugins
kitSchema.plugin(auditPlugin);
kitSchema.plugin(softDeletePlugin);

// Indexes
kitSchema.index({ schoolId: 1, status: 1 });
kitSchema.index({ schoolId: 1, status: 1, publishedAt: -1 });
kitSchema.index({ vendorId: 1 });
kitSchema.index({ name: 'text' });
kitSchema.index({ 'softDelete.isDeleted': 1, 'audit.updatedAt': -1 });

const KitModel = mongoose.model('Kit', kitSchema);

// A kit is only safe to add to a cart or turn into an order line item when the
// school has actually published it, it hasn't been removed, and a vendor is
// assigned to fulfil it. `Kit.findById()` on its own does not check any of that —
// it would happily return a draft, a soft-deleted kit, or one with no vendor.
// Any lookup that feeds a purchase (as opposed to school/admin management, which
// legitimately needs to see drafts) must go through this filter.
//
// This deliberately says nothing about the admin's kit purchase window: that
// depends on a settings read, so it can't live in a synchronous filter. Callers
// that feed a purchase must ALSO check isKitPurchaseWindowOpen() from
// kitPurchaseWindow.util.js — cart add, cart validation and checkout all do.
KitModel.purchasableFilter = (id) => ({
  _id: id,
  status: 'active',
  vendorId: { $ne: null },
  'softDelete.isDeleted': { $ne: true },
});

module.exports = KitModel;
