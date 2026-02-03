-- Database Migration: Add Proposal Schedule Support
-- File: migrations/004_add_proposal_schedule_table.sql
-- Purpose: Create permanent storage for weekly schedule proposal placements

-- Create proposal_schedule table for storing scheduled proposals
CREATE TABLE IF NOT EXISTS proposal_schedule (
    id SERIAL PRIMARY KEY,
    proposal_id UUID NOT NULL,         -- References opps_monitoring.uid
    proposal_name VARCHAR(255) NOT NULL,
    week_start_date DATE NOT NULL,     -- Monday of the week (YYYY-MM-DD)
    day_index INTEGER NOT NULL CHECK (day_index BETWEEN 0 AND 6), -- 0=Monday, 6=Sunday
    scheduled_by VARCHAR(50),          -- User who scheduled it
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_proposal_schedule_proposal_id ON proposal_schedule(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_schedule_week_lookup ON proposal_schedule(week_start_date, day_index);
CREATE INDEX IF NOT EXISTS idx_proposal_schedule_user ON proposal_schedule(scheduled_by);

-- Create unique constraint to prevent duplicate placements
-- A proposal can only be scheduled once per week (but can be moved to different days)
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_schedule_unique_week 
ON proposal_schedule(proposal_id, week_start_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_proposal_schedule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_proposal_schedule_updated_at 
    BEFORE UPDATE ON proposal_schedule 
    FOR EACH ROW 
    EXECUTE FUNCTION update_proposal_schedule_timestamp();

-- Create a view for easy schedule querying with proposal details
CREATE OR REPLACE VIEW schedule_with_proposal_details AS
SELECT 
    ps.id,
    ps.proposal_id,
    ps.proposal_name,
    ps.week_start_date,
    ps.day_index,
    ps.scheduled_by,
    ps.created_at,
    ps.updated_at,
    om.project_name,
    om.client,
    om.status as proposal_status,
    om.final_amt,
    om.pic,
    om.account_mgr
FROM proposal_schedule ps
LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
ORDER BY ps.week_start_date DESC, ps.day_index;

-- Migrate existing MOCK_SCHEDULE data (if any exists)
-- This will be populated by the backend route when first accessed

-- Add helpful comments
COMMENT ON TABLE proposal_schedule IS 'Stores proposal placements in weekly calendar schedule';
COMMENT ON COLUMN proposal_schedule.proposal_id IS 'References opps_monitoring.uid - the proposal being scheduled';
COMMENT ON COLUMN proposal_schedule.week_start_date IS 'Monday date of the week in YYYY-MM-DD format';
COMMENT ON COLUMN proposal_schedule.day_index IS 'Day of week: 0=Monday, 1=Tuesday, ..., 6=Sunday';
COMMENT ON COLUMN proposal_schedule.scheduled_by IS 'Username of person who scheduled the proposal';
COMMENT ON VIEW schedule_with_proposal_details IS 'View combining schedule data with proposal information for easy display';

-- Create function to get schedule for a specific week
CREATE OR REPLACE FUNCTION get_weekly_schedule(week_start DATE)
RETURNS TABLE (
    day_index INTEGER,
    proposals JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.day_index,
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
                'id', ps.proposal_id,
                'name', ps.proposal_name,
                'schedule_id', ps.id,
                'project_name', om.project_name,
                'client', om.client,
                'status', om.status,
                'final_amt', om.final_amt,
                'pic', om.pic
            )
        ) as proposals
    FROM proposal_schedule ps
    LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
    WHERE ps.week_start_date = week_start
    GROUP BY ps.day_index
    ORDER BY ps.day_index;
END;
$$ LANGUAGE plpgsql;

-- Create function to add proposal to schedule
CREATE OR REPLACE FUNCTION add_proposal_to_schedule(
    p_proposal_id UUID,
    p_proposal_name VARCHAR(255),
    p_week_start DATE,
    p_day_index INTEGER,
    p_scheduled_by VARCHAR(50)
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert or update the schedule entry
    INSERT INTO proposal_schedule (
        proposal_id, proposal_name, week_start_date, day_index, scheduled_by
    ) VALUES (
        p_proposal_id, p_proposal_name, p_week_start, p_day_index, p_scheduled_by
    )
    ON CONFLICT (proposal_id, week_start_date) 
    DO UPDATE SET 
        day_index = EXCLUDED.day_index,
        proposal_name = EXCLUDED.proposal_name,
        scheduled_by = EXCLUDED.scheduled_by,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create function to remove proposal from schedule
CREATE OR REPLACE FUNCTION remove_proposal_from_schedule(
    p_proposal_id UUID,
    p_week_start DATE
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM proposal_schedule 
    WHERE proposal_id = p_proposal_id 
    AND week_start_date = p_week_start;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Verify migration by showing table info
SELECT 
    'Table created successfully' as status,
    COUNT(*) as initial_record_count
FROM proposal_schedule;

SELECT 
    'Indexes created' as status,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'proposal_schedule';

COMMENT ON FUNCTION get_weekly_schedule(DATE) IS 'Returns organized schedule data for a specific week';
COMMENT ON FUNCTION add_proposal_to_schedule(UUID, VARCHAR, DATE, INTEGER, VARCHAR) IS 'Safely adds or moves a proposal in the schedule';
COMMENT ON FUNCTION remove_proposal_from_schedule(UUID, DATE) IS 'Removes a proposal from the schedule for a specific week'; 