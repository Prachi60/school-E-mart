/** READ-ONLY. Exact options of the live users indexes vs what the schema now declares. */
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');
(async () => {
  await connectLive();
  require('../../src/database/modelRegistry');
  const User = mongoose.model('User');
  console.log('LIVE indexes on users:');
  (await User.collection.indexes()).forEach((i) => console.log('  ' + JSON.stringify(i)));
  console.log('\nSCHEMA declares:');
  User.schema.indexes().forEach((i) => console.log('  ' + JSON.stringify(i)));
  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e); await mongoose.disconnect(); process.exit(1); });
