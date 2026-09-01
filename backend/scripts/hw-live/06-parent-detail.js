/** READ-ONLY. Characterise the parents who see nothing, and check the demo login account. */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');
const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');
  const User = mongoose.model('User');
  const School = mongoose.model('School');
  const Student = mongoose.model('Student');
  const ChildProfile = mongoose.model('ChildProfile');
  const ParentProfile = mongoose.model('ParentProfile');
  const Order = mongoose.model('Order');

  const schools = new Map((await School.find(notDeleted).select('_id name').lean()).map((s) => [String(s._id), s.name]));

  console.log('=== demo login account 9300000001 ===');
  const demo = await User.find({ phone: '9300000001' }).lean();
  console.log(demo.length ? demo.map((d) => `  ${d._id} ${d.role} ${d.name} tenant=${schools.get(String(d.tenantSchoolId)) || d.tenantSchoolId}`).join('\n') : '  (does not exist)');

  console.log('\n=== the 27 parents with NO school context ===');
  const parents = await User.find({ role: 'parent', ...notDeleted }).select('_id name phone tenantSchoolId refId audit').lean();
  let noSchool = 0, guestish = 0;
  for (const p of parents) {
    const child = await ChildProfile.findOne({ parentUserId: p._id, ...notDeleted }).lean();
    if (child?.schoolId || p.tenantSchoolId) continue;
    noSchool += 1;
    const orders = await Order.countDocuments({ userId: p._id });
    const pp = await ParentProfile.findOne({ userId: p._id }).lean();
    const linked = pp ? await Student.countDocuments({ parentProfileIds: pp._id, ...notDeleted }) : 0;
    if (orders > 0 || (!child && !linked)) guestish += 1;
    if (noSchool <= 12) console.log(`  ${p.phone}  ${p.name}  refId=${p.refId}  childProfiles=${child ? 1 : 0}  linkedStudents=${linked}  orders=${orders}`);
  }
  console.log(`  total: ${noSchool}   look like shop-only/guest customers: ${guestish}`);

  console.log('\n=== the 3 parents hitting 403 STUDENT_REQUIRED ===');
  for (const phone of ['9673167535', '9325694754', '8530797451']) {
    const u = await User.findOne({ phone, ...notDeleted }).lean();
    if (!u) { console.log(`  ${phone}: no user`); continue; }
    const cps = await ChildProfile.find({ parentUserId: u._id }).lean();
    const pp = await ParentProfile.findOne({ userId: u._id }).lean();
    const linked = pp ? await Student.find({ parentProfileIds: pp._id, ...notDeleted }).select('name classGrade status schoolId').lean() : [];
    console.log(`  ${phone} ${u.name} tenant=${schools.get(String(u.tenantSchoolId))}`);
    cps.forEach((c) => console.log(`     childProfile name=${c.name} grade=${c.grade} studentId=${c.studentId} school=${schools.get(String(c.schoolId))} deleted=${c.softDelete?.isDeleted}`));
    linked.forEach((s) => console.log(`     linkedStudent ${s.name} ${s.classGrade} status=${s.status} school=${schools.get(String(s.schoolId))}`));
    if (!cps.length && !linked.length) console.log('     (no childProfile, no linked student)');
    // Does a roster student exist for this phone that simply was never linked?
    const byName = await Student.find({ name: new RegExp(String(u.name).trim().split(/\s+/)[0], 'i'), ...notDeleted }).select('name classGrade schoolId parentProfileIds').lean();
    console.log(`     roster rows whose name contains "${String(u.name).trim().split(/\s+/)[0]}": ${byName.length}`);
  }

  console.log('\n=== students whose ACTIVE status may hide them ===');
  const byStatus = await Student.aggregate([
    { $match: { 'softDelete.isDeleted': { $ne: true } } },
    { $group: { _id: { st: '$status', school: '$schoolId' }, n: { $sum: 1 } } },
  ]);
  byStatus.forEach((r) => console.log(`  ${schools.get(String(r._id.school))}: status=${r._id.st} -> ${r.n}`));

  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
