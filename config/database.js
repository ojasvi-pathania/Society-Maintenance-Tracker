const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Configurable database path for production persistence (e.g. /data/database.db)
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.db');

// Ensure parent directory exists for persistent storage paths
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      flat_number TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('RESIDENT', 'ADMIN')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_number TEXT UNIQUE NOT NULL,
      resident_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      photo_url TEXT,
      priority TEXT DEFAULT 'Low' CHECK(priority IN ('Low', 'Medium', 'High')),
      status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Resolved')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS complaint_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      actor_id INTEGER NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_important INTEGER DEFAULT 0 CHECK(is_important IN (0, 1)),
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default overdue threshold if not exists
  const existingThreshold = db.prepare(`SELECT * FROM settings WHERE key = 'overdue_threshold_days'`).get();
  if (!existingThreshold) {
    db.prepare(`INSERT INTO settings (key, value) VALUES ('overdue_threshold_days', '3')`).run();
  }
}

async function autoSeedDefaultAccounts() {
  try {
    const adminEmail = 'admin@society.com';
    const residentEmail = 'resident@society.com';

    const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    const existingResident = db.prepare('SELECT id FROM users WHERE email = ?').get(residentEmail);

    let adminId = existingAdmin ? existingAdmin.id : null;
    let residentId = existingResident ? existingResident.id : null;

    if (!existingAdmin) {
      const adminHash = await bcrypt.hash('admin123', 10);
      const res = db.prepare(`
        INSERT INTO users (name, email, phone, flat_number, password_hash, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('Society Admin', adminEmail, '9876543210', 'A-000', adminHash, 'ADMIN');
      adminId = res.lastInsertRowid;
      console.log('⚡ Auto-seeded default Admin account: admin@society.com / admin123');
    }

    if (!existingResident) {
      const residentHash = await bcrypt.hash('resident123', 10);
      const res = db.prepare(`
        INSERT INTO users (name, email, phone, flat_number, password_hash, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('John Resident', residentEmail, '9876543211', 'B-104', residentHash, 'RESIDENT');
      residentId = res.lastInsertRowid;
      console.log('⚡ Auto-seeded default Resident account: resident@society.com / resident123');
    }

    // Seed notices if empty
    const countNotices = db.prepare('SELECT COUNT(*) as count FROM notices').get().count;
    if (countNotices === 0 && adminId) {
      db.prepare(`
        INSERT INTO notices (title, content, is_important, created_by)
        VALUES (?, ?, ?, ?)
      `).run('Annual General Meeting Notice', 'The Annual General Meeting (AGM) will be held on Sunday at 10:00 AM in the Main Clubhouse. All residents are requested to attend.', 1, adminId);

      db.prepare(`
        INSERT INTO notices (title, content, is_important, created_by)
        VALUES (?, ?, ?, ?)
      `).run('Water Tank Cleaning Scheduled', 'Overhead water tanks will be cleaned tomorrow from 9:00 AM to 2:00 PM. Water supply will be temporarily paused.', 0, adminId);
    }

    // Seed initial complaints if empty
    const countComplaints = db.prepare('SELECT COUNT(*) as count FROM complaints').get().count;
    if (countComplaints === 0 && residentId) {
      const cmp1 = db.prepare(`
        INSERT INTO complaints (complaint_number, resident_id, category, description, priority, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('CMP-20260824-101', residentId, 'Plumbing', 'Water leak from the ceiling in the master bathroom. Requires urgent plumber attention.', 'High', 'Open');

      db.prepare(`
        INSERT INTO complaint_history (complaint_id, actor_id, previous_status, new_status, note)
        VALUES (?, ?, ?, ?, ?)
      `).run(cmp1.lastInsertRowid, residentId, 'N/A', 'Open', 'Complaint created by resident.');

      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const cmp2 = db.prepare(`
        INSERT INTO complaints (complaint_number, resident_id, category, description, priority, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('CMP-20260819-098', residentId, 'Electrical', 'Corridor light flickering outside Flat B-104.', 'Medium', 'Open', pastDate, pastDate);

      db.prepare(`
        INSERT INTO complaint_history (complaint_id, actor_id, previous_status, new_status, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(cmp2.lastInsertRowid, residentId, 'N/A', 'Open', 'Complaint registered.', pastDate);
    }
  } catch (err) {
    console.error('Auto-seed error:', err);
  }
}

initSchema();
autoSeedDefaultAccounts();

db.resolvedPath = path.resolve(dbPath);

module.exports = db;
