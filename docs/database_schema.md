# Database Schema Documentation - Society Maintenance Tracker

This document details the relational database architecture designed for the Society Maintenance Tracker application.

---

## Database Engine
- **Engine**: SQLite 3 (`node:sqlite` DatabaseSync module)
- **File**: `database.db`
- **Integrity**: Foreign Key Constraints Enabled (`PRAGMA foreign_keys = ON;`)

---

## Relational Entity-Relationship Diagram (ERD Summary)

```
 [users] 1 -------- N [complaints] 1 -------- N [complaint_history]
    1                     1
    |                     |
    N                     N
 [notices]             [users] (as actor)
```

---

## 1. Table Definitions

### 1.1 `users` Table
Stores authentication data, profile details, and role access for Residents and Admins.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique user identifier |
| `name` | TEXT | NOT NULL | Full name of user |
| `email` | TEXT | UNIQUE NOT NULL | Account email (used for login & notifications) |
| `phone` | TEXT | NOT NULL | 10-digit contact phone number |
| `flat_number` | TEXT | NOT NULL | Apartment/Flat number (e.g. `B-104`) |
| `password_hash`| TEXT | NOT NULL | Bcrypt hashed password (10 salt rounds) |
| `role` | TEXT | CHECK(`RESIDENT`, `ADMIN`) | Access role |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Account registration timestamp |

---

### 1.2 `complaints` Table
Stores maintenance ticket requests submitted by residents.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Internal complaint identifier |
| `complaint_number` | TEXT | UNIQUE NOT NULL | Public tracking ID (`CMP-YYYYMMDD-XXX`) |
| `resident_id` | INTEGER | FOREIGN KEY (`users.id`) | Links complaint to resident owner |
| `category` | TEXT | NOT NULL | Category (Plumbing, Electrical, Lift, etc.) |
| `description` | TEXT | NOT NULL | Detailed problem description |
| `photo_url` | TEXT | NULLABLE | Relative web path to uploaded image |
| `priority` | TEXT | CHECK(`Low`, `Medium`, `High`) | Ticket urgency (Default: `Low`) |
| `status` | TEXT | CHECK(`Open`, `In Progress`, `Resolved`) | Ticket state (Default: `Open`) |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last modified timestamp |

---

### 1.3 `complaint_history` Table
Stores an immutable audit trail of every status transition and remark.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | History entry identifier |
| `complaint_id` | INTEGER | FOREIGN KEY (`complaints.id`) | Associated complaint ticket |
| `actor_id` | INTEGER | FOREIGN KEY (`users.id`) | User who triggered the state change |
| `previous_status`| TEXT | NOT NULL | Status before update (`N/A` for initial) |
| `new_status` | TEXT | NOT NULL | Status after update (`Open`, `In Progress`, `Resolved`) |
| `note` | TEXT | NULLABLE | Action remark or admin notes |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Event timestamp |

---

### 1.4 `notices` Table
Stores society announcements and notices published by Admin users.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Notice identifier |
| `title` | TEXT | NOT NULL | Announcement title |
| `content` | TEXT | NOT NULL | Body content |
| `is_important` | INTEGER | CHECK(0, 1) | Pinned flag (1 = Important, 0 = Normal) |
| `created_by` | INTEGER | FOREIGN KEY (`users.id`) | Admin user who created notice |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Publication timestamp |

---

### 1.5 `settings` Table
Stores system-wide key-value configuration parameters.

| Column | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Setting identifier |
| `key` | TEXT | UNIQUE NOT NULL | Parameter key (e.g. `overdue_threshold_days`) |
| `value` | TEXT | NOT NULL | Configured value string (e.g. `'3'`) |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last updated timestamp |

---

## 2. Key Architectural Rationale

1. **Decoupled History Audit Log**:
   Status transitions are stored in `complaint_history` rather than overwriting single columns in `complaints`. This provides complete historical visibility for academic submission requirements.
2. **Dynamic Overdue Calculation**:
   `Overdue` is calculated on demand using `(status != 'Resolved') AND (created_at < threshold)`. It is deliberately excluded from stored column statuses to prevent stale state synchronization bugs.
3. **Foreign Key Integrity**:
   Foreign key constraints with `ON DELETE CASCADE` ensure orphaned records are prevented when parent records are deleted.
