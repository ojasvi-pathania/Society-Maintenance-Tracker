require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const complaintsRoutes = require('./routes/complaints');
const noticesRoutes = require('./routes/notices');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurable upload directory for production persistence
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve uploads directory statically at /uploads (supports custom UPLOAD_DIR)
app.use('/uploads', express.static(uploadsDir));

// Serve public directory statically
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/settings', settingsRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected error occurred on the server.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Society Maintenance Tracker Server running on port ${PORT}`);
  console.log(`  Active Resolved Database Path: ${db.resolvedPath}`);
  console.log(`  Active Upload Directory: ${uploadsDir}`);
  console.log(`  Access Application: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
