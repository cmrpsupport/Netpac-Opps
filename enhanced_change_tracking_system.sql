-- Enhanced Change Tracking System with Solution Categorization
-- Building on the existing opportunity_revisions table

-- 1. Extend opportunity_revisions table with categorization fields
ALTER TABLE opportunity_revisions 
ADD COLUMN IF NOT EXISTS change_category TEXT,
ADD COLUMN IF NOT EXISTS change_type TEXT,
ADD COLUMN IF NOT EXISTS business_impact TEXT,
ADD COLUMN IF NOT EXISTS solution_category TEXT,
ADD COLUMN IF NOT EXISTS change_magnitude TEXT DEFAULT 'minor',
ADD COLUMN IF NOT EXISTS automated_tags JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS change_context JSONB DEFAULT '{}';

-- 2. Create change categories lookup table
CREATE TABLE IF NOT EXISTS change_categories (
    id SERIAL PRIMARY KEY,
    category_name TEXT UNIQUE NOT NULL,
    description TEXT,
    priority_level INTEGER DEFAULT 1, -- 1=Low, 2=Medium, 3=High, 4=Critical
    requires_approval BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create change types lookup table
CREATE TABLE IF NOT EXISTS change_types (
    id SERIAL PRIMARY KEY,
    type_name TEXT UNIQUE NOT NULL,
    category_id INTEGER REFERENCES change_categories(id),
    description TEXT,
    expected_fields JSONB DEFAULT '[]', -- Which fields typically change for this type
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Insert standard change categories
INSERT INTO change_categories (category_name, description, priority_level, requires_approval) VALUES
('FINANCIAL', 'Changes to financial fields (amounts, margins, etc.)', 3, TRUE),
('TIMELINE', 'Changes to dates and deadlines', 2, FALSE),
('SOLUTION_SCOPE', 'Changes to solution type or scope', 3, TRUE),
('CLIENT_DETAILS', 'Changes to client information', 2, FALSE),
('PROJECT_STATUS', 'Changes to project status or opportunity status', 3, TRUE),
('TECHNICAL_SPECS', 'Changes to technical specifications', 2, FALSE),
('PERSONNEL', 'Changes to assigned personnel', 2, FALSE),
('DOCUMENTATION', 'Changes to comments, remarks, or documentation', 1, FALSE),
('SOLUTION_CATEGORY', 'Changes between solution categories (Electrification, Automation, Digitalization)', 4, TRUE),
('REVISION_CONTROL', 'Changes to revision numbers', 2, FALSE)
ON CONFLICT (category_name) DO NOTHING;

-- 5. Insert standard change types
INSERT INTO change_types (type_name, category_id, description, expected_fields) VALUES
-- Financial changes
('AMOUNT_INCREASE', (SELECT id FROM change_categories WHERE category_name = 'FINANCIAL'), 'Final amount increased', '["final_amt"]'),
('AMOUNT_DECREASE', (SELECT id FROM change_categories WHERE category_name = 'FINANCIAL'), 'Final amount decreased', '["final_amt"]'),
('MARGIN_ADJUSTMENT', (SELECT id FROM change_categories WHERE category_name = 'FINANCIAL'), 'Margin percentage adjusted', '["margin"]'),

-- Timeline changes
('DEADLINE_EXTENSION', (SELECT id FROM change_categories WHERE category_name = 'TIMELINE'), 'Client deadline extended', '["client_deadline"]'),
('DEADLINE_ACCELERATION', (SELECT id FROM change_categories WHERE category_name = 'TIMELINE'), 'Client deadline moved earlier', '["client_deadline"]'),
('SUBMISSION_DATE_UPDATE', (SELECT id FROM change_categories WHERE category_name = 'TIMELINE'), 'Submission date modified', '["submitted_date"]'),
('FORECAST_ADJUSTMENT', (SELECT id FROM change_categories WHERE category_name = 'TIMELINE'), 'Forecast date adjusted', '["forecast_date"]'),

-- Solution scope changes
('SOLUTION_TYPE_CHANGE', (SELECT id FROM change_categories WHERE category_name = 'SOLUTION_SCOPE'), 'Solution type changed', '["solutions"]'),
('SOLUTION_DETAILS_UPDATE', (SELECT id FROM change_categories WHERE category_name = 'SOLUTION_SCOPE'), 'Solution particulars updated', '["sol_particulars"]'),
('INDUSTRY_FOCUS_CHANGE', (SELECT id FROM change_categories WHERE category_name = 'SOLUTION_SCOPE'), 'Industry focus changed', '["industries", "ind_particulars"]'),

-- Client changes
('CLIENT_CHANGE', (SELECT id FROM change_categories WHERE category_name = 'CLIENT_DETAILS'), 'Client organization changed', '["client"]'),
('PROJECT_RENAME', (SELECT id FROM change_categories WHERE category_name = 'CLIENT_DETAILS'), 'Project name updated', '["project_name"]'),
('PROJECT_CODE_UPDATE', (SELECT id FROM change_categories WHERE category_name = 'CLIENT_DETAILS'), 'Project code modified', '["project_code"]'),

-- Status changes
('STATUS_PROGRESSION', (SELECT id FROM change_categories WHERE category_name = 'PROJECT_STATUS'), 'Opportunity status progressed', '["opp_status"]'),
('STATUS_REGRESSION', (SELECT id FROM change_categories WHERE category_name = 'PROJECT_STATUS'), 'Opportunity status moved backward', '["opp_status"]'),
('DECISION_UPDATE', (SELECT id FROM change_categories WHERE category_name = 'PROJECT_STATUS'), 'Decision status changed', '["decision"]'),
('GENERAL_STATUS_UPDATE', (SELECT id FROM change_categories WHERE category_name = 'PROJECT_STATUS'), 'General status updated', '["status"]'),

-- Personnel changes
('ACCOUNT_MANAGER_CHANGE', (SELECT id FROM change_categories WHERE category_name = 'PERSONNEL'), 'Account manager reassigned', '["account_mgr"]'),
('PIC_CHANGE', (SELECT id FROM change_categories WHERE category_name = 'PERSONNEL'), 'Person in charge changed', '["pic"]'),
('BOM_OWNER_CHANGE', (SELECT id FROM change_categories WHERE category_name = 'PERSONNEL'), 'BOM owner changed', '["bom"]'),

-- Solution category changes (High priority)
('ELECTRIFICATION_TO_AUTOMATION', (SELECT id FROM change_categories WHERE category_name = 'SOLUTION_CATEGORY'), 'Changed from Electrification to Automation', '["solutions"]'),
('AUTOMATION_TO_DIGITALIZATION', (SELECT id FROM change_categories WHERE category_name = 'SOLUTION_CATEGORY'), 'Changed from Automation to Digitalization', '["solutions"]'),
('DIGITALIZATION_TO_ELECTRIFICATION', (SELECT id FROM change_categories WHERE category_name = 'SOLUTION_CATEGORY'), 'Changed from Digitalization to Electrification', '["solutions"]'),
('SOLUTION_CATEGORY_OTHER', (SELECT id FROM change_categories WHERE category_name = 'SOLUTION_CATEGORY'), 'Solution category changed to other type', '["solutions"]'),

-- Revision control
('REVISION_INCREMENT', (SELECT id FROM change_categories WHERE category_name = 'REVISION_CONTROL'), 'Revision number incremented', '["rev"]'),
('REVISION_ROLLBACK', (SELECT id FROM change_categories WHERE category_name = 'REVISION_CONTROL'), 'Revision number rolled back', '["rev"]')

ON CONFLICT (type_name) DO NOTHING;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_change_category ON opportunity_revisions(change_category);
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_solution_category ON opportunity_revisions(solution_category);
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_change_type ON opportunity_revisions(change_type);
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_business_impact ON opportunity_revisions(business_impact);
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_change_magnitude ON opportunity_revisions(change_magnitude);

-- 7. Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_categorized_search 
ON opportunity_revisions(solution_category, change_category, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_impact_analysis 
ON opportunity_revisions(business_impact, change_magnitude, changed_at DESC);

-- 8. Create a view for comprehensive change analysis
CREATE OR REPLACE VIEW change_analysis_summary AS
SELECT 
    r.opportunity_uid,
    r.revision_number,
    r.changed_by,
    r.changed_at,
    r.change_category,
    r.change_type,
    r.solution_category,
    r.business_impact,
    r.change_magnitude,
    cc.priority_level,
    cc.requires_approval,
    ct.description as change_type_description,
    -- Parse changed fields for analysis
    jsonb_object_keys(r.changed_fields::jsonb) as changed_field_names,
    -- Calculate change impact score
    CASE 
        WHEN r.business_impact = 'critical' THEN 4
        WHEN r.business_impact = 'high' THEN 3
        WHEN r.business_impact = 'medium' THEN 2
        ELSE 1
    END as impact_score,
    -- Extract solution category from actual data
    CASE 
        WHEN o.solutions ILIKE '%electrification%' OR o.solutions ILIKE '%electric%' THEN 'ELECTRIFICATION'
        WHEN o.solutions ILIKE '%automation%' OR o.solutions ILIKE '%auto%' THEN 'AUTOMATION'
        WHEN o.solutions ILIKE '%digitalization%' OR o.solutions ILIKE '%digital%' OR o.solutions ILIKE '%it%' THEN 'DIGITALIZATION'
        ELSE 'OTHER'
    END as current_solution_category,
    o.final_amt,
    o.opp_status,
    o.project_name,
    o.client
FROM opportunity_revisions r
LEFT JOIN change_categories cc ON r.change_category = cc.category_name
LEFT JOIN change_types ct ON r.change_type = ct.type_name
LEFT JOIN opps_monitoring o ON r.opportunity_uid = o.uid;

-- 9. Create stored procedure for automated change categorization
CREATE OR REPLACE FUNCTION categorize_change(
    p_changed_fields JSONB,
    p_opportunity_uid UUID
) RETURNS TABLE(
    change_category TEXT,
    change_type TEXT,
    business_impact TEXT,
    solution_category TEXT,
    change_magnitude TEXT,
    automated_tags JSONB
) AS $$
DECLARE
    v_change_category TEXT := 'GENERAL';
    v_change_type TEXT := 'FIELD_UPDATE';
    v_business_impact TEXT := 'low';
    v_solution_category TEXT := 'OTHER';
    v_change_magnitude TEXT := 'minor';
    v_automated_tags JSONB := '{}';
    v_field_name TEXT;
    v_current_solution TEXT;
BEGIN
    -- Get current solution for the opportunity
    SELECT solutions INTO v_current_solution 
    FROM opps_monitoring 
    WHERE uid = p_opportunity_uid;
    
    -- Determine solution category
    IF v_current_solution ILIKE '%electrification%' OR v_current_solution ILIKE '%electric%' THEN
        v_solution_category := 'ELECTRIFICATION';
    ELSIF v_current_solution ILIKE '%automation%' OR v_current_solution ILIKE '%auto%' THEN
        v_solution_category := 'AUTOMATION';
    ELSIF v_current_solution ILIKE '%digitalization%' OR v_current_solution ILIKE '%digital%' OR v_current_solution ILIKE '%it%' THEN
        v_solution_category := 'DIGITALIZATION';
    END IF;
    
    -- Analyze each changed field
    FOR v_field_name IN SELECT jsonb_object_keys(p_changed_fields)
    LOOP
        -- Financial fields
        IF v_field_name IN ('final_amt', 'margin') THEN
            v_change_category := 'FINANCIAL';
            v_business_impact := 'high';
            v_change_magnitude := 'major';
            
        -- Timeline fields
        ELSIF v_field_name IN ('client_deadline', 'submitted_date', 'forecast_date') THEN
            v_change_category := 'TIMELINE';
            v_business_impact := 'medium';
            v_change_magnitude := 'moderate';
            
        -- Solution fields
        ELSIF v_field_name IN ('solutions', 'sol_particulars') THEN
            v_change_category := 'SOLUTION_SCOPE';
            v_business_impact := 'high';
            v_change_magnitude := 'major';
            
        -- Status fields
        ELSIF v_field_name IN ('opp_status', 'status', 'decision') THEN
            v_change_category := 'PROJECT_STATUS';
            v_business_impact := 'high';
            v_change_magnitude := 'major';
            
        -- Personnel fields
        ELSIF v_field_name IN ('account_mgr', 'pic', 'bom') THEN
            v_change_category := 'PERSONNEL';
            v_business_impact := 'medium';
            v_change_magnitude := 'moderate';
            
        -- Client fields
        ELSIF v_field_name IN ('client', 'project_name', 'project_code') THEN
            v_change_category := 'CLIENT_DETAILS';
            v_business_impact := 'medium';
            v_change_magnitude := 'moderate';
            
        -- Revision field
        ELSIF v_field_name = 'rev' THEN
            v_change_category := 'REVISION_CONTROL';
            v_business_impact := 'medium';
            v_change_magnitude := 'moderate';
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_change_category,
        v_change_type,
        v_business_impact,
        v_solution_category,
        v_change_magnitude,
        '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to update revision categories retroactively
CREATE OR REPLACE FUNCTION update_revision_categories() RETURNS INTEGER AS $$
DECLARE
    v_revision_record RECORD;
    v_categorization RECORD;
    v_updated_count INTEGER := 0;
BEGIN
    FOR v_revision_record IN 
        SELECT opportunity_uid, revision_number, changed_fields
        FROM opportunity_revisions 
        WHERE change_category IS NULL 
        AND changed_fields IS NOT NULL
        AND changed_fields::TEXT != '{}'
    LOOP
        -- Get categorization for this revision
        SELECT * INTO v_categorization 
        FROM categorize_change(
            v_revision_record.changed_fields::JSONB, 
            v_revision_record.opportunity_uid
        );
        
        -- Update the revision record
        UPDATE opportunity_revisions 
        SET 
            change_category = v_categorization.change_category,
            change_type = v_categorization.change_type,
            business_impact = v_categorization.business_impact,
            solution_category = v_categorization.solution_category,
            change_magnitude = v_categorization.change_magnitude,
            automated_tags = v_categorization.automated_tags
        WHERE 
            opportunity_uid = v_revision_record.opportunity_uid 
            AND revision_number = v_revision_record.revision_number;
            
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger to auto-categorize new changes
CREATE OR REPLACE FUNCTION auto_categorize_revision() RETURNS TRIGGER AS $$
DECLARE
    v_categorization RECORD;
BEGIN
    -- Only categorize if changed_fields is not empty and category is not already set
    IF NEW.changed_fields IS NOT NULL 
       AND NEW.changed_fields::TEXT != '{}' 
       AND NEW.change_category IS NULL THEN
        
        -- Get automatic categorization
        SELECT * INTO v_categorization 
        FROM categorize_change(
            NEW.changed_fields::JSONB, 
            NEW.opportunity_uid
        );
        
        -- Apply categorization
        NEW.change_category := v_categorization.change_category;
        NEW.change_type := v_categorization.change_type;
        NEW.business_impact := v_categorization.business_impact;
        NEW.solution_category := v_categorization.solution_category;
        NEW.change_magnitude := v_categorization.change_magnitude;
        NEW.automated_tags := v_categorization.automated_tags;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_categorize_revision ON opportunity_revisions;
CREATE TRIGGER trigger_auto_categorize_revision
    BEFORE INSERT OR UPDATE ON opportunity_revisions
    FOR EACH ROW
    EXECUTE FUNCTION auto_categorize_revision();

-- 12. Create summary views for reporting
CREATE OR REPLACE VIEW solution_category_change_summary AS
SELECT 
    solution_category,
    change_category,
    change_type,
    COUNT(*) as change_count,
    COUNT(DISTINCT opportunity_uid) as affected_opportunities,
    AVG(CASE 
        WHEN business_impact = 'critical' THEN 4
        WHEN business_impact = 'high' THEN 3
        WHEN business_impact = 'medium' THEN 2
        ELSE 1
    END) as avg_impact_score,
    MIN(changed_at) as first_change,
    MAX(changed_at) as latest_change
FROM opportunity_revisions
WHERE change_category IS NOT NULL
GROUP BY solution_category, change_category, change_type
ORDER BY solution_category, change_count DESC;

CREATE OR REPLACE VIEW high_impact_changes AS
SELECT 
    r.opportunity_uid,
    o.project_name,
    o.client,
    o.solutions,
    r.revision_number,
    r.changed_by,
    r.changed_at,
    r.change_category,
    r.change_type,
    r.business_impact,
    r.solution_category,
    r.changed_fields
FROM opportunity_revisions r
JOIN opps_monitoring o ON r.opportunity_uid = o.uid
WHERE r.business_impact IN ('high', 'critical')
ORDER BY r.changed_at DESC;

-- 13. Run initial categorization for existing data
SELECT update_revision_categories() as updated_revision_count;

-- 14. Add helpful comments
COMMENT ON TABLE change_categories IS 'Lookup table for categorizing types of changes made to opportunities';
COMMENT ON TABLE change_types IS 'Specific types of changes within each category';
COMMENT ON COLUMN opportunity_revisions.change_category IS 'High-level category of the change (FINANCIAL, TIMELINE, etc.)';
COMMENT ON COLUMN opportunity_revisions.change_type IS 'Specific type of change within the category';
COMMENT ON COLUMN opportunity_revisions.business_impact IS 'Business impact level: low, medium, high, critical';
COMMENT ON COLUMN opportunity_revisions.solution_category IS 'Solution category: ELECTRIFICATION, AUTOMATION, DIGITALIZATION, OTHER';
COMMENT ON COLUMN opportunity_revisions.change_magnitude IS 'Magnitude of change: minor, moderate, major';
COMMENT ON COLUMN opportunity_revisions.automated_tags IS 'JSON object containing automated analysis tags';
COMMENT ON COLUMN opportunity_revisions.change_context IS 'Additional contextual information about the change';

COMMENT ON VIEW change_analysis_summary IS 'Comprehensive view for analyzing changes with categorization and impact scoring';
COMMENT ON VIEW solution_category_change_summary IS 'Summary of changes grouped by solution category and change type';
COMMENT ON VIEW high_impact_changes IS 'View showing only high and critical impact changes for management review';

COMMENT ON FUNCTION categorize_change IS 'Automatically categorizes changes based on field changes and business rules';
COMMENT ON FUNCTION update_revision_categories IS 'Retroactively categorizes existing revision records'; 