-- Database Migration: Add Account Manager-Specific Snapshots
-- File: migrations/002_add_account_manager_snapshots.sql
-- Purpose: Store weekly/monthly snapshots for each account manager

-- Create account_manager_snapshots table
CREATE TABLE IF NOT EXISTS account_manager_snapshots (
    id SERIAL PRIMARY KEY,
    account_manager VARCHAR(50) NOT NULL,
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

-- Create unique constraint to ensure only one snapshot per account manager per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_manager_snapshots_unique 
ON account_manager_snapshots(account_manager, snapshot_type);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_account_manager_snapshots_lookup 
ON account_manager_snapshots(account_manager, snapshot_type, saved_date DESC);

-- Populate initial account manager snapshots based on current data
-- This calculates current metrics for each account manager as baseline

-- Weekly snapshots for each account manager
INSERT INTO account_manager_snapshots (
    account_manager, snapshot_type, total_opportunities, submitted_count, submitted_amount,
    op100_count, op100_amount, op90_count, op90_amount, 
    op60_count, op60_amount, op30_count, op30_amount,
    lost_count, lost_amount, inactive_count, ongoing_count, 
    pending_count, declined_count, revised_count, saved_date
)
SELECT 
    account_mgr as account_manager,
    'weekly' as snapshot_type,
    COUNT(*) as total_opportunities,
    COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as submitted_count,
    COALESCE(SUM(CASE WHEN status = 'Submitted' THEN final_amt END), 0) as submitted_amount,
    COUNT(CASE WHEN opp_status = 'OP100' THEN 1 END) as op100_count,
    COALESCE(SUM(CASE WHEN opp_status = 'OP100' THEN final_amt END), 0) as op100_amount,
    COUNT(CASE WHEN opp_status = 'OP90' THEN 1 END) as op90_count,
    COALESCE(SUM(CASE WHEN opp_status = 'OP90' THEN final_amt END), 0) as op90_amount,
    COUNT(CASE WHEN opp_status = 'OP60' THEN 1 END) as op60_count,
    COALESCE(SUM(CASE WHEN opp_status = 'OP60' THEN final_amt END), 0) as op60_amount,
    COUNT(CASE WHEN opp_status = 'OP30' THEN 1 END) as op30_count,
    COALESCE(SUM(CASE WHEN opp_status = 'OP30' THEN final_amt END), 0) as op30_amount,
    COUNT(CASE WHEN opp_status = 'LOST' THEN 1 END) as lost_count,
    COALESCE(SUM(CASE WHEN opp_status = 'LOST' THEN final_amt END), 0) as lost_amount,
    COUNT(CASE WHEN opp_status = 'Inactive' THEN 1 END) as inactive_count,
    COUNT(CASE WHEN opp_status = 'On-going' THEN 1 END) as ongoing_count,
    COUNT(CASE WHEN opp_status = 'Pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN decision = 'Decline' THEN 1 END) as declined_count,
    COUNT(CASE WHEN opp_status = 'Revised' THEN 1 END) as revised_count,
    '2025-06-11 09:00:00' as saved_date -- Weekly baseline date
FROM opps_monitoring 
WHERE account_mgr IS NOT NULL AND account_mgr != ''
GROUP BY account_mgr
ON CONFLICT (account_manager, snapshot_type) DO UPDATE SET
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

-- Monthly snapshots for each account manager (copy weekly data)
INSERT INTO account_manager_snapshots (
    account_manager, snapshot_type, total_opportunities, submitted_count, submitted_amount,
    op100_count, op100_amount, op90_count, op90_amount, 
    op60_count, op60_amount, op30_count, op30_amount,
    lost_count, lost_amount, inactive_count, ongoing_count, 
    pending_count, declined_count, revised_count, saved_date
)
SELECT 
    account_manager,
    'monthly' as snapshot_type,
    total_opportunities,
    submitted_count,
    submitted_amount,
    op100_count,
    op100_amount,
    op90_count,
    op90_amount,
    op60_count,
    op60_amount,
    op30_count,
    op30_amount,
    lost_count,
    lost_amount,
    inactive_count,
    ongoing_count,
    pending_count,
    declined_count,
    revised_count,
    '2025-05-18 09:00:00' as saved_date -- Monthly baseline date
FROM account_manager_snapshots 
WHERE snapshot_type = 'weekly'
ON CONFLICT (account_manager, snapshot_type) DO UPDATE SET
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
