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

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.FILE_ENCRYPT, 'files', fileId,
      `Encrypted: ${req.file.originalname} | AES-256-CBC | RSA-wrapped key | size: ${req.file.size} bytes`,
      req.ip
    );

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
      `Uploaded: ${req.file.originalname} | sensitivity: ${sensitivity_level} | dept: ${department}`,
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

    const isOwner = file.owner_id === req.user.id;

    if (!isOwner) {
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

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.ACCESS_EVAL, 'files', id,
      `Access evaluation passed: role=${req.user.role}, sensitivity=${file.sensitivity_level}, owner=${isOwner}`,
      req.ip
    );

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
      ACTIONS.FILE_DECRYPT, 'files', id,
      `Decrypted: ${file.original_name} | RSA key-unwrap + AES-256-CBC`,
      req.ip
    );

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.FILE_DOWNLOAD, 'files', id,
      `Downloaded: ${file.original_name}`,
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
    if (req.user.role === 'Administrator') {
      return res.status(403).json({
        message: 'Administrators do not have access to file contents or listings'
      });
    }

    const result = await pool.query(
      `SELECT f.id, f.original_name, f.size_bytes, f.mime_type,
              f.sensitivity_level, f.project_category, f.department,
              f.folder_id, f.uploaded_at, u.email as owner_email
       FROM files f
       JOIN users u ON f.owner_id = u.id
       WHERE f.is_deleted = FALSE
         AND (
           f.owner_id = $1
           OR f.id IN (SELECT file_id FROM file_permissions WHERE granted_to_user_id = $1)
         )
       ORDER BY f.uploaded_at DESC`,
      [req.user.id]
    );

    res.json({ files: result.rows });

  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch files', error: error.message });
  }
};

const listSharedFiles = async (req, res) => {
  try {
    if (req.user.role === 'Administrator') {
      return res.status(403).json({ message: 'Administrators cannot access files' });
    }

    const result = await pool.query(
      `SELECT f.id, f.original_name, f.size_bytes, f.mime_type,
              f.sensitivity_level, f.project_category, f.department,
              f.folder_id, f.uploaded_at, u.email as owner_email,
              fp.permission_level, gb.email as shared_by_email
       FROM files f
       JOIN users u ON f.owner_id = u.id
       JOIN file_permissions fp ON fp.file_id = f.id
       JOIN users gb ON fp.granted_by_user_id = gb.id
       WHERE fp.granted_to_user_id = $1
         AND f.is_deleted = FALSE
       ORDER BY f.uploaded_at DESC`,
      [req.user.id]
    );

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.ACCESS_EVAL, 'files', null,
      `Listed shared files — ${result.rows.length} files accessible`,
      req.ip
    );

    res.json({ files: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch shared files', error: error.message });
  }
};

const listDeletedFiles = async (req, res) => {
  try {
    let result;

    if (req.user.role === 'Administrator') {
      result = await pool.query(
        `SELECT f.id, f.original_name, f.size_bytes, f.mime_type,
                f.sensitivity_level, f.project_category, f.department,
                f.uploaded_at, u.email as owner_email, u.id as owner_id
         FROM files f
         JOIN users u ON f.owner_id = u.id
         WHERE f.is_deleted = TRUE
         ORDER BY f.uploaded_at DESC`
      );
    } else if (['Department Manager', 'Project Manager', 'User'].includes(req.user.role)) {
      result = await pool.query(
        `SELECT f.id, f.original_name, f.size_bytes, f.mime_type,
                f.sensitivity_level, f.project_category, f.department,
                f.uploaded_at, u.email as owner_email, u.id as owner_id
         FROM files f
         JOIN users u ON f.owner_id = u.id
         WHERE f.is_deleted = TRUE AND f.owner_id = $1
         ORDER BY f.uploaded_at DESC`,
        [req.user.id]
      );
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ files: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vault files', error: error.message });
  }
};

const restoreFile = async (req, res) => {
  try {
    const { id } = req.params;

    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = TRUE', [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found in vault' });
    }

    const file = fileResult.rows[0];

    if (req.user.role !== 'Administrator' && file.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.query('UPDATE files SET is_deleted = FALSE WHERE id = $1', [id]);

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.FILE_RESTORE, 'files', id,
      `Restored file from vault: ${file.original_name}`,
      req.ip
    );

    res.json({ message: 'File restored successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Restore failed', error: error.message });
  }
};

