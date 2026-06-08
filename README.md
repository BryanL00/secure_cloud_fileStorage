# CloudFortify — Secure Cloud File Storage with RBAC

A Final Year Project (FYP) that delivers a secure, browser-based file storage system with end-to-end encryption, Role-Based Access Control (RBAC), department-aware file sharing, audit logging, and a recycle bin. Files are encrypted before leaving the server and stored in a private MinIO object store — never in plaintext.

---

## Features

### Security
- **AES-256-CBC file encryption** with a unique key and IV per file
- **RSA key wrapping** — the per-file AES key is encrypted with an RSA public key before storage
- **JWT authentication** via HTTP-only cookies (no tokens in localStorage)
- **bcrypt** password hashing
- **Rate limiting** — 10 login attempts per 10 minutes; 30 uploads per 15 minutes
- **File type allowlist** — MIME type and extension validation on upload
- **100 MB per-file size cap** and **10 GB per-user storage quota**
- **Duplicate prevention** — blocks re-uploading a file or creating a folder with the same name in the same location

### Role-Based Access Control (RBAC)
Five roles with distinct permissions:

| Role | Upload | Share | Folders | Admin Panel | View All Files |
|---|---|---|---|---|---|
| Administrator | — | — | — | Yes | Yes (metadata only) |
| Department Manager | Yes | Yes (cross-dept) | Yes | — | Own dept |
| Project Manager | Yes | Yes (same dept) | Yes (own) | — | Own dept |
| User | Yes | — | Yes | — | Own |
| Guest (Vendor) | — | — | — | — | Shared with them |

### File Management
- Upload single files or entire folder structures (preserving subfolder hierarchy)
- Organize files into nested folders
- Folder deletion cascades — all files and subfolders are soft-deleted recursively
- File count on folder cards includes files in all nested subfolders
- **Recycle Bin** — soft-delete with restore; permanent delete by Administrator only
- **File preview** in-browser for PDF, images, and plain text/JSON
- Download with enforced permission level (`viewer` = download allowed, `metadata` = view info only)

### Sharing
- Share files with `viewer` (download) or `metadata` (info only) permission
- **Department Managers** can share with any user including cross-department and Guests
- **Project Managers** can share within their department only
- **Guest/Vendor** users can receive shares regardless of department
- "Who has access" panel shows owner and all shared users
- Owners can revoke individual share access at any time

### Admin Panel
- Create, deactivate, and permanently delete user accounts
- Assign roles and departments; Guest role has no department
- View storage usage across all users
- Export full audit log as CSV

### Audit Logging
Every significant action is logged: logins, uploads, downloads, shares, deletes, permission changes, and quota violations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Axios |
| Backend | Node.js, Express (CommonJS) |
| Database | PostgreSQL |
| Object Storage | MinIO (S3-compatible) |
| Authentication | JWT (HTTP-only cookies) |
| Encryption | AES-256-CBC + RSA (Node.js `crypto`) |

---

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- **MinIO** — [install via Homebrew on macOS](https://min.io/docs/minio/macos/index.html)

```bash
brew install minio/stable/minio
```

---

## Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/secure_cloud_storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_BUCKET=encrypted-files
JWT_SECRET=your_jwt_secret
RSA_PRIVATE_KEY_PATH=./keys/private.pem
RSA_PUBLIC_KEY_PATH=./keys/public.pem
PORT=3001
FRONTEND_URL=http://localhost:5173
```

---

## Setup

### 1. Database

Create the PostgreSQL database and run the schema:

```bash
psql -U postgres -c "CREATE DATABASE secure_cloud_storage;"
psql -U postgres -d secure_cloud_storage -f backend/schema.sql
```

### 2. RSA Keys

Generate the RSA key pair used for AES key wrapping:

```bash
mkdir -p backend/keys
openssl genrsa -out backend/keys/private.pem 2048
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem
```

### 3. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

---

## Running the Application

The system requires **three processes** running simultaneously:

### 1. MinIO (object storage)

```bash
minio server ~/minio-data --console-address :9001
```

Access the MinIO console at `http://localhost:9001` to create the bucket named `encrypted-files`.

### 2. Backend API

```bash
cd backend
npm run dev        # development (nodemon)
# or
npm start          # production
```

Runs on `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
npm run dev
```

Runs on `http://localhost:5173`

---

## Project Structure

```
secure_cloud_fileStorage/
├── backend/
│   ├── keys/                  # RSA key pair (gitignored)
│   ├── src/
│   │   ├── controllers/
│   │   │   └── file.controller.js   # Upload, download, share, preview, audit
│   │   ├── middleware/
│   │   │   └── auth.js              # JWT verify + role authorize
│   │   ├── routes/
│   │   │   ├── auth.routes.js       # Login, logout, register
│   │   │   ├── file.routes.js       # File CRUD + sharing
│   │   │   ├── folder.routes.js     # Folder CRUD + cascade delete
│   │   │   ├── user.routes.js       # User management (Admin)
│   │   │   └── audit.routes.js      # Audit log + CSV export
│   │   └── utils/
│   │       ├── db.js                # PostgreSQL pool
│   │       ├── minio.js             # MinIO client
│   │       └── encryption.js        # AES-256-CBC + RSA helpers
│   └── index.js
└── frontend/
    └── src/
        ├── pages/
        │   ├── Login.jsx            # Authentication
        │   ├── Dashboard.jsx        # Overview + audit log
        │   ├── MyFiles.jsx          # File & folder management
        │   ├── SharedFiles.jsx      # Files shared with me
        │   ├── Vault.jsx            # Recycle Bin
        │   └── AdminPanel.jsx       # User & storage management
        └── components/
            └── Layout.jsx           # Sidebar navigation
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (rate limited) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/files` | List own files |
| POST | `/api/files/upload` | Upload encrypted file |
| GET | `/api/files/download/:id` | Download + decrypt |
| DELETE | `/api/files/:id` | Soft delete (Recycle Bin) |
| POST | `/api/files/:id/restore` | Restore from Recycle Bin |
| DELETE | `/api/files/:id/permanent` | Permanent delete (Admin) |
| POST | `/api/files/:id/share` | Share file with user |
| GET | `/api/files/:id/shares` | Get share list |
| DELETE | `/api/files/:id/share/:userId` | Revoke share |
| GET | `/api/files/shared` | Files shared with me |
| GET | `/api/folders` | List folders |
| POST | `/api/folders` | Create folder |
| DELETE | `/api/folders/:id` | Delete folder (cascades) |
| GET | `/api/users` | List users (Admin) |
| DELETE | `/api/users/:id` | Delete user (Admin) |
| GET | `/api/audit` | Audit log (Admin) |
| GET | `/api/audit/export` | Export audit log as CSV |

---

## License

This project is developed as an academic Final Year Project and is not licensed for commercial use.
