const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_academic_submission_2026';

// Resident Registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, flat_number, password, confirm_password } = req.body;

    if (!name || !email || !phone || !flat_number || !password || !confirm_password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // Check existing email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email address is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const stmt = db.prepare(`
      INSERT INTO users (name, email, phone, flat_number, password_hash, role)
      VALUES (?, ?, ?, ?, ?, 'RESIDENT')
    `);

    const result = stmt.run(name.trim(), email.toLowerCase().trim(), phone.trim(), flat_number.trim(), passwordHash);

    const user = {
      id: result.lastInsertRowid,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      flat_number: flat_number.trim(),
      role: 'RESIDENT'
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return res.status(201).json({
      success: true,
      message: 'Registration successful!',
      token,
      user
    });
  } catch (err) {
    console.error('Registration Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Login (Resident & Admin)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      flat_number: user.flat_number,
      role: user.role
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: userPayload
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Current User Profile
router.get('/me', verifyToken, (req, res) => {
  const user = db.prepare('SELECT id, name, email, phone, flat_number, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }
  return res.json({ success: true, user });
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
