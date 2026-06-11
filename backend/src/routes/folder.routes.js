const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { authenticate, authorize } = require('../middleware/auth');
const { log, ACTIONS } = require('../utils/auditLog');


// Create folder
router.post(
  '/',
  authenticate,
  authorize('Administrator', 'Department Manager', 'Project Manager', 'User'),
  async (req, res) => {
    try {
      const { name, parent_id } = req.body;
      if (!name) return res.status(400).json({ message: 'Folder name required' });

      const duplicate = await pool.query(
        `SELECT id FROM folders
         WHERE owner_id = $1
           AND name = $2
           AND (parent_id = $3 OR (parent_id IS NULL AND $3::uuid IS NULL))`,
        [req.user.id, name, parent_id || null]
      );
      if (duplicate.rows.length > 0) {
        return res.status(409).json({
          message: `A folder named "${name}" already exists in this location.`,
        });
      }

      const result = await pool.query(
        `INSERT INTO folders (owner_id, name, parent_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, parent_id, created_at`,
        [req.user.id, name, parent_id || null]
      );

      await log(
        req.user.id, req.user.email, req.user.role,
        ACTIONS.FOLDER_CREATE, 'folders', result.rows[0].id,
        `Created folder: ${name}${parent_id ? ` (parent: ${parent_id})` : ' (root)'}`,
        req.ip
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
      if (req.user.role === 'Administrator') {
        // Administrators oversee every folder in the system
        result = await pool.query(
          `SELECT f.*, u.email as owner_email
           FROM folders f
           JOIN users u ON f.owner_id = u.id
           ORDER BY f.created_at DESC`
        );
      } else if (req.user.role === 'Department Manager') {
        // Managers see their own folders and those owned by users in their department
        result = await pool.query(
          `SELECT f.*, u.email as owner_email
           FROM folders f
           JOIN users u ON f.owner_id = u.id
           WHERE f.owner_id = $1
              OR (u.department = $2 AND $2 IS NOT NULL)
           ORDER BY f.created_at DESC`,
          [req.user.id, req.user.department]
        );
      } else {
        result = await pool.query(
          `SELECT f.*, u.email as owner_email
           FROM folders f
           JOIN users u ON f.owner_id = u.id
           JOIN roles r ON u.role_id = r.id
           WHERE f.owner_id = $1
              OR (
                u.department = $2
                AND $2 IS NOT NULL
                AND r.name IN ('Department Manager', 'Project Manager')
              )
           ORDER BY f.created_at DESC`,
          [req.user.id, req.user.department]
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
      const folder = await pool.query(
        `SELECT f.*, u.department AS owner_department
         FROM folders f JOIN users u ON f.owner_id = u.id
         WHERE f.id = $1`,
        [id]
      );
      if (folder.rows.length === 0) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      const { owner_id, owner_department, name: folderName } = folder.rows[0];
      const isOwner = owner_id === req.user.id;
      const isAdmin = req.user.role === 'Administrator';
      const isDeptManager =
        req.user.role === 'Department Manager' &&
        req.user.department &&
        owner_department === req.user.department;
      if (!isOwner && !isAdmin && !isDeptManager) {
        await log(
          req.user.id, req.user.email, req.user.role,
          ACTIONS.ACCESS_DENIED, 'folders', id,
          `Denied folder delete: "${folderName}" owned by another department/user`,
          req.ip
        );
        return res.status(403).json({ message: 'Access denied' });
      }
      const filesResult = await pool.query(
        `WITH RECURSIVE subtree AS (
           SELECT id FROM folders WHERE id = $1
           UNION ALL
           SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id
         )
         UPDATE files SET is_deleted = TRUE
         WHERE folder_id IN (SELECT id FROM subtree) AND is_deleted = FALSE`,
        [id]
      );
      const foldersResult = await pool.query(
        `WITH RECURSIVE subtree AS (
           SELECT id FROM folders WHERE id = $1
           UNION ALL
           SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id
         )
         DELETE FROM folders WHERE id IN (SELECT id FROM subtree)`,
        [id]
      );

      await log(
        req.user.id, req.user.email, req.user.role,
        ACTIONS.FOLDER_DELETE, 'folders', id,
        `Deleted folder: ${folderName} | ${foldersResult.rowCount} folder(s), ${filesResult.rowCount} file(s) removed`,
        req.ip
      );

      res.json({ message: 'Folder deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete folder', error: error.message });
    }
  }
);

module.exports = router;