const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');
const { log, ACTIONS } = require('../utils/auditLog');

const DEPARTMENTS = ['IT', 'Finance', 'Marketing', 'HR', 'Operations'];

// Get all users — Admin only
router.get(
  '/',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT u.id, u.email, u.full_name, u.is_active,
                u.department, u.created_at, r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id != $1
         ORDER BY u.created_at DESC`,
        [req.user.id]
      );
      res.json({ users: result.rows });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  }
);

// Update user role — Admin only
router.patch(
  '/:id/role',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const { role_name } = req.body;
      const { id } = req.params;

      const roleResult = await pool.query(
        'SELECT id FROM roles WHERE name = $1', [role_name]
      );
      if (roleResult.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const result = await pool.query(
        `UPDATE users SET role_id = $1 WHERE id = $2
         RETURNING id, email, full_name`,
        [roleResult.rows[0].id, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      await log(
        req.user.id, req.user.email, req.user.role,
        ACTIONS.USER_ROLE_UPDATE, 'users', id,
        `Updated user ${result.rows[0].email} role to ${role_name}`,
        req.ip
      );

      res.json({ message: 'Role updated successfully', user: result.rows[0] });

    } catch (error) {
      res.status(500).json({ message: 'Failed to update role' });
    }
  }
);

// Update user department — Admin only
router.patch(
  '/:id/department',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const { department } = req.body;
      const { id } = req.params;

      if (!DEPARTMENTS.includes(department)) {
        return res.status(400).json({ message: 'Invalid department' });
      }

      const existing = await pool.query('SELECT department FROM users WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      const previousDepartment = existing.rows[0].department;

      const result = await pool.query(
        `UPDATE users SET department = $1 WHERE id = $2
         RETURNING id, email, full_name, department`,
        [department, id]
      );

      await log(
        req.user.id, req.user.email, req.user.role,
        ACTIONS.USER_DEPARTMENT_UPDATE, 'users', id,
        `Changed department of ${result.rows[0].email} from ${previousDepartment || 'none'} to ${department}`,
        req.ip
      );

      res.json({ message: 'Department updated', user: result.rows[0] });

    } catch (error) {
      res.status(500).json({ message: 'Failed to update department' });
    }
  }
);

// Delete user — Admin only
router.delete(
  '/:id',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (id === String(req.user.id)) {
        return res.status(400).json({ message: 'You cannot delete your own account' });
      }

      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      await pool.query('DELETE FROM users WHERE id = $1', [id]);

      await log(
        req.user.id, req.user.email, req.user.role,
        ACTIONS.USER_DEACTIVATE, 'users', id,
        `Permanently deleted user: ${userResult.rows[0].email}`,
        req.ip
      );

      res.json({ message: 'User deleted successfully' });

    } catch (error) {
      res.status(500).json({ message: 'Failed to delete user' });
    }
  }
);

// Deactivate user — Admin only
router.patch(
  '/:id/deactivate',
  authenticate,
  authorize('Administrator'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (id === String(req.user.id)) {
        return res.status(400).json({ message: 'You cannot deactivate your own account' });
      }

      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [id]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      await pool.query(
        'UPDATE users SET is_active = FALSE WHERE id = $1', [id]
      );

      await log(
        req.user.id, req.user.email, req.user.role,
        ACTIONS.USER_DEACTIVATE, 'users', id,
        `Deactivated user: ${userResult.rows[0].email}`,
        req.ip
      );

      res.json({ message: 'User deactivated successfully' });

    } catch (error) {
      res.status(500).json({ message: 'Failed to deactivate user' });
    }
  }
);

module.exports = router;