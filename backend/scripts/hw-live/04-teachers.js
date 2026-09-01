/** READ-ONLY. Full teacher identity + authorization surface for the homework publish path. */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');
const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');
  const School = mongoose.model('School');
  const User = mongoose.model('User');
  const TeacherProfile = mongoose.model('TeacherProfile');
  const SchoolMembership = mongoose.model('SchoolMembership');
  const LmsAssignment = mongoose.model('LmsAssignment');

  const schools = new Map((await School.find(notDeleted).select('_id name').lean()).map((s) => [String(s._id), s.name]));

  for (const tp of await TeacherProfile.find(notDeleted).lean()) {
    const u = await User.findById(tp.userId).lean();
    const mem = await SchoolMembership.find({ userId: tp.userId }).lean();
    const filed = await LmsAssignment.countDocuments({ assignedByUserId: tp.userId, ...notDeleted });
    const tenantOk = String(u?.tenantSchoolId) === String(tp.schoolId);
    console.log(`\n${u?.name} <${u?.email}>`);
    console.log(`  user.status=${u?.status}  profile.approval=${tp.approvalStatus}  homeworkFiled=${filed}`);
    console.log(`  profile.schoolId   = ${tp.schoolId} (${schools.get(String(tp.schoolId))})`);
    console.log(`  user.tenantSchoolId= ${u?.tenantSchoolId} (${schools.get(String(u?.tenantSchoolId))})  ${tenantOk ? 'MATCH' : '*** MISMATCH ***'}`);
    console.log(`  memberships: ${JSON.stringify(mem.map((m) => `${m.role}@${schools.get(String(m.schoolId))}:${m.status}`))}`);
    console.log(`  profile.subjects: ${JSON.stringify(tp.subjects || [])}`);
    if (!(tp.classAssignments || []).length) {
      console.log('  classAssignments: [] <<< CANNOT PUBLISH HOMEWORK FOR ANY CLASS (LMS_COURSE_NOT_ASSIGNED)');
    } else {
      (tp.classAssignments || []).forEach((c) =>
        console.log(`  classAssignment: class=${JSON.stringify(c.class)} section=${JSON.stringify(c.section)} isClassTeacher=${!!c.isClassTeacher} subjects=${JSON.stringify(c.subjects || [])}`));
    }
  }

  console.log(`\n${'='.repeat(78)}\nSUBJECT values actually used on filed homework\n${'='.repeat(78)}`);
  const subj = await LmsAssignment.aggregate([
    { $match: { 'softDelete.isDeleted': { $ne: true } } },
    { $group: { _id: { s: '$subject', school: '$schoolId' }, n: { $sum: 1 } } }, { $sort: { n: -1 } },
  ]);
  subj.forEach((r) => console.log(`  ${String(r.n).padStart(3)}  subject=${JSON.stringify(r._id.s)}  @${schools.get(String(r._id.school))}`));

  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
