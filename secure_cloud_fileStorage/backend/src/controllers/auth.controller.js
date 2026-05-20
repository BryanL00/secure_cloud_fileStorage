const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../utils/db');
const { log, ACTIONS } = require('../utils/auditLog');

const DEPARTMENTS = ['IT', 'Finance', 'Marketing', 'HR', 'Operations'];

const register = async (req, res) => {
  try {
    const { email, password, full_name, role_name, department } = req.body;

    if (department && !DEPARTMENTS.includes(department)) {
      return res.status(400).json({ message: 'Invalid department' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const roleName = role_name || 'User';
    const roleResult = await pool.query(
      'SELECT id FROM roles WHERE name = $1', [roleName]
    );
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, department`,
      [email, hashedPassword, full_name, roleResult.rows[0].id, department || null]
    );

    await log(
      result.rows[0].id, email, roleName,
      ACTIONS.REGISTER, 'users', result.rows[0].id,
      `New user registered with role ${roleName}`,
      req.ip
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.password_hash,
              u.is_active, u.department, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await log(
      user.id, user.email, user.role,
      ACTIONS.LOGIN, 'auth', user.id,
      'User logged in successfully',
      req.ip
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.department,
              r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get user', error: error.message });
  }
};

module.exports = { register, login, getMe };