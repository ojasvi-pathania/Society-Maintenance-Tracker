# System Design Write-Up - Society Maintenance Tracker

This write-up presents the core architectural decisions behind the **Society Maintenance Tracker** web application, focusing on audit trail integrity, dynamic SLA metrics, media security, and event-driven notification dispatch.

---

## 1. Complaint History Audit Model

The application enforces a dual-tier storage strategy for maintenance request tracking: state mutability is separated from audit history logging.

While the primary `complaints` table maintains the active ticket state (`priority`, `status`, `updated_at`), every status transition creates an immutable record in the `complaint_history` table containing:
- `complaint_id`: Foreign key reference to the parent complaint.
- `actor_id`: Foreign key reference to the user (Resident or Admin) performing the state change.
- `previous_status`: The preceding state (`N/A` for ticket registration, `Open`, `In Progress`).
- `new_status`: The resulting state (`Open`, `In Progress`, `Resolved`).
- `note`: Optional administrative remarks or action notes.
- `created_at`: Server timestamp recording the exact transition moment.

**Design Justification**: Storing audit records in a dedicated table guarantees historical accountability. If an Admin updates priority alone without changing status, the system updates `complaints.priority` directly without fabricating a fake status transition. When status changes, both the complaint table and history table are updated atomically.

---

## 2. Dynamic Overdue Detection (SLA Calculation)

Overdue detection is computed dynamically rather than stored as a static column value in the database.

A complaint is identified as **Overdue** if and only if:
1. Its current status is **NOT** `Resolved` (`status != 'Resolved'`), AND
2. The time elapsed since creation (`created_at`) exceeds the configurable `overdue_threshold_days` stored in the `settings` table (defaulting to 3 days).

**Design Justification**:
- **Eliminates Stale Data**: Storing "Overdue" as a static status in a database column introduces state synchronization bugs (e.g., a ticket becoming overdue at midnight without a database write).
- **Excludes Resolved Tickets**: Once a ticket reaches `Resolved`, it represents a completed task; excluding resolved tickets ensures closed issues never pollute overdue SLA metrics.
- **Instant Configuration Propagation**: When an Admin updates the overdue threshold setting in `/admin-settings.html`, all query calculations immediately reflect the new threshold across the Admin Dashboard and Overdue Complaints view without requiring database migrations.

---

## 3. Photo Handling & Persistent Storage Security

The application supports optional photo attachments during complaint submission to help maintenance staff diagnose issues visually.

**Security & Storage Protocol**:
- **Multipart Processing**: File ingestion is managed via `multer` middleware with strict memory limits.
- **Format Validation**: Uploads are restricted to common image extensions (`.jpg`, `.jpeg`, `.png`, `.webp`) validated through MIME-type checking (`image/jpeg`, `image/png`, `image/webp`). Executable file types (`.exe`, `.js`, `.sh`, `.php`) are rejected immediately with user-friendly 400 Bad Request responses.
- **File-Size Restriction**: A maximum file size of 5MB is enforced.
- **Sanitized Filename Generation**: Files are saved to local or persistent storage paths (`UPLOAD_DIR` env var, defaulting to `public/uploads/`) using sanitized, non-predictable filenames (`complaint-TIMESTAMP-RANDOM.ext`) to prevent file-path traversal attacks. The database stores only the relative URL string (`photo_url`).

---

## 4. Asynchronous Notification Flow & Resilience

The notification system uses an asynchronous event-driven pattern decoupled from the primary database transaction:

```
[ Admin Action ]
       │
       ▼
 [ DB Update ] ──> [ Create History Record ]
       │
       ▼
 [ Trigger Async Notification ]
       │
       ├──> Complaint Status Update ──> Send Email to Resident
       └──> Important Notice Broadcast ──> Send Email to All Residents
```

**Resilience & Non-Blocking Design**:
- **Decoupled Delivery**: When an Admin updates a ticket status or publishes an important notice, database operations complete immediately. Email dispatch is executed asynchronously via `services/emailService.js`.
- **Fail-Safe Fallback**: Email execution is wrapped in safe `try/catch` handlers. If SMTP credentials are missing, invalid, or the SMTP host is unreachable, the email service logs a structured development preview to the console without throwing an unhandled exception or rolling back database updates.
- **Privacy Enforcement**: Notifications contain only relevant operational context (Resident Name, Complaint Number, Category, Status transition, Admin Note, or Notice Content). Sensitive credentials (passwords, tokens) are strictly omitted.
