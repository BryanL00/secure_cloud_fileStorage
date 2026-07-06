const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../utils/db');
const { log, ACTIONS } = require('../utils/auditLog');

const DEPARTMENTS = ['IT', 'Finance', 'Marketing', 'HR', 'Operations'];

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. !@#$%^&*)';
  }
  return null;
}

    const COOKIE_OPTIONS = {
      httpOnly: true,
      secure: true, // served over HTTPS in all environments (mkcert in dev)
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours — matches JWT expiry
    };

const register = async (req, res) => {
  try {
    const { email, password, full_name, role_name, department, managed_project } = req.body;

    const pwError = validatePassword(password);
    if (pwError) {
      return res.status(400).json({ message: pwError });
    }

    if (department && !DEPARTMENTS.includes(department)) {
      return res.status(400).json({ message: 'Invalid department' });
    }

    // The managed project only carries meaning for a Project Manager; ignore it
    // for every other role so it can't grant accidental cross-project access.
    const managedProject =
      role_name === 'Project Manager' && managed_project
        ? managed_project.trim()
        : null;

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
    // Mathematical one-way hashing with a salt and cost factor of 12
    const hashedPassword = await bcrypt.hash(password, 12);

    // Database insertion of the hashed credential, not the plaintext
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id, department, managed_project)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, department, managed_project`,
      [email, hashedPassword, full_name, roleResult.rows[0].id, department || null, managedProject]
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
    res.status(500).json({ message: 'Registration failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.password_hash,
              u.is_active, u.department, u.managed_project, r.name as role
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

    // Delivering the token via the secure cookie options
    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        managed_project: user.managed_project
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
};

const logout = async (req, res) => {
  try {
    await log(
      req.user.id, req.user.email, req.user.role,
      ACTIONS.LOGOUT, 'auth', req.user.id,
      'User logged out',
      req.ip
    );
  } catch { /* audit failure is non-fatal */ }

  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ message: 'Logged out successfully' });
};

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.is_active, u.department,
              u.managed_project, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get user' });
  }
};

module.exports = { register, login, logout, getMe };