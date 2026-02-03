-- Database Migration: Add Dashboard Snapshots Support (Fixed)
-- File: migrations/001_add_dashboard_snapshots_fixed.sql
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique constraint to ensure only one snapshot per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_snapshots_type ON dashboard_snapshots(snapshot_type);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_saved_date ON dashboard_snapshots(saved_date DESC);

-- Insert baseline snapshots data
-- Weekly baseline snapshot (June 11, 2025 - user provided spreadsheet data)
INSERT INTO dashboard_snapshots (
    snapshot_type, total_opportunities, submitted_count, submitted_amount,
    op100_count, op100_amount, op90_count, op90_amount, 
    op60_count, op60_amount, op30_count, op30_amount,
    lost_count, lost_amount, inactive_count, ongoing_count, 
    pending_count, declined_count, revised_count, saved_date
) VALUES (
    'weekly', 433, 271, 1030273263.72,
    39, 91565013.72, 40, 125829615.57,
    44, 164773765.72, 41, 165319836.75,
    26, 62156647.00, 12, 6, 
    2, 9, 9, '2025-06-11 09:00:00'
) ON CONFLICT (snapshot_type) DO UPDATE SET
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
    saved_date = EXCLUDED.saved_date;

-- Monthly baseline snapshot (May 18, 2025)
INSERT INTO dashboard_snapshots (
    snapshot_type, total_opportunities, submitted_count, submitted_amount,
    op100_count, op100_amount, op90_count, op90_amount, 
    op60_count, op60_amount, op30_count, op30_amount,
    lost_count, lost_amount, inactive_count, ongoing_count, 
    pending_count, declined_count, revised_count, saved_date
) VALUES (
    'monthly', 395, 245, 858394012.48,
    28, 71928014.02, 32, 87593741.18,
    38, 138903217.52, 33, 127452072.85,
    21, 52134647.12, 10, 5, 
    1, 7, 8, '2025-05-18 09:00:00'
) ON CONFLICT (snapshot_type) DO UPDATE SET
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
    saved_date = EXCLUDED.saved_date;
