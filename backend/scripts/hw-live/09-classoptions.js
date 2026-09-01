/** READ-ONLY. Exactly what the teacher homework form's class/section/subject dropdowns get. */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');
(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');
  const School = mongoose.model('School');
  const classService = require('../../src/modules/school/services/class.service');
  for (const s of await School.find({ 'softDelete.isDeleted': { $ne: true } }).select('_id name').lean()) {
    console.log(`\n=== ${s.name} ===`);
    const classes = await classService.listClasses(s._id);
    console.log(JSON.stringify(classes, null, 2));
  }
  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
