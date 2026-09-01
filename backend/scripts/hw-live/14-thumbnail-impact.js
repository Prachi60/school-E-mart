/** READ-ONLY. How many parent homework cards gain a real photo from the thumbnail fallback. */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');
(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');
  const School = mongoose.model('School');
  const { assignmentRepository } = require('../../src/modules/lms/repositories/assignment.repository');
  const notDeleted = { 'softDelete.isDeleted': { $ne: true } };
  const schools = new Map((await School.find(notDeleted).select('_id name').lean()).map((s) => [String(s._id), s.name]));

  const rows = await assignmentRepository.findManyPopulated({ status: 'published' }, { limit: 0 });
  let banner = 0, fallback = 0, none = 0;
  const perSchool = {};
  for (const a of rows) {
    const b = a.bannerAttachmentId ? String(a.bannerAttachmentId._id || a.bannerAttachmentId) : null;
    const img = (a.attachments || []).find((x) => String(x && x.mime || '').startsWith('image/'));
    const key = schools.get(String(a.schoolId)) || String(a.schoolId);
    perSchool[key] = perSchool[key] || { banner: 0, fallback: 0, none: 0 };
    if (b) { banner += 1; perSchool[key].banner += 1; }
    else if (img) { fallback += 1; perSchool[key].fallback += 1; }
    else { none += 1; perSchool[key].none += 1; }
  }
  console.log(`published homework rows: ${rows.length}`);
  console.log(`  had a thumbnail before (banner set)        : ${banner}`);
  console.log(`  GAIN a thumbnail from the attachment fallback: ${fallback}`);
  console.log(`  still no image (nothing to show)           : ${none}`);
  console.log('\nper school:');
  Object.entries(perSchool).forEach(([k, v]) => console.log(`  ${k}: before=${v.banner}  after=${v.banner + v.fallback}  noImage=${v.none}`));
  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
