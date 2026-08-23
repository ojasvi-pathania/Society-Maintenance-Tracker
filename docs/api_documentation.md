# API Documentation - Society Maintenance Tracker

This document provides complete technical specifications for all RESTful API endpoints exposed by the Society Maintenance Tracker application.

---

## Base URL
All API requests are prefixed with `/api`.

---

## 1. Authentication Endpoints

### 1.1 Resident Registration
- **Method**: `POST`
- **URL**: `/api/auth/register`
- **Authentication**: None (Public)
- **Role Required**: None
- **Request Body** (`application/json`):
  ```json
  {
    "name": "Sarah Connor",
    "email": "sarah@example.com",
    "phone": "9876543210",
    "flat_number": "C-201",
    "password": "password123",
    "confirm_password": "password123"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Registration successful!",
    "token": "eyJhbGciOi...",
    "user": {
      "id": 2,
      "name": "Sarah Connor",
      "email": "sarah@example.com",
      "phone": "9876543210",
      "flat_number": "C-201",
      "role": "RESIDENT"
    }
  }
  ```
- **Common Errors**:
  - `400 Bad Request`: Passwords do not match / Email already registered / Missing fields.

---

### 1.2 User Login
- **Method**: `POST`
- **URL**: `/api/auth/login`
- **Authentication**: None (Public)
- **Role Required**: None
- **Request Body** (`application/json`):
  ```json
  {
    "email": "resident@society.com",
    "password": "resident123"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Login successful!",
    "token": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "name": "John Resident",
      "email": "resident@society.com",
      "role": "RESIDENT"
    }
  }
  ```
- **Common Errors**:
  - `401 Unauthorized`: Invalid email or password.

---

### 1.3 Get Current User Profile
- **Method**: `GET`
- **URL**: `/api/auth/me`
- **Authentication**: Required (`Bearer <token>` or HttpOnly cookie)
- **Role Required**: `RESIDENT` or `ADMIN`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "name": "John Resident",
      "email": "resident@society.com",
      "phone": "9876543211",
      "flat_number": "B-104",
      "role": "RESIDENT",
      "created_at": "2026-08-24 00:00:00"
    }
  }
  ```

---

### 1.4 Logout
- **Method**: `POST`
- **URL**: `/api/auth/logout`
- **Authentication**: Optional
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```

---

## 2. Complaint Endpoints

### 2.1 Raise Complaint
- **Method**: `POST`
- **URL**: `/api/complaints`
- **Authentication**: Required
- **Role Required**: `RESIDENT`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `category` (string, required): Plumbing, Electrical, Lift, Cleaning, Security, Water Supply, Parking, Common Area, Other.
  - `description` (string, required): Detailed problem statement.
  - `photo` (file, optional): Image attachment (JPG, PNG, WEBP max 5MB).
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Complaint created successfully!",
    "complaint": {
      "id": 5,
      "complaint_number": "CMP-20260824-005",
      "resident_id": 2,
      "category": "Plumbing",
      "description": "Ceiling leakage",
      "photo_url": "/uploads/complaint-1771800000-123.jpg",
      "priority": "Low",
      "status": "Open",
      "created_at": "2026-08-24 00:15:00"
    },
    "redirect_url": "/complaint-detail.html?id=5"
  }
  ```
- **Common Errors**:
  - `400 Bad Request`: Invalid file extension or size exceeding 5MB.
  - `403 Forbidden`: Admin cannot raise complaints.

---

### 2.2 List Complaints
- **Method**: `GET`
- **URL**: `/api/complaints`
- **Query Parameters**: `category`, `status`, `search`, `overdue` (boolean)
- **Authentication**: Required
- **Role Required**: `RESIDENT` or `ADMIN`
- **Behavior**:
  - **Resident**: Returns ONLY complaints belonging to caller (`WHERE resident_id = req.user.id`).
  - **Admin**: Returns all complaints across the society.
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "count": 2,
    "thresholdDays": 3,
    "complaints": [
      {
        "id": 1,
        "complaint_number": "CMP-20260824-101",
        "resident_name": "John Resident",
        "flat_number": "B-104",
        "category": "Plumbing",
        "priority": "High",
        "status": "Open",
        "is_overdue": false,
        "created_at": "2026-08-24 00:00:00"
      }
    ]
  }
  ```

---

### 2.3 Single Complaint Detail & History Timeline
- **Method**: `GET`
- **URL**: `/api/complaints/:id`
- **Authentication**: Required
- **Role Required**: `RESIDENT` or `ADMIN`
- **Authorization Guard**: Residents can ONLY view their own complaint. Viewing another resident's ID returns `403 Forbidden`.
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "complaint": {
      "id": 1,
      "complaint_number": "CMP-20260824-101",
      "resident_name": "John Resident",
      "flat_number": "B-104",
      "category": "Plumbing",
      "description": "Water leak",
      "priority": "High",
      "status": "In Progress",
      "is_overdue": false
    },
    "history": [
      {
        "id": 1,
        "actor_name": "John Resident",
        "actor_role": "RESIDENT",
        "previous_status": "N/A",
        "new_status": "Open",
        "note": "Complaint created.",
        "created_at": "2026-08-24 00:00:00"
      },
      {
        "id": 2,
        "actor_name": "Society Admin",
        "actor_role": "ADMIN",
        "previous_status": "Open",
        "new_status": "In Progress",
        "note": "Plumber assigned.",
        "created_at": "2026-08-24 01:00:00"
      }
    ]
  }
  ```

---

### 2.4 Update Status & Priority
- **Method**: `PUT`
- **URL**: `/api/complaints/:id/status-priority`
- **Authentication**: Required
- **Role Required**: `ADMIN`
- **Request Body** (`application/json`):
  ```json
  {
    "status": "Resolved",
    "priority": "High",
    "note": "Ceiling pipe repaired and sealed."
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Complaint updated successfully.",
    "status_changed": true,
    "complaint": { ... }
  }
  ```
- **Common Errors**:
  - `403 Forbidden`: Non-admin callers.

---

### 2.5 Complaints Dashboard Stats
- **Method**: `GET`
- **URL**: `/api/complaints/stats`
- **Authentication**: Required
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "stats": {
      "total": 10,
      "open": 3,
      "in_progress": 4,
      "resolved": 3,
      "overdue": 1,
      "overdue_threshold_days": 3,
      "by_category": {
        "Plumbing": 4,
        "Electrical": 6
      }
    }
  }
  ```

---

## 3. Notice Endpoints

### 3.1 Get All Notices
- **Method**: `GET`
- **URL**: `/api/notices`
- **Authentication**: Required (`RESIDENT` or `ADMIN`)
- **Ordering**: `is_important DESC, created_at DESC` (Important notices pinned first).

### 3.2 Publish Notice
- **Method**: `POST`
- **URL**: `/api/notices`
- **Authentication**: Required
- **Role Required**: `ADMIN`
- **Request Body**:
  ```json
  {
    "title": "Water Tank Cleaning",
    "content": "Cleaning scheduled for tomorrow.",
    "is_important": true
  }
  ```

### 3.3 Delete Notice
- **Method**: `DELETE`
- **URL**: `/api/notices/:id`
- **Role Required**: `ADMIN`

---

## 4. Settings Endpoints

### 4.1 Get Settings
- **Method**: `GET`
- **URL**: `/api/settings`

### 4.2 Update Settings
- **Method**: `PUT`
- **URL**: `/api/settings`
- **Role Required**: `ADMIN`
- **Request Body**:
  ```json
  {
    "overdue_threshold_days": 3
  }
  ```
