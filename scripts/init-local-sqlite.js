#!/usr/bin/env node
/**
 * Create a local SQLite database and apply the schema.
 * Run once: node scripts/init-local-sqlite.js
 * Then set USE_SQLITE_LOCAL=1 in .env and start the server.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const projectRoot = path.resolve(__dirname, '..');
const dbDir = path.join(projectRoot, 'data');
const dbPath = process.env.SQLITE_DB_PATH || path.join(dbDir, 'local.db');
const schemaPath = path.join(projectRoot, 'sqlite_schema.sql');

if (!fs.existsSync(schemaPath)) {
  console.error('Schema file not found:', schemaPath);
  process.exit(1);
}

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('Created directory:', dbDir);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Applying schema from', schemaPath);
let schema = fs.readFileSync(schemaPath, 'utf8');
schema = schema.replace(/'{}'::uuid\[\]/g, "'[]'");

try {
  db.exec(schema);
  console.log('Schema applied.');
} catch (err) {
  if (err.message.includes('already exists')) {
    console.log('Schema already applied (tables exist).');
  } else {
    console.error('Schema error:', err.message);
    db.close();
    process.exit(1);
  }
}

// Ensure tenant support exists (for older DBs)
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
// Add tenant_id to users if missing (SQLite supports ADD COLUMN)
try {
  db.exec(`ALTER TABLE users ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';`);
} catch (e) {
  // ignore if column already exists
}
// Seed default tenant
try {
  db.prepare(`INSERT OR IGNORE INTO tenants (id, code, name) VALUES (?, ?, ?)`).run('default', 'default', 'Default');
} catch (e) {
  // ignore
}

// Seed roles if empty
const roleCount = db.prepare('SELECT COUNT(*) as n FROM roles').get();
if (roleCount.n === 0) {
  console.log('Seeding roles...');
  db.exec(`
    INSERT INTO roles (name) VALUES ('technical'), ('proposal'), ('sales'), ('admin'), ('executive'), ('account_manager');
  `);
}

// Account managers table and users.account_manager_id (migration for existing DBs)
db.exec(`
  CREATE TABLE IF NOT EXISTS account_managers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
try {
  db.exec(`ALTER TABLE users ADD COLUMN account_manager_id INTEGER;`);
} catch (e) {
  // column may already exist
}
db.exec(`
  CREATE TABLE IF NOT EXISTS pics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
try {
  db.exec(`ALTER TABLE users ADD COLUMN pic_id INTEGER;`);
} catch (e) {
  // column may already exist
}

// Seed default admin user if no users
const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get();
if (userCount.n === 0) {
  console.log('Seeding default admin user (admin@example.com / admin123)...');
  const id = uuidv4();
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    `INSERT INTO users (id, tenant_id, email, password_hash, name, is_verified, roles, account_type) VALUES (?, 'default', ?, ?, ?, 1, ?, 'Admin')`
  ).run(id, 'admin@example.com', hash, 'Admin', JSON.stringify(['admin']));
  // Assign admin role
  const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();
  if (adminRole) {
    db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').run(id, adminRole.id);
  }
  console.log('  Login: admin@example.com / admin123');
}

db.close();
console.log('Done. Database created at:', dbPath);
console.log('Add to .env: USE_SQLITE_LOCAL=1');
console.log('Then start the server: npm run dev');
