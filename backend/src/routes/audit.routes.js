const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { log, ACTIONS } = require('../utils/auditLog');
const { authenticate, authorize } = require('../middleware/auth');

function buildWhereClause(action, from, to) {
  const conditions = [];
  const params = [];

  if (action) { params.push(action); conditions.push(`action = $${params.length}`); }
  if (from)   { params.push(from);   conditions.push(`created_at::date >= $${params.length}::date`); }
  if (to)     { params.push(to);     conditions.push(`created_at::date <= $${params.length}::date`); }

  return {
    where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
    params,
  };
}

function escapeCSV(val) {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(rows) {
  const headers = ['ID', 'Timestamp (UTC)', 'User Email', 'User Role', 'Action', 'Resource', 'Resource ID', 'Details', 'IP Address'];
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      escapeCSV(r.id),
      escapeCSV(r.created_at ? new Date(r.created_at).toISOString() : ''),
      escapeCSV(r.user_email),
      escapeCSV(r.user_role),
      escapeCSV(r.action),
      escapeCSV(r.resource),
      escapeCSV(r.resource_id),
      escapeCSV(r.details),
      escapeCSV(r.ip_address),
    ].join(',')),
  ];
  return lines.join('\r\n');
}

// GET /api/audit/security — recent events for admin dashboard
router.get(
  '/security',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const { limit = 100 } = req.query;
      const safeLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
      const result = await pool.query(
        `SELECT id, user_email, user_role, action,
                resource, resource_id, details, ip_address, created_at
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT $1`,
        [safeLimit]
      );
      res.json({ logs: result.rows });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch security logs' });
    }
  }
);

// GET /api/audit/stats — aggregated statistics for admin dashboard
router.get(
  '/stats',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const [actionsResult, dailyResult, topUsersResult] = await Promise.all([
        pool.query(`
          SELECT action, COUNT(*)::int AS count
          FROM audit_logs
          GROUP BY action
          ORDER BY count DESC
        `),
        pool.query(`
          SELECT DATE(created_at)::text AS day, COUNT(*)::int AS count
          FROM audit_logs
          WHERE created_at >= NOW() - INTERVAL '14 days'
          GROUP BY DATE(created_at)
          ORDER BY day ASC
        `),
        pool.query(`
          SELECT user_email, user_role, COUNT(*)::int AS event_count
          FROM audit_logs
          WHERE created_at >= NOW() - INTERVAL '7 days'
            AND user_email IS NOT NULL
          GROUP BY user_email, user_role
          ORDER BY event_count DESC
          LIMIT 5
        `),
      ]);

      res.json({
        action_counts: actionsResult.rows,
        daily_counts: dailyResult.rows,
        top_users: topUsersResult.rows,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch audit stats' });
    }
  }
);

// GET /api/audit — paginated log view with optional filters
router.get(
  '/',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const { action, from, to, limit = 100, offset = 0 } = req.query;
      const { where, params } = buildWhereClause(action, from, to);

      const query = `
        SELECT id, user_email, user_role, action,
               resource, resource_id, details, ip_address, created_at
        FROM audit_logs
        ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await pool.query(query, [...params, limit, offset]);
      res.json({ logs: result.rows });

    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch logs' });
    }
  }
);

// GET /api/audit/export — download full CSV (max 50 000 rows)
router.get(
  '/export',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const { action, from, to } = req.query;
      const { where, params } = buildWhereClause(action, from, to);

      const query = `
        SELECT id, user_email, user_role, action,
               resource, resource_id, details, ip_address, created_at
        FROM audit_logs
        ${where}
        ORDER BY created_at DESC
        LIMIT 50000
      `;

      const result = await pool.query(query, params);
      const csv = buildCSV(result.rows);

      const dateTag = new Date().toISOString().slice(0, 10);
      const filename = `audit-logs-${dateTag}.csv`;

      await log(
        req.user.id, req.user.email, req.user.role,
        ACTIONS.ACCESS_EVAL, 'audit_logs', null,
        `Exported ${result.rows.length} audit log rows to CSV — filters: action=${action || 'all'}, from=${from || 'any'}, to=${to || 'any'}`,
        req.ip
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv); // UTF-8 BOM so Excel opens it correctly
    } catch (error) {
      res.status(500).json({ message: 'Export failed' });
    }
  }
);

module.exports = router;