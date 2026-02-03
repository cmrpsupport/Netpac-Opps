-- Fix Role Definitions Migration
-- Purpose: Create proper role tables and fix account manager assignments

-- Create role definition tables
CREATE TABLE IF NOT EXISTS role_definitions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    role_type VARCHAR(20) NOT NULL CHECK (role_type IN ('account_manager', 'pic', 'bom')),
    is_active BOOLEAN DEFAULT TRUE,
    is_resigned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert correct Account Managers (as provided by user)
INSERT INTO role_definitions (code, name, role_type, is_active, is_resigned) VALUES
-- Active Account Managers
('RTR', 'RTR', 'account_manager', TRUE, FALSE),
('LOS', 'LOS', 'account_manager', TRUE, FALSE),
('JMO', 'JMO', 'account_manager', TRUE, FALSE),
('CBD', 'CBD', 'account_manager', TRUE, FALSE),
('ISP', 'ISP', 'account_manager', TRUE, FALSE),
('NSG', 'NSG', 'account_manager', TRUE, FALSE),
('TJC', 'TJC', 'account_manager', TRUE, FALSE),
('JEB', 'JEB', 'account_manager', TRUE, FALSE),
('RJR', 'RJR', 'account_manager', TRUE, FALSE)

ON CONFLICT (code) DO UPDATE SET
    role_type = EXCLUDED.role_type,
    is_active = EXCLUDED.is_active,
    is_resigned = EXCLUDED.is_resigned;

-- Insert PICs (Account Managers + additional PICs)
INSERT INTO role_definitions (code, name, role_type, is_active, is_resigned) VALUES
-- All Account Managers are also PICs
('RTR', 'RTR', 'pic', TRUE, FALSE),
('LOS', 'LOS', 'pic', TRUE, FALSE),
('JMO', 'JMO', 'pic', TRUE, FALSE),
('CBD', 'CBD', 'pic', TRUE, FALSE),
('ISP', 'ISP', 'pic', TRUE, FALSE),
('NSG', 'NSG', 'pic', TRUE, FALSE),
('TJC', 'TJC', 'pic', TRUE, FALSE),
('JEB', 'JEB', 'pic', TRUE, FALSE),
('RJR', 'RJR', 'pic', TRUE, FALSE),
-- Additional PICs (not Account Managers)
('CBG', 'CBG', 'pic', TRUE, FALSE),
('ASB', 'ASB', 'pic', TRUE, FALSE),
('VIB', 'VIB', 'pic', TRUE, FALSE),
-- Resigned PICs (still needed for filtering)
('AVR', 'AVR', 'pic', TRUE, TRUE),
('EIS', 'EIS', 'pic', TRUE, TRUE),
('MMR', 'MMR', 'pic', TRUE, TRUE),
('MRB', 'MRB', 'pic', TRUE, TRUE),
('RPV', 'RPV', 'pic', TRUE, TRUE)

ON CONFLICT (code) DO NOTHING;

-- Insert BOMs (PICs + additional BOMs)
INSERT INTO role_definitions (code, name, role_type, is_active, is_resigned) VALUES
-- All Account Managers are BOMs
('RTR', 'RTR', 'bom', TRUE, FALSE),
('LOS', 'LOS', 'bom', TRUE, FALSE),
('JMO', 'JMO', 'bom', TRUE, FALSE),
('CBD', 'CBD', 'bom', TRUE, FALSE),
('ISP', 'ISP', 'bom', TRUE, FALSE),
('NSG', 'NSG', 'bom', TRUE, FALSE),
('TJC', 'TJC', 'bom', TRUE, FALSE),
('JEB', 'JEB', 'bom', TRUE, FALSE),
('RJR', 'RJR', 'bom', TRUE, FALSE),
-- All PICs are BOMs
('CBG', 'CBG', 'bom', TRUE, FALSE),
('ASB', 'ASB', 'bom', TRUE, FALSE),
('VIB', 'VIB', 'bom', TRUE, FALSE),
('AVR', 'AVR', 'bom', TRUE, TRUE),
('EIS', 'EIS', 'bom', TRUE, TRUE),
('MMR', 'MMR', 'bom', TRUE, TRUE),
('MRB', 'MRB', 'bom', TRUE, TRUE),
('RPV', 'RPV', 'bom', TRUE, TRUE),
-- Additional BOMs
('Partner', 'Partner', 'bom', TRUE, FALSE),
('SubCon', 'SubCon', 'bom', TRUE, FALSE)

ON CONFLICT (code) DO NOTHING;

-- Create view for easy role lookup
CREATE OR REPLACE VIEW role_lookup AS
SELECT 
    code,
    name,
    ARRAY_AGG(role_type ORDER BY role_type) as roles,
    MAX(CASE WHEN is_active THEN 1 ELSE 0 END) = 1 as is_active,
    MAX(CASE WHEN is_resigned THEN 1 ELSE 0 END) = 1 as is_resigned
FROM role_definitions
GROUP BY code, name;

-- Create function to check if someone is an account manager
CREATE OR REPLACE FUNCTION is_account_manager(person_code VARCHAR(10))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM role_definitions 
        WHERE code = person_code 
        AND role_type = 'account_manager' 
        AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to get valid account managers
CREATE OR REPLACE FUNCTION get_account_managers(include_resigned BOOLEAN DEFAULT FALSE)
RETURNS TABLE(code VARCHAR(10), name VARCHAR(100), is_resigned BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT rd.code, rd.name, rd.is_resigned
    FROM role_definitions rd
    WHERE rd.role_type = 'account_manager'
    AND rd.is_active = TRUE
    AND (include_resigned = TRUE OR rd.is_resigned = FALSE)
    ORDER BY rd.is_resigned, rd.code;
END;
$$ LANGUAGE plpgsql;

-- Display the corrected role definitions
SELECT 
    'Account Managers' as category,
    code,
    CASE WHEN is_resigned THEN name || ' (Resigned)' ELSE name END as name
FROM role_definitions 
WHERE role_type = 'account_manager' AND is_active = TRUE
ORDER BY is_resigned, code

UNION ALL

SELECT 
    'PICs Only' as category,
    code,
    CASE WHEN is_resigned THEN name || ' (Resigned)' ELSE name END as name
FROM role_definitions 
WHERE role_type = 'pic' AND is_active = TRUE
AND code NOT IN (SELECT code FROM role_definitions WHERE role_type = 'account_manager' AND is_active = TRUE)
ORDER BY is_resigned, code

UNION ALL

SELECT 
    'BOMs Only' as category,
    code,
    CASE WHEN is_resigned THEN name || ' (Resigned)' ELSE name END as name
FROM role_definitions 
WHERE role_type = 'bom' AND is_active = TRUE
AND code NOT IN (SELECT code FROM role_definitions WHERE role_type IN ('account_manager', 'pic') AND is_active = TRUE)
ORDER BY is_resigned, code;