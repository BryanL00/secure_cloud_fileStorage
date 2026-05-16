const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const {
  upload, download, listFiles, listSharedFiles,
  listDeletedFiles, restoreFile, permanentDelete,
  searchFiles, deleteFileRecord, shareFile, getStorageStats
} = require('../controllers/file.controller');

const storage = multer.memoryStorage();
const uploadMiddleware = multer({ storage });

router.get('/storage',       authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), getStorageStats);
router.get('/search',        authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), searchFiles);
router.get('/shared',        authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), listSharedFiles);
router.get('/deleted',       authenticate, authorize('Administrator', 'Department Manager', 'Project Manager', 'User'), listDeletedFiles);
router.get('/',              authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), listFiles);
router.post('/upload',       authenticate, authorize('Department Manager', 'Project Manager', 'User'), uploadMiddleware.single('file'), upload);
router.get('/download/:id',  authenticate, authorize('Department Manager', 'Project Manager', 'User', 'Guest'), download);
router.post('/:id/restore',  authenticate, authorize('Administrator', 'Department Manager', 'Project Manager', 'User'), restoreFile);
router.delete('/:id/permanent', authenticate, authorize('Administrator'), permanentDelete);
router.delete('/:id',        authenticate, authorize('Department Manager', 'Project Manager', 'User'), deleteFileRecord);
router.post('/:id/share',    authenticate, authorize('Department Manager', 'Project Manager'), shareFile);

module.exports = router;