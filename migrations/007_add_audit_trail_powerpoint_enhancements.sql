-- Audit Trail PowerPoint Enhancement Migration
-- File: migrations/007_add_audit_trail_powerpoint_enhancements.sql
-- Purpose: Add PowerPoint-specific audit trail enhancements for weekly meeting reports

-- 1. Enhance opportunity_revisions table with PowerPoint-specific fields
ALTER TABLE opportunity_revisions 
ADD COLUMN IF NOT EXISTS week_of_change DATE,
ADD COLUMN IF NOT EXISTS submission_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status_progression_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS financial_impact_amount DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS meeting_reportable BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS account_manager_at_time VARCHAR(50),
ADD COLUMN IF NOT EXISTS change_velocity_score INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS client_impact_level VARCHAR(20) DEFAULT 'LOW';

-- 2. Create weekly_change_summaries table
CREATE TABLE IF NOT EXISTS weekly_change_summaries (
    id SERIAL PRIMARY KEY,
    account_manager VARCHAR(50) NOT NULL,
    week_starting_date DATE NOT NULL, -- Every Wednesday
    new_opportunities_count INTEGER DEFAULT 0,
    status_changes_count INTEGER DEFAULT 0,
    submissions_count INTEGER DEFAULT 0,
    financial_changes_amount DECIMAL(15,2) DEFAULT 0,
    high_priority_changes_count INTEGER DEFAULT 0,
    opportunities_advanced INTEGER DEFAULT 0,
    opportunities_regressed INTEGER DEFAULT 0,
    avg_change_velocity DECIMAL(5,2) DEFAULT 1.0,
    total_pipeline_amount DECIMAL(15,2) DEFAULT 0,
    weekly_delta_amount DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_manager, week_starting_date)
);

-- 3. Create meeting_highlights table
CREATE TABLE IF NOT EXISTS meeting_highlights (
    id SERIAL PRIMARY KEY,
    opportunity_uid UUID NOT NULL,
    account_manager VARCHAR(50) NOT NULL,
    meeting_date DATE NOT NULL, -- Wednesday meeting date
    highlight_type VARCHAR(30) NOT NULL, -- 'NEW_SUBMISSION', 'STATUS_CHANGE', etc.
    highlight_priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM', -- 'HIGH', 'MEDIUM', 'LOW'
    presentation_notes TEXT,
    auto_generated BOOLEAN DEFAULT TRUE,
    include_in_report BOOLEAN DEFAULT TRUE,
    financial_impact DECIMAL(15,2),
    status_from VARCHAR(20),
    status_to VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (opportunity_uid) REFERENCES opps_monitoring(uid)
);

-- 4. Create presentation_templates table
CREATE TABLE IF NOT EXISTS presentation_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL UNIQUE,
    slide_structure JSONB NOT NULL, -- Slide layout configuration
    color_scheme JSONB NOT NULL, -- Colors for different statuses
    chart_types JSONB NOT NULL, -- Preferred chart types
    narrative_rules JSONB NOT NULL, -- Rules for text generation
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_week_of_change ON opportunity_revisions(week_of_change);
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_meeting_reportable ON opportunity_revisions(meeting_reportable);
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_submission_flag ON opportunity_revisions(submission_flag);
CREATE INDEX IF NOT EXISTS idx_opportunity_revisions_account_manager_time ON opportunity_revisions(account_manager_at_time);

CREATE INDEX IF NOT EXISTS idx_weekly_change_summaries_account_date ON weekly_change_summaries(account_manager, week_starting_date);
CREATE INDEX IF NOT EXISTS idx_weekly_change_summaries_week_date ON weekly_change_summaries(week_starting_date);

CREATE INDEX IF NOT EXISTS idx_meeting_highlights_account_meeting ON meeting_highlights(account_manager, meeting_date);
CREATE INDEX IF NOT EXISTS idx_meeting_highlights_opportunity ON meeting_highlights(opportunity_uid);
CREATE INDEX IF NOT EXISTS idx_meeting_highlights_priority ON meeting_highlights(highlight_priority, meeting_date);

-- 6. Create function to calculate Wednesday-based business weeks
CREATE OR REPLACE FUNCTION get_wednesday_week_start(input_date DATE) RETURNS DATE AS $$
BEGIN
    -- Calculate Wednesday-to-Tuesday business weeks
    -- Make Wednesday = 0, so we subtract the right number of days
    RETURN input_date - (EXTRACT(DOW FROM input_date) + 4)::INTEGER % 7;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Create function to get last meeting date (previous Wednesday)
CREATE OR REPLACE FUNCTION get_last_meeting_date() RETURNS DATE AS $$
DECLARE
    today DATE := CURRENT_DATE;
    last_wednesday DATE;
BEGIN
    last_wednesday := get_wednesday_week_start(today);
    -- If today is before Wednesday, go back one more week
    IF EXTRACT(DOW FROM today) < 3 THEN
        last_wednesday := last_wednesday - 7;
    END IF;
    RETURN last_wednesday;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to update week_of_change for existing records
CREATE OR REPLACE FUNCTION update_weeks_of_change() RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    UPDATE opportunity_revisions 
    SET week_of_change = get_wednesday_week_start(changed_at::DATE)
    WHERE week_of_change IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to detect status progressions
CREATE OR REPLACE FUNCTION get_status_progression_type(from_status TEXT, to_status TEXT) 
RETURNS VARCHAR(20) AS $$
BEGIN
    -- Define status hierarchy: OP30 < OP60 < OP90 < OP100
    -- Also consider Submitted as progression from any OP status
    
    IF to_status = 'Submitted' AND from_status IN ('OP30', 'OP60', 'OP90', 'OP100') THEN
        RETURN 'FORWARD';
    ELSIF (from_status = 'OP30' AND to_status IN ('OP60', 'OP90', 'OP100')) OR
          (from_status = 'OP60' AND to_status IN ('OP90', 'OP100')) OR
          (from_status = 'OP90' AND to_status = 'OP100') THEN
        RETURN 'FORWARD';
    ELSIF (from_status = 'OP100' AND to_status IN ('OP90', 'OP60', 'OP30')) OR
          (from_status = 'OP90' AND to_status IN ('OP60', 'OP30')) OR
          (from_status = 'OP60' AND to_status = 'OP30') OR
          (to_status IN ('LOST', 'Inactive') AND from_status IN ('OP30', 'OP60', 'OP90', 'OP100')) THEN
        RETURN 'BACKWARD';
    ELSE
        RETURN 'LATERAL';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 10. Create trigger to auto-populate PowerPoint-specific fields
CREATE OR REPLACE FUNCTION populate_powerpoint_audit_fields() RETURNS TRIGGER AS $$
DECLARE
    v_account_manager TEXT;
    v_old_opp_status TEXT;
    v_new_opp_status TEXT;
    v_old_final_amt DECIMAL(15,2);
    v_new_final_amt DECIMAL(15,2);
    v_old_status TEXT;
    v_new_status TEXT;
BEGIN
    -- Set week of change
    NEW.week_of_change := get_wednesday_week_start(NEW.changed_at::DATE);
    
    -- Get account manager at time of change
    SELECT account_mgr INTO v_account_manager 
    FROM opps_monitoring 
    WHERE uid = NEW.opportunity_uid;
    NEW.account_manager_at_time := v_account_manager;
    
    -- Check if this change involves submission
    IF NEW.changed_fields ? 'status' THEN
        v_new_status := (NEW.changed_fields->>'status')::TEXT;
        IF v_new_status = 'Submitted' THEN
            NEW.submission_flag := TRUE;
        END IF;
    END IF;
    
    -- Determine status progression type
    IF NEW.changed_fields ? 'opp_status' THEN
        v_old_opp_status := (NEW.previous_values->>'opp_status')::TEXT;
        v_new_opp_status := (NEW.changed_fields->>'opp_status')::TEXT;
        NEW.status_progression_type := get_status_progression_type(v_old_opp_status, v_new_opp_status);
    END IF;
    
    -- Calculate financial impact
    IF NEW.changed_fields ? 'final_amt' THEN
        v_old_final_amt := COALESCE((NEW.previous_values->>'final_amt')::DECIMAL(15,2), 0);
        v_new_final_amt := COALESCE((NEW.changed_fields->>'final_amt')::DECIMAL(15,2), 0);
        NEW.financial_impact_amount := v_new_final_amt - v_old_final_amt;
    END IF;
    
    -- Set change velocity score (1-10 based on change frequency and impact)
    NEW.change_velocity_score := LEAST(10, GREATEST(1, 
        CASE 
            WHEN NEW.business_impact = 'critical' THEN 8
            WHEN NEW.business_impact = 'high' THEN 6
            WHEN NEW.business_impact = 'medium' THEN 4
            ELSE 2
        END
    ));
    
    -- Set client impact level based on change type and amount
    NEW.client_impact_level := CASE 
        WHEN NEW.change_category = 'FINANCIAL' AND ABS(COALESCE(NEW.financial_impact_amount, 0)) > 100000 THEN 'CRITICAL'
        WHEN NEW.change_category = 'PROJECT_STATUS' AND NEW.status_progression_type = 'BACKWARD' THEN 'HIGH'
        WHEN NEW.change_category IN ('SOLUTION_SCOPE', 'TIMELINE') THEN 'MEDIUM'
        ELSE 'LOW'
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_populate_powerpoint_audit_fields ON opportunity_revisions;
CREATE TRIGGER trigger_populate_powerpoint_audit_fields
    BEFORE INSERT OR UPDATE ON opportunity_revisions
    FOR EACH ROW
    EXECUTE FUNCTION populate_powerpoint_audit_fields();

-- 11. Create function to generate weekly summary data
CREATE OR REPLACE FUNCTION generate_weekly_summary(p_account_manager TEXT, p_week_date DATE)
RETURNS void AS $$
DECLARE
    v_week_start DATE;
    v_week_end DATE;
    v_summary_data RECORD;
BEGIN
    v_week_start := get_wednesday_week_start(p_week_date);
    v_week_end := v_week_start + 6; -- Tuesday of the same week
    
    -- Calculate summary metrics for the week
    SELECT 
        COUNT(CASE WHEN r.changed_at::DATE BETWEEN v_week_start AND v_week_end 
                   AND r.change_category = 'NEW_OPPORTUNITY' THEN 1 END) as new_opps,
        COUNT(CASE WHEN r.changed_at::DATE BETWEEN v_week_start AND v_week_end 
                   AND r.change_category = 'PROJECT_STATUS' THEN 1 END) as status_changes,
        COUNT(CASE WHEN r.changed_at::DATE BETWEEN v_week_start AND v_week_end 
                   AND r.submission_flag = TRUE THEN 1 END) as submissions,
        SUM(CASE WHEN r.changed_at::DATE BETWEEN v_week_start AND v_week_end 
                 THEN COALESCE(r.financial_impact_amount, 0) ELSE 0 END) as financial_changes,
        COUNT(CASE WHEN r.changed_at::DATE BETWEEN v_week_start AND v_week_end 
                   AND r.business_impact IN ('high', 'critical') THEN 1 END) as high_priority,
        COUNT(CASE WHEN r.changed_at::DATE BETWEEN v_week_start AND v_week_end 
                   AND r.status_progression_type = 'FORWARD' THEN 1 END) as advanced,
        COUNT(CASE WHEN r.changed_at::DATE BETWEEN v_week_start AND v_week_end 
                   AND r.status_progression_type = 'BACKWARD' THEN 1 END) as regressed,
        AVG(CASE WHEN r.changed_at::DATE BETWEEN v_week_start AND v_week_end 
                 THEN r.change_velocity_score ELSE NULL END) as avg_velocity
    INTO v_summary_data
    FROM opportunity_revisions r
    WHERE r.account_manager_at_time = p_account_manager;
    
    -- Insert or update summary record
    INSERT INTO weekly_change_summaries (
        account_manager, week_starting_date, new_opportunities_count,
        status_changes_count, submissions_count, financial_changes_amount,
        high_priority_changes_count, opportunities_advanced, opportunities_regressed,
        avg_change_velocity
    ) VALUES (
        p_account_manager, v_week_start, 
        COALESCE(v_summary_data.new_opps, 0),
        COALESCE(v_summary_data.status_changes, 0),
        COALESCE(v_summary_data.submissions, 0),
        COALESCE(v_summary_data.financial_changes, 0),
        COALESCE(v_summary_data.high_priority, 0),
        COALESCE(v_summary_data.advanced, 0),
        COALESCE(v_summary_data.regressed, 0),
        COALESCE(v_summary_data.avg_velocity, 1.0)
    )
    ON CONFLICT (account_manager, week_starting_date) 
    DO UPDATE SET
        new_opportunities_count = EXCLUDED.new_opportunities_count,
        status_changes_count = EXCLUDED.status_changes_count,
        submissions_count = EXCLUDED.submissions_count,
        financial_changes_amount = EXCLUDED.financial_changes_amount,
        high_priority_changes_count = EXCLUDED.high_priority_changes_count,
        opportunities_advanced = EXCLUDED.opportunities_advanced,
        opportunities_regressed = EXCLUDED.opportunities_regressed,
        avg_change_velocity = EXCLUDED.avg_change_velocity,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 12. Create default presentation template
INSERT INTO presentation_templates (
    template_name, slide_structure, color_scheme, chart_types, narrative_rules
) VALUES (
    'Standard Weekly Report',
    '{
        "slides": [
            {"type": "title", "title": "{ACCOUNT_MANAGER} Weekly Report", "subtitle": "Week of {WEEK_DATE}"},
            {"type": "executive_summary", "title": "Executive Summary", "content": ["metrics_table", "key_highlights"]},
            {"type": "submissions", "title": "New Submissions", "content": ["submission_table", "total_value"]},
            {"type": "status_movements", "title": "Status Progressions", "content": ["status_flow", "progression_table"]},
            {"type": "highlights", "title": "This Week''s Highlights", "content": ["highlight_bullets", "callout_boxes"]},
            {"type": "concerns", "title": "Items Requiring Attention", "content": ["red_flags", "action_items"]},
            {"type": "next_week", "title": "Looking Ahead", "content": ["upcoming_deadlines", "expected_submissions"]}
        ]
    }',
    '{
        "OP100": "#22c55e",
        "OP90": "#a7f3d0", 
        "OP60": "#fde047",
        "OP30": "#60a5fa",
        "LOST": "#fca5a5",
        "Inactive": "#9ca3af",
        "Submitted": "#3b82f6",
        "primary": "#1f2937",
        "secondary": "#6b7280",
        "success": "#059669",
        "warning": "#d97706",
        "danger": "#dc2626"
    }',
    '{
        "status_distribution": "pie",
        "trend_analysis": "line",
        "financial_impact": "bar",
        "velocity_tracking": "gauge"
    }',
    '{
        "highlight_rules": {
            "submissions": {"priority": "high", "template": "Submitted {project_name} for {amount}"},
            "large_financial": {"threshold": 50000, "priority": "high", "template": "Major financial change: {change_amount}"},
            "status_regression": {"priority": "medium", "template": "Status moved backward: {project_name} from {old_status} to {new_status}"},
            "new_opportunities": {"priority": "medium", "template": "New opportunity added: {project_name}"}
        }
    }'
) ON CONFLICT (template_name) DO NOTHING;

-- 13. Update existing records with new fields
SELECT update_weeks_of_change() as updated_weeks_count;

-- 14. Add helpful comments
COMMENT ON COLUMN opportunity_revisions.week_of_change IS 'Wednesday-based business week when change occurred';
COMMENT ON COLUMN opportunity_revisions.submission_flag IS 'True if this change involved moving to submitted status';
COMMENT ON COLUMN opportunity_revisions.status_progression_type IS 'FORWARD, BACKWARD, or LATERAL status movement';
COMMENT ON COLUMN opportunity_revisions.financial_impact_amount IS 'Dollar amount of financial change (positive or negative)';
COMMENT ON COLUMN opportunity_revisions.meeting_reportable IS 'Whether this change should appear in meeting reports';
COMMENT ON COLUMN opportunity_revisions.account_manager_at_time IS 'Account manager when the change occurred';
COMMENT ON COLUMN opportunity_revisions.change_velocity_score IS 'Speed/importance score 1-10 for prioritizing in reports';
COMMENT ON COLUMN opportunity_revisions.client_impact_level IS 'Impact level on client: LOW, MEDIUM, HIGH, CRITICAL';

COMMENT ON TABLE weekly_change_summaries IS 'Weekly aggregated metrics for each account manager for PowerPoint reports';
COMMENT ON TABLE meeting_highlights IS 'Important items to highlight in weekly PowerPoint presentations';
COMMENT ON TABLE presentation_templates IS 'PowerPoint slide templates and formatting rules';

COMMENT ON FUNCTION get_wednesday_week_start IS 'Returns the Wednesday that starts the business week for any given date';
COMMENT ON FUNCTION get_last_meeting_date IS 'Returns the date of the previous Wednesday meeting';
COMMENT ON FUNCTION get_status_progression_type IS 'Determines if status change is forward, backward, or lateral progression';
COMMENT ON FUNCTION generate_weekly_summary IS 'Calculates and stores weekly summary metrics for an account manager';