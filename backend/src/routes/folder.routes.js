const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');

const MANAGER_ROLES = ['Administrator', 'Department Manager', 'Project Manager'];

// Create folder
router.post(
  '/',
  authenticate,
  authorize('Administrator', 'Department Manager', 'Project Manager', 'User'),
  async (req, res) => {
    try {
      const { name, parent_id } = req.body;
      if (!name) return res.status(400).json({ message: 'Folder name required' });

      const result = await pool.query(
        `INSERT INTO folders (owner_id, name, parent_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, parent_id, created_at`,
        [req.user.id, name, parent_id || null]
      );

      res.status(201).json({ message: 'Folder created', folder: result.rows[0] });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create folder', error: error.message });
    }
  }
);

// Get all folders for current user
router.get(
  '/',
  authenticate,
  authorize('Administrator', 'Department Manager', 'Project Manager', 'User', 'Guest'),
  async (req, res) => {
    try {
      let result;
      if (MANAGER_ROLES.includes(req.user.role)) {
        result = await pool.query(
          `SELECT f.*, u.email as owner_email
           FROM folders f
           JOIN users u ON f.owner_id = u.id
           ORDER BY f.created_at DESC`
        );
      } else {
        result = await pool.query(
          `SELECT f.*, u.email as owner_email
           FROM folders f
           JOIN users u ON f.owner_id = u.id
           WHERE f.owner_id = $1
           ORDER BY f.created_at DESC`,
          [req.user.id]
        );
      }
      res.json({ folders: result.rows });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch folders', error: error.message });
    }
  }
);

// Delete folder
router.delete(
  '/:id',
  authenticate,
  authorize('Administrator', 'Department Manager', 'Project Manager', 'User'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const folder = await pool.query('SELECT * FROM folders WHERE id = $1', [id]);
      if (folder.rows.length === 0) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      if (folder.rows[0].owner_id !== req.user.id && req.user.role !== 'Administrator') {
        return res.status(403).json({ message: 'Access denied' });
      }
      await pool.query('DELETE FROM folders WHERE id = $1', [id]);
      res.json({ message: 'Folder deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete folder', error: error.message });
    }
  }
);

module.exports = router;