-- Migration 012: Add Custom Snapshots Table
-- Purpose: Create table to store custom date snapshots for dashboard comparison

CREATE TABLE IF NOT EXISTS custom_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    description TEXT,
    total_opportunities INTEGER DEFAULT 0,
    submitted_count INTEGER DEFAULT 0,
    submitted_amount DECIMAL(15,2) DEFAULT 0,
    op100_count INTEGER DEFAULT 0,
    op100_amount DECIMAL(15,2) DEFAULT 0,
    op90_count INTEGER DEFAULT 0,
    op90_amount DECIMAL(15,2) DEFAULT 0,
    op60_count INTEGER DEFAULT 0,
    op60_amount DECIMAL(15,2) DEFAULT 0,
    op30_count INTEGER DEFAULT 0,
    op30_amount DECIMAL(15,2) DEFAULT 0,
    lost_count INTEGER DEFAULT 0,
    lost_amount DECIMAL(15,2) DEFAULT 0,
    inactive_count INTEGER DEFAULT 0,
    ongoing_count INTEGER DEFAULT 0,
    pending_count INTEGER DEFAULT 0,
    declined_count INTEGER DEFAULT 0,
    revised_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on snapshot_date to prevent duplicate snapshots for the same date
CREATE UNIQUE INDEX IF NOT EXISTS custom_snapshots_date_idx ON custom_snapshots(snapshot_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_custom_snapshots_updated_at ON custom_snapshots;
CREATE TRIGGER update_custom_snapshots_updated_at 
    BEFORE UPDATE ON custom_snapshots 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE custom_snapshots IS 'Stores custom date snapshots for executive dashboard comparisons';