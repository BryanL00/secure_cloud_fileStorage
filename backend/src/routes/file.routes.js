const path = require('path');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth');
const {
  upload, download, listFiles, listSharedFiles,
  listDeletedFiles, restoreFile, permanentDelete,
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

// --- Upload rate limiter ---

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many uploads. Please wait before uploading again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Routes ---

router.get('/storage',          authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), getStorageStats);
router.get('/search',           authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), searchFiles);
router.get('/shared',           authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), listSharedFiles);
router.get('/deleted',          authenticate, authorize('Administrator', 'Department Manager', 'Project Manager', 'User'), listDeletedFiles);
router.get('/',                 authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), listFiles);
router.post('/upload',          authenticate, authorize('Department Manager', 'Project Manager', 'User'), uploadLimiter, handleUpload, upload);
router.get('/download/:id',     authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), download);
router.get('/:id/shares',             authenticate, authorize('Department Manager', 'Project Manager'), getFileShares);
router.delete('/:id/share/:userId',   authenticate, authorize('Department Manager', 'Project Manager'), revokeShare);
router.post('/:id/restore',     authenticate, authorize('Administrator', 'Department Manager', 'Project Manager', 'User'), restoreFile);
router.delete('/:id/permanent', authenticate, authorize('Administrator'), permanentDelete);
router.delete('/:id',           authenticate, authorize('Department Manager', 'Project Manager', 'User'), deleteFileRecord);
router.post('/:id/share',       authenticate, authorize('Department Manager', 'Project Manager'), shareFile);

module.exports = router;