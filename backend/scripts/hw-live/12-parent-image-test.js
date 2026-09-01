/**
 * LIVE TEST of the PARENT side of the homework-image path.
 *
 * Half the complaint is "homework images don't show". The teacher-side fetch already
 * proved the files exist on the server; this proves a PARENT token can stream them,
 * which is the branch parents actually hit.
 *
 * Uses the built-in demo login (phone 9300000001 / OTP 1234, hard-coded in
 * otp.service.js) so no real family's account is touched. That account already exists.
 * The only writes are the ones logging in inevitably makes - an AuthSession row and a
 * loginCount/lastLoginAt bump - and both are restored at the end.
 *
 *   node scripts/hw-live/12-parent-image-test.js
 */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');

const API = process.env.LIVE_API || 'https://schoolemart.com/api/v1';
const DEMO_PHONE = '9300000001';
const DEMO_OTP = '1234';

(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');
  const User = mongoose.model('User');
  const AuthSession = mongoose.model('AuthSession');
  const LmsAssignment = mongoose.model('LmsAssignment');
  const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

  const before = await User.findOne({ phone: DEMO_PHONE }).lean();
  if (!before) throw new Error('demo account missing - aborting rather than creating one');
  const sessionsBefore = new Set((await AuthSession.find({ userId: before._id }).select('_id').lean()).map((d) => String(d._id)));
  console.log(`demo parent ${before._id}  loginCount=${before.loginCount}  sessions=${sessionsBefore.size}\n`);

  try {
    const res = await fetch(`${API}/auth/parent/otp/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: DEMO_PHONE, otp: DEMO_OTP }),
    });
    const body = await res.json();
    console.log(`parent OTP login: http=${res.status} ${body.message || ''} ${body.code || ''}`);
    if (!res.ok) throw new Error(JSON.stringify(body).slice(0, 300));
    const token = body.data.accessToken;
    console.log(`  role=${body.data.user.role}  name=${body.data.user.name}\n`);

    // Pick real, published homework that carries files.
    const rows = await LmsAssignment.find({ status: 'published', ...notDeleted })
      .select('_id schoolId title classGrade attachments bannerAttachmentId')
      .limit(400).lean();

    const picks = [];
    for (const a of rows) {
      if (a.bannerAttachmentId) picks.push({ schoolId: String(a.schoolId), id: String(a.bannerAttachmentId), kind: 'banner', a });
      (a.attachments || []).slice(0, 1).forEach((x) => picks.push({ schoolId: String(a.schoolId), id: String(x), kind: 'attachment', a }));
      if (picks.length >= 12) break;
    }

    console.log('PARENT fetching real homework images through the live API:');
    let ok = 0;
    for (const p of picks) {
      const r = await fetch(`${API}/schools/${p.schoolId}/lms/submission-attachments/${p.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const ct = r.headers.get('content-type') || '';
      let note = '';
      if (r.ok) { note = `${ct} ${(await r.arrayBuffer()).byteLength}b`; ok += 1; }
      else { try { note = (JSON.parse(await r.text()).code) || ''; } catch { note = '(non-json)'; } }
      console.log(`  http=${r.status} ${String(note).padEnd(24)} ${p.kind.padEnd(10)} "${p.a.title}" [${p.a.classGrade}]`);
    }
    console.log(`\n  ${ok}/${picks.length} homework images served to a parent token.`);
  } finally {
    console.log('\n' + '='.repeat(60) + '\nCLEANUP\n' + '='.repeat(60));
    const nowSessions = await AuthSession.find({ userId: before._id }).select('_id').lean();
    const newOnes = nowSessions.filter((s) => !sessionsBefore.has(String(s._id))).map((s) => s._id);
    if (newOnes.length) {
      const r = await AuthSession.deleteMany({ _id: { $in: newOnes } });
      console.log(`  removed ${r.deletedCount} session row(s) created by this test`);
    } else {
      console.log('  no new session rows to remove');
    }
    await User.updateOne(
      { _id: before._id },
      { $set: { loginCount: before.loginCount, lastLoginAt: before.lastLoginAt || null } }
    );
    const after = await User.findById(before._id).lean();
    console.log(`  demo account restored: loginCount=${after.loginCount} (was ${before.loginCount})`);
    console.log('  no other document was written.');
    await mongoose.disconnect();
  }
})().catch(async (e) => {
  console.error('FAILED:', e.message);
  try { await mongoose.disconnect(); } catch { /* already closed */ }
  process.exit(1);
});
