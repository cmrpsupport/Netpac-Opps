-- PIC (Person in Charge) list and user tagging
-- Migration: 015_add_pics.sql

CREATE TABLE IF NOT EXISTS pics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN pic_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_pic_id ON users(pic_id);
