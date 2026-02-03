-- Database Migration: Add Google Calendar OAuth Support
-- File: migrations/009_add_google_calendar_oauth.sql
-- Purpose: Create tables for Google Calendar OAuth tokens and synced events

-- Create table to store user OAuth tokens for Google Calendar
CREATE TABLE IF NOT EXISTS user_calendar_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,              -- References your user system
    username VARCHAR(50) NOT NULL,      -- For easy lookup
    google_email VARCHAR(255),          -- User's Google email
    access_token TEXT,                  -- Current access token
    refresh_token TEXT NOT NULL,        -- Refresh token (permanent)
    token_expires_at TIMESTAMP,         -- When access token expires
    scope TEXT NOT NULL,                -- Granted scopes
    calendar_id VARCHAR(255),           -- Primary calendar ID
    sync_enabled BOOLEAN DEFAULT TRUE,  -- User can disable sync
    last_sync_at TIMESTAMP,            -- Last successful sync time
    sync_token TEXT,                    -- Google's incremental sync token
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id),                    -- One calendar connection per user
    UNIQUE(username)                    -- Ensure username uniqueness
);

-- Create table to store synced calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,              -- Who owns this calendar event
    google_event_id VARCHAR(255) NOT NULL, -- Google Calendar event ID
    calendar_id VARCHAR(255) NOT NULL,  -- Which calendar it came from
    summary TEXT,                       -- Event title/summary
    description TEXT,                   -- Event description
    start_datetime TIMESTAMP,           -- Event start time
    end_datetime TIMESTAMP,             -- Event end time
    is_all_day BOOLEAN DEFAULT FALSE,   -- All-day event flag
    location TEXT,                      -- Event location
    attendees JSONB,                    -- Event attendees as JSON
    status VARCHAR(50),                 -- confirmed, tentative, cancelled
    visibility VARCHAR(50),             -- public, private, confidential
    event_created_at TIMESTAMP,         -- When event was created in Google
    event_updated_at TIMESTAMP,         -- When event was last updated in Google
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When we synced this event
    is_deleted BOOLEAN DEFAULT FALSE,   -- Soft delete for removed events
    UNIQUE(google_event_id, calendar_id) -- Prevent duplicate events
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_calendar_tokens_user_id ON user_calendar_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_calendar_tokens_username ON user_calendar_tokens(username);
CREATE INDEX IF NOT EXISTS idx_user_calendar_tokens_sync_enabled ON user_calendar_tokens(sync_enabled);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_datetime ON calendar_events(start_datetime, end_datetime);
CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_id ON calendar_events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status, is_deleted);

-- Add trigger to update updated_at timestamp for tokens table
CREATE OR REPLACE FUNCTION update_calendar_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_calendar_tokens_updated_at 
    BEFORE UPDATE ON user_calendar_tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION update_calendar_tokens_timestamp();

-- Create function to get user's calendar events for a date range
CREATE OR REPLACE FUNCTION get_user_calendar_events(
    p_user_id UUID,
    p_start_date TIMESTAMP,
    p_end_date TIMESTAMP
)
RETURNS TABLE (
    event_id VARCHAR(255),
    summary TEXT,
    description TEXT,
    start_datetime TIMESTAMP,
    end_datetime TIMESTAMP,
    is_all_day BOOLEAN,
    location TEXT,
    status VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.google_event_id,
        ce.summary,
        ce.description,
        ce.start_datetime,
        ce.end_datetime,
        ce.is_all_day,
        ce.location,
        ce.status
    FROM calendar_events ce
    WHERE ce.user_id = p_user_id
    AND ce.is_deleted = FALSE
    AND ce.status != 'cancelled'
    AND (
        (ce.start_datetime >= p_start_date AND ce.start_datetime <= p_end_date)
        OR (ce.end_datetime >= p_start_date AND ce.end_datetime <= p_end_date)
        OR (ce.start_datetime <= p_start_date AND ce.end_datetime >= p_end_date)
    )
    ORDER BY ce.start_datetime;
END;
$$ LANGUAGE plpgsql;

-- Create function to get weekly schedule with calendar events
CREATE OR REPLACE FUNCTION get_weekly_schedule_with_calendar(
    p_week_start DATE,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    day_index INTEGER,
    proposals JSONB,
    calendar_events JSONB
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
        WHERE ps.week_start_date = p_week_start
        AND (p_user_id IS NULL OR ps.scheduled_by = (
            SELECT username FROM user_calendar_tokens WHERE user_id = p_user_id
        ))
        GROUP BY ps.day_index
    ),
    calendar_data AS (
        SELECT 
            EXTRACT(DOW FROM ce.start_datetime)::INTEGER as day_index, -- 0=Sunday, 1=Monday...
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'id', ce.google_event_id,
                    'summary', ce.summary,
                    'description', ce.description,
                    'start_datetime', ce.start_datetime,
                    'end_datetime', ce.end_datetime,
                    'is_all_day', ce.is_all_day,
                    'location', ce.location,
                    'type', 'calendar_event'
                )
            ) as calendar_events
        FROM calendar_events ce
        WHERE p_user_id IS NOT NULL 
        AND ce.user_id = p_user_id
        AND ce.is_deleted = FALSE
        AND ce.status != 'cancelled'
        AND ce.start_datetime >= p_week_start::TIMESTAMP
        AND ce.start_datetime < (p_week_start + INTERVAL '7 days')::TIMESTAMP
        GROUP BY EXTRACT(DOW FROM ce.start_datetime)::INTEGER
    ),
    all_days AS (
        SELECT generate_series(0, 6) as day_index
    )
    SELECT 
        ad.day_index,
        COALESCE(pd.proposals, '[]'::JSONB) as proposals,
        COALESCE(cd.calendar_events, '[]'::JSONB) as calendar_events
    FROM all_days ad
    LEFT JOIN proposal_data pd ON ad.day_index = pd.day_index
    LEFT JOIN calendar_data cd ON ad.day_index = cd.day_index
    ORDER BY ad.day_index;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE user_calendar_tokens IS 'Stores OAuth tokens for Google Calendar access per user';
COMMENT ON TABLE calendar_events IS 'Stores synced calendar events from users Google Calendars';
COMMENT ON FUNCTION get_user_calendar_events(UUID, TIMESTAMP, TIMESTAMP) IS 'Retrieves calendar events for a user within date range';
COMMENT ON FUNCTION get_weekly_schedule_with_calendar(DATE, UUID) IS 'Gets combined proposal schedule and calendar events for a week';

-- Verify migration by showing table info
SELECT 
    'user_calendar_tokens table created' as status,
    COUNT(*) as initial_record_count
FROM user_calendar_tokens;

SELECT 
    'calendar_events table created' as status,
    COUNT(*) as initial_record_count
FROM calendar_events;