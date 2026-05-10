const pool = require('../utils/db');
const { v4: uuidv4 } = require('uuid');
const {
  generateAESKey, generateIV,
  encryptFile, decryptFile,
  encryptAESKey, decryptAESKey
} = require('../utils/encryption');
const { uploadFile, downloadFile, deleteFile } = require('../utils/minio');
const { log, ACTIONS } = require('../utils/auditLog');

const DEPARTMENTS = ['IT', 'Finance', 'Marketing', 'HR', 'Operations'];

const upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const {
      sensitivity_level = 'low',
      project_category = '',
      folder_id = null,
      department = null
    } = req.body;

    const validLevels = ['low', 'medium', 'high', 'confidential'];
    if (!validLevels.includes(sensitivity_level)) {
      return res.status(400).json({ message: 'Invalid sensitivity level' });
    }

    if (department && !DEPARTMENTS.includes(department)) {
      return res.status(400).json({ message: 'Invalid department' });
    }

    const fileBuffer = req.file.buffer;
    const fileId = uuidv4();
    const storageKey = `${fileId}-${req.file.originalname}`;

    const aesKey = generateAESKey();
    const iv = generateIV();
    const encryptedBuffer = encryptFile(fileBuffer, aesKey, iv);
    const encryptedAESKey = encryptAESKey(aesKey);

    await uploadFile(storageKey, encryptedBuffer);

    await pool.query(
      `INSERT INTO files
        (id, owner_id, original_name, storage_key, size_bytes,
         mime_type, sensitivity_level, project_category, folder_id, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        fileId, req.user.id, req.file.originalname, storageKey,
        req.file.size, req.file.mimetype, sensitivity_level,
        project_category, folder_id || null, department || null
      ]
    );

    await pool.query(
      `INSERT INTO file_encryption_keys (file_id, encrypted_aes_key, aes_iv)
       VALUES ($1, $2, $3)`,
      [fileId, encryptedAESKey, iv.toString('hex')]
    );

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.FILE_UPLOAD, 'files', fileId,
      `Uploaded file: ${req.file.originalname} | sensitivity: ${sensitivity_level} | dept: ${department}`,
      req.ip
    );

    res.status(201).json({
      message: 'File uploaded and encrypted successfully',
      file: {
        id: fileId,
        original_name: req.file.originalname,
        sensitivity_level,
        project_category,
        department,
        size_bytes: req.file.size
      }
    });

  } catch (error) {
    console.error('Upload error:', error.message);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
};

const download = async (req, res) => {
  try {
    const { id } = req.params;

    const fileResult = await pool.query(
      `SELECT f.*, u.email as owner_email, u.department as owner_department
       FROM files f
       JOIN users u ON f.owner_id = u.id
       WHERE f.id = $1 AND f.is_deleted = FALSE`,
      [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = fileResult.rows[0];

    // Admin cannot download files
    if (req.user.role === 'Administrator') {
      await log(
        req.user.id, req.user.email, req.user.role,
        ACTIONS.ACCESS_DENIED, 'files', id,
        'Administrator attempted to download file — not permitted',
        req.ip
      );
      return res.status(403).json({
        message: 'Administrators cannot access file contents'
      });
    }

    // Check ownership or permission
    const isOwner = file.owner_id === req.user.id;
    const isManager = req.user.role === 'Manager';

    if (!isOwner) {
      // Check shared permissions
      const permResult = await pool.query(
        `SELECT id FROM file_permissions
         WHERE file_id = $1 AND granted_to_user_id = $2`,
        [id, req.user.id]
      );

      if (permResult.rows.length === 0) {
        await log(
          req.user.id, req.user.email, req.user.role,
          ACTIONS.ACCESS_DENIED, 'files', id,
          'Attempted to download file without permission',
          req.ip
        );
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Guest can only access low sensitivity files
    if (req.user.role === 'Guest' && file.sensitivity_level !== 'low') {
      await log(
        req.user.id, req.user.email, req.user.role,
        ACTIONS.ACCESS_DENIED, 'files', id,
        `Guest attempted to access ${file.sensitivity_level} sensitivity file`,
        req.ip
      );
      return res.status(403).json({
        message: 'Access denied: file sensitivity level too high'
      });
    }

    const keyResult = await pool.query(
      `SELECT encrypted_aes_key, aes_iv FROM file_encryption_keys WHERE file_id = $1`,
      [id]
    );

    if (keyResult.rows.length === 0) {
      return res.status(500).json({ message: 'Encryption key not found' });
    }

    const { encrypted_aes_key, aes_iv } = keyResult.rows[0];
    const encryptedBuffer = await downloadFile(file.storage_key);
    const aesKey = decryptAESKey(encrypted_aes_key);
    const iv = Buffer.from(aes_iv, 'hex');
    const decryptedBuffer = decryptFile(encryptedBuffer, aesKey, iv);

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.FILE_DOWNLOAD, 'files', id,
      `Downloaded file: ${file.original_name}`,
      req.ip
    );

    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.send(decryptedBuffer);

  } catch (error) {
    res.status(500).json({ message: 'Download failed', error: error.message });
  }
};

const listFiles = async (req, res) => {
  try {
    // Admin cannot see any files
    if (req.user.role === 'Administrator') {
      return res.status(403).json({
        message: 'Administrators do not have access to file contents or listings'
      });
    }

    let result;

    if (req.user.role === 'Manager') {
      result = await pool.query(
        `SELECT f.id, f.original_name, f.size_bytes, f.mime_type,
                f.sensitivity_level, f.project_category, f.department,
                f.folder_id, f.uploaded_at, u.email as owner_email
         FROM files f
         JOIN users u ON f.owner_id = u.id
         WHERE f.is_deleted = FALSE
         AND (
           f.owner_id = $1
           OR f.id IN (
             SELECT file_id FROM file_permissions WHERE granted_to_user_id = $1
           )
         )
         ORDER BY f.uploaded_at DESC`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        `SELECT f.id, f.original_name, f.size_bytes, f.mime_type,
                f.sensitivity_level, f.project_category, f.department,
                f.folder_id, f.uploaded_at, u.email as owner_email
         FROM files f
         JOIN users u ON f.owner_id = u.id
         WHERE f.is_deleted = FALSE
         AND (
           f.owner_id = $1
           OR f.id IN (
             SELECT file_id FROM file_permissions WHERE granted_to_user_id = $1
           )
         )
         ORDER BY f.uploaded_at DESC`,
        [req.user.id]
      );
    }

    res.json({ files: result.rows });

  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch files',
      error: error.message
    });
  }
};

const deleteFileRecord = async (req, res) => {
  try {
    const { id } = req.params;

    // Admin cannot delete files
    if (req.user.role === 'Administrator') {
      return res.status(403).json({
        message: 'Administrators cannot delete files'
      });
    }

    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = FALSE', [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = fileResult.rows[0];

    // Only owner can delete
    if (file.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.query('UPDATE files SET is_deleted = TRUE WHERE id = $1', [id]);

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.FILE_DELETE, 'files', id,
      `Deleted file: ${file.original_name}`,
      req.ip
    );

    res.json({ message: 'File deleted successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Delete failed', error: error.message });
  }
};

const shareFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { granted_to_email, permission_level = 'viewer' } = req.body;

    // Only Manager can share
    if (req.user.role !== 'Manager') {
      return res.status(403).json({
        message: 'Only Managers can share files'
      });
    }

    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = FALSE', [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = fileResult.rows[0];

    // Manager can only share files they own
    if (file.owner_id !== req.user.id) {
      return res.status(403).json({
        message: 'You can only share files you own'
      });
    }

    // Find the user to share with
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.department, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1 AND u.is_active = TRUE`,
      [granted_to_email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = userResult.rows[0];

    // Can only share to User or Guest roles
    if (!['User', 'Guest'].includes(targetUser.role)) {
      return res.status(403).json({
        message: 'Files can only be shared with User or Guest roles'
      });
    }

    // Check department or project category match
    const managerResult = await pool.query(
      'SELECT department FROM users WHERE id = $1',
      [req.user.id]
    );
    const managerDept = managerResult.rows[0]?.department;

    const sameDepartment = managerDept && targetUser.department === managerDept;
    const sameProject = file.project_category &&
      file.project_category.trim() !== '';

    if (!sameDepartment && !sameProject) {
      return res.status(403).json({
        message: 'You can only share files within your department or project'
      });
    }

    await pool.query(
      `INSERT INTO file_permissions
        (file_id, granted_to_user_id, granted_by_user_id, permission_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (file_id, granted_to_user_id)
       DO UPDATE SET permission_level = $4`,
      [id, targetUser.id, req.user.id, permission_level]
    );

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.FILE_SHARE, 'files', id,
      `Shared file: ${file.original_name} with ${granted_to_email}`,
      req.ip
    );

    res.json({ message: 'File shared successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Share failed', error: error.message });
  }
};

module.exports = { upload, download, listFiles, deleteFileRecord, shareFile };