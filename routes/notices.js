const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { notifyImportantNotice } = require('../services/emailService');

// Get All Notices (Important pinned first)
router.get('/', verifyToken, (req, res) => {
  try {
    const notices = db.prepare(`
      SELECT n.*, u.name as author_name
      FROM notices n
      JOIN users u ON n.created_by = u.id
      ORDER BY n.is_important DESC, n.created_at DESC
    `).all();

    return res.json({ success: true, count: notices.length, notices });
  } catch (err) {
    console.error('Fetch Notices Error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching notices.' });
  }
});

// Create Notice (Admin Only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { title, content, is_important } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const isImportantValue = (is_important === true || is_important === 1 || is_important === 'true') ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO notices (title, content, is_important, created_by)
      VALUES (?, ?, ?, ?)
    `).run(title.trim(), content.trim(), isImportantValue, req.user.id);

    const newNotice = db.prepare(`
      SELECT n.*, u.name as author_name
      FROM notices n
      JOIN users u ON n.created_by = u.id
      WHERE n.id = ?
    `).get(result.lastInsertRowid);

    // If important, trigger email notification to all residents
    if (isImportantValue === 1) {
      const residents = db.prepare(`SELECT email FROM users WHERE role = 'RESIDENT'`).all();
      const emails = residents.map(r => r.email);
      notifyImportantNotice(emails, title, content);
    }

    return res.status(201).json({
      success: true,
      message: 'Notice published successfully!',
      notice: newNotice
    });
  } catch (err) {
    console.error('Create Notice Error:', err);
    return res.status(500).json({ success: false, message: 'Server error publishing notice.' });
  }
});

// Delete Notice (Admin Only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const noticeId = req.params.id;
    const existing = db.prepare('SELECT id FROM notices WHERE id = ?').get(noticeId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Notice not found.' });
    }

    db.prepare('DELETE FROM notices WHERE id = ?').run(noticeId);
    return res.json({ success: true, message: 'Notice deleted successfully.' });
  } catch (err) {
    console.error('Delete Notice Error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting notice.' });
  }
});

module.exports = router;
