-- Add missing last_excel_sync column to opps_monitoring table
-- This migration adds the column that's required for Google Drive sync functionality

-- Add the last_excel_sync column
ALTER TABLE opps_monitoring 
ADD COLUMN IF NOT EXISTS last_excel_sync TIMESTAMP;

-- Add index for better performance on sync queries
CREATE INDEX IF NOT EXISTS idx_opps_monitoring_last_excel_sync 
ON opps_monitoring(last_excel_sync);

-- Add comment to document the column purpose
COMMENT ON COLUMN opps_monitoring.last_excel_sync IS 'Timestamp of last sync from Excel/Google Drive file';