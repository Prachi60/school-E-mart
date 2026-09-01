/**
 * READ-ONLY. Replays the real parent homework feed for EVERY parent account on the
 * live database, using the exact same service code the API runs, and reports who
 * gets nothing and why. Writes nothing.
 *
 *   node scripts/hw-live/02-simulate.js
 */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');

const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');

  const User = mongoose.model('User');
  const School = mongoose.model('School');
  const ChildProfile = mongoose.model('ChildProfile');
  const studentLookup = require('../../src/modules/lms/repositories/student.repository');
  const assignmentService = require('../../src/modules/lms/services/assignment.service');

  const schools = await School.find(notDeleted).select('_id name').lean();
  const schoolName = new Map(schools.map((s) => [String(s._id), s.name]));

  const parents = await User.find({ role: 'parent', ...notDeleted })
    .select('_id name phone tenantSchoolId').lean();

  const buckets = {
    ok: [], emptyFeed: [], noContext: [], noSchool: [],
  };
  const emptyByGrade = new Map();

  for (const p of parents) {
    // Same school resolution the API uses for a parent with no ?schoolId in the URL.
    const child = await ChildProfile.findOne({ parentUserId: p._id, ...notDeleted }).lean();
    const schoolId = child?.schoolId || p.tenantSchoolId || null;
    if (!schoolId) { buckets.noSchool.push({ p }); continue; }

    const ctx = await studentLookup.resolveLearnerContext(schoolId, p._id, null);
    if (!ctx) { buckets.noContext.push({ p, schoolId }); continue; }

    const feed = await assignmentService.getStudentHomeworkFeed(schoolId, ctx.student);
    const row = {
      p, schoolId, n: feed.length, linked: ctx.isLinked,
      grade: ctx.student.classGrade, section: ctx.student.section, child: ctx.student.name,
    };
    if (feed.length) buckets.ok.push(row);
    else {
      buckets.emptyFeed.push(row);
      const key = `${schoolName.get(String(schoolId)) || schoolId} :: ${JSON.stringify(row.grade)}`;
      emptyByGrade.set(key, (emptyByGrade.get(key) || 0) + 1);
    }
  }

  const pct = (n) => `${((n / parents.length) * 100).toFixed(1)}%`;
  console.log(`parent accounts examined: ${parents.length}\n`);
  console.log(`  sees homework          : ${buckets.ok.length}  (${pct(buckets.ok.length)})`);
  console.log(`  EMPTY feed             : ${buckets.emptyFeed.length}  (${pct(buckets.emptyFeed.length)})`);
  console.log(`  403 STUDENT_REQUIRED   : ${buckets.noContext.length}  (${pct(buckets.noContext.length)})`);
  console.log(`  no school at all       : ${buckets.noSchool.length}  (${pct(buckets.noSchool.length)})`);

  console.log('\nEMPTY FEEDS, grouped by the class the feed was built for:');
  [...emptyByGrade.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => console.log(`  ${String(n).padStart(3)}  ${k}`));

  console.log('\nSample of parents with an empty feed:');
  buckets.emptyFeed.slice(0, 12).forEach((r) =>
    console.log(`  ${r.p.phone}  ${r.p.name}  child=${r.child}  grade=${JSON.stringify(r.grade)} section=${JSON.stringify(r.section)}  linked=${r.linked}  school=${schoolName.get(String(r.schoolId))}`));

  console.log('\nSample of parents who see homework:');
  buckets.ok.slice(0, 8).forEach((r) =>
    console.log(`  ${r.p.phone}  ${r.p.name}  child=${r.child}  grade=${JSON.stringify(r.grade)}  items=${r.n}`));

  if (buckets.noContext.length) {
    console.log('\nParents hitting 403 STUDENT_REQUIRED:');
    buckets.noContext.slice(0, 15).forEach((r) =>
      console.log(`  ${r.p.phone}  ${r.p.name}  school=${schoolName.get(String(r.schoolId))}`));
  }

  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
