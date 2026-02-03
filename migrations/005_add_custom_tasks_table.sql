-- Database Migration: Add Custom Tasks Support
-- File: migrations/005_add_custom_tasks_table.sql
-- Purpose: Create permanent storage for custom tasks in weekly schedule

-- Create custom_tasks table for storing user-created tasks
CREATE TABLE IF NOT EXISTS custom_tasks (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) NOT NULL,      -- Frontend-generated task ID
    user_id UUID,                      -- User who created the task (references users.id)
    week_start_date DATE NOT NULL,     -- Monday of the week (YYYY-MM-DD)
    day_index INTEGER NOT NULL CHECK (day_index BETWEEN 0 AND 6), -- 0=Monday, 6=Sunday
    title VARCHAR(255) NOT NULL,
    description TEXT,
    time VARCHAR(20),                  -- Time string like "09:00" or empty for all-day
    is_all_day BOOLEAN DEFAULT FALSE,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_custom_tasks_task_id ON custom_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_custom_tasks_user_week ON custom_tasks(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_custom_tasks_week_lookup ON custom_tasks(week_start_date, day_index);

-- Create unique constraint for task_id per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_tasks_unique_user_task 
ON custom_tasks(user_id, task_id);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_custom_tasks_updated_at 
    BEFORE UPDATE ON custom_tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_proposal_schedule_timestamp(); -- Reuse existing function

-- Update the schedule view to include custom tasks
DROP VIEW IF EXISTS schedule_with_proposal_details;
CREATE OR REPLACE VIEW schedule_with_details AS
SELECT 
    'proposal' as item_type,
    ps.id,
    ps.proposal_id::text as item_id,
    ps.proposal_name as title,
    NULL as description,
    ps.week_start_date,
    ps.day_index,
    ps.scheduled_by as created_by,
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

-- Update the weekly schedule function to include custom tasks
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
                    'type', 'proposal'
                )
            ) as proposals
        FROM proposal_schedule ps
        LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
        WHERE ps.week_start_date = week_start
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
                    'type', 'custom'
                )
            ) as custom_tasks
        FROM custom_tasks ct
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

-- Create functions for custom task management
CREATE OR REPLACE FUNCTION add_custom_task(
    p_task_id VARCHAR(50),
    p_user_id UUID,
    p_week_start DATE,
    p_day_index INTEGER,
    p_title VARCHAR(255),
    p_description TEXT DEFAULT NULL,
    p_time VARCHAR(20) DEFAULT NULL,
    p_is_all_day BOOLEAN DEFAULT FALSE,
    p_comment TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO custom_tasks (
        task_id, user_id, week_start_date, day_index, title, 
        description, time, is_all_day, comment
    ) VALUES (
        p_task_id, p_user_id, p_week_start, p_day_index, p_title,
        p_description, p_time, p_is_all_day, p_comment
    )
    ON CONFLICT (user_id, task_id) 
    DO UPDATE SET 
        week_start_date = EXCLUDED.week_start_date,
        day_index = EXCLUDED.day_index,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        time = EXCLUDED.time,
        is_all_day = EXCLUDED.is_all_day,
        comment = EXCLUDED.comment,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_custom_task(
    p_task_id VARCHAR(50),
    p_user_id UUID,
    p_title VARCHAR(255),
    p_description TEXT DEFAULT NULL,
    p_time VARCHAR(20) DEFAULT NULL,
    p_is_all_day BOOLEAN DEFAULT FALSE,
    p_comment TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE custom_tasks SET
        title = p_title,
        description = p_description,
        time = p_time,
        is_all_day = p_is_all_day,
        comment = p_comment,
        updated_at = CURRENT_TIMESTAMP
    WHERE task_id = p_task_id AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_custom_task(
    p_task_id VARCHAR(50),
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM custom_tasks 
    WHERE task_id = p_task_id AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION move_custom_task(
    p_task_id VARCHAR(50),
    p_user_id UUID,
    p_new_week_start DATE,
    p_new_day_index INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE custom_tasks SET
        week_start_date = p_new_week_start,
        day_index = p_new_day_index,
        updated_at = CURRENT_TIMESTAMP
    WHERE task_id = p_task_id AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE custom_tasks IS 'Stores user-created custom tasks in weekly calendar schedule';
COMMENT ON COLUMN custom_tasks.task_id IS 'Frontend-generated unique identifier for the task';
COMMENT ON COLUMN custom_tasks.user_id IS 'ID of user who created the task';
COMMENT ON COLUMN custom_tasks.week_start_date IS 'Monday date of the week in YYYY-MM-DD format';
COMMENT ON COLUMN custom_tasks.day_index IS 'Day of week: 0=Monday, 1=Tuesday, ..., 6=Sunday';

COMMENT ON FUNCTION get_weekly_schedule_with_tasks(DATE, UUID) IS 'Returns complete schedule data including proposals and custom tasks for a specific week';
COMMENT ON FUNCTION add_custom_task(VARCHAR, UUID, DATE, INTEGER, VARCHAR, TEXT, VARCHAR, BOOLEAN, TEXT) IS 'Safely adds or updates a custom task';
COMMENT ON FUNCTION update_custom_task(VARCHAR, UUID, VARCHAR, TEXT, VARCHAR, BOOLEAN, TEXT) IS 'Updates an existing custom task';
COMMENT ON FUNCTION delete_custom_task(VARCHAR, UUID) IS 'Deletes a custom task';
COMMENT ON FUNCTION move_custom_task(VARCHAR, UUID, DATE, INTEGER) IS 'Moves a custom task to a different day or week';

-- Verify migration
SELECT 
    'Custom tasks table created successfully' as status,
    COUNT(*) as initial_record_count
FROM custom_tasks;

SELECT 
    'Custom task indexes created' as status,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'custom_tasks'; 