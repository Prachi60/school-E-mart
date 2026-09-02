const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

// Must match the server's per-file cap (fileStorage.DEFAULT_MAX_BYTES) and the
// submitAssignment validator's 5-file limit. Images are downscaled below, so in practice
// this only bites on large PDFs — which the server would otherwise reject after the
// parent had already waited through the upload.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 5;

// Exactly what the server's data-URI writer will store (backend fileStorage.js,
// DATA_URI_PATTERN). Anything outside this set has to be re-encoded to JPEG in the
// browser before it is sent — sending it as-is is a guaranteed UNSUPPORTED_FILE_TYPE
// after the parent has already waited through the upload.
const STORABLE_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

// Android's gallery and file managers type a downloaded file by its extension rather
// than by sniffing its bytes, so a file saved as a bare "Attachment 1" opens as
// "Failed to load photo" / "File format isn't supported or files are corrupted".
// Attachment records keep no original filename, so the extension has to be rebuilt
// from the stored mime. Keep in step with fileStorage.EXTENSION_BY_MIME.
const EXTENSION_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

/** File extension (no dot) for a stored mime, or '' when we don't recognise it. */
export const extensionForMime = (mime) =>
  EXTENSION_BY_MIME[String(mime || '').trim().toLowerCase()] || '';

/**
 * Display/download name for an Attachment. The extension is what makes a downloaded
 * file openable on a phone, so it must survive into the anchor's `download` attribute.
 */
export const attachmentFileName = (mime, index) => {
  const ext = extensionForMime(mime);
  const base = `Attachment ${index + 1}`;
  return ext ? `${base}.${ext}` : base;
};

/** Returns an error message if the selection cannot be submitted, else null. */
export const validateSubmissionFiles = (files = []) => {
  if (files.length > MAX_FILES) {
    return `You can attach at most ${MAX_FILES} files.`;
  }

  const tooBig = files.find((file) => file.size > MAX_FILE_BYTES);
  if (tooBig && !tooBig.type.startsWith('image/')) {
    return `"${tooBig.name}" is larger than 5 MB. Please attach a smaller file.`;
  }

  const unsupported = files.find(
    (file) => !file.type.startsWith('image/') && file.type !== 'application/pdf'
  );
  if (unsupported) {
    return `"${unsupported.name}" is not a supported file. Attach a JPG, PNG, WEBP, GIF or PDF.`;
  }

  return null;
};

export const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });

/**
 * Downscale an image to a sane size and re-encode it as JPEG so submissions stay
 * well inside the server's request body budget. Non-images (e.g. PDFs) pass through
 * unchanged.
 *
 * A format the server cannot store (HEIC from an iPhone camera, AVIF, BMP, TIFF) is
 * always re-encoded, however small it is: passing the original bytes through would be
 * rejected on arrival. That conversion only works where the browser can decode the
 * format at all — Safari decodes HEIC, Chrome on Android does not — so a decode
 * failure is reported against the file by name instead of as a bare "unable to load".
 */
export const fileToCompressedDataUrl = async (file) => {
  const dataUrl = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/')) return dataUrl;

  const mustReencode = !STORABLE_IMAGE_MIMES.has(file.type.toLowerCase());

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          mustReencode
            ? `"${file.name}" is in a format this device cannot convert. Please attach a JPG or PNG.`
            : `Unable to load "${file.name}".`
        )
      );
    img.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  if (!mustReencode && scale === 1 && dataUrl.length < 1_000_000) return dataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
};

export const filesToCompressedDataUrls = (files = []) =>
  Promise.all(files.map((file) => fileToCompressedDataUrl(file)));
