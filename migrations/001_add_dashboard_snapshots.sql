-- Database Migration: Add Dashboard Snapshots Support
-- File: migrations/001_add_dashboard_snapshots.sql
-- Purpose: Create table and populate with baseline snapshot data

-- Create dashboard_snapshots table
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('weekly', 'monthly')),
    total_opportunities INTEGER,
    submitted_count INTEGER,
    submitted_amount DECIMAL(15,2),
    op100_count INTEGER,
    op100_amount DECIMAL(15,2),
    op90_count INTEGER,
    op90_amount DECIMAL(15,2),
    op60_count INTEGER,
    op60_amount DECIMAL(15,2),
    op30_count INTEGER,
    op30_amount DECIMAL(15,2),
    lost_count INTEGER,
    lost_amount DECIMAL(15,2),
    inactive_count INTEGER,
    ongoing_count INTEGER,
    pending_count INTEGER,
    declined_count INTEGER,
    revised_count INTEGER,
    saved_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint to ensure only one snapshot per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_snapshots_type ON dashboard_snapshots(snapshot_type);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_saved_date ON dashboard_snapshots(saved_date DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dashboard_snapshots_updated_at 
    BEFORE UPDATE ON dashboard_snapshots 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert baseline snapshot data (from screenshot metrics)
INSERT INTO dashboard_snapshots (
    snapshot_type, total_opportunities, submitted_count, submitted_amount,
    op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
    op30_count, op30_amount, lost_count, lost_amount, inactive_count,
    ongoing_count, pending_count, declined_count, revised_count
) VALUES 
    -- Weekly baseline
    ('weekly', 428, 270, 150000000.00, 38, 25000000.00, 27, 20000000.00, 41, 30000000.00, 
     120, 70000000.00, 31, 5000000.00, 8, 19, 29, 109, 104),
    -- Monthly baseline  
    ('monthly', 428, 270, 150000000.00, 38, 25000000.00, 27, 20000000.00, 41, 30000000.00,
     120, 70000000.00, 31, 5000000.00, 8, 19, 29, 109, 104)
ON CONFLICT (snapshot_type) DO UPDATE SET
    total_opportunities = EXCLUDED.total_opportunities,
    submitted_count = EXCLUDED.submitted_count,
    submitted_amount = EXCLUDED.submitted_amount,
    op100_count = EXCLUDED.op100_count,
    op100_amount = EXCLUDED.op100_amount,
    op90_count = EXCLUDED.op90_count,
    op90_amount = EXCLUDED.op90_amount,
    op60_count = EXCLUDED.op60_count,
    op60_amount = EXCLUDED.op60_amount,
    op30_count = EXCLUDED.op30_count,
    op30_amount = EXCLUDED.op30_amount,
    lost_count = EXCLUDED.lost_count,
    lost_amount = EXCLUDED.lost_amount,
    inactive_count = EXCLUDED.inactive_count,
    ongoing_count = EXCLUDED.ongoing_count,
    pending_count = EXCLUDED.pending_count,
    declined_count = EXCLUDED.declined_count,
    revised_count = EXCLUDED.revised_count,
    saved_date = CURRENT_TIMESTAMP;

-- Verify migration
SELECT 
    snapshot_type, 
    total_opportunities, 
    submitted_count, 
    op100_count,
    saved_date
FROM dashboard_snapshots 
ORDER BY snapshot_type;
