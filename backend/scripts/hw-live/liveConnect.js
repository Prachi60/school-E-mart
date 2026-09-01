/**
 * Shared connector for the LIVE client database.
 *
 * Deliberately does NOT use src/database/connection.js: config/database.js sets
 * `autoIndex: env.NODE_ENV !== 'production'` and .env says NODE_ENV=development, so
 * connecting through the app would make mongoose start BUILDING INDEXES on the live
 * database the moment it connects. autoIndex is forced off here.
 *
 * The live URI is the commented-out line in backend/.env under "##live client mongo url",
 * so nothing here depends on editing .env (which would repoint the running app too).
 */
const fs = require('fs');
const path = require('path');
const dns = require('dns');
const mongoose = require('mongoose');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const ENV_PATH = path.resolve(__dirname, '../../.env');

const readLiveUri = () => {
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  const idx = lines.findIndex((l) => /live client mongo url/i.test(l));
  if (idx === -1) throw new Error('No "##live client mongo url" marker in .env');
  for (let i = idx + 1; i < Math.min(idx + 5, lines.length); i += 1) {
    const m = lines[i].match(/^\s*#\s*MONGODB_URI\s*=\s*(\S+)\s*$/);
    if (m) return m[1];
  }
  throw new Error('No commented MONGODB_URI found under the live marker');
};

const redact = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

const connectLive = async () => {
  const uri = readLiveUri();
  await mongoose.connect(uri, {
    autoIndex: false, // never build indexes on the live DB
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 20000,
  });
  console.log(`connected: ${redact(uri)}`);
  console.log(`database:  ${mongoose.connection.name}\n`);
  return mongoose.connection;
};

module.exports = { connectLive, readLiveUri, redact };
