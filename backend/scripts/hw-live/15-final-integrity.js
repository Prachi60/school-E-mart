/** READ-ONLY. Confirms the live database is untouched after the test run. */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');
(async () => {
  await connectLive();
  const db = mongoose.connection.db;
  const want = ['lmsAssignments', 'attachments', 'users', 'students', 'childProfiles',
    'parentProfiles', 'lmsAssignmentSubmissions', 'authSessions', 'teacherProfiles', 'schools'];
  for (const c of want) console.log(`  ${String(await db.collection(c).countDocuments()).padStart(6)}  ${c}`);
  const stray = await db.collection('lmsAssignments').countDocuments({ title: /ZZ-AUTOMATED-TEST/ });
  console.log(`\n  test rows left behind: ${stray}`);
  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