const permanentDelete = async (req, res) => {
  try {
    const { id } = req.params;

    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = TRUE', [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found in vault' });
    }

    const file = fileResult.rows[0];

    await pool.query('DELETE FROM file_encryption_keys WHERE file_id = $1', [id]);
    await pool.query('DELETE FROM file_permissions WHERE file_id = $1', [id]);
    await pool.query('DELETE FROM files WHERE id = $1', [id]);

    try {
      await deleteFile(file.storage_key);
    } catch (e) {
      console.error('MinIO delete (non-fatal):', e.message);
    }

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.FILE_PERMANENT_DELETE, 'files', id,
      `Permanently erased from vault: ${file.original_name}`,
      req.ip
    );

    res.json({ message: 'File permanently deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Permanent delete failed', error: error.message });
  }
};

const searchFiles = async (req, res) => {
  try {
    if (req.user.role === 'Administrator') {
      return res.status(403).json({ message: 'Administrators cannot search files' });
    }

    const { q = '' } = req.query;

    if (!q.trim()) {
      return res.json({ files: [] });
    }

    const searchTerm = `%${q.trim().toLowerCase()}%`;

    const result = await pool.query(
      `SELECT f.id, f.original_name, f.size_bytes, f.mime_type,
              f.sensitivity_level, f.project_category, f.department,
              f.folder_id, f.uploaded_at, u.email as owner_email
       FROM files f
       JOIN users u ON f.owner_id = u.id
       WHERE f.is_deleted = FALSE
         AND (
           f.owner_id = $1
           OR f.id IN (SELECT file_id FROM file_permissions WHERE granted_to_user_id = $1)
         )
         AND (
           LOWER(f.original_name) LIKE $2
           OR LOWER(COALESCE(f.project_category, '')) LIKE $2
           OR LOWER(COALESCE(f.department, '')) LIKE $2
           OR LOWER(f.sensitivity_level) LIKE $2
           OR LOWER(u.email) LIKE $2
         )
       ORDER BY f.uploaded_at DESC
       LIMIT 20`,
      [req.user.id, searchTerm]
    );

    res.json({ files: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};

const deleteFileRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role === 'Administrator') {
      return res.status(403).json({ message: 'Administrators cannot delete files' });
    }

    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = FALSE', [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = fileResult.rows[0];

    if (file.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.query('UPDATE files SET is_deleted = TRUE WHERE id = $1', [id]);

    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.FILE_DELETE, 'files', id,
      `Soft-deleted (moved to vault): ${file.original_name}`,
      req.ip
    );

    res.json({ message: 'File moved to vault' });

  } catch (error) {
    res.status(500).json({ message: 'Delete failed', error: error.message });
  }
};

const shareFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { granted_to_email, permission_level = 'viewer' } = req.body;

    if (!['Department Manager', 'Project Manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only Managers can share files' });
    }

    const fileResult = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = FALSE', [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = fileResult.rows[0];

    if (file.owner_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only share files you own' });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.department,
          r.name as role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.email = $1`,
        [granted_to_email]
      );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = result.rows[0];

    if (!['User', 'Guest', 'Project Manager'].includes(targetUser.role)) {
      return res.status(403).json({
        message: 'Files can only be shared with User, Guest, or Project Manager roles'
      });
    }

    const managerDept = req.user.department;
    const sameDepartment = managerDept && targetUser.department === managerDept;

    if (!sameDepartment) {
      return res.status(403).json({
        message: 'You can only share files with users in the same department'
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
      `Shared: ${file.original_name} → ${granted_to_email} | dept: ${managerDept}`,
      req.ip
    );

    res.json({ message: 'File shared successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Share failed', error: error.message });
  }
};

const getStorageStats = async (req, res) => {
  try {
    const TOTAL_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB per user

    const result = await pool.query(
      `SELECT
        COALESCE(SUM(f.size_bytes), 0)::bigint          AS used_bytes,
        COUNT(f.id)::int                                 AS file_count,
        COALESCE(SUM(
          CASE WHEN fp.file_id IS NOT NULL
               THEN f.size_bytes ELSE 0 END
        ), 0)::bigint                                    AS shared_bytes
       FROM files f
       LEFT JOIN (
         SELECT DISTINCT file_id
         FROM file_permissions
         WHERE granted_by_user_id = $1
       ) fp ON fp.file_id = f.id
       WHERE f.owner_id = $1 AND f.is_deleted = FALSE`,
      [req.user.id]
    );

    const { used_bytes, file_count, shared_bytes } = result.rows[0];

    res.json({
      used_bytes:   Number(used_bytes),
      shared_bytes: Number(shared_bytes),
      file_count:   Number(file_count),
      total_bytes:  TOTAL_BYTES,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch storage stats' });
  }
};

module.exports = {
  upload, download, listFiles, listSharedFiles,
  listDeletedFiles, restoreFile, permanentDelete,
  searchFiles, deleteFileRecord, shareFile, getStorageStats
};
