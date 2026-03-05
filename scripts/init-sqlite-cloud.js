#!/usr/bin/env node
/**
 * Apply schema and migrations to SQLite Cloud.
 * Run once after creating the database: SQLITECLOUD_URL=... node scripts/init-sqlite-cloud.js
 * Set SQLITECLOUD_URL in .env or pass it when running.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const { Database } = require('@sqlitecloud/drivers');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const projectRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(projectRoot, 'sqlite_schema.sql');

const url = (process.env.SQLITECLOUD_URL || '').trim();
if (!url || !url.startsWith('sqlitecloud://')) {
  console.error('Set SQLITECLOUD_URL (e.g. sqlitecloud://xxx.sqlite.cloud:8860/db?apikey=...) in .env or environment');
  process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
  console.error('Schema file not found:', schemaPath);
  process.exit(1);
}

function run(db, sql, params = []) {
  return db.sql(sql, ...params);
}

let db;

async function main() {
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Connection timeout')), 15000);
    db = new Database(url, (err) => {
      clearTimeout(t);
      if (err) {
        console.error('SQLite Cloud connection error:', err.message);
        reject(err);
      } else resolve();
    });
  });

  console.log('Applying schema from', schemaPath);
  let schema = fs.readFileSync(schemaPath, 'utf8');
  schema = schema.replace(/'{}'::uuid\[\]/g, "'[]'");

  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  let applied = 0;
  let skipped = 0;
  for (const stmt of statements) {
    try {
      await new Promise((resolve, reject) => {
        db.exec(stmt + ';', (e) => (e ? reject(e) : resolve()));
      });
      applied++;
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        skipped++;
      } else {
        console.warn('Schema statement warning:', err.message);
        skipped++;
      }
    }
  }
  console.log(`Schema applied: ${applied} statements, ${skipped} skipped.`);

  const runSql = (sql, params = []) => db.sql(sql, ...params);

  await runSql(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `).catch(() => {});

  await runSql(`ALTER TABLE users ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';`).catch(() => {});
  await runSql(`INSERT OR IGNORE INTO tenants (id, code, name) VALUES ('default', 'default', 'Default')`).catch(() => {});

  const roleRes = await runSql('SELECT COUNT(*) as n FROM roles');
  const roleCount = Array.isArray(roleRes) && roleRes[0] ? roleRes[0].n : 0;
  if (roleCount === 0) {
    console.log('Seeding roles...');
    await runSql(`
      INSERT INTO roles (name) VALUES ('technical'), ('proposal'), ('sales'), ('admin'), ('executive'), ('account_manager');
    `);
  }

  await runSql(`
    CREATE TABLE IF NOT EXISTS account_managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `).catch(() => {});
  await runSql(`ALTER TABLE users ADD COLUMN account_manager_id INTEGER;`).catch(() => {});
  await runSql(`
    CREATE TABLE IF NOT EXISTS pics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `).catch(() => {});
  await runSql(`ALTER TABLE users ADD COLUMN pic_id INTEGER;`).catch(() => {});

  const userRes = await runSql('SELECT COUNT(*) as n FROM users');
  const userCount = Array.isArray(userRes) && userRes[0] ? userRes[0].n : 0;
  if (userCount === 0) {
    console.log('Seeding default admin user (admin@example.com / admin123)...');
    const id = uuidv4();
    const hash = bcrypt.hashSync('admin123', 10);
    await runSql(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, is_verified, roles, account_type) VALUES (?, 'default', ?, ?, ?, 1, ?, 'Admin')`,
      id, 'admin@example.com', hash, 'Admin', JSON.stringify(['admin'])
    );
    const adminRoleRes = await runSql("SELECT id FROM roles WHERE name = 'admin'");
    const adminRole = Array.isArray(adminRoleRes) && adminRoleRes[0] ? adminRoleRes[0] : null;
    if (adminRole) {
      await runSql('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', id, adminRole.id);
    }
    console.log('  Login: admin@example.com / admin123');
  }

  db.close();
  console.log('SQLite Cloud init done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
