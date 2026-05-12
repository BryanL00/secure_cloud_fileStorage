const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const {
  upload, download, listFiles, listSharedFiles,
  listDeletedFiles, restoreFile, permanentDelete,
  searchFiles, deleteFileRecord, shareFile
} = require('../controllers/file.controller');

const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage });

router.get('/search', authenticate, authorize('Manager', 'User', 'Guest'), searchFiles);
router.get('/shared', authenticate, authorize('Manager', 'User', 'Guest'), listSharedFiles);
router.get('/deleted', authenticate, authorize('Administrator', 'Manager', 'User'), listDeletedFiles);
router.get('/', authenticate, authorize('Manager', 'User', 'Guest'), listFiles);
router.post('/upload', authenticate, authorize('Manager', 'User'), uploadMiddleware.single('file'), upload);
router.get('/download/:id', authenticate, authorize('Manager', 'User', 'Guest'), download);
router.post('/:id/restore', authenticate, authorize('Administrator', 'Manager', 'User'), restoreFile);
router.delete('/:id/permanent', authenticate, authorize('Administrator'), permanentDelete);
router.delete('/:id', authenticate, authorize('Manager', 'User'), deleteFileRecord);
router.post('/:id/share', authenticate, authorize('Manager'), shareFile);

module.exports = router;