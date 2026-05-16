const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/register', authenticate, authorize('Administrator'), register);
router.post('/login', login);
router.get('/me', authenticate, getMe);

module.exports = router;