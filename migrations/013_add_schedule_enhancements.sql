-- Database Migration: Schedule Enhancements
-- File: migrations/013_add_schedule_enhancements.sql
-- Purpose: Add historical status tracking and task completion functionality

-- 1. Create proposal_status_history table for tracking status changes over time
CREATE TABLE IF NOT EXISTS proposal_status_history (
    id SERIAL PRIMARY KEY,
    proposal_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    status_date DATE NOT NULL,
    changed_by VARCHAR(50),
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient status history queries
CREATE INDEX IF NOT EXISTS idx_proposal_status_history_proposal_id ON proposal_status_history(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_status_history_date ON proposal_status_history(status_date);
CREATE INDEX IF NOT EXISTS idx_proposal_status_history_lookup ON proposal_status_history(proposal_id, status_date);

-- 2. Add completion tracking fields to proposal_schedule table
ALTER TABLE proposal_schedule 
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completed_by VARCHAR(50),
ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- 3. Create schedule_task_completion table for custom tasks
CREATE TABLE IF NOT EXISTS schedule_task_completion (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) NOT NULL, -- Can be proposal_id or custom task ID
    task_type VARCHAR(20) NOT NULL CHECK (task_type IN ('proposal', 'custom')),
    week_start_date DATE NOT NULL,
    day_index INTEGER NOT NULL CHECK (day_index BETWEEN 0 AND 6),
    user_id VARCHAR(50) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    completion_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for task completion
CREATE INDEX IF NOT EXISTS idx_schedule_task_completion_task ON schedule_task_completion(task_id, task_type);
CREATE INDEX IF NOT EXISTS idx_schedule_task_completion_week ON schedule_task_completion(week_start_date, day_index);
CREATE INDEX IF NOT EXISTS idx_schedule_task_completion_user ON schedule_task_completion(user_id);

-- Unique constraint to prevent duplicate completion records
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_task_completion_unique 
ON schedule_task_completion(task_id, task_type, week_start_date, day_index, user_id);

-- 4. Function to get historical status for a proposal on a specific date
CREATE OR REPLACE FUNCTION get_proposal_status_on_date(p_proposal_id UUID, p_date DATE)
RETURNS VARCHAR(50) AS $$
DECLARE
    historical_status VARCHAR(50);
    current_status VARCHAR(50);
BEGIN
    -- First, try to get the most recent historical status on or before the specified date
    SELECT status INTO historical_status
    FROM proposal_status_history 
    WHERE proposal_id = p_proposal_id 
    AND status_date <= p_date
    ORDER BY status_date DESC, created_at DESC
    LIMIT 1;
    
    -- If no historical record found, get current status from opps_monitoring
    IF historical_status IS NULL THEN
        SELECT status INTO current_status
        FROM opps_monitoring
        WHERE uid = p_proposal_id;
        
        RETURN current_status;
    END IF;
    
    RETURN historical_status;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to record status change
CREATE OR REPLACE FUNCTION record_status_change(
    p_proposal_id UUID,
    p_new_status VARCHAR(50),
    p_changed_by VARCHAR(50),
    p_change_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert the status change record
    INSERT INTO proposal_status_history (
        proposal_id, status, status_date, changed_by, change_reason
    ) VALUES (
        p_proposal_id, p_new_status, CURRENT_DATE, p_changed_by, p_change_reason
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to toggle task completion
CREATE OR REPLACE FUNCTION toggle_task_completion(
    p_task_id VARCHAR(50),
    p_task_type VARCHAR(20),
    p_week_start DATE,
    p_day_index INTEGER,
    p_user_id VARCHAR(50),
    p_completion_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_completion BOOLEAN;
BEGIN
    -- Check current completion status
    SELECT is_completed INTO current_completion
    FROM schedule_task_completion 
    WHERE task_id = p_task_id 
    AND task_type = p_task_type
    AND week_start_date = p_week_start
    AND day_index = p_day_index
    AND user_id = p_user_id;
    
    -- If no record exists, create one as completed
    IF current_completion IS NULL THEN
        INSERT INTO schedule_task_completion (
            task_id, task_type, week_start_date, day_index, user_id,
            is_completed, completed_at, completion_notes
        ) VALUES (
            p_task_id, p_task_type, p_week_start, p_day_index, p_user_id,
            TRUE, CURRENT_TIMESTAMP, p_completion_notes
        );
        RETURN TRUE;
    END IF;
    
    -- Toggle the completion status
    UPDATE schedule_task_completion SET
        is_completed = NOT current_completion,
        completed_at = CASE WHEN NOT current_completion THEN CURRENT_TIMESTAMP ELSE NULL END,
        completion_notes = p_completion_notes,
        updated_at = CURRENT_TIMESTAMP
    WHERE task_id = p_task_id 
    AND task_type = p_task_type
    AND week_start_date = p_week_start
    AND day_index = p_day_index
    AND user_id = p_user_id;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 7. Update the existing schedule view to include completion status
CREATE OR REPLACE VIEW schedule_with_proposal_details AS
SELECT 
    ps.id,
    ps.proposal_id,
    ps.proposal_name,
    ps.week_start_date,
    ps.day_index,
    ps.scheduled_by,
    ps.is_completed as schedule_completed,
    ps.completed_at as schedule_completed_at,
    ps.completed_by as schedule_completed_by,
    ps.created_at,
    ps.updated_at,
    om.project_name,
    om.client,
    om.status as current_proposal_status,
    om.final_amt,
    om.pic,
    om.account_mgr,
    -- Get historical status for the week date
    get_proposal_status_on_date(ps.proposal_id, ps.week_start_date + ps.day_index) as historical_status
FROM proposal_schedule ps
LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
ORDER BY ps.week_start_date DESC, ps.day_index;

-- 8. Function to get comprehensive schedule data with completion status
CREATE OR REPLACE FUNCTION get_weekly_schedule_with_completion(
    p_week_start DATE,
    p_user_id VARCHAR(50)
)
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
                'current_status', om.status,
                'historical_status', get_proposal_status_on_date(ps.proposal_id, p_week_start + ps.day_index),
                'final_amt', om.final_amt,
                'pic', om.pic,
                'is_completed', COALESCE(stc.is_completed, FALSE),
                'completed_at', stc.completed_at,
                'completion_notes', stc.completion_notes
            )
        ) as proposals
    FROM proposal_schedule ps
    LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
    LEFT JOIN schedule_task_completion stc ON (
        stc.task_id = ps.proposal_id::VARCHAR
        AND stc.task_type = 'proposal'
        AND stc.week_start_date = p_week_start
        AND stc.day_index = ps.day_index
        AND stc.user_id = p_user_id
    )
    WHERE ps.week_start_date = p_week_start
    GROUP BY ps.day_index
    ORDER BY ps.day_index;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE proposal_status_history IS 'Tracks proposal status changes over time for historical reference';
COMMENT ON TABLE schedule_task_completion IS 'Tracks completion status of tasks in weekly schedules per user';
COMMENT ON FUNCTION get_proposal_status_on_date(UUID, DATE) IS 'Returns the status of a proposal on a specific historical date';
COMMENT ON FUNCTION record_status_change(UUID, VARCHAR, VARCHAR, TEXT) IS 'Records a status change in the history table';
COMMENT ON FUNCTION toggle_task_completion(VARCHAR, VARCHAR, DATE, INTEGER, VARCHAR, TEXT) IS 'Toggles completion status of a scheduled task';
COMMENT ON FUNCTION get_weekly_schedule_with_completion(DATE, VARCHAR) IS 'Returns weekly schedule with completion status for a specific user';

-- Initialize historical data for existing proposals (run once)
INSERT INTO proposal_status_history (proposal_id, status, status_date, changed_by, change_reason)
SELECT 
    uid, 
    COALESCE(status, 'not_started'), 
    CURRENT_DATE, 
    'system', 
    'Initial migration of existing statuses'
FROM opps_monitoring 
WHERE NOT EXISTS (
    SELECT 1 FROM proposal_status_history WHERE proposal_id = opps_monitoring.uid
);

-- Verify migration
SELECT 
    'Status history table created' as status,
    COUNT(*) as initial_record_count
FROM proposal_status_history;

SELECT 
    'Task completion table created' as status,
    COUNT(*) as initial_record_count
FROM schedule_task_completion;