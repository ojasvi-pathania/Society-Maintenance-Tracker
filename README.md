# Society Maintenance Tracker

A clean, professional, responsive full-stack web application designed for apartment and residential society maintenance management, built for academic submission.

---

## 📌 Project Overview

**Society Maintenance Tracker** provides a role-based digital management system for residential complexes. It streamlines how apartment residents raise, track, and monitor maintenance issues while empowering society administrators to manage complaints, change ticket status/priority, track overdue SLA breaches, publish pinned society notices, and broadcast email notifications.

---

## ✨ Features

### Resident Features
- **Account Registration & Login**: Resident registration with Name, Email, Phone, Flat/Apartment number, and hashed password.
- **Resident Dashboard**: Real-time metric cards (Total, Open, In Progress, Resolved), recent complaints table, and pinned society announcements widget.
- **Raise Complaint**: Category selection (Plumbing, Electrical, Lift, Cleaning, Security, Water Supply, Parking, Common Area, Other), detailed description, and optional photo attachment (JPG/PNG/WEBP max 5MB).
- **Auto ID Generation**: Automatic unique complaint tracking ID generation (`CMP-YYYYMMDD-XXX`).
- **My Complaints**: Resident-isolated list with status badges, priority badges, created/updated dates, and overdue flags.
- **Complaint Details & Timeline**: Dedicated view displaying full description, photo preview, and chronological audit trail showing status transitions, timestamps, actors, and admin remarks.
- **Society Notice Board**: Read-only notice feed with pinned important announcements sorted first.

### Admin Features
- **Admin Dashboard**: Live operational statistics (Total, Open, In Progress, Resolved, Overdue count), Visual Status Bar Chart, Overdue Alert Card, and Complaints by Category breakdown.
- **Manage Complaints**: View all society complaints with filtering by Category, Status, and Search (ID, Flat, Description).
- **Update Priority & Status**: Set Priority (`Low`, `Medium`, `High`) or Status (`Open`, `In Progress`, `Resolved`) with optional Admin Action Notes.
- **Overdue Complaints Management**: Surfacing and highlighting unresolved tickets past configured threshold days.
- **Configurable Overdue Threshold**: Modify overdue threshold (e.g. 3 days) via Admin Settings with instant application-wide effect.
- **Notice Management**: Publish, pin (`IMPORTANT`), and delete society announcements.
- **Automated Email Notifications**: Automatic emails sent to residents on complaint status changes and important notice broadcasts.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla JavaScript, Vanilla CSS Design System with custom CSS variables, responsive sidebar layout, status badges, timeline components, and modals.
- **Backend**: Node.js (v22.5+) & Express.js RESTful API architecture.
- **Database**: SQLite (`node:sqlite` DatabaseSync module) configurable via `DATABASE_PATH` with active foreign key constraints (`PRAGMA foreign_keys = ON;`).
- **Authentication**: JWT tokens stored in HttpOnly cookies / authorization headers and `bcryptjs` password hashing (10 salt rounds).
- **File Uploads**: `multer` middleware with strict file type/size validation, path sanitization, and configurable persistent upload storage via `UPLOAD_DIR`.
- **Email Notifications**: Modular Nodemailer abstraction (`services/emailService.js`) with safe async console logging fallback for development environments.

---

## 🚀 Local Setup Guide

Follow these exact steps to run the application locally:

### 1. Clone & Set Working Directory
```bash
git clone <repository-url>
cd society-maintenance-tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Initialize & Seed Development Database
Create database tables and seed demo accounts and sample data:
```bash
npm run seed
```

### 5. Start Application
```bash
npm start
```
Access the application in your web browser at: **`http://localhost:3000`**

---

## 🔐 Environment Variables (`.env.example`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Web server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `JWT_SECRET` | Secret key used for signing JWT session tokens | `your_jwt_secret_key_here` |
| `DATABASE_PATH` | Optional custom path to SQLite database file | `/data/database.db` |
| `UPLOAD_DIR` | Optional custom path to uploaded photos folder | `/data/uploads` |
| `SMTP_HOST` | Outgoing SMTP mail server hostname | `smtp.example.com` |
| `SMTP_PORT` | Outgoing SMTP port (587 or 465) | `587` |
| `SMTP_USER` | SMTP authentication username | `your_smtp_username` |
| `SMTP_PASS` | SMTP authentication password | `your_smtp_password` |
| `FROM_EMAIL` | Sender email address for notifications | `no-reply@society-maintenance.com` |

---

## 🔑 Demo Accounts (For Academic Demonstration Only)

These pre-seeded accounts are provided for local testing and evaluation:

- **Admin Account**:
  - Email: `admin@society.com`
  - Password: `admin123`
- **Resident Account**:
  - Email: `resident@society.com`
  - Password: `resident123`

---

## 🛢️ Database Schema Summary

The database (`database.db` or `DATABASE_PATH`) consists of 5 relational tables:
- **`users`**: User registration, role (`RESIDENT` / `ADMIN`), flat number, hashed password.
- **`complaints`**: Complaint tickets (`complaint_number`, `resident_id`, `category`, `description`, `photo_url`, `priority`, `status`, `created_at`, `updated_at`).
- **`complaint_history`**: Immutable status audit log (`complaint_id`, `actor_id`, `previous_status`, `new_status`, `note`, `created_at`).
- **`notices`**: Society notices (`title`, `content`, `is_important`, `created_by`, `created_at`).
- **`settings`**: Configuration key-value parameters (`overdue_threshold_days`).

For complete schema details, see [`docs/database_schema.md`](docs/database_schema.md).

---

## 📑 API Documentation Summary

| Method | Endpoint | Role | Purpose |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new resident account |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue JWT |
| `GET` | `/api/auth/me` | Resident/Admin | Get logged-in user profile |
| `POST` | `/api/auth/logout` | Resident/Admin | Clear session cookie |
| `POST` | `/api/complaints` | Resident | Raise new maintenance complaint |
| `GET` | `/api/complaints` | Resident/Admin | List complaints (Resident-isolated) |
| `GET` | `/api/complaints/:id` | Resident/Admin | Single complaint detail & timeline |
| `PUT` | `/api/complaints/:id/status-priority` | Admin | Update status, priority & add notes |
| `GET` | `/api/complaints/stats` | Resident/Admin | Get summary statistics & categories |
| `GET` | `/api/notices` | Resident/Admin | Get notices (Important pinned first) |
| `POST` | `/api/notices` | Admin | Publish notice (Broadcast email if important) |
| `DELETE`| `/api/notices/:id` | Admin | Delete notice |
| `GET` | `/api/settings` | Resident/Admin | Get overdue threshold setting |
| `PUT` | `/api/settings` | Admin | Update overdue threshold setting |

For detailed request/response payload examples, see [`docs/api_documentation.md`](docs/api_documentation.md).

---

## 📂 Project Structure

