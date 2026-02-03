-- Fix Data Swap Migration
-- Purpose: Swap account_mgr and pic columns as they were incorrectly populated

-- First, let's create a backup of the current data
CREATE TABLE IF NOT EXISTS opps_monitoring_backup_swap AS 
SELECT uid, account_mgr, pic, bom, created_at 
FROM opps_monitoring 
WHERE account_mgr IS NOT NULL OR pic IS NOT NULL;

-- Add a temporary column to help with the swap
ALTER TABLE opps_monitoring ADD COLUMN IF NOT EXISTS temp_swap_col VARCHAR(50);

-- Step 1: Store the current account_mgr values in temp column
UPDATE opps_monitoring SET temp_swap_col = account_mgr;

-- Step 2: Move pic values to account_mgr column
UPDATE opps_monitoring SET account_mgr = pic;

-- Step 3: Move temp column (old account_mgr) to pic column  
UPDATE opps_monitoring SET pic = temp_swap_col;

-- Step 4: Clean up the temporary column
ALTER TABLE opps_monitoring DROP COLUMN IF EXISTS temp_swap_col;

-- Verify the swap by showing some sample data
SELECT 
    'After Swap' as status,
    account_mgr, 
    pic, 
    COUNT(*) as count 
FROM opps_monitoring 
WHERE account_mgr IS NOT NULL AND pic IS NOT NULL
GROUP BY account_mgr, pic 
ORDER BY count DESC 
LIMIT 10;

-- Show Account Manager distribution after swap
SELECT 
    'Account Managers (After Swap)' as category,
    account_mgr,
    COUNT(*) as opportunity_count
FROM opps_monitoring 
WHERE account_mgr IS NOT NULL AND account_mgr != ''
GROUP BY account_mgr
ORDER BY opportunity_count DESC;

-- Check which of our defined account managers now have data
SELECT 
    'Correct Account Managers with Data' as status,
    rd.code as account_manager,
    COUNT(om.uid) as opportunity_count
FROM role_definitions rd
LEFT JOIN opps_monitoring om ON rd.code = om.account_mgr
WHERE rd.role_type = 'account_manager' 
AND rd.is_active = TRUE
GROUP BY rd.code
ORDER BY opportunity_count DESC;