const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const fileType = require('file-type');
const { authenticate, authorize } = require('../middleware/auth');
const {
  upload, uploadBatch, download, preview, listFiles, listSharedFiles,
  listDeletedFiles, restoreFile, permanentDelete, emptyRecycleBin,
  searchFiles, deleteFileRecord, shareFile, getStorageStats,
  getFileShares, revokeShare,
} = require('../controllers/file.controller');

// --- Allowlists ---

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'text/plain', 'text/csv', 'application/rtf',
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
  // Archives
  'application/zip', 'application/x-7z-compressed',
  'application/x-rar-compressed', 'application/gzip',
  // Data
  'application/json', 'application/xml', 'text/xml',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  '.txt', '.csv', '.rtf',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
  '.zip', '.7z', '.rar', '.tar', '.gz',
  '.json', '.xml', '.yaml', '.yml',
]);

// Maps each binary extension to the content type(s) file-type may legitimately
// detect from its magic bytes. Container formats (OOXML/ODF) are ZIP-based, and
// legacy MS Office files are CFB-based, so they detect as zip / x-cfb.
const ZIP_CONTAINER = ['application/zip'];
const CFB_CONTAINER = ['application/x-cfb'];
const EXT_MAGIC_MAP = {
  '.pdf':  ['application/pdf'],
  '.jpg':  ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png':  ['image/png'],
  '.gif':  ['image/gif'],
  '.webp': ['image/webp'],
  '.bmp':  ['image/bmp'],
  '.zip':  ZIP_CONTAINER,
  '.7z':   ['application/x-7z-compressed'],
  '.rar':  ['application/x-rar-compressed'],
  '.gz':   ['application/gzip'],
  '.tar':  ['application/x-tar'],
  // OOXML/ODF detect as generic zip, or the specific type when file-type can
  // scan the zip's central directory — accept either.
  '.docx': [...ZIP_CONTAINER, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xlsx': [...ZIP_CONTAINER, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.pptx': [...ZIP_CONTAINER, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.odt':  [...ZIP_CONTAINER, 'application/vnd.oasis.opendocument.text'],
  '.ods':  [...ZIP_CONTAINER, 'application/vnd.oasis.opendocument.spreadsheet'],
  '.odp':  [...ZIP_CONTAINER, 'application/vnd.oasis.opendocument.presentation'],
  '.doc':  CFB_CONTAINER, '.xls':  CFB_CONTAINER, '.ppt':  CFB_CONTAINER,
};

// --- Multer config ---

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File extension '${ext}' is not allowed`), false);
  }
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error(`File type '${file.mimetype}' is not allowed`), false);
  }
  cb(null, true);
};

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB hard cap
});

// Lenient filter for batch (folder) uploads: a disallowed file is skipped and
// recorded on req.filteredOut rather than aborting the whole batch.
const batchFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    req.filteredOut = req.filteredOut || [];
    req.filteredOut.push({ name: file.originalname, reason: `File type '${ext || file.mimetype}' is not allowed` });
    return cb(null, false);
  }
  cb(null, true);
};

const batchUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter: batchFileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Wraps multer so errors return clean JSON instead of crashing the route
const handleUpload = (req, res, next) => {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File exceeds the 100 MB size limit' });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Checks a file's actual bytes against its declared extension to block renamed
// executables. Executables always carry magic bytes, so a disguised binary is
// always detected here; format-less files (text/csv/json/empty) detect as
// nothing and are trusted via the extension allowlist already enforced upstream.
// Returns { ok: true } or { ok: false, message }.
const checkFileType = async (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const detected = await fileType.fromBuffer(file.buffer);
  if (!detected) {
    return { ok: true };
  }
  const allowedForExt = EXT_MAGIC_MAP[ext];
  if (!allowedForExt || !allowedForExt.includes(detected.mime)) {
    return { ok: false, message: `File content (${detected.mime}) does not match its '${ext}' extension` };
  }
  return { ok: true };
};

// Single-file magic-byte guard: rejects the request if the one file is invalid.
const validateMagicBytes = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const result = await checkFileType(req.file);
    if (!result.ok) return res.status(400).json({ message: result.message });
    next();
  } catch (err) {
    next(err);
  }
};

// Batch magic-byte guard: partitions req.files, keeping valid files and moving
// rejected ones to req.invalidFiles so the controller can report them per-file.
const validateMagicBytesBatch = async (req, res, next) => {
  // Start with files dropped by the lenient multer filter (wrong extension/type).
  const invalid = req.filteredOut || [];
  if (!req.files || req.files.length === 0) {
    req.invalidFiles = invalid;
    return next();
  }
  try {
    const valid = [];
    for (const file of req.files) {
      const result = await checkFileType(file);
      if (result.ok) valid.push(file);
      else invalid.push({ name: file.originalname, reason: result.message });
    }
    req.files = valid;
    req.invalidFiles = invalid;
    next();
  } catch (err) {
    next(err);
  }
};

// --- Upload rate limiter ---

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many uploads. Please wait before uploading again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Max files accepted in a single batch (folder) upload request.
const MAX_BATCH_FILES = 50;

// Wraps multer's array handler so errors return clean JSON.
const handleBatchUpload = (req, res, next) => {
  batchUploadMiddleware.array('files', MAX_BATCH_FILES)(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'A file exceeds the 100 MB size limit' });
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: `Each batch may contain at most ${MAX_BATCH_FILES} files` });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// --- Routes ---

router.get('/storage',          authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), getStorageStats);
router.get('/search',           authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), searchFiles);
router.get('/shared',           authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), listSharedFiles);
router.get('/deleted',          authenticate, authorize('Administrator', 'Department Manager', 'Project Manager', 'User'), listDeletedFiles);
router.delete('/recycle-bin/empty', authenticate, authorize('Administrator'), emptyRecycleBin);
router.get('/',                 authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), listFiles);
router.post('/upload',          authenticate, authorize('Department Manager', 'Project Manager', 'User'), uploadLimiter, handleUpload, validateMagicBytes, upload);
router.post('/upload/batch',    authenticate, authorize('Department Manager', 'Project Manager', 'User'), uploadLimiter, handleBatchUpload, validateMagicBytesBatch, uploadBatch);
router.get('/download/:id',     authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), download);
router.get('/preview/:id',      authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), preview);
router.get('/:id/shares',             authenticate, authorize('Department Manager', 'Project Manager'), getFileShares);
router.delete('/:id/share/:userId',   authenticate, authorize('Department Manager', 'Project Manager'), revokeShare);
router.post('/:id/restore',     authenticate, authorize('Administrator', 'Department Manager', 'Project Manager', 'User'), restoreFile);
router.delete('/:id/permanent', authenticate, authorize('Administrator'), permanentDelete);
router.delete('/:id',           authenticate, authorize('Department Manager', 'Project Manager', 'User'), deleteFileRecord);
router.post('/:id/share',       authenticate, authorize('Department Manager', 'Project Manager'), shareFile);

module.exports = router;