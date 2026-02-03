-- Migration 013: Fix Custom Snapshots Missing Columns
-- Purpose: Add missing created_by and is_manual columns to custom_snapshots table
-- Issue: Custom snapshots table was missing columns that are referenced in routes

-- Add missing columns to custom_snapshots table
ALTER TABLE custom_snapshots 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE;

-- Update existing records to set is_manual = TRUE for any existing custom snapshots
UPDATE custom_snapshots 
SET is_manual = TRUE, created_by = 'System Migration' 
WHERE is_manual IS NULL OR created_by IS NULL;

-- Add comment to document the fix
COMMENT ON COLUMN custom_snapshots.created_by IS 'User or system that created the snapshot';
COMMENT ON COLUMN custom_snapshots.is_manual IS 'Whether this snapshot was created manually';