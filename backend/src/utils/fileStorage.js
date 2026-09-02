const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

// Both directories live on the server's own disk and are gitignored, so they persist
// across an in-place update but are never committed. Set UPLOADS_DIR /
// PRIVATE_UPLOADS_DIR to an absolute path outside the repo if a deploy clones into a
// fresh directory, or the previous checkout's files are stranded.
//
// Public assets (product images, banners, reels) are served by express.static.
const UPLOADS_DIR = env.UPLOADS_DIR
  ? path.resolve(env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');

// Student work is not public. Nothing serves this directory statically; it is only
// readable through the authorized attachment stream endpoint.
const PRIVATE_UPLOADS_DIR = env.PRIVATE_UPLOADS_DIR
  ? path.resolve(env.PRIVATE_UPLOADS_DIR)
  : path.resolve(__dirname, '../../private-uploads');

const DATA_URI_PATTERN = /^data:(image\/(?:png|jpe?g|webp|gif)|application\/pdf);base64,([\s\S]+)$/;

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME = {
  'image/png': 'png',
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

/**
 * File extension (no dot) for a stored mime, or '' when we do not recognise it.
 * Phones type a downloaded file by its extension rather than by sniffing its bytes, so
 * anything that hands a file to a client needs this to build a usable filename.
 */
const extensionForMime = (mime) => EXTENSION_BY_MIME[String(mime || '').trim().toLowerCase()] || '';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Decode a base64 data URI and write it under `dir`.
 * Returns { storageKey, mime, sizeBytes } on success, or { error } describing why the
 * file was refused. Callers must surface the error: silently dropping a file leaves the
 * parent believing they submitted work that never arrived.
 */
const writeDataUri = (value, { dir, prefix, maxBytes }) => {
  if (!value || typeof value !== 'string') {
    return { error: 'EMPTY_FILE' };
  }

  const match = value.match(DATA_URI_PATTERN);
  if (!match) {
    return { error: 'UNSUPPORTED_FILE_TYPE' };
  }

  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    return { error: 'EMPTY_FILE' };
  }
  if (buffer.length > maxBytes) {
    return { error: 'FILE_TOO_LARGE' };
  }

  ensureDir(dir);

  const ext = EXTENSION_BY_MIME[mime] || 'bin';
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return { storageKey: filename, mime, sizeBytes: buffer.length };
};

/**
 * Persist a base64 data URI under the public /uploads dir and return its public path.
 * Returns already-stored paths untouched so callers can pass through existing values.
 * Returns null when the input is not a data URI we accept.
 */
const saveBase64File = (value, prefix = 'file', { maxBytes = DEFAULT_MAX_BYTES } = {}) => {
  if (typeof value === 'string') {
    if (value.startsWith('/uploads/')) return value;
    const matchUploads = value.match(/(\/uploads\/[^\s?#]+)/);
    if (matchUploads) return matchUploads[1];
  }

  const result = writeDataUri(value, { dir: UPLOADS_DIR, prefix, maxBytes });
  return result.error ? null : `/uploads/${result.storageKey}`;
};

const saveBase64Files = (values = [], prefix = 'file', options = {}) =>
  (Array.isArray(values) ? values : [])
    .map((value) => saveBase64File(value, prefix, options))
    .filter(Boolean);

/**
 * Persist base64 data URIs under the private dir. Unlike the public helper, this reports
 * every rejection so the caller can tell the user which file failed and why.
 * Returns { saved: [{ storageKey, mime, sizeBytes }], rejected: [{ index, error }] }.
 */
const savePrivateBase64Files = (
  values = [],
  prefix = 'file',
  { maxBytes = DEFAULT_MAX_BYTES } = {}
) => {
  const saved = [];
  const rejected = [];

  (Array.isArray(values) ? values : []).forEach((value, index) => {
    const result = writeDataUri(value, { dir: PRIVATE_UPLOADS_DIR, prefix, maxBytes });
    if (result.error) {
      rejected.push({ index, error: result.error });
    } else {
      saved.push(result);
    }
  });

  return { saved, rejected };
};

/**
 * Resolve a private storage key to an absolute path, refusing anything that escapes the
 * private dir. Keys come from the database, but a traversal there must not become a
 * read of arbitrary server files.
 */
const resolvePrivatePath = (storageKey) => {
  if (!storageKey || typeof storageKey !== 'string') return null;

  const absolute = path.resolve(PRIVATE_UPLOADS_DIR, storageKey);
  const root = `${PRIVATE_UPLOADS_DIR}${path.sep}`;
  if (!absolute.startsWith(root)) return null;

  return absolute;
};

module.exports = {
  extensionForMime,
  saveBase64File,
  saveBase64Files,
  savePrivateBase64Files,
  resolvePrivatePath,
  DEFAULT_MAX_BYTES,
  UPLOADS_DIR,
  PRIVATE_UPLOADS_DIR,
};
