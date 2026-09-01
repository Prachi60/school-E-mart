/**
 * READ-ONLY diagnosis of the live homework flow. Writes nothing, builds no indexes.
 *
 *   node scripts/hw-live/01-diagnose.js
 */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');

const h = (t) => console.log(`\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}`);
const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');

  const User = mongoose.model('User');
  const School = mongoose.model('School');
  const Student = mongoose.model('Student');
  const ChildProfile = mongoose.model('ChildProfile');
  const ParentProfile = mongoose.model('ParentProfile');
  const LmsAssignment = mongoose.model('LmsAssignment');
  const Attachment = mongoose.model('Attachment');
  const TeacherProfile = mongoose.model('TeacherProfile');

  h('1. INDEXES ACTUALLY PRESENT ON users');
  const userIdx = await User.collection.indexes();
  console.log(userIdx.map((i) => `  ${i.name}  ${JSON.stringify(i.key)}${i.unique ? '  UNIQUE' : ''}`).join('\n'));
  console.log(`  phone_1 present: ${userIdx.some((i) => i.name === 'phone_1') ? 'YES' : 'NO  <-- uniqueness is NOT enforced'}`);

  h('2. DUPLICATE PHONE NUMBERS');
  const dupes = await User.aggregate([
    { $match: { 'softDelete.isDeleted': { $ne: true }, phone: { $type: 'string' } } },
    { $group: { _id: '$phone', n: { $sum: 1 }, roles: { $push: '$role' }, names: { $push: '$name' }, ids: { $push: '$_id' } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  console.log(`  phone numbers held by >1 live account: ${dupes.length}`);
  dupes.forEach((d) => console.log(`    ${d._id}  x${d.n}  roles=[${d.roles}]  names=[${d.names}]`));

  h('3. SCHOOLS');
  const schools = await School.find(notDeleted).select('_id name code schoolRefNo').lean();
  for (const s of schools) {
    const [students, assignments, published] = await Promise.all([
      Student.countDocuments({ schoolId: s._id, ...notDeleted }),
      LmsAssignment.countDocuments({ schoolId: s._id, ...notDeleted }),
      LmsAssignment.countDocuments({ schoolId: s._id, status: 'published', ...notDeleted }),
    ]);
    console.log(`  ${s._id}  ${s.name}  (${s.schoolRefNo || s.code})  students=${students}  homework=${assignments} (published=${published})`);
  }

  h('4. THE TEACHER prachi@gmail.com');
  const prachi = await User.findOne({ email: 'prachi@gmail.com', ...notDeleted }).lean();
  if (!prachi) { console.log('  NOT FOUND'); }
  else {
    console.log(`  user     ${prachi._id}  role=${prachi.role}  status=${prachi.status}  phone=${prachi.phone}`);
    console.log(`  tenant   ${prachi.tenantSchoolId}`);
    const tp = await TeacherProfile.findOne({ userId: prachi._id, ...notDeleted }).lean();
    console.log(`  profile  ${tp ? tp._id : 'NONE'}  school=${tp?.schoolId}  approval=${tp?.approvalStatus}`);
    console.log(`  classAssignments: ${JSON.stringify(tp?.classAssignments || [])}`);
    console.log(`  subjects:         ${JSON.stringify(tp?.subjects || [])}`);
  }

  h('5. HOMEWORK ROWS (every school)');
  const byStatus = await LmsAssignment.aggregate([
    { $group: { _id: { school: '$schoolId', status: '$status', deleted: '$softDelete.isDeleted' }, n: { $sum: 1 } } },
  ]);
  byStatus.forEach((r) => console.log(`  school=${r._id.school} status=${r._id.status} deleted=${r._id.deleted} -> ${r.n}`));

  console.log('\n  classGrade spellings on PUBLISHED homework:');
  const hwGrades = await LmsAssignment.aggregate([
    { $match: { status: 'published', 'softDelete.isDeleted': { $ne: true } } },
    { $group: { _id: { g: '$classGrade', s: '$section' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  hwGrades.forEach((r) => console.log(`    grade=${JSON.stringify(r._id.g)} section=${JSON.stringify(r._id.s)}  x${r.n}`));

  console.log('\n  classGrade spellings on the STUDENT roster:');
  const stGrades = await Student.aggregate([
    { $match: { 'softDelete.isDeleted': { $ne: true }, status: 'active' } },
    { $group: { _id: { g: '$classGrade', s: '$section' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
  stGrades.forEach((r) => console.log(`    grade=${JSON.stringify(r._id.g)} section=${JSON.stringify(r._id.s)}  x${r.n}`));

  h('6. HOMEWORK IMAGES / ATTACHMENTS');
  const withBanner = await LmsAssignment.countDocuments({ bannerAttachmentId: { $ne: null }, ...notDeleted });
  const withAtt = await LmsAssignment.countDocuments({ 'attachments.0': { $exists: true }, ...notDeleted });
  const total = await LmsAssignment.countDocuments(notDeleted);
  console.log(`  homework rows: ${total}  with banner: ${withBanner}  with attachments[]: ${withAtt}`);
  const attPurposes = await Attachment.aggregate([
    { $group: { _id: '$purpose', n: { $sum: 1 } } }, { $sort: { n: -1 } },
  ]);
  console.log('  attachment purposes: ' + attPurposes.map((a) => `${a._id}=${a.n}`).join(', '));

  // Do the ids referenced by homework still resolve to attachment rows?
  const refs = await LmsAssignment.find({ ...notDeleted, $or: [{ bannerAttachmentId: { $ne: null } }, { 'attachments.0': { $exists: true } }] })
    .select('_id title bannerAttachmentId attachments status').lean();
  const wantedIds = new Set();
  refs.forEach((a) => { if (a.bannerAttachmentId) wantedIds.add(String(a.bannerAttachmentId)); (a.attachments || []).forEach((x) => wantedIds.add(String(x))); });
  const found = await Attachment.find({ _id: { $in: [...wantedIds] } }).select('_id storageKey mime purpose sizeBytes').lean();
  const foundIds = new Set(found.map((f) => String(f._id)));
  const dangling = [...wantedIds].filter((id) => !foundIds.has(id));
  console.log(`  attachment ids referenced by homework: ${wantedIds.size}  resolved: ${foundIds.size}  DANGLING: ${dangling.length}`);
  console.log('  sample storageKeys: ' + found.slice(0, 5).map((f) => `${f.purpose}:${f.storageKey}`).join('\n                      '));

  h('7. PARENT LINKAGE');
  const parents = await User.countDocuments({ role: 'parent', ...notDeleted });
  const childProfiles = await ChildProfile.countDocuments(notDeleted);
  const cpNoStudent = await ChildProfile.countDocuments({ $or: [{ studentId: null }, { studentId: { $exists: false } }], ...notDeleted });
  const cpNoSchool = await ChildProfile.countDocuments({ $or: [{ schoolId: null }, { schoolId: { $exists: false } }], ...notDeleted });
  const studentsNoParent = await Student.countDocuments({ $or: [{ parentProfileIds: { $size: 0 } }, { parentProfileIds: { $exists: false } }], ...notDeleted });
  console.log(`  parent users:                 ${parents}`);
  console.log(`  childProfiles:                ${childProfiles}  (no studentId: ${cpNoStudent}, no schoolId: ${cpNoSchool})`);
  console.log(`  students with NO parent link: ${studentsNoParent}`);

  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
