/** READ-ONLY. Classify EVERY live parent account into one definite root cause. */
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
  const LmsAssignment = mongoose.model('LmsAssignment');
  const studentLookup = require('../../src/modules/lms/repositories/student.repository');
  const assignmentService = require('../../src/modules/lms/services/assignment.service');

  const schools = new Map((await School.find(notDeleted).select('_id name').lean()).map((s) => [String(s._id), s.name]));
  const parents = await User.find({ role: 'parent', ...notDeleted }).select('_id name phone tenantSchoolId audit').lean();

  const causes = new Map();
  const add = (k, row) => { if (!causes.has(k)) causes.set(k, []); causes.get(k).push(row); };
  let multiChild = 0;

  for (const p of parents) {
    const kids = await ChildProfile.find({ parentUserId: p._id, ...notDeleted }).lean();
    if (kids.length > 1) multiChild += 1;
    const schoolId = (kids[0] && kids[0].schoolId) || p.tenantSchoolId || null;
    const tag = `${p.phone} ${p.name}`;

    if (!schoolId) {
      add('A. No school on the account at all - blank page, NO message shown', tag);
      continue;
    }
    const sName = schools.get(String(schoolId)) || String(schoolId);
    const ctx = await studentLookup.resolveLearnerContext(schoolId, p._id, null);
    if (!ctx) { add(`B. 403 STUDENT_REQUIRED - no child linked @ ${sName}`, tag); continue; }

    const feed = await assignmentService.getStudentHomeworkFeed(schoolId, ctx.student);
    if (feed.length) { add(`E. Working - sees homework @ ${sName}`, `${tag} (${feed.length})`); continue; }

    const schoolHas = await LmsAssignment.countDocuments({ schoolId, status: 'published', ...notDeleted });
    if (schoolHas === 0) add(`C. School has never published ANY homework - ${sName}`, `${tag} [${ctx.student.classGrade}]`);
    else add(`D. School publishes, but nothing for this class - ${sName} / ${ctx.student.classGrade}`, tag);
  }

  const order = [...causes.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`TOTAL live parent accounts: ${parents.length}\n`);
  for (const [k, rows] of order) {
    console.log(`${String(rows.length).padStart(4)}  ${k}`);
  }
  console.log(`\nparents with more than one child profile: ${multiChild}`);

  console.log(`\n${'='.repeat(78)}\nDETAIL for every NOT-WORKING bucket\n${'='.repeat(78)}`);
  for (const [k, rows] of order) {
    if (k.startsWith('E.')) continue;
    console.log(`\n--- ${k}  (${rows.length}) ---`);
    rows.forEach((r) => console.log(`   ${r}`));
  }
  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
