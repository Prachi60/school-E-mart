const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { UPLOADS_DIR, extensionForMime } = require('../../../utils/fileStorage');

// Single source of truth for where public uploads live, so a configured UPLOADS_DIR
// moves multer, the base64 writer, and the static mount together.
const UPLOAD_DIR = UPLOADS_DIR;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const VIDEO_EXTENSION_BY_MIME = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/**
 * The extension a stored file gets. Derived from the mime first: that is what the bytes
 * actually are, and a file picked from a camera roll can arrive with no extension at
 * all. Stored without one, express.static serves it with no Content-Type and the
 * browser that downloads it saves a file the phone cannot open.
 */
const storedExtension = (file) => {
  const fromMime = extensionForMime(file.mimetype) || VIDEO_EXTENSION_BY_MIME[file.mimetype];
  if (fromMime) return `.${fromMime}`;

  const fromName = path.extname(file.originalname || '').toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(fromName) ? fromName : '';
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${storedExtension(file)}`);
  },
});

// Only the formats every target browser can actually render, and the same five the
// base64 writer stores (fileStorage.DATA_URI_PATTERN). "image/*" used to be enough to
// get in, which let HEIC (the iPhone and many Android camera defaults), AVIF, BMP and
// TIFF reach /uploads, where a large share of visitors then could not display them.
const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const IMAGE_ERROR = 'Only JPG, PNG, WEBP or GIF images are allowed';

const isAllowedImage = (file) => ALLOWED_IMAGE_MIMES.has(String(file.mimetype).toLowerCase());

const imageFilter = (_req, file, cb) => {
  if (isAllowedImage(file)) {
    cb(null, true);
    return;
  }
  cb(new Error(IMAGE_ERROR));
};

const mediaFilter = (_req, file, cb) => {
  if (isAllowedImage(file) || file.mimetype.startsWith('video/')) {
    cb(null, true);
    return;
  }
  cb(new Error(`${IMAGE_ERROR}, or a video file`));
};

// KYC paperwork is routinely a scanned PDF, so documents accept more than images.
const documentFilter = (_req, file, cb) => {
  if (isAllowedImage(file) || file.mimetype === 'application/pdf') {
    cb(null, true);
    return;
  }
  cb(new Error(`${IMAGE_ERROR}, or a PDF`));
};

const uploadImage = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: imageFilter,
}).single('file');

const PlatformSettings = require('../../../database/models/PlatformSettings');

const getMaxMediaSizeBytes = async () => {
  try {
    const settings = await PlatformSettings.findById('default').lean();
    const mb = settings?.lms?.maxVideoSizeMB || 500;
    return mb * 1024 * 1024;
  } catch {
    return 500 * 1024 * 1024;
  }
};

const uploadMedia = (req, res, next) => {
  getMaxMediaSizeBytes()
    .then((maxBytes) => {
      multer({
        storage,
        limits: { fileSize: maxBytes },
        fileFilter: mediaFilter,
      }).single('file')(req, res, next);
    })
    .catch(() => {
      multer({
        storage,
        limits: { fileSize: 500 * 1024 * 1024 },
        fileFilter: mediaFilter,
      }).single('file')(req, res, next);
    });
};

const uploadDocument = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: documentFilter,
}).single('file');

module.exports = {
  uploadImage,
  uploadMedia,
  uploadDocument,
  UPLOAD_DIR,
};
