const mongoose = require('mongoose');
const auditPlugin = require('../plugins/audit.plugin');
const softDeletePlugin = require('../plugins/softDelete.plugin');

const userSchema = new mongoose.Schema({
  refId: { 
    type: String, 
    required: true,
    match: /^SEM-(P|ADM|TCH|VEN|SADM)-[A-Z0-9]{4,8}$/
  },
  role: {
    type: String,
    enum: ['parent', 'school', 'teacher', 'vendor', 'admin'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'pending_approval', 'suspended', 'inactive'],
    required: true,
    default: 'active'
  },
  name: { type: String, required: true, maxlength: 80 },
  email: { 
    type: String,
    match: /^\S+@\S+\.\S+$/
  },
  phone: { 
    type: String, 
    required: true,
    match: /^[6-9]\d{9}$/
  },
  passwordHash: { type: String },
  passwordAlgo: { 
    type: String,
    enum: ['argon2id', 'bcrypt'],
    default: 'bcrypt'
  },
  emailVerifiedAt: { type: Date },
  phoneVerifiedAt: { type: Date },
  lastLoginAt: { type: Date },
  loginCount: { type: Number, required: true, default: 0 },
  mfaEnabled: { type: Boolean, required: true, default: false },
  roleScopes: [{ type: String }],
  tenantSchoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  defaultLocale: { type: String, required: true, default: 'en-IN' }
}, { collection: 'users' });

// Plugins
userSchema.plugin(auditPlugin);
userSchema.plugin(softDeletePlugin);

// Indexes
userSchema.index({ refId: 1 }, { unique: true });
// Scoped to live accounts only. A soft-deleted user keeps its email, and
// covering those rows made the index disagree with findEmailOwner (which skips
// them): deleting a teacher then reusing its address was legal in the app but
// unindexable, so the build failed and the constraint silently never existed.
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: 'string' },
      'softDelete.isDeleted': false,
    },
  }
);
// Same shape as the email index above. `sparse` must NOT be set alongside
// partialFilterExpression: Mongo rejects the pair outright ("cannot mix
// partialFilterExpression and sparse options"), which made this index un-buildable —
// syncIndexes threw on User and the live constraint only exists because it was created
// before the sparse flag was added. The partial filter already excludes rows with no
// phone, so sparse was never adding anything.
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $type: 'string' },
      'softDelete.isDeleted': false,
    },
  }
);
userSchema.index({ role: 1, status: 1, 'audit.createdAt': -1 });
userSchema.index({ tenantSchoolId: 1, role: 1 });
userSchema.index({ name: 'text', email: 'text', phone: 'text' });
// Soft delete compound index
userSchema.index({ 'softDelete.isDeleted': 1, 'audit.updatedAt': -1 });

/**
 * An email address identifies exactly one account, across every role — a parent
 * and a teacher must never share one. The unique index above is the backstop,
 * but it cannot report *which* account holds the address and it is not built on
 * collections that already contain duplicates, so every write path that accepts
 * an email calls this first.
 *
 * Pass the id of the account being edited as excludeUserId, otherwise saving a
 * record without changing its email would collide with itself.
 */
userSchema.statics.findEmailOwner = function findEmailOwner(email, { excludeUserId, session } = {}) {
  if (!email) return null;
  const filter = {
    email: String(email).trim().toLowerCase(),
    'softDelete.isDeleted': { $ne: true },
  };
  if (excludeUserId) filter._id = { $ne: excludeUserId };
  const query = this.findOne(filter).select('name role email');
  return session ? query.session(session) : query;
};

userSchema.statics.findPhoneOwner = function findPhoneOwner(phone, { excludeUserId, session } = {}) {
  if (!phone) return null;
  const filter = {
    phone: String(phone).trim(),
    'softDelete.isDeleted': { $ne: true },
  };
  if (excludeUserId) filter._id = { $ne: excludeUserId };
  const query = this.findOne(filter).select('name role phone email');
  return session ? query.session(session) : query;
};

module.exports = mongoose.model('User', userSchema);
