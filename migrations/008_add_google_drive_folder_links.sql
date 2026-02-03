-- Migration: Add Google Drive folder linking support to opportunities
-- Created: 2025-01-12
-- Purpose: Enable linking of opportunities/projects to Google Drive folders

-- Add Google Drive folder columns to opps_monitoring table
ALTER TABLE opps_monitoring 
ADD COLUMN IF NOT EXISTS google_drive_folder_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_drive_folder_url TEXT,
ADD COLUMN IF NOT EXISTS google_drive_folder_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS drive_folder_created_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS drive_folder_created_by VARCHAR(100);

-- Create index for faster folder lookups
CREATE INDEX IF NOT EXISTS idx_opps_monitoring_drive_folder_id 
ON opps_monitoring(google_drive_folder_id);

-- Add comments for documentation
COMMENT ON COLUMN opps_monitoring.google_drive_folder_id IS 'Google Drive folder ID for direct API access';
COMMENT ON COLUMN opps_monitoring.google_drive_folder_url IS 'Human-readable Google Drive folder URL for browser access';
COMMENT ON COLUMN opps_monitoring.google_drive_folder_name IS 'Display name of the Google Drive folder';
COMMENT ON COLUMN opps_monitoring.drive_folder_created_at IS 'Timestamp when the Drive folder was created/linked';
COMMENT ON COLUMN opps_monitoring.drive_folder_created_by IS 'User who created or linked the Drive folder';

-- Create audit trail for Drive folder operations
CREATE TABLE IF NOT EXISTS drive_folder_audit (
    id SERIAL PRIMARY KEY,
    opportunity_uid UUID NOT NULL REFERENCES opps_monitoring(uid),
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('CREATED', 'LINKED', 'UPDATED', 'DELETED', 'PERMISSIONS_CHANGED')),
    folder_id VARCHAR(255),
    folder_url TEXT,
    folder_name VARCHAR(255),
    performed_by VARCHAR(100) NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    operation_details JSONB DEFAULT '{}',
    CONSTRAINT fk_drive_audit_opportunity FOREIGN KEY (opportunity_uid) REFERENCES opps_monitoring(uid) ON DELETE CASCADE
);

-- Create index for audit trail queries
CREATE INDEX IF NOT EXISTS idx_drive_folder_audit_opportunity_uid 
ON drive_folder_audit(opportunity_uid);

CREATE INDEX IF NOT EXISTS idx_drive_folder_audit_performed_at 
ON drive_folder_audit(performed_at);

-- Insert initial audit records for any existing Drive folder data (if any)
-- This is safe to run even if no existing data exists
INSERT INTO drive_folder_audit (opportunity_uid, operation_type, folder_id, folder_url, folder_name, performed_by, operation_details)
SELECT 
    uid,
    'LINKED' as operation_type,
    google_drive_folder_id,
    google_drive_folder_url,
    google_drive_folder_name,
    COALESCE(drive_folder_created_by, 'SYSTEM_MIGRATION') as performed_by,
    '{"source": "migration", "migration_script": "008_add_google_drive_folder_links.sql"}'::jsonb as operation_details
FROM opps_monitoring 
WHERE google_drive_folder_id IS NOT NULL;

-- Create function to automatically log Drive folder changes
CREATE OR REPLACE FUNCTION log_drive_folder_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log folder creation/linking
    IF OLD.google_drive_folder_id IS NULL AND NEW.google_drive_folder_id IS NOT NULL THEN
        INSERT INTO drive_folder_audit (
            opportunity_uid, operation_type, folder_id, folder_url, folder_name, 
            performed_by, operation_details
        ) VALUES (
            NEW.uid, 
            CASE WHEN NEW.drive_folder_created_at > NOW() - INTERVAL '1 minute' THEN 'CREATED' ELSE 'LINKED' END,
            NEW.google_drive_folder_id,
            NEW.google_drive_folder_url,
            NEW.google_drive_folder_name,
            COALESCE(NEW.drive_folder_created_by, 'UNKNOWN'),
            '{}'::jsonb
        );
    END IF;
    
    -- Log folder updates
    IF OLD.google_drive_folder_id IS NOT NULL AND NEW.google_drive_folder_id IS NOT NULL 
       AND (OLD.google_drive_folder_id != NEW.google_drive_folder_id 
            OR OLD.google_drive_folder_url != NEW.google_drive_folder_url
            OR OLD.google_drive_folder_name != NEW.google_drive_folder_name) THEN
        INSERT INTO drive_folder_audit (
            opportunity_uid, operation_type, folder_id, folder_url, folder_name, 
            performed_by, operation_details
        ) VALUES (
            NEW.uid, 'UPDATED',
            NEW.google_drive_folder_id,
            NEW.google_drive_folder_url,
            NEW.google_drive_folder_name,
            COALESCE(NEW.drive_folder_created_by, 'UNKNOWN'),
            jsonb_build_object(
                'old_folder_id', OLD.google_drive_folder_id,
                'old_folder_url', OLD.google_drive_folder_url,
                'old_folder_name', OLD.google_drive_folder_name
            )
        );
    END IF;
    
    -- Log folder removal
    IF OLD.google_drive_folder_id IS NOT NULL AND NEW.google_drive_folder_id IS NULL THEN
        INSERT INTO drive_folder_audit (
            opportunity_uid, operation_type, folder_id, folder_url, folder_name, 
            performed_by, operation_details
        ) VALUES (
            NEW.uid, 'DELETED',
            OLD.google_drive_folder_id,
            OLD.google_drive_folder_url,
            OLD.google_drive_folder_name,
            COALESCE(NEW.drive_folder_created_by, 'UNKNOWN'),
            '{}'::jsonb
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic Drive folder audit logging
DROP TRIGGER IF EXISTS trigger_log_drive_folder_changes ON opps_monitoring;
CREATE TRIGGER trigger_log_drive_folder_changes
    AFTER UPDATE ON opps_monitoring
    FOR EACH ROW
    EXECUTE FUNCTION log_drive_folder_changes();

-- Add constraint to ensure folder ID format is valid (Google Drive folder IDs are typically 33 characters)
ALTER TABLE opps_monitoring 
ADD CONSTRAINT check_drive_folder_id_format 
CHECK (google_drive_folder_id IS NULL OR length(google_drive_folder_id) > 10);

-- Migration completed successfully
SELECT 'Migration 008: Google Drive folder linking support added successfully' as migration_status;