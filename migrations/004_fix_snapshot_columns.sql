-- Fix snapshot columns and constraints
-- Add missing columns for compatibility

-- Add missing columns to account_manager_snapshots if they don't exist
ALTER TABLE account_manager_snapshots 
ADD COLUMN IF NOT EXISTS declined_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS revised_count INTEGER DEFAULT 0;

-- Update any decline_count to declined_count for consistency
UPDATE account_manager_snapshots 
SET declined_count = decline_count 
WHERE decline_count IS NOT NULL AND declined_count IS NULL;

-- Fix the get_nearest_snapshot_date function
DROP FUNCTION IF EXISTS get_nearest_snapshot_date(DATE, VARCHAR(20), VARCHAR(50));

CREATE OR REPLACE FUNCTION get_nearest_snapshot_date(
    p_target_date DATE,
    p_snapshot_type VARCHAR(20),
    p_account_manager VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE(
    snapshot_date DATE,
    days_difference INTEGER,
    is_exact_match BOOLEAN
) AS $$
BEGIN
    IF p_account_manager IS NULL THEN
        -- Global snapshot search
        RETURN QUERY
        SELECT 
            ds.snapshot_date,
            ABS(ds.snapshot_date - p_target_date)::INTEGER as days_difference,
            ds.snapshot_date = p_target_date as is_exact_match
        FROM dashboard_snapshots ds
        WHERE ds.snapshot_type = p_snapshot_type
        ORDER BY ABS(ds.snapshot_date - p_target_date)
        LIMIT 1;
    ELSE
        -- Account manager snapshot search
        RETURN QUERY
        SELECT 
            ams.snapshot_date,
            ABS(ams.snapshot_date - p_target_date)::INTEGER as days_difference,
            ams.snapshot_date = p_target_date as is_exact_match
        FROM account_manager_snapshots ams
        WHERE ams.snapshot_type = p_snapshot_type 
        AND ams.account_manager = p_account_manager
        ORDER BY ABS(ams.snapshot_date - p_target_date)
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Verify fixes
SELECT 'Column fixes completed' as status;