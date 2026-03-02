-- Account manager list and user tagging
-- Migration: 014_add_account_managers.sql

-- Master list of account managers (add/edit here; tag users to one when they have an account)
CREATE TABLE IF NOT EXISTS account_managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Link users to an account manager when they are "tagged" (e.g. once they created an account)
ALTER TABLE users ADD COLUMN account_manager_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_account_manager_id ON users(account_manager_id);
