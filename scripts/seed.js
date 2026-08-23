const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function seedData() {
  console.log('Seeding initial development database...');

  const adminEmail = 'admin@society.com';
  const residentEmail = 'resident@society.com';

  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  const existingResident = db.prepare('SELECT id FROM users WHERE email = ?').get(residentEmail);

  let adminId, residentId;

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, phone, flat_number, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Society Admin', adminEmail, '9876543210', 'A-000', passwordHash, 'ADMIN');
    adminId = result.lastInsertRowid;
    console.log('Created Demo Admin Account: admin@society.com / admin123');
  } else {
    adminId = existingAdmin.id;
  }

  if (!existingResident) {
    const passwordHash = await bcrypt.hash('resident123', 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, phone, flat_number, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('John Resident', residentEmail, '9876543211', 'B-104', passwordHash, 'RESIDENT');
    residentId = result.lastInsertRowid;
    console.log('Created Demo Resident Account: resident@society.com / resident123');
  } else {
    residentId = existingResident.id;
  }

  // Seed sample notice if none exist
  const countNotices = db.prepare('SELECT COUNT(*) as count FROM notices').get().count;
  if (countNotices === 0) {
    db.prepare(`
      INSERT INTO notices (title, content, is_important, created_by)
      VALUES (?, ?, ?, ?)
    `).run(
      'Annual General Meeting Notice',
      'The Annual General Meeting (AGM) will be held on Sunday at 10:00 AM in the Main Clubhouse. All residents are requested to attend.',
      1,
      adminId
    );

    db.prepare(`
      INSERT INTO notices (title, content, is_important, created_by)
      VALUES (?, ?, ?, ?)
    `).run(
      'Water Tank Cleaning Scheduled',
      'Overhead water tanks will be cleaned tomorrow from 9:00 AM to 2:00 PM. Water supply will be temporarily paused.',
      0,
      adminId
    );
    console.log('Seeded sample society notices.');
  }

  // Seed sample complaint if none exist
  const countComplaints = db.prepare('SELECT COUNT(*) as count FROM complaints').get().count;
  if (countComplaints === 0) {
    // Normal open complaint
    const cmp1 = db.prepare(`
      INSERT INTO complaints (complaint_number, resident_id, category, description, priority, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'CMP-20260824-101',
      residentId,
      'Plumbing',
      'Water leak from the ceiling in the master bathroom. Requires urgent plumber attention.',
      'High',
      'Open'
    );

    db.prepare(`
      INSERT INTO complaint_history (complaint_id, actor_id, previous_status, new_status, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(cmp1.lastInsertRowid, residentId, 'None', 'Open', 'Complaint created by resident.');

    // Overdue complaint created 5 days ago
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const cmp2 = db.prepare(`
      INSERT INTO complaints (complaint_number, resident_id, category, description, priority, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'CMP-20260819-098',
      residentId,
      'Electrical',
      'Corridor light flickering outside Flat B-104.',
      'Medium',
      'Open',
      pastDate,
      pastDate
    );

    db.prepare(`
      INSERT INTO complaint_history (complaint_id, actor_id, previous_status, new_status, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cmp2.lastInsertRowid, residentId, 'None', 'Open', 'Complaint registered.', pastDate);

    console.log('Seeded sample complaints.');
  }

  console.log('Seeding completed successfully!');
}

seedData().catch(console.error);
