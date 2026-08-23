const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/database');
const { verifyToken, requireAdmin, requireResident } = require('../middleware/auth');
const { notifyComplaintStatusChange } = require('../services/emailService');

// Configurable upload directory for production persistence (e.g. /data/uploads)
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File upload configuration with security checks
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'complaint-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (allowedExts.includes(ext) && allowedMimes.includes(mime)) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type! Only JPG, JPEG, PNG, and WEBP images under 5MB are permitted.'));
    }
  }
});

// Helper: Get overdue threshold in days
function getOverdueThresholdDays() {
  const setting = db.prepare(`SELECT value FROM settings WHERE key = 'overdue_threshold_days'`).get();
  return setting ? parseInt(setting.value, 10) : 3;
}

// Helper: Calculate if complaint is overdue (Resolved complaints are NEVER overdue)
function isOverdue(created_at, status, thresholdDays) {
  if (status === 'Resolved') return false;
  const createdDate = new Date(created_at);
  const now = new Date();
  const diffTime = Math.abs(now - createdDate);
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays > thresholdDays;
}

// Helper: Generate unique Complaint ID (CMP-YYYYMMDD-XXX)
function generateComplaintNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countRow = db.prepare('SELECT COUNT(*) as count FROM complaints').get();
  const nextNum = (countRow ? countRow.count : 0) + 1;
  const paddedNum = String(nextNum).padStart(3, '0');
  return `CMP-${dateStr}-${paddedNum}`;
}

// 1. Create New Complaint (Resident Only)
router.post('/', requireResident, upload.single('photo'), (req, res) => {
  try {
    const { category, description } = req.body;
    
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required.' });
    }

    const allowedCategories = ['Plumbing', 'Electrical', 'Lift', 'Cleaning', 'Security', 'Water Supply', 'Parking', 'Common Area', 'Other'];
    if (!allowedCategories.includes(category.trim())) {
      return res.status(400).json({ success: false, message: 'Invalid category specified.' });
    }

    const complaintNumber = generateComplaintNumber();
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const residentId = req.user.id;

    const stmt = db.prepare(`
      INSERT INTO complaints (complaint_number, resident_id, category, description, photo_url, priority, status)
      VALUES (?, ?, ?, ?, ?, 'Low', 'Open')
    `);

    const result = stmt.run(complaintNumber, residentId, category.trim(), description.trim(), photoUrl);
    const complaintId = result.lastInsertRowid;

    // Log initial history entry (previous_status = 'N/A', new_status = 'Open')
    db.prepare(`
      INSERT INTO complaint_history (complaint_id, actor_id, previous_status, new_status, note)
      VALUES (?, ?, 'N/A', 'Open', 'Complaint created.')
    `).run(complaintId, residentId);

    const createdComplaint = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);

    return res.status(201).json({
      success: true,
      message: 'Complaint created successfully!',
      complaint: createdComplaint,
      redirect_url: `/complaint-detail.html?id=${complaintId}`
    });
  } catch (err) {
    console.error('Create Complaint Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Error creating complaint.' });
  }
});

// Express multer error handler wrapper
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.includes('Invalid file type')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
});

// 2. Get Complaints List (Resident isolation vs Admin access)
router.get('/', verifyToken, (req, res) => {
  try {
    const { category, status, search, overdue } = req.query;
    const thresholdDays = getOverdueThresholdDays();

    let sql = `
      SELECT c.*, u.name as resident_name, u.flat_number, u.email as resident_email, u.phone as resident_phone
      FROM complaints c
      JOIN users u ON c.resident_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // STRICT AUTHORIZATION: Resident sees ONLY their own complaints
    if (req.user.role === 'RESIDENT') {
      sql += ` AND c.resident_id = ?`;
      params.push(req.user.id);
    }

    if (category) {
      sql += ` AND c.category = ?`;
      params.push(category);
    }

    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }

    if (search) {
      sql += ` AND (c.complaint_number LIKE ? OR c.description LIKE ? OR u.flat_number LIKE ? OR u.name LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    sql += ` ORDER BY c.created_at DESC`;

    const complaints = db.prepare(sql).all(...params);

    const formattedComplaints = complaints.map(cmp => {
      return {
        ...cmp,
        is_overdue: isOverdue(cmp.created_at, cmp.status, thresholdDays)
      };
    });

    if (overdue === 'true') {
      const overdueList = formattedComplaints.filter(c => c.is_overdue);
      return res.json({ success: true, count: overdueList.length, thresholdDays, complaints: overdueList });
    }

    return res.json({ success: true, count: formattedComplaints.length, thresholdDays, complaints: formattedComplaints });
  } catch (err) {
    console.error('Fetch Complaints Error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching complaints.' });
  }
});