```
society-maintenance-tracker/
├── package.json               # Dependencies & npm scripts
├── .env                       # Environment configuration (Excluded from git)
├── .env.example               # Template environment configuration
├── .gitignore                 # Excluded directories & secrets
├── README.md                  # Master project overview & documentation
├── server.js                  # Express server entrypoint
├── database.db                # Auto-generated SQLite relational database
├── config/
│   └── database.js            # SQLite database schema & initialization
├── middleware/
│   └── auth.js                # JWT verification & role authorization (Admin/Resident)
├── routes/
│   ├── auth.js                # Auth API endpoints (Register, Login, Me, Logout)
│   ├── complaints.js          # Complaint CRUD, image upload, status/priority updates
│   ├── notices.js             # Notice publishing, pinning, deletion
│   └── settings.js            # Configurable overdue threshold settings
├── services/
│   └── emailService.js        # Email notification triggers & SMTP abstraction
├── scripts/
│   ├── seed.js                # Development database seed script
│   ├── test-phase4.js         # Integration & edge case test suite
│   └── test-phase5.js         # Final system verification suite
├── docs/
│   ├── api_documentation.md   # API endpoint documentation
│   ├── database_schema.md     # Relational database schema reference
│   ├── system_design.md       # System design write-up (< 800 words)
│   └── screenshots/           # Screenshot placeholders for submission
└── public/
    ├── css/
    │   └── style.css          # Design system stylesheet
    ├── js/
    │   ├── app.js             # Global utilities, toast notifications, API helper
    │   ├── auth.js            # Login & Registration handlers
    │   ├── resident.js        # Resident dashboard & complaint handling
    │   └── admin.js           # Admin dashboard, management, and settings
    ├── uploads/               # Photo upload storage directory
    │   └── .gitkeep           # Preserves directory in git
    ├── index.html             # Role-based landing router
    ├── login.html             # Login view
    ├── register.html          # Resident registration view
    ├── resident-dashboard.html # Resident metrics & quick actions
    ├── raise-complaint.html   # Complaint submission form
    ├── my-complaints.html     # Filterable complaint list
    ├── complaint-detail.html  # Dedicated complaint detail & timeline view
    ├── notice-board.html      # Society announcements feed
    ├── admin-dashboard.html   # Admin metrics, charts & overdue alerts
    ├── admin-complaints.html  # All society complaints management
    ├── overdue-complaints.html# Overdue complaints view
    ├── admin-notices.html     # Notice creation & deletion view
    └── admin-settings.html    # Overdue threshold configuration view
```

---

## 🌐 Production Deployment Guide (Render.com)

- **Selected Host**: **Render.com Web Service** (PaaS)
- **Persistent Disk Volume**: Mount path `/data` (ensures `database.db` and uploaded photos persist across server restarts and deployments).

### Step-by-Step Deployment Instructions:
1. **Connect GitHub**: Sign up at [Render.com](https://render.com) and connect your GitHub repository.
2. **Create Web Service**: Select **New Web Service** and select your repository (`main` branch).
3. **Set Build & Start Commands**:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. **Add Persistent Disk**:
   - In Render Web Service settings, click **Disks** → **Add Disk**.
   - **Name**: `society-data`
   - **Mount Path**: `/data`
   - **Size**: `1 GB`
5. **Set Environment Variables**:
   Add the following in Render Environment settings:
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
   - `JWT_SECRET`: `<your-random-production-secret>`
   - `DATABASE_PATH`: `/data/database.db`
   - `UPLOAD_DIR`: `/data/uploads`
   - `SMTP_HOST`: `smtp.example.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: `<your-smtp-user>`
   - `SMTP_PASS`: `<your-smtp-pass>`
   - `FROM_EMAIL`: `no-reply@society-maintenance.com`
6. **Deploy**: Click **Save Changes & Deploy**. Your application will be live at `https://your-app-name.onrender.com`.

---

## 🖼️ Application Screenshots

*(Placeholders for documentation screenshots)*
1. **Login View**: `docs/screenshots/01-login.png`
2. **Resident Dashboard**: `docs/screenshots/02-resident-dashboard.png`
3. **Raise Complaint Form**: `docs/screenshots/03-raise-complaint.png`
4. **My Complaints List**: `docs/screenshots/04-my-complaints.png`
5. **Complaint Details & Timeline**: `docs/screenshots/05-complaint-details.png`
6. **Resident Notice Board**: `docs/screenshots/06-resident-notices.png`
7. **Admin Dashboard Analytics**: `docs/screenshots/07-admin-dashboard.png`
8. **Admin Complaints Management**: `docs/screenshots/08-admin-complaints.png`
9. **Admin Update Modal**: `docs/screenshots/09-admin-update-modal.png`
10. **Overdue Complaints View**: `docs/screenshots/10-overdue-complaints.png`
11. **Admin Notice Management**: `docs/screenshots/11-admin-notices.png`
12. **Admin Settings**: `docs/screenshots/12-admin-settings.png`
