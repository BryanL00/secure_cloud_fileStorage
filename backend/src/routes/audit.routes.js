const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

// Get all audit logs — Admin only
router.get(
  '/',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const { action, limit = 100, offset = 0 } = req.query;

      let query = `
        SELECT id, user_email, user_role, action,
               resource, details, ip_address, created_at
        FROM audit_logs
      `;
      const params = [];

      if (action) {
        query += ` WHERE action = $1`;
        params.push(action);
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      res.json({ logs: result.rows });

    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch logs', error: error.message });
    }
  }
);

module.exports = router;