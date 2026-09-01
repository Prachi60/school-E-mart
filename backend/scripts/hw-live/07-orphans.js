/** READ-ONLY. Where did the school-less "Parent User" accounts come from, and are they real people? */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');
const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');
  const User = mongoose.model('User');
  const ChildProfile = mongoose.model('ChildProfile');
  const AuthSession = mongoose.model('AuthSession');
  const DeviceToken = mongoose.model('DeviceToken');
  const AuditLog = mongoose.model('AuditLog');

  const orphans = [];
  for (const p of await User.find({ role: 'parent', ...notDeleted }).lean()) {
    const child = await ChildProfile.findOne({ parentUserId: p._id, ...notDeleted }).lean();
    if (child?.schoolId || p.tenantSchoolId) continue;
    orphans.push(p);
  }

  console.log(`school-less parent accounts: ${orphans.length}\n`);
  console.log('name distribution: ' + JSON.stringify(orphans.reduce((a, o) => { a[o.name] = (a[o.name] || 0) + 1; return a; }, {})));

  console.log('\nphone                created              lastLogin            logins  sessions  devices  name');
  for (const o of orphans) {
    const [sessions, devices] = await Promise.all([
      AuthSession.countDocuments({ userId: o._id }),
      DeviceToken.countDocuments({ userId: o._id }),
    ]);
    const c = o.audit?.createdAt ? new Date(o.audit.createdAt).toISOString().slice(0, 16) : '?';
    const l = o.lastLoginAt ? new Date(o.lastLoginAt).toISOString().slice(0, 16) : '-';
    console.log(`${o.phone}  ${c}  ${String(l).padEnd(19)}  ${String(o.loginCount ?? 0).padStart(5)}  ${String(sessions).padStart(8)}  ${String(devices).padStart(7)}  ${o.name}`);
  }

  console.log('\n=== audit trail for these accounts (how they were created / logged in) ===');
  const ids = orphans.map((o) => o._id);
  const acts = await AuditLog.aggregate([
    { $match: { $or: [{ actorUserId: { $in: ids } }, { entityId: { $in: ids } }] } },
    { $group: { _id: '$action', n: { $sum: 1 } } }, { $sort: { n: -1 } },
  ]);
  acts.forEach((a) => console.log(`  ${String(a.n).padStart(4)}  ${a._id}`));

  console.log('\n=== every auth.* action in the audit log (whole DB) ===');
  const allActs = await AuditLog.aggregate([
    { $match: { action: /^auth\./ } },
    { $group: { _id: '$action', n: { $sum: 1 }, last: { $max: '$audit.createdAt' } } }, { $sort: { n: -1 } },
  ]);
  allActs.forEach((a) => console.log(`  ${String(a.n).padStart(4)}  ${String(a._id).padEnd(34)} last=${a.last ? new Date(a.last).toISOString().slice(0, 16) : '?'}`));

  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
