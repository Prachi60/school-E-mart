/**
 * READ-ONLY against the LIVE API. Logs in as a teacher, then tries to actually FETCH
 * every homework attachment the live database references, and reports which ones the
 * server can serve. Nothing is created, updated or deleted.
 *
 *   node scripts/hw-live/05-api-attachments.js
 */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');

const API = process.env.LIVE_API || 'https://schoolemart.com/api/v1';
const EMAIL = process.env.LIVE_TEACHER_EMAIL || 'prachi@gmail.com';
const PASSWORD = process.env.LIVE_TEACHER_PASSWORD;

(async () => {
  if (!PASSWORD) throw new Error('Set LIVE_TEACHER_PASSWORD in the environment');

  const login = await fetch(`${API}/auth/school/teacher/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginBody = await login.json();
  console.log(`login: http=${login.status} success=${loginBody.success} ${loginBody.message || ''}`);
  if (!login.ok) { console.log(JSON.stringify(loginBody).slice(0, 400)); process.exit(1); }

  const token = loginBody.data?.accessToken;
  const me = loginBody.data?.user;
  console.log(`  as: ${me?.name} role=${me?.role} school=${me?.tenantSchoolId || me?.schoolId}\n`);
  const auth = { authorization: `Bearer ${token}` };

  await connectLive();
  require('../../src/database/modelRegistry');
  const LmsAssignment = mongoose.model('LmsAssignment');
  const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

  const schoolId = String(me?.tenantSchoolId || me?.schoolId);
  const rows = await LmsAssignment.find({ schoolId, ...notDeleted })
    .select('_id title classGrade status attachments bannerAttachmentId').lean();

  const targets = [];
  rows.forEach((a) => {
    if (a.bannerAttachmentId) targets.push({ id: String(a.bannerAttachmentId), kind: 'banner', hw: a });
    (a.attachments || []).forEach((x) => targets.push({ id: String(x), kind: 'attachment', hw: a }));
  });
  console.log(`homework rows at this school: ${rows.length}   attachment refs to fetch: ${targets.length}\n`);

  const tally = {};
  const failures = [];
  let i = 0;
  for (const t of targets) {
    i += 1;
    const res = await fetch(`${API}/schools/${schoolId}/lms/submission-attachments/${t.id}`, { headers: auth });
    const ct = res.headers.get('content-type') || '';
    let code = `${res.status}`;
    if (!res.ok) {
      const body = await res.text();
      try { code += ` ${JSON.parse(body).code || ''}`; } catch { code += ' (non-json)'; }
      failures.push({ ...t, code, ct });
    } else {
      const buf = await res.arrayBuffer();
      code += ` ok ${ct} ${buf.byteLength}b`;
      if (buf.byteLength === 0) failures.push({ ...t, code: '200 but EMPTY', ct });
      code = `200 ${ct.split(';')[0]}`;
    }
    tally[code] = (tally[code] || 0) + 1;
    if (i % 25 === 0) process.stdout.write(`  ...${i}/${targets.length}\n`);
  }

  console.log('\nRESULT of fetching every homework attachment through the live API:');
  Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));

  if (failures.length) {
    console.log(`\nFAILED (${failures.length}) — sample:`);
    failures.slice(0, 20).forEach((f) =>
      console.log(`  ${f.code.padEnd(28)} ${f.kind.padEnd(10)} hw="${f.hw.title}" [${f.hw.classGrade}/${f.hw.status}] att=${f.id}`));
    const byHw = new Set(failures.map((f) => String(f.hw._id)));
    console.log(`\n  homework rows with at least one unservable file: ${byHw.size} of ${rows.length}`);
  }

  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); try { await mongoose.disconnect(); } catch {} process.exit(1); });
