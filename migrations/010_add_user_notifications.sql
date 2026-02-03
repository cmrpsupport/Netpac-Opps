-- Add user notifications system
-- Migration: 010_add_user_notifications.sql

-- Create user notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opportunity_uid UUID REFERENCES opps_monitoring(uid) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'pic_assignment', 'bom_assignment', 'account_mgr_assignment', 'mention', 'status_change', 'deadline_alert'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional structured data (e.g., old_value, new_value, mention_context)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    read_at TIMESTAMP NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_opportunity_uid ON user_notifications(opportunity_uid);

-- Create composite index for common queries (unread notifications for a user)
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread 
ON user_notifications(user_id, is_read, created_at DESC) 
WHERE is_read = false;

-- Create notification types enum for reference (not enforced, just documentation)
COMMENT ON COLUMN user_notifications.type IS 'Notification types: pic_assignment, bom_assignment, account_mgr_assignment, mention, status_change, deadline_alert, submission_reminder, decision_update, financial_update, drive_activity, revision_update';

-- Create function to automatically update read_at timestamp
CREATE OR REPLACE FUNCTION update_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read = true AND OLD.is_read = false THEN
        NEW.read_at = NOW();
    ELSIF NEW.is_read = false THEN
        NEW.read_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update read_at
DROP TRIGGER IF EXISTS trigger_update_notification_read_at ON user_notifications;
CREATE TRIGGER trigger_update_notification_read_at
    BEFORE UPDATE ON user_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_read_at();

-- Verify the table was created successfully
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_notifications' 
ORDER BY ordinal_position;