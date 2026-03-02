#!/usr/bin/env node
/**
 * Set admin@netpacific.com as Admin (account_type = 'Admin', roles include 'Admin').
 * Uses project db_adapter so it works with SQLite or PostgreSQL from .env.
 *
 * Run: node make_admin_netpacific.js
 */

require('dotenv').config();
const db = require('./db_adapter');

const EMAIL = 'admin@netpacific.com';

async function main() {
  await db.initDatabase();
  try {
    // Update by email: set account_type and roles (JSON array for SQLite/Postgres)
    const rolesJson = JSON.stringify(['Admin']);
    const result = await db.query(
      "UPDATE users SET account_type = 'Admin', roles = ? WHERE email = ?",
      [rolesJson, EMAIL]
    );
    if (result.rowCount === 0) {
      console.log('No user found with email:', EMAIL);
      console.log('Create the user first (e.g. via User Management or signup), then run this script again.');
      process.exit(1);
    }
    console.log('Updated', result.rowCount, 'user(s):', EMAIL, '-> Admin');
    const check = await db.query(
      'SELECT id, email, name, account_type, roles FROM users WHERE email = ?',
      [EMAIL]
    );
    if (check.rows && check.rows[0]) {
      console.log('Verified:', check.rows[0]);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    if (db.close) db.close();
  }
}

main();
