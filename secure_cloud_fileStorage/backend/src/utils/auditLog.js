const pool = require('./db');

const ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  FILE_UPLOAD: 'FILE_UPLOAD',
  FILE_DOWNLOAD: 'FILE_DOWNLOAD',
  FILE_DELETE: 'FILE_DELETE',
  FILE_SHARE: 'FILE_SHARE',
  FOLDER_CREATE: 'FOLDER_CREATE',
  FOLDER_DELETE: 'FOLDER_DELETE',
  USER_ROLE_UPDATE: 'USER_ROLE_UPDATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  ACCESS_DENIED: 'ACCESS_DENIED'
};

const log = async (userId, userEmail, userRole, action, resource, resourceId, details, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
        (user_id, user_email, user_role, action, resource, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId || null,
        userEmail || null,
        userRole || null,
        action,
        resource || null,
        resourceId || null,
        details || null,
        ipAddress || null
      ]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

module.exports = { log, ACTIONS };