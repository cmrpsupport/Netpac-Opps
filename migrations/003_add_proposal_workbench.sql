-- Add proposal_status column to opps_monitoring table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'opps_monitoring' AND column_name = 'proposal_status') THEN
        ALTER TABLE opps_monitoring 
        ADD COLUMN proposal_status VARCHAR(20) CHECK (proposal_status IN ('not_started', 'ongoing', 'for_approval', 'submitted'));
    END IF;
END $$;

-- Create proposal_schedule table if it doesn't exist
CREATE TABLE IF NOT EXISTS proposal_schedule (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    proposal_id VARCHAR(36) NOT NULL,
    day_index INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT proposal_schedule_user_proposal_unique UNIQUE (user_id, proposal_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_proposal_schedule_user_id ON proposal_schedule(user_id);
CREATE INDEX IF NOT EXISTS idx_proposal_schedule_proposal_id ON proposal_schedule(proposal_id);

-- Set default proposal_status based on existing data
UPDATE opps_monitoring
SET proposal_status = 
    CASE 
        WHEN submitted_date IS NOT NULL THEN 'submitted'
        ELSE 'not_started'
    END
WHERE proposal_status IS NULL;

-- Add revision column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'opps_monitoring' AND column_name = 'revision') THEN
        ALTER TABLE opps_monitoring 
        ADD COLUMN revision VARCHAR(20);
    END IF;
END $$; 