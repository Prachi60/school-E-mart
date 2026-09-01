/**
 * LIVE WRITE TEST - creates ONE homework as a real teacher, verifies what parents
 * would see, then HARD-DELETES exactly what it created and proves the database is
 * back where it started.
 *
 * Safety rules this script follows:
 *  - every _id it creates is recorded before any verification runs;
 *  - cleanup deletes ONLY those recorded ids (never a query-by-title sweep);
 *  - cleanup runs in a finally block, so a mid-test failure still cleans up;
 *  - a full before/after id-set diff of lmsAssignments + attachments is printed, so
 *    any residue would be visible;
 *  - it never modifies an existing document.
 *
 *   LIVE_TEACHER_PASSWORD=... node scripts/hw-live/08-publish-test.js
 */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');

const API = process.env.LIVE_API || 'https://schoolemart.com/api/v1';
const EMAIL = process.env.LIVE_TEACHER_EMAIL || 'prachi@gmail.com';
const PASSWORD = process.env.LIVE_TEACHER_PASSWORD;
const MARK = `ZZ-AUTOMATED-TEST-${Date.now()}`;

// A real, tiny JPEG so the upload/stream path is genuinely exercised.
const JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAQABABAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+iiiigD//2Q==';

(async () => {
  if (!PASSWORD) throw new Error('Set LIVE_TEACHER_PASSWORD');

  await connectLive();
  require('../../src/database/modelRegistry');
  const LmsAssignment = mongoose.model('LmsAssignment');
  const Attachment = mongoose.model('Attachment');
  const Student = mongoose.model('Student');
  const User = mongoose.model('User');
  const ChildProfile = mongoose.model('ChildProfile');
  const studentLookup = require('../../src/modules/lms/repositories/student.repository');
  const assignmentService = require('../../src/modules/lms/services/assignment.service');
  const notDeleted = { 'softDelete.isDeleted': { $ne: true } };

  const snapHw = new Set((await LmsAssignment.find({}).select('_id').lean()).map((d) => String(d._id)));
  const snapAtt = new Set((await Attachment.find({}).select('_id').lean()).map((d) => String(d._id)));
  console.log(`SNAPSHOT  lmsAssignments=${snapHw.size}  attachments=${snapAtt.size}\n`);

  const createdHw = [];
  const createdAtt = [];

  try {
    const login = await fetch(`${API}/auth/school/teacher/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const lb = await login.json();
    if (!login.ok) throw new Error(`login failed: ${JSON.stringify(lb).slice(0, 300)}`);
    const token = lb.data.accessToken;
    const me = lb.data.user;
    const schoolId = String(me.tenantSchoolId || me.schoolId);
    const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    console.log(`logged in as ${me.name} (${me.role}) at school ${schoolId}`);

    const payload = {
      title: `${MARK} KG2 homework`,
      description: 'Automated verification of the parent homework feed. Deleted immediately.',
      instructions: 'Automated test row.',
      classGrade: 'KG2',
      section: 'A',
      subject: 'Math',
      homeworkType: 'Written',
      priority: 'Low',
      assignedDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 3 * 864e5).toISOString(),
      status: 'published',
      files: [JPEG_DATA_URL],
      bannerFile: JPEG_DATA_URL,
    };
    const res = await fetch(`${API}/schools/${schoolId}/lms/assignments`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    console.log(`\nCREATE homework: http=${res.status} ${body.message || ''} ${body.code || ''}`);
    if (!res.ok) throw new Error(JSON.stringify(body).slice(0, 500));

    const hw = body.data.assignment;
    createdHw.push(String(hw._id));
    const bannerId = hw.bannerAttachmentId && (hw.bannerAttachmentId._id || hw.bannerAttachmentId);
    (hw.attachments || []).forEach((a) => createdAtt.push(String((a && a._id) || a)));
    if (bannerId) createdAtt.push(String(bannerId));
    console.log(`  assignment _id     : ${hw._id}`);
    console.log(`  classGrade/section : ${hw.classGrade} / ${hw.section}   status=${hw.status}`);
    console.log(`  attachments created: ${JSON.stringify(createdAtt)}`);

    console.log('\nFETCH the files back through the API (as the teacher):');
    for (const id of createdAtt) {
      const r = await fetch(`${API}/schools/${schoolId}/lms/submission-attachments/${id}`, {
        headers: { authorization: auth.authorization },
      });
      const ct = r.headers.get('content-type');
      const n = r.ok ? (await r.arrayBuffer()).byteLength : 0;
      console.log(`  ${id}  http=${r.status} ${ct} ${n}b`);
    }

    console.log('\nPARENT FEED (real accounts, real service code, read-only):');
    const sample = async (grade, want) => {
      const students = await Student.find({ schoolId, classGrade: grade, status: 'active', ...notDeleted })
        .select('_id name').limit(60).lean();
      const seen = [];
      for (const st of students) {
        const cp = await ChildProfile.findOne({ studentId: st._id, ...notDeleted }).lean();
        if (!cp) continue;
        const u = await User.findById(cp.parentUserId).select('name phone').lean();
        if (!u) continue;
        const ctx = await studentLookup.resolveLearnerContext(schoolId, cp.parentUserId, null);
        if (!ctx) continue;
        const feed = await assignmentService.getStudentHomeworkFeed(schoolId, ctx.student);
        const mine = feed.find((f) => String(f.assignment._id) === String(hw._id));
        seen.push({
          parent: u.name,
          phone: u.phone,
          child: st.name,
          total: feed.length,
          sawTest: Boolean(mine),
          atts: mine ? (mine.assignment.attachments || []).length : 0,
          banner: mine ? Boolean(mine.assignment.bannerAttachmentId) : false,
          mime: mine && mine.assignment.attachments && mine.assignment.attachments[0] ? mine.assignment.attachments[0].mime : null,
        });
        if (seen.length >= want) break;
      }
      return seen;
    };

    for (const grade of ['KG2', 'KG1', 'NURSERY', 'PLAY GROUP']) {
      const rows = await sample(grade, 4);
      console.log(`\n  --- ${grade} ---`);
      if (!rows.length) console.log('    (no resolvable parent found)');
      rows.forEach((r) =>
        console.log(
          `    ${r.phone} ${r.parent} / ${r.child}: feed=${r.total} sawTestHomework=${r.sawTest}` +
            (r.sawTest ? ` attachments=${r.atts} banner=${r.banner} mime=${r.mime}` : '')
        )
      );
    }
  } finally {
    console.log('\n' + '='.repeat(70) + '\nCLEANUP\n' + '='.repeat(70));
    if (createdHw.length) {
      const r = await LmsAssignment.deleteMany({ _id: { $in: createdHw.map((id) => new mongoose.Types.ObjectId(id)) } });
      console.log(`  hard-deleted ${r.deletedCount} assignment(s): ${createdHw}`);
    }
    if (createdAtt.length) {
      const r = await Attachment.deleteMany({ _id: { $in: createdAtt.map((id) => new mongoose.Types.ObjectId(id)) } });
      console.log(`  hard-deleted ${r.deletedCount} attachment row(s): ${createdAtt}`);
    }

    const nowHw = new Set((await LmsAssignment.find({}).select('_id').lean()).map((d) => String(d._id)));
    const nowAtt = new Set((await Attachment.find({}).select('_id').lean()).map((d) => String(d._id)));
    const added = [...nowHw].filter((i) => !snapHw.has(i)).concat([...nowAtt].filter((i) => !snapAtt.has(i)));
    const lost = [...snapHw].filter((i) => !nowHw.has(i)).concat([...snapAtt].filter((i) => !nowAtt.has(i)));
    console.log(`\n  lmsAssignments ${snapHw.size} -> ${nowHw.size}    attachments ${snapAtt.size} -> ${nowAtt.size}`);
    console.log(`  documents added by this run and still present: ${added.length ? added.join(', ') : 'NONE'}`);
    console.log(`  pre-existing documents lost                 : ${lost.length ? lost.join(', ') : 'NONE'}`);
    console.log(added.length === 0 && lost.length === 0 ? '  DATABASE IS EXACTLY AS IT WAS.' : '  *** RESIDUE - INVESTIGATE ***');
    await mongoose.disconnect();
  }
})().catch(async (e) => {
  console.error('FAILED:', e.message);
  try { await mongoose.disconnect(); } catch { /* already closed */ }
  process.exit(1);
});
