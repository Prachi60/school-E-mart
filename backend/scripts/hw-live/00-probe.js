// Read-only: which database does the live URI actually land on, and what is in it?
const mongoose = require('mongoose');
const { connectLive } = require('./liveConnect');

(async () => {
  await connectLive();
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  const rows = [];
  for (const c of cols) {
    rows.push([c.name, await db.collection(c.name).estimatedDocumentCount()]);
  }
  rows.sort((a, b) => b[1] - a[1]);
  console.log(`collections in "${mongoose.connection.name}": ${rows.length}`);
  rows.forEach(([n, k]) => console.log(`  ${String(k).padStart(8)}  ${n}`));

  try {
    const admin = db.admin();
    const { databases } = await admin.listDatabases();
    console.log('\ndatabases on the cluster:');
    databases.forEach((d) => console.log(`  ${d.name} (${d.sizeOnDisk} bytes)`));
  } catch (e) {
    console.log('\n(listDatabases not permitted:', e.message, ')');
  }
  await mongoose.disconnect();
})().catch(async (e) => { console.error('FAILED:', e.message); await mongoose.disconnect(); process.exit(1); });
