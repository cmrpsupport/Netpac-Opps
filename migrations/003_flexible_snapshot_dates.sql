-- Database Migration: Flexible Snapshot Dates
-- File: migrations/003_flexible_snapshot_dates.sql
-- Purpose: Enable flexible snapshot date selection for better reporting

-- First, add new columns to dashboard_snapshots
ALTER TABLE dashboard_snapshots 
ADD COLUMN IF NOT EXISTS snapshot_date DATE,
ADD COLUMN IF NOT EXISTS created_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add new columns to account_manager_snapshots
ALTER TABLE account_manager_snapshots
ADD COLUMN IF NOT EXISTS snapshot_date DATE,
ADD COLUMN IF NOT EXISTS created_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Populate snapshot_date for existing records (use created_at date)
UPDATE dashboard_snapshots 
SET snapshot_date = DATE(created_at)
WHERE snapshot_date IS NULL;

UPDATE account_manager_snapshots 
SET snapshot_date = DATE(created_at)
WHERE snapshot_date IS NULL;

-- Make snapshot_date NOT NULL now that we have data
ALTER TABLE dashboard_snapshots 
ALTER COLUMN snapshot_date SET NOT NULL;

ALTER TABLE account_manager_snapshots 
ALTER COLUMN snapshot_date SET NOT NULL;

-- Drop old unique constraints
DROP INDEX IF EXISTS idx_dashboard_snapshots_type;
DROP INDEX IF EXISTS idx_account_manager_snapshots_unique;

-- Create new composite unique constraints that allow multiple snapshots per type
CREATE UNIQUE INDEX idx_dashboard_snapshots_type_date 
ON dashboard_snapshots(snapshot_type, snapshot_date);

CREATE UNIQUE INDEX idx_account_manager_snapshots_unique_date
ON account_manager_snapshots(account_manager, snapshot_type, snapshot_date);

-- Add performance indexes for date-based queries
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_date_desc 
ON dashboard_snapshots(snapshot_date DESC, snapshot_type);

CREATE INDEX IF NOT EXISTS idx_account_manager_snapshots_date_lookup 
ON account_manager_snapshots(account_manager, snapshot_type, snapshot_date DESC);

-- Create index for manual snapshots queries
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_manual 
ON dashboard_snapshots(is_manual, snapshot_type, snapshot_date DESC);

-- Create a view for easy snapshot date queries
CREATE OR REPLACE VIEW available_snapshot_dates AS
SELECT 
    'global' as scope,
    snapshot_type,
    snapshot_date,
    description,
    is_manual,
    created_by,
    created_at,
    'dashboard_snapshots' as source_table
FROM dashboard_snapshots
UNION ALL
SELECT 
    account_manager as scope,
    snapshot_type,
    snapshot_date,
    description,
    is_manual,
    created_by,
    created_at,
    'account_manager_snapshots' as source_table
FROM account_manager_snapshots
ORDER BY snapshot_date DESC, scope;

-- Function to get nearest snapshot date
CREATE OR REPLACE FUNCTION get_nearest_snapshot_date(
    p_target_date DATE,
    p_snapshot_type VARCHAR(20),
    p_account_manager VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE(
    snapshot_date DATE,
    days_difference INTEGER,
    is_exact_match BOOLEAN
) AS $$
BEGIN
    IF p_account_manager IS NULL THEN
        -- Global snapshot search
        RETURN QUERY
        SELECT 
            ds.snapshot_date,
            ABS(EXTRACT(DAY FROM (ds.snapshot_date - p_target_date))::INTEGER) as days_difference,
            ds.snapshot_date = p_target_date as is_exact_match
        FROM dashboard_snapshots ds
        WHERE ds.snapshot_type = p_snapshot_type
        ORDER BY ABS(EXTRACT(DAY FROM (ds.snapshot_date - p_target_date)))
        LIMIT 1;
    ELSE
        -- Account manager snapshot search
        RETURN QUERY
        SELECT 
            ams.snapshot_date,
            ABS(EXTRACT(DAY FROM (ams.snapshot_date - p_target_date))::INTEGER) as days_difference,
            ams.snapshot_date = p_target_date as is_exact_match
        FROM account_manager_snapshots ams
        WHERE ams.snapshot_type = p_snapshot_type 
        AND ams.account_manager = p_account_manager
        ORDER BY ABS(EXTRACT(DAY FROM (ams.snapshot_date - p_target_date)))
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create summary function for snapshot analytics
CREATE OR REPLACE FUNCTION get_snapshot_summary()
RETURNS TABLE(
    snapshot_type VARCHAR(20),
    total_snapshots BIGINT,
    manual_snapshots BIGINT,
    auto_snapshots BIGINT,
    latest_date DATE,
    oldest_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ds.snapshot_type,
        COUNT(*) as total_snapshots,
        COUNT(CASE WHEN ds.is_manual THEN 1 END) as manual_snapshots,
        COUNT(CASE WHEN NOT ds.is_manual THEN 1 END) as auto_snapshots,
        MAX(ds.snapshot_date) as latest_date,
        MIN(ds.snapshot_date) as oldest_date
    FROM dashboard_snapshots ds
    GROUP BY ds.snapshot_type;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample manual snapshots for testing
INSERT INTO dashboard_snapshots (
    snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
    op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
    op30_count, op30_amount, lost_count, lost_amount, inactive_count,
    ongoing_count, pending_count, declined_count, revised_count,
    is_manual, description, created_by
) VALUES 
    ('weekly', CURRENT_DATE, 430, 272, 152000000.00, 40, 26000000.00, 28, 21000000.00, 
     42, 31000000.00, 122, 72000000.00, 32, 5200000.00, 8, 19, 30, 110, 106,
     TRUE, 'Current Week Snapshot', 'System'),
    ('monthly', CURRENT_DATE, 430, 272, 152000000.00, 40, 26000000.00, 28, 21000000.00, 
     42, 31000000.00, 122, 72000000.00, 32, 5200000.00, 8, 19, 30, 110, 106,
     TRUE, 'Current Month Snapshot', 'System')
ON CONFLICT (snapshot_type, snapshot_date) DO UPDATE SET
    total_opportunities = EXCLUDED.total_opportunities,
    submitted_count = EXCLUDED.submitted_count,
    submitted_amount = EXCLUDED.submitted_amount,
    created_at = CURRENT_TIMESTAMP;

-- Verify migration
SELECT 
    'Dashboard Snapshots' as table_name,
    snapshot_type, 
    snapshot_date,
    is_manual,
    description,
    total_opportunities
FROM dashboard_snapshots 
ORDER BY snapshot_date DESC, snapshot_type;

SELECT 
    'Available Functions' as info,
    'get_nearest_snapshot_date(date, type, account_mgr)' as function_name,
    'Returns nearest snapshot to target date' as description
UNION ALL
SELECT 
    'Available Functions',
    'get_snapshot_summary()',
    'Returns summary of all snapshots';

SELECT 
    'View Created' as info,
    'available_snapshot_dates' as view_name,
    'Shows all snapshots across both tables' as description;