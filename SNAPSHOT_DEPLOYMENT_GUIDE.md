# Snapshot API (main server)

Snapshots are served by the **main app** (`node server.js`). There is no separate snapshot server.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/snapshots/weekly` | Get weekly snapshot |
| `GET` | `/api/snapshots/monthly` | Get monthly snapshot |
| `POST` | `/api/snapshots` | Save new snapshot |
| `GET` | `/api/snapshots` | Get all snapshots |

## Usage

- **Development:** Start the app with `npm start` (or `npm run dev`). Snapshot APIs are on the same port (e.g. `http://localhost:3000/api/snapshots/weekly`).
- **Production (Render):** The single web service serves both the app and snapshot APIs. No extra deployment.

## Database

Snapshot data is stored in the same database as the rest of the app (SQLite Cloud or local SQLite, depending on `SQLITECLOUD_URL` / `USE_SQLITE_LOCAL`).
