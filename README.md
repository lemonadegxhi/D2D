# DAY2DAY

DAY2DAY is now scaffolded as the start of a web-hosted secure file server:

- React + Vite frontend with login and file import UI
- Express + PostgreSQL backend
- PostgreSQL-backed persisted user file storage
- seeded admin login groundwork
- audit log table for file access events

## Current groundwork

The project now includes:

- `POST /api/auth/login` for seeded admin authentication
- `POST /api/files/upload` to import files (click-select or drag/drop in UI) into PostgreSQL
- `GET /api/files/mine` to list files saved for the logged-in user
- `GET /api/files/download/:id` to retrieve previously uploaded files
- `GET /api/files/overview` for total file count, bytes used, and recent files
- `GET /api/files/browse?path=` for safe directory listing inside the storage root
- automatic bootstrap of `app_users` and `file_audit_log` tables on server start
- automatic bootstrap of `user_files` table for persistent file content
- path normalization to prevent browsing outside the configured storage vault

Current upload limit is 10 MB per file.

This is still a foundation, not a finished secure file platform. Uploads, downloads, real sessions/JWT/cookies, per-user permissions, rate limiting, and encryption-at-rest are still future work.

## Local setup

### 1. Start PostgreSQL

From the project root:

```powershell
docker compose up -d
```

Postgres will run with:

- database: `day2day`
- username: `postgres`
- password: `postgres`
- port: `5432`

### 2. Configure the server

Inside `server/`, copy `.env.example` to `.env` if needed:

```powershell
Copy-Item .env.example .env
```

Default values now include:

```text
CLIENT_URL=http://localhost:5173
STORAGE_ROOT=./storage/library
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=ChangeMeNow123!
```

### 3. Run the backend

Inside `server/`:

```powershell
npm install
npm run dev
```

On startup the server will:

- connect to PostgreSQL
- create the storage root if it does not exist
- create the auth and audit tables if missing
- seed the admin user if it does not exist

The API will be available at `http://localhost:5000`.

### 4. Run the frontend

From the project root:

```powershell
npm install
npm run dev
```

The UI will be available at `http://localhost:5173`.

## Using the scaffold

1. Start the backend and frontend.
2. Sign in with the seeded admin credentials from `server/.env`.
3. Log in with seeded credentials.
4. Import files from the browser with click-select or drag/drop.
5. Refresh or re-login to verify uploaded files remain available under your account.

## Suggested next steps

- Add upload and download endpoints with streaming
- Replace demo session tokens with secure cookie-based auth or JWT
- Add per-user and per-folder permissions
- Add file metadata tables instead of filesystem-only discovery
- Add virus scanning, rate limiting, and request logging
