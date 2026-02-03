-- Database Migration: Add User Filtering to Proposal Schedule
-- File: migrations/006_add_user_filtering_to_proposal_schedule.sql
-- Purpose: Add user_id column to proposal_schedule table for user-specific filtering

-- Add user_id column to proposal_schedule table
ALTER TABLE proposal_schedule 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Create index for user-based filtering
CREATE INDEX IF NOT EXISTS idx_proposal_schedule_user_id ON proposal_schedule(user_id);

-- Update the unique constraint to include user_id
-- This allows multiple users to schedule the same proposal in the same week
DROP INDEX IF EXISTS idx_proposal_schedule_unique_week;
CREATE UNIQUE INDEX idx_proposal_schedule_unique_user_week 
ON proposal_schedule(user_id, proposal_id, week_start_date);

-- Update the schedule view to include user information
DROP VIEW IF EXISTS schedule_with_details;
CREATE OR REPLACE VIEW schedule_with_details AS
SELECT 
    'proposal' as item_type,
    ps.id,
    ps.proposal_id::text as item_id,
    ps.proposal_name as title,
    NULL as description,
    ps.week_start_date,
    ps.day_index,
    ps.user_id,
    u.name as created_by,
    ps.created_at,
    ps.updated_at,
    -- Additional proposal details
    om.project_name,
    om.client,
    om.status as proposal_status,
    om.final_amt,
    om.pic,
    om.account_mgr,
    NULL as time,
    NULL as is_all_day,
    NULL as comment
FROM proposal_schedule ps
LEFT JOIN users u ON ps.user_id = u.id
LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid

UNION ALL

SELECT 
    'custom_task' as item_type,
    ct.id,
    ct.task_id as item_id,
    ct.title,
    ct.description,
    ct.week_start_date,
    ct.day_index,
    ct.user_id,
    u.name as created_by,
    ct.created_at,
    ct.updated_at,
    -- Null proposal details
    NULL as project_name,
    NULL as client,
    NULL as proposal_status,
    NULL as final_amt,
    NULL as pic,
    NULL as account_mgr,
    ct.time,
    ct.is_all_day,
    ct.comment
FROM custom_tasks ct
LEFT JOIN users u ON ct.user_id = u.id

ORDER BY week_start_date DESC, day_index, created_at;

-- Update the weekly schedule function to support user filtering
CREATE OR REPLACE FUNCTION get_weekly_schedule_with_tasks(
    week_start DATE,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    day_index INTEGER,
    proposals JSONB,
    custom_tasks JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH proposal_data AS (
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
                    'pic', om.pic,
                    'user_id', ps.user_id,
                    'created_by', u.name,
                    'type', 'proposal'
                )
            ) as proposals
        FROM proposal_schedule ps
        LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
        LEFT JOIN users u ON ps.user_id = u.id
        WHERE ps.week_start_date = week_start
        AND (p_user_id IS NULL OR ps.user_id = p_user_id)
        GROUP BY ps.day_index
    ),
    task_data AS (
        SELECT 
            ct.day_index,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'id', ct.task_id,
                    'title', ct.title,
                    'description', ct.description,
                    'time', ct.time,
                    'isAllDay', ct.is_all_day,
                    'comment', ct.comment,
                    'db_id', ct.id,
                    'user_id', ct.user_id,
                    'created_by', u.name,
                    'type', 'custom'
                )
            ) as custom_tasks
        FROM custom_tasks ct
        LEFT JOIN users u ON ct.user_id = u.id
        WHERE ct.week_start_date = week_start
        AND (p_user_id IS NULL OR ct.user_id = p_user_id)
        GROUP BY ct.day_index
    )
    SELECT 
        COALESCE(pd.day_index, td.day_index) as day_index,
        COALESCE(pd.proposals, '[]'::JSONB) as proposals,
        COALESCE(td.custom_tasks, '[]'::JSONB) as custom_tasks
    FROM proposal_data pd
    FULL OUTER JOIN task_data td ON pd.day_index = td.day_index
    ORDER BY day_index;
END;
$$ LANGUAGE plpgsql;

-- Update the add_proposal_to_schedule function to include user_id
CREATE OR REPLACE FUNCTION add_proposal_to_schedule(
    p_proposal_id UUID,
    p_proposal_name VARCHAR(255),
    p_week_start DATE,
    p_day_index INTEGER,
    p_scheduled_by VARCHAR(50),
    p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert or update the schedule entry
    INSERT INTO proposal_schedule (
        proposal_id, proposal_name, week_start_date, day_index, scheduled_by, user_id
    ) VALUES (
        p_proposal_id, p_proposal_name, p_week_start, p_day_index, p_scheduled_by, p_user_id
    )
    ON CONFLICT (user_id, proposal_id, week_start_date) 
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

-- Update the remove_proposal_from_schedule function to include user_id
CREATE OR REPLACE FUNCTION remove_proposal_from_schedule(
    p_proposal_id UUID,
    p_week_start DATE,
    p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM proposal_schedule 
    WHERE proposal_id = p_proposal_id 
    AND week_start_date = p_week_start
    AND (p_user_id IS NULL OR user_id = p_user_id);
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to get users who have scheduled items
CREATE OR REPLACE FUNCTION get_schedule_users()
RETURNS TABLE (
    user_id UUID,
    user_name VARCHAR(255),
    schedule_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH schedule_users AS (
        SELECT ps.user_id, u.name, COUNT(*) as count
        FROM proposal_schedule ps
        LEFT JOIN users u ON ps.user_id = u.id
        WHERE ps.user_id IS NOT NULL
        GROUP BY ps.user_id, u.name
        
        UNION ALL
        
        SELECT ct.user_id, u.name, COUNT(*) as count
        FROM custom_tasks ct
        LEFT JOIN users u ON ct.user_id = u.id
        WHERE ct.user_id IS NOT NULL
        GROUP BY ct.user_id, u.name
    )
    SELECT 
        su.user_id,
        su.name as user_name,
        SUM(su.count)::INTEGER as schedule_count
    FROM schedule_users su
    WHERE su.user_id IS NOT NULL
    GROUP BY su.user_id, su.name
    ORDER BY schedule_count DESC, user_name;
END;
$$ LANGUAGE plpgsql;

-- Add comments for new functionality
COMMENT ON COLUMN proposal_schedule.user_id IS 'ID of user who owns this scheduled proposal (for user-specific filtering)';
COMMENT ON FUNCTION get_schedule_users() IS 'Returns list of users who have scheduled items for filtering';

-- Verify migration
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_schedules,
    COUNT(user_id) as schedules_with_user_id
FROM proposal_schedule;

SELECT 
    'Indexes updated' as status,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'proposal_schedule' AND indexname LIKE '%user%'; 