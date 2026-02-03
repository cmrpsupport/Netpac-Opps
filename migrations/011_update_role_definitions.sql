-- Update Role Definitions Migration
-- Purpose: Update role names and user role structure as requested
-- 1. DS - Digital Solutions, SE - Smart Energy  
-- 2. Replace PM with TM (Technical Manager)
-- 3. Replace Administrator with Office Admin
-- 4. Update user roles to User and System Admin

-- First, let's see what we're working with
SELECT 'Current role definitions before update:' as status;
SELECT code, name, role_type, is_active, is_resigned FROM role_definitions ORDER BY role_type, code;

-- Update existing role definitions if they exist, otherwise skip
-- Note: We're being careful not to break existing data

-- Update any DS references (Design Specialist -> Digital Solutions)
UPDATE role_definitions 
SET name = 'Digital Solutions'
WHERE code = 'DS' AND name LIKE '%Design%';

-- Update any SE references (Sales Engineer -> Smart Energy) 
UPDATE role_definitions
SET name = 'Smart Energy' 
WHERE code = 'SE' AND name LIKE '%Sales%';

-- Handle PM -> TM transition
-- First create TM entries for any existing PM entries
INSERT INTO role_definitions (code, name, role_type, is_active, is_resigned)
SELECT 'TM', 'Technical Manager', role_type, is_active, is_resigned
FROM role_definitions 
WHERE code = 'PM'
ON CONFLICT (code, role_type) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    is_resigned = EXCLUDED.is_resigned;

-- Mark PM entries as deprecated/resigned to maintain historical data
UPDATE role_definitions 
SET is_resigned = TRUE, 
    name = name || ' (Deprecated - now TM)'
WHERE code = 'PM';

-- Handle Administrator -> Office Admin transition
-- Update role names for Administrator to Office Admin
UPDATE role_definitions
SET name = 'Office Admin'
WHERE code = 'Admin' OR name LIKE '%Administrator%';

-- Show updated role definitions
SELECT 'Updated role definitions:' as status;
SELECT code, name, role_type, is_active, is_resigned FROM role_definitions ORDER BY role_type, code;

-- Create a view for user account types mapping
CREATE OR REPLACE VIEW user_account_types AS
SELECT 
    'User' as account_type,
    'Standard user with basic access' as description,
    1 as sort_order
UNION ALL
SELECT 
    'System Admin' as account_type,
    'System administrator with full access' as description,
    2 as sort_order
ORDER BY sort_order;

-- Create function to validate user account types
CREATE OR REPLACE FUNCTION is_valid_account_type(account_type_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN account_type_input IN ('User', 'System Admin');
END;
$$ LANGUAGE plpgsql;

-- Show the new account types
SELECT 'New user account types:' as status;
SELECT account_type, description FROM user_account_types ORDER BY sort_order;

-- Create comprehensive role mappings view for UI components
CREATE OR REPLACE VIEW role_display_names AS
SELECT 
    'DS' as code,
    'Digital Solutions' as display_name,
    'Digital Solutions (DS)' as full_display,
    1 as sort_order
UNION ALL
SELECT 
    'SE' as code,
    'Smart Energy' as display_name,
    'Smart Energy (SE)' as full_display,
    2 as sort_order
UNION ALL
SELECT 
    'AM' as code,
    'Account Manager' as display_name,
    'Account Manager (AM)' as full_display,
    3 as sort_order
UNION ALL
SELECT 
    'TM' as code,
    'Technical Manager' as display_name,
    'Technical Manager (TM)' as full_display,
    4 as sort_order
UNION ALL
SELECT 
    'Office Admin' as code,
    'Office Admin' as display_name,
    'Office Admin' as full_display,
    5 as sort_order
ORDER BY sort_order;

-- Show role mappings for UI
SELECT 'Role display mappings for UI:' as status;
SELECT code, display_name, full_display FROM role_display_names ORDER BY sort_order;

-- Summary of changes
SELECT 'Migration Summary:' as status;
SELECT 
    '✓ DS updated to "Digital Solutions"' as change
UNION ALL
SELECT 
    '✓ SE updated to "Smart Energy"' as change
UNION ALL
SELECT 
    '✓ PM migrated to TM "Technical Manager" (PM marked as deprecated)' as change
UNION ALL
SELECT 
    '✓ Administrator updated to "Office Admin"' as change
UNION ALL
SELECT 
    '✓ User account types updated to "User" and "System Admin"' as change
UNION ALL
SELECT 
    '✓ Created helper views and functions for UI components' as change;