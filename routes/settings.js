const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Get All Settings
router.get('/', verifyToken, (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    return res.json({ success: true, settings });
  } catch (err) {
    console.error('Fetch Settings Error:', err);
    return res.status(500).json({ success: false, message: 'Error fetching settings.' });
  }
});

// Update Settings (Admin Only)
router.put('/', requireAdmin, (req, res) => {
  try {
    const { overdue_threshold_days } = req.body;

    if (overdue_threshold_days !== undefined) {
      const days = parseInt(overdue_threshold_days, 10);
      if (isNaN(days) || days < 1) {
        return res.status(400).json({ success: false, message: 'Overdue threshold must be a positive integer.' });
      }

      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('overdue_threshold_days', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `).run(String(days));
    }

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    return res.json({ success: true, message: 'Settings updated successfully.', settings });
  } catch (err) {
    console.error('Update Settings Error:', err);
    return res.status(500).json({ success: false, message: 'Error updating settings.' });
  }
});

module.exports = router;