// 3. Stats Summary
router.get('/stats', verifyToken, (req, res) => {
  try {
    const thresholdDays = getOverdueThresholdDays();
    let whereClause = '';
    const params = [];

    if (req.user.role === 'RESIDENT') {
      whereClause = 'WHERE resident_id = ?';
      params.push(req.user.id);
    }

    const allComplaints = db.prepare(`SELECT created_at, status, category FROM complaints ${whereClause}`).all(...params);

    let total = allComplaints.length;
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let overdueCount = 0;
    const byCategory = {};

    allComplaints.forEach(cmp => {
      if (cmp.status === 'Open') openCount++;
      if (cmp.status === 'In Progress') inProgressCount++;
      if (cmp.status === 'Resolved') resolvedCount++;

      if (isOverdue(cmp.created_at, cmp.status, thresholdDays)) {
        overdueCount++;
      }

      byCategory[cmp.category] = (byCategory[cmp.category] || 0) + 1;
    });

    return res.json({
      success: true,
      stats: {
        total,
        open: openCount,
        in_progress: inProgressCount,
        resolved: resolvedCount,
        overdue: overdueCount,
        overdue_threshold_days: thresholdDays,
        by_category: byCategory
      }
    });
  } catch (err) {
    console.error('Stats Error:', err);
    return res.status(500).json({ success: false, message: 'Error calculating stats.' });
  }
});

// 4. Single Complaint Detail + History Timeline
router.get('/:id', verifyToken, (req, res) => {
  try {
    const complaintId = req.params.id;

    const complaint = db.prepare(`
      SELECT c.*, u.name as resident_name, u.email as resident_email, u.phone as resident_phone, u.flat_number
      FROM complaints c
      JOIN users u ON c.resident_id = u.id
      WHERE c.id = ?
    `).get(complaintId);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    // STRICT AUTHORIZATION CHECK: Resident can ONLY view their own complaint details!
    if (req.user.role === 'RESIDENT' && complaint.resident_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to view another resident\'s complaint.' });
    }

    const history = db.prepare(`
      SELECT h.*, u.name as actor_name, u.role as actor_role
      FROM complaint_history h
      JOIN users u ON h.actor_id = u.id
      WHERE h.complaint_id = ?
      ORDER BY h.created_at ASC
    `).all(complaintId);

    const thresholdDays = getOverdueThresholdDays();
    complaint.is_overdue = isOverdue(complaint.created_at, complaint.status, thresholdDays);

    return res.json({
      success: true,
      complaint,
      history
    });
  } catch (err) {
    console.error('Fetch Complaint Detail Error:', err);
    return res.status(500).json({ success: false, message: 'Error loading complaint detail.' });
  }
});

// 5. Update Status / Priority (Admin Only)
router.put('/:id/status-priority', requireAdmin, async (req, res) => {
  try {
    const complaintId = req.params.id;
    const { status, priority, note } = req.body;

    const validStatuses = ['Open', 'In Progress', 'Resolved'];
    const validPriorities = ['Low', 'Medium', 'High'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority value.' });
    }

    const existing = db.prepare(`
      SELECT c.*, u.email as resident_email, u.name as resident_name
      FROM complaints c
      JOIN users u ON c.resident_id = u.id
      WHERE c.id = ?
    `).get(complaintId);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const previousStatus = existing.status;
    const newStatus = status || existing.status;
    const newPriority = priority || existing.priority;

    db.prepare(`
      UPDATE complaints
      SET status = ?, priority = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, newPriority, complaintId);

    // If status changed, create history record & send email
    if (status && status !== previousStatus) {
      db.prepare(`
        INSERT INTO complaint_history (complaint_id, actor_id, previous_status, new_status, note)
        VALUES (?, ?, ?, ?, ?)
      `).run(complaintId, req.user.id, previousStatus, newStatus, note ? note.trim() : null);

      // Asynchronous email notification
      notifyComplaintStatusChange({
        residentEmail: existing.resident_email,
        residentName: existing.resident_name,
        complaintNumber: existing.complaint_number,
        category: existing.category,
        oldStatus: previousStatus,
        newStatus: newStatus,
        note: note
      });
    }

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);

    return res.json({
      success: true,
      message: 'Complaint updated successfully.',
      status_changed: status && status !== previousStatus,
      complaint: updated
    });
  } catch (err) {
    console.error('Update Complaint Error:', err);
    return res.status(500).json({ success: false, message: 'Error updating complaint.' });
  }
});

module.exports = router;
