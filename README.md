# DAY2DAY

This repo now includes:

- a root React + Vite frontend
- a `server/` Express + PostgreSQL backend designed for local development with Docker Desktop

## Structure

```text
DAY2DAY/
├── src/
├── server/
├── docker-compose.yml
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Frontend

Install frontend dependencies from the project root:

```powershell
npm install
```

Start the frontend:

```powershell
npm run dev
```

This serves the app at:

```text
http://localhost:5173
```

Right now it intentionally renders a plain white page.

## Backend and Database

### Step 1: Start PostgreSQL in Docker Desktop

From the project root:

```powershell
docker compose up -d
```

This starts a PostgreSQL container with:

- database: `day2day`
- username: `postgres`
- password: `postgres`
- port: `5432`

### Step 2: Set up the server environment file

Inside `server/`, copy `.env.example` to `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

### Step 3: Install backend dependencies

Inside `server/`:

```powershell
npm install
```

### Step 4: Run the server

Inside `server/`:

```powershell
npm run dev
```

If the database connection works, the server will start on `http://localhost:5000`.

### Step 5: Verify the API

Open:

```text
http://localhost:5000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## Useful Docker commands

Start database:

```powershell
docker compose up -d
```

Stop database:

```powershell
docker compose down
```

Stop database and remove volume data:

```powershell
docker compose down -v
```

## Notes

- The backend uses the `pg` package with a connection pool.
- The sample route checks PostgreSQL connectivity by running `SELECT NOW()`.
- When you add React later, your frontend can call `http://localhost:5000/api/...`.
