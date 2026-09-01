/** READ-ONLY. Per-school: who teaches what, what the roster says, what homework was filed. */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');
const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');
  const School = mongoose.model('School');
  const Student = mongoose.model('Student');
  const User = mongoose.model('User');
  const TeacherProfile = mongoose.model('TeacherProfile');
  const LmsAssignment = mongoose.model('LmsAssignment');
  const classService = require('../../src/modules/school/services/class.service');

  for (const s of await School.find(notDeleted).select('_id name').lean()) {
    console.log(`\n${'='.repeat(78)}\n${s.name}   ${s._id}\n${'='.repeat(78)}`);

    const roster = await Student.aggregate([
      { $match: { schoolId: s._id, status: 'active', 'softDelete.isDeleted': { $ne: true } } },
      { $group: { _id: { g: '$classGrade', sec: '$section' }, n: { $sum: 1 } } }, { $sort: { n: -1 } },
    ]);
    console.log('ROSTER grades:');
    roster.forEach((r) => console.log(`   ${String(r.n).padStart(3)}  grade=${JSON.stringify(r._id.g)} section=${JSON.stringify(r._id.sec)}`));

    let classes = [];
    try { classes = await classService.listClasses(s._id); } catch (e) { console.log('  listClasses failed:', e.message); }
    console.log(`CLASS LIST the UI offers (classService.listClasses): ${JSON.stringify(classes.map((c) => `${c.classGrade}/${c.section ?? ''}`))}`);

    const tprofiles = await TeacherProfile.find({ schoolId: s._id, ...notDeleted }).lean();
    console.log(`TEACHERS (${tprofiles.length}):`);
    for (const tp of tprofiles) {
      const u = await User.findById(tp.userId).select('name email status').lean();
      const ca = (tp.classAssignments || []).map((c) => `${c.class}/${c.section}${c.isClassTeacher ? '*' : ''}`);
      const filed = await LmsAssignment.countDocuments({ schoolId: s._id, assignedByUserId: tp.userId, ...notDeleted });
      console.log(`   ${u?.name} <${u?.email}> ${u?.status}/${tp.approvalStatus}  teaches=[${ca}]  homeworkFiled=${filed}`);
    }

    const hw = await LmsAssignment.aggregate([
      { $match: { schoolId: s._id, 'softDelete.isDeleted': { $ne: true } } },
      { $group: { _id: { g: '$classGrade', sec: '$section', st: '$status' }, n: { $sum: 1 } } }, { $sort: { n: -1 } },
    ]);
    console.log('HOMEWORK filed:');
    if (!hw.length) console.log('   (none)');
    hw.forEach((r) => console.log(`   ${String(r.n).padStart(3)}  grade=${JSON.stringify(r._id.g)} section=${JSON.stringify(r._id.sec)} status=${r._id.st}`));

    // Which roster grades have no matching published homework?
    const norm = (v) => String(v || '').toLowerCase().replace(/class/g, '').replace(/\s+/g, '').trim();
    const hwGrades = new Set(hw.filter((r) => r._id.st === 'published').map((r) => norm(r._id.g)));
    const orphans = roster.filter((r) => !hwGrades.has(norm(r._id.g)));
    console.log(`ROSTER GRADES WITH NO PUBLISHED HOMEWORK: ${orphans.length ? orphans.map((o) => `${JSON.stringify(o._id.g)}(${o.n} students)`).join(', ') : 'none'}`);
  }
  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
