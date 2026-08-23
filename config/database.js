const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

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

initSchema();

module.exports = db;
