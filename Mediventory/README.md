# Mediventory

Medicine Inventory Management System built from the PRD. This project contains a Node/Express backend, MongoDB/Mongoose models, REST APIs, role-based access checks, JWT authentication, bcrypt password hashing, seeded demo data, and a browser frontend for inventory, sales, procurement, suppliers, reports, alerts, and audit logs.

## Setup

Create `.env` in this folder:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=use_a_long_random_secret
PORT=4000
```

Install dependencies:

```bash
npm install
```

## Run locally

```bash
npm start
```

Open `http://localhost:4000`.

## Deploy on Render

1. Push this repository to GitHub.
2. Open Render and create a new Blueprint or Web Service.
3. Select the repository and use `Mediventory` as the root directory.
4. Build command: `npm install`.
5. Start command: `npm start`.
6. Add environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `NODE_ENV=production`
7. In MongoDB Atlas, allow Render network access. For a student/demo deployment, `0.0.0.0/0` is simplest; for production, restrict it.

Demo logins:

- `admin@mims.local` / `admin123`
- `pharmacist@mims.local` / `pharma123`

## Implemented PRD scope

- Medicine catalog with duplicate prevention.
- Batch-wise inventory with expiry dates, locations, reorder levels, and negative stock prevention.
- Low stock, near-expiry, and expired-stock alerts.
- Supplier management.
- Purchase order creation and goods-receipt API.
- Sales invoices with automatic FEFO stock deduction and expired-stock blocking.
- Reports endpoint with downloadable JSON export from the frontend.
- Authentication, role checks, password hashing, and audit logs.

## Backend API highlights

- `POST /api/auth/login`
- `GET|POST /api/medicines`
- `GET|POST /api/inventory`
- `POST /api/inventory/adjust`
- `POST /api/inventory/transfer`
- `GET|POST /api/suppliers`
- `GET|POST /api/purchases`
- `POST /api/purchases/:id/receive`
- `GET|POST /api/sales`
- `GET /api/reports`
- `GET /api/audit`

## Recommended next steps

1. Rotate the MongoDB password if this repository is ever made public or shared.
2. Replace the demo `JWT_SECRET` with a long random value before real use.
3. Add automated tests for sale stock deduction, expired medicine blocking, duplicate batches, role access, and purchase receipt.
4. Add PDF/Excel exports for reports and invoices.
5. Add user-management screens for Admins.
6. Add deployment configuration for MongoDB Atlas and a cloud host.
