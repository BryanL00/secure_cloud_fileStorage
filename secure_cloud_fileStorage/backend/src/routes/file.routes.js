const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const {
  upload, download, listFiles,
  deleteFileRecord, shareFile
} = require('../controllers/file.controller');

const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage });

// Upload — Manager and User only (NOT Admin)
router.post(
  '/upload',
  authenticate,
  authorize('Manager', 'User'),
  uploadMiddleware.single('file'),
  upload
);

// List files — all roles
// List files — NOT Admin
router.get(
  '/',
  authenticate,
  authorize('Manager', 'User', 'Guest'),
  listFiles
);

// Download — Manager, User, Guest (NOT Admin)
router.get(
  '/download/:id',
  authenticate,
  authorize('Manager', 'User', 'Guest'),
  download
);

// Delete — Manager and User (owner only, checked in controller)
router.delete(
  '/:id',
  authenticate,
  authorize('Manager', 'User'),
  deleteFileRecord
);

// Share — Manager only
router.post(
  '/:id/share',
  authenticate,
  authorize('Manager'),
  shareFile
);

module.exports = router;