const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'default' },
    general: {
      platformName: { type: String, default: 'School E-Mart' },
      logoMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      contact: {
        email: { type: String },
        phone: { type: String },
        address: { type: String },
      },
      timezone: { type: String, default: 'Asia/Kolkata' },
      currency: { type: String, default: 'INR' },
      language: { type: String, default: 'en-IN' },
    },
    marketplace: {
      // Legacy single rate — kept for backward compatibility. New flows use the
      // two explicit platform rates below.
      commissionPercent: { type: Number, default: 10 },
      // Platform's cut on retail product sales (and bulk school purchases).
      platformRetailPercent: { type: Number, default: 10 },
      // Platform's cut on kit sales (the school earns its own kit % on top).
      platformKitPercent: { type: Number, default: 5 },
      vendorAutoApproval: { type: Boolean, default: false },
      productApprovalRequired: { type: Boolean, default: true },
    },
    orders: {
      returnWindowDays: { type: Number, default: 7 },
      cancellationWindowHours: { type: Number, default: 24 },
      tax: {
        enabled: { type: Boolean, default: true },
        defaultRatePercent: { type: Number, default: 18 },
      },
      invoice: {
        prefix: { type: String, default: 'INV' },
        showTaxBreakdown: { type: Boolean, default: true },
      },
    },
    school: {
      schoolApprovalRequired: { type: Boolean, default: true },
      teacherApprovalRequired: { type: Boolean, default: true },
    },
    security: {
      passwordPolicy: {
        minLength: { type: Number, default: 8 },
        requireNumber: { type: Boolean, default: true },
        requireSpecialChar: { type: Boolean, default: true },
      },
      loginPolicy: {
        maxAttempts: { type: Number, default: 5 },
        lockoutMinutes: { type: Number, default: 15 },
      },
      session: {
        accessTokenExpiry: { type: String, default: '15m' },
        refreshTokenExpiry: { type: String, default: '7d' },
      },
    },
    contact: {
      phone: { type: String },
      email: { type: String },
      address: { type: String },
      workingHours: { type: String },
      whatsapp: { type: String },
      bulkPhone: { type: String },
      bulkEmail: { type: String },
    },
    lms: {
      maxVideoSizeMB: { type: Number, default: 500, min: 10, max: 5000 },
    },
    kits: {
      // Auto-hide a school kit from parents once it has been on sale for
      // `purchaseWindowDays` days without them buying it. Off by default —
      // switching it on immediately closes the window on every kit already
      // published longer ago than that.
      purchaseWindowEnabled: { type: Boolean, default: false },
      purchaseWindowDays: { type: Number, default: 7, min: 1, max: 365 },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'platformSettings', timestamps: false }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
