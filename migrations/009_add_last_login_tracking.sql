-- Add last login tracking to users table
-- Migration: 009_add_last_login_tracking.sql

-- Add last_login_at column to track when users last logged in
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create index for better performance on queries that filter by last login
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);

-- Optional: Update existing users to have a default last_login_at based on created_at
-- This gives a reasonable starting point for existing users
UPDATE users 
SET last_login_at = created_at 
WHERE last_login_at IS NULL;

-- Verify the changes
SELECT 
    email, 
    name, 
    created_at,
    last_login_at,
    account_type 
FROM users 
ORDER BY email
LIMIT 5;