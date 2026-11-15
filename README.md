# sifon-service Complaint Management System

**sifon-service** is an enterprise-grade, admin-operated Complaint Management System built with React, Vite, Tailwind CSS, Node.js, Express, and MongoDB. It provides centralized customer complaint logging, manual complaint ID management, brand and category classification, secure file attachment handling with private Cloudinary and local disk drivers, field servicer allocation, resolution auditing, durable WhatsApp Cloud API notifications, and server-side PDF reporting.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Prerequisites](#prerequisites)
4. [Project Structure](#project-structure)
5. [Installation & Setup](#installation--setup)
6. [Environment Configuration](#environment-configuration)
7. [Manual Complaint ID Format](#manual-complaint-id-format)
8. [Brand & Category Management](#brand--category-management)
9. [Cloudinary Storage Integration](#cloudinary-storage-integration)
10. [WhatsApp Cloud API & Webhook Integration](#whatsapp-cloud-api--webhook-integration)
11. [PDF Export Capabilities & Filenames](#pdf-export-capabilities--filenames)
12. [Administrator Initialization (Seeding)](#administrator-initialization-seeding)
13. [Running Locally](#running-locally)
14. [Running Automated Tests](#running-automated-tests)
15. [Production Deployment & Security](#production-deployment--security)

---

## Key Features

- **Application Branding & Clean Design**:
  - Consistent `sifon-service` branding across all headers, sidebars, dashboard cards, footers, page titles, notifications, and generated documents.
  - Modern, responsive interface styled with Tailwind CSS in an accessible teal palette.
- **Secure Session-Based Authentication**:
  - HttpOnly, secure, SameSite cookies storing an opaque database-backed session token hash.
  - Brute-force rate limiting on `/api/auth/login`.
  - Comprehensive CSRF protection for all state-changing endpoints with origin validation.
  - Full session revocation on password changes, email changes, or sign out.
- **Manual Complaint ID Enforcement**:
  - Human-entered string accepting letters, numbers, hyphens (`-`), and slashes (`/`).
  - Preserves leading zeros (e.g. `0042`, `00123`).
  - Enforces case-insensitive uniqueness in the backend/database.
  - Returns exact duplicate error: `"This Complaint ID already exists."`
  - Read-only after creation to guarantee ticket integrity and audit history.
- **Brand & Category Management**:
  - Dedicated sections for Brand and Category maintenance.
  - Add, edit, search, and toggle active/inactive status.
  - Live complaint count aggregations per brand and category.
  - Filter complaints by Brand or Category with one click.
  - Dedicated PDF export reports for individual brands and categories.
  - Preserves historical tickets and brand/category snapshots upon deactivation.
- **Inline Modal Creation During Registration**:
  - "+ Add Brand" and "+ Add Category" modals directly inside the New Complaint form.
  - Refreshes options and auto-selects newly created entities without losing entered form data.
- **Durable WhatsApp Cloud API Notifications**:
  - Registration opt-in checkbox with international country code selection (`+91` default) and customer consent note.
  - Durable MongoDB outbox queueing (`WhatsAppNotification`) with statuses: `Queued`, `Processing`, `Accepted by provider`, `Delivered`, `Read`, `Failed`.
  - Meta Webhook support with handshake verification (`GET /api/webhooks/whatsapp`) and HMAC-SHA256 signature verification (`POST /api/webhooks/whatsapp`).
  - Manual retry action (`POST /api/complaints/:id/notifications/whatsapp/retry`) with failure reason feedback.
  - Non-blocking execution: WhatsApp delivery failures never block complaint creation.
  - Dedicated WhatsApp settings card in Account Settings with live placeholder preview.
- **Private Attachment Storage (Cloudinary & Local)**:
  - Supports authenticated Cloudinary uploads and local disk storage.
  - Magic byte file signature verification (JPEG, PNG, WebP, PDF) to prevent MIME spoofing.
  - All attachments are accessed via private authenticated streaming endpoints (`/api/complaints/:id/attachments/:attachmentId/download`).
- **Comprehensive Server-Side PDF Reporting**:
  - **Individual Ticket PDF**: `sifon-service-complaint-{safeId}.pdf` with letterhead, complete audit history, and brand/category details.
  - **All Complaints PDF**: `sifon-service-all-complaints-{date}.pdf`.
  - **Filtered Complaints PDF**: `sifon-service-filtered-complaints-{date}.pdf`.
  - **Brand Report PDF**: `sifon-service-brand-{safeBrandName}-{date}.pdf`.
  - **Category Report PDF**: `sifon-service-category-{safeCategoryName}-{date}.pdf`.
- **Field Servicer Allocation & Resolution Auditing**:
  - Add, edit, and search field servicers with active workload metrics.
  - Workflow rules require an active servicer before moving to `Assigned` or `In Progress`.
  - Resolution audit requires technical notes, parts replaced, and labor charge before marking tickets `Resolved` or `Closed`.

---

## Architecture & Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: React Router DOM (v6) with ordered navigation (Dashboard, Complaints, Brands, Categories, Servicers, Account Settings)
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios with shared credentials and CSRF synchronization
- **Icons**: Lucide React
- **Timezone**: Timestamps rendered in `Asia/Kolkata`

### Backend
- **Runtime**: Node.js (ES modules)
- **Web Framework**: Express
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Opaque SHA-256 session tokens stored in MongoDB with TTL auto-expiration
- **Password Hashing**: `bcryptjs` (salt rounds: 12)
- **Cloud Storage**: Cloudinary SDK (v2) with private streaming proxy and local fallback
- **Messaging**: WhatsApp Business Cloud API with HMAC-SHA256 webhook verification
- **PDF Engine**: PDFKit with custom tabular layouts
- **Validation**: Zod schema validation on all inputs

---

## Prerequisites

- **Node.js**: Node.js 18 LTS, 20 LTS, 22 LTS, or 24/26.
- **npm**: Version 9+
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017/rocoware`) or MongoDB Atlas URI.

---

## Project Structure

```text
sifon-service/
  backend/
    src/
      config/           # Environment config & database connection
      controllers/      # Auth, Admin, Complaints, Brands, Categories, Servicers, Notifications, Webhooks
      middleware/       # Auth, CSRF, Rate Limiting, File Upload, Error Handling
      models/           # Admin, Session, Complaint, Brand, Category, Servicer, WhatsAppNotification, NotificationSettings
      routes/           # Express route definitions
      services/         # Storage (Cloudinary/Local), WhatsApp Cloud API, PDF Generation
      validators/       # Zod schemas for all models & mutations
      scripts/          # Admin seeding & migrations
    tests/              # Automated node:test test suites
    .env.example
    package.json
  frontend/
    src/
      api/              # Shared Axios client with CSRF interceptor
      components/       # Modal, Toast, LoadingSpinner, ProtectedRoute, ErrorBoundary
      features/         # AuthContext and login state
      layouts/          # DashboardLayout with sidebar & header
      pages/            # Dashboard, ComplaintsList, NewComplaint, ComplaintDetails, Brands, Categories, Servicers, Settings
      utils/            # Formatters (dates, currency, badge styles)
    .env.example
    package.json
  package.json          # Root scripts
  README.md
```

---

## Environment Configuration

### Backend (`backend/.env`)

```env
NODE_ENV=development
PORT=5002
MONGO_URI=mongodb://127.0.0.1:27017/rocoware

CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

SESSION_COOKIE_NAME=rocoware_session
SESSION_TTL_DAYS=7
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=
TRUST_PROXY=0
CSRF_SECRET=your_long_random_csrf_secret_key

# Storage Configuration (local or cloudinary)
UPLOAD_DRIVER=local
UPLOAD_DIR=./storage/uploads
MAX_UPLOAD_MB=10
MAX_ATTACHMENTS_PER_COMPLAINT=10

# Cloudinary (Optional, activated when driver is set to 'cloudinary')
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# WhatsApp Business Cloud API Configuration
WHATSAPP_ENABLED=true
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_API_VERSION=v21.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=sifon_webhook_verify_token_secure_2026
WHATSAPP_APP_SECRET=
WHATSAPP_DEFAULT_TEMPLATE=sifon_complaint_confirmation
WHATSAPP_DEFAULT_LANGUAGE=en_US

# Admin Initial Seed
ADMIN_NAME=sifon-service Admin
ADMIN_EMAIL=admin@sifon-service.local
ADMIN_INITIAL_PASSWORD=YourSecurePassword123!
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5002
VITE_APP_NAME=sifon-service
```

---

## Manual Complaint ID Format

- **Allowed Characters**: Letters (`a-z`, `A-Z`), digits (`0-9`), hyphens (`-`), and forward slashes (`/`).
- **Examples**: `SIF-2026/001`, `0042`, `SIF-RO-2026-99`.
- **Leading Zeros**: Fully preserved as entered by the administrator.
- **Uniqueness**: Enforced case-insensitively in MongoDB (`complaintNumberLower` unique sparse index). Duplicate attempts return:
  `"This Complaint ID already exists."`
- **Read-Only**: After initial registration, the Complaint ID is read-only in all edit dialogs.

---

## Brand & Category Management

1. **Brands (`/brands`)**:
   - Create, list, search, and edit authorized customer brands.
   - Deactivate or reactivate brands at any time.
   - Real-time complaint counter per brand.
   - Download brand-specific PDF reports (`/api/brands/:id/complaints/pdf`).
2. **Categories (`/categories`)**:
   - Create, list, search, and edit product & service categories.
   - Deactivate or reactivate categories.
   - Real-time complaint counter per category.
   - Download category-specific PDF reports (`/api/categories/:id/complaints/pdf`).
3. **Data Integrity**:
   - Deactivating a brand or category preserves historical tickets through snapshot fields (`brandNameSnapshot`, `categoryNameSnapshot`).
   - Inactive brands/categories cannot be selected for new complaints.

---

## Cloudinary Storage Integration

- Set `UPLOAD_DRIVER=cloudinary` and provide `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
- Attachments are stored privately under the `sifon_service/complaints` folder in Cloudinary.
- Attachments are **never** exposed publicly: downloads are authenticated through the server endpoint `/api/complaints/:id/attachments/:attachmentId/download`, which streams the file directly to authenticated administrators.
- If Cloudinary credentials are absent, the system automatically falls back to local private disk storage without failing ticket uploads.

---

## WhatsApp Cloud API & Webhook Integration

### Durable Outbox Queueing
When a new complaint is registered with WhatsApp confirmation checked:
1. An outbox record is created in MongoDB (`WhatsAppNotification`) with status `Queued`.
2. The asynchronous outbox worker dispatches the notification to the Meta Graph API (`POST https://graph.facebook.com/{version}/{phoneNumberId}/messages`).
3. If successful, the notification transitions to `Accepted by provider`.
4. If WhatsApp credentials are missing or the API call fails, the notification transitions to `Failed` with the exact error details stored in `failureReason`. Complaint registration **still succeeds** and informs the administrator via a non-blocking toast warning.

### Manual Retry Action
Administrators can retry any failed notification from the Ticket Details page or by invoking:
```http
POST /api/complaints/:id/notifications/whatsapp/retry
```

### Meta Webhooks Handshake & Delivery Updates
- **Handshake Verification**:
  `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token={WHATSAPP_WEBHOOK_VERIFY_TOKEN}&hub.challenge={challenge}`
- **Delivery Updates**:
  `POST /api/webhooks/whatsapp`
  Secured with HMAC-SHA256 signature verification (`X-Hub-Signature-256`) using `WHATSAPP_APP_SECRET`. Updates outbox status to `Delivered`, `Read`, or `Failed`.

### Live Variable Placeholders
The Account Settings page provides a live preview interpolating the following placeholders:
- `{{customer_name}}`: Customer full name
- `{{complaint_id}}`: Manual complaint ID
- `{{brand_name}}`: Assigned brand name
- `{{category_name}}`: Assigned category name
- `{{product_name}}`: Product description
- `{{servicer_name}}`: Assigned field servicer name
- `{{status}}`: Current complaint status
- `{{registered_date}}`: Registration date formatted in IST
- `{{company_name}}`: Company branding

---

## PDF Export Capabilities & Filenames

All PDF files are generated server-side using PDFKit with clean typography, headers, and footers:

| Export Type | Endpoint | Filename Pattern |
|---|---|---|
| **Individual Complaint** | `GET /api/complaints/:id/pdf` | `sifon-service-complaint-{safeId}.pdf` |
| **All Active Complaints** | `GET /api/complaints/export/pdf?exportAll=true` | `sifon-service-all-complaints-{date}.pdf` |
| **Filtered Complaints** | `GET /api/complaints/export/pdf?...` | `sifon-service-filtered-complaints-{date}.pdf` |
| **Brand Report** | `GET /api/brands/:id/complaints/pdf` | `sifon-service-brand-{safeBrandName}-{date}.pdf` |
| **Category Report** | `GET /api/categories/:id/complaints/pdf` | `sifon-service-category-{safeCategoryName}-{date}.pdf` |

---

## Administrator Initialization (Seeding)

To initialize the default administrator safely without overwriting existing data:

```bash
npm --prefix backend run seed
```

- If an administrator account already exists, the script safely exits without modifying credentials or passwords.
- Initial seed credentials can be configured via `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` in `backend/.env`.

---

## Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Backend Server
```bash
npm --prefix backend run dev
```
Backend runs on `http://localhost:5002`.

### 3. Start Frontend Development Server
```bash
npm --prefix frontend run dev
```
Frontend runs on `http://localhost:5173` and proxies `/api` to port `5002`.

---

## Running Automated Tests

Run the complete backend test suite using Node.js built-in test runner:

```bash
npm --prefix backend test
```

All 51 automated tests across 9 test suites verify:
- Attachment Security & MIME Signature Validation
- Authentication, CSRF & Admin Settings
- Brand & Category Management & Count Aggregations
- Manual Complaint ID Format, Leading Zeros & Duplicate Handling
- Concurrency Protection & Version Checking
- PDF Export Generation & Filename Prefixes
- WhatsApp Outbox Queueing, Settings, Webhooks & Manual Retries
- Admin Seed Idempotency

To verify the frontend production build:
```bash
npm --prefix frontend run build
```

---

## Production Deployment & Security

- **Reverse Proxy**: Serve frontend and backend from the same domain or behind an Nginx/Cloudflare reverse proxy to maintain first-party `SameSite=Lax` cookies.
- **HTTPS**: Set `COOKIE_SECURE=true` and `NODE_ENV=production` in production.
- **CSRF Token**: Ensure all state-changing endpoints pass the `X-CSRF-Token` header retrieved from `GET /api/auth/csrf`.
- **Private Attachments**: Never expose local uploads or Cloudinary assets via public URL redirects; always pipe them through the authenticated `/download` endpoint.
