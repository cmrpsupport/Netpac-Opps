/**
 * Automated Highlight Detection System
 * Identifies important changes for PowerPoint presentations
 */

const { Pool } = require('pg');
const { getBusinessWeek, getLastMeetingDate, formatCurrency } = require('./meeting-dates');

/**
 * Detect and generate meeting highlights for an account manager
 * @param {string} accountManager - Account manager name
 * @param {Date} meetingDate - Wednesday meeting date
 * @returns {Promise<Array>} - Array of highlight objects
 */
async function detectMeetingHighlights(accountManager, meetingDate) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    const highlights = [];
    
    try {
        // Get changes since last meeting
        const weekStart = getBusinessWeek(meetingDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        // New submissions (always highlight - HIGH priority)
        const submissions = await getSubmissionsThisWeek(pool, accountManager, weekStart, weekEnd);
        submissions.forEach(opp => {
            highlights.push({
                opportunity_uid: opp.uid,
                account_manager: accountManager,
                meeting_date: meetingDate,
                highlight_type: 'NEW_SUBMISSION',
                highlight_priority: 'HIGH',
                presentation_notes: generateSubmissionNote(opp),
                auto_generated: true,
                include_in_report: true,
                financial_impact: opp.final_amt,
                status_from: opp.previous_status,
                status_to: 'Submitted'
            });
        });
        
        // Significant status progressions (MEDIUM to HIGH priority)
        const progressions = await getStatusProgressions(pool, accountManager, weekStart, weekEnd);
        progressions.forEach(change => {
            if (isSignificantProgression(change.from_status, change.to_status)) {
                highlights.push({
                    opportunity_uid: change.opportunity_uid,
                    account_manager: accountManager,
                    meeting_date: meetingDate,
                    highlight_type: 'STATUS_PROGRESSION',
                    highlight_priority: calculateProgressionPriority(change),
                    presentation_notes: generateProgressionNarrative(change),
                    auto_generated: true,
                    include_in_report: true,
                    financial_impact: change.final_amt,
                    status_from: change.from_status,
                    status_to: change.to_status
                });
            }
        });
        
        // Major financial changes (HIGH priority if > $100K)
        const financialChanges = await getFinancialChanges(pool, accountManager, weekStart, weekEnd);
        financialChanges.forEach(change => {
            const impact = Math.abs(change.financial_impact_amount || 0);
            if (impact > 50000) { // $50K+ changes
                highlights.push({
                    opportunity_uid: change.opportunity_uid,
                    account_manager: accountManager,
                    meeting_date: meetingDate,
                    highlight_type: 'FINANCIAL_CHANGE',
                    highlight_priority: impact > 100000 ? 'HIGH' : 'MEDIUM',
                    presentation_notes: generateFinancialChangeNote(change),
                    auto_generated: true,
                    include_in_report: true,
                    financial_impact: change.financial_impact_amount,
                    status_from: null,
                    status_to: null
                });
            }
        });
        
        // New opportunities (MEDIUM priority)
        const newOpportunities = await getNewOpportunities(pool, accountManager, weekStart, weekEnd);
        newOpportunities.forEach(opp => {
            highlights.push({
                opportunity_uid: opp.uid,
                account_manager: accountManager,
                meeting_date: meetingDate,
                highlight_type: 'NEW_OPPORTUNITY',
                highlight_priority: 'MEDIUM',
                presentation_notes: generateNewOpportunityNote(opp),
                auto_generated: true,
                include_in_report: true,
                financial_impact: opp.final_amt,
                status_from: null,
                status_to: opp.opp_status
            });
        });
        
        // Concerning changes (HIGH priority)
        const concerns = await getConcerningChanges(pool, accountManager, weekStart, weekEnd);
        concerns.forEach(change => {
            highlights.push({
                opportunity_uid: change.opportunity_uid,
                account_manager: accountManager,
                meeting_date: meetingDate,
                highlight_type: 'CONCERN',
                highlight_priority: 'HIGH',
                presentation_notes: generateConcernNote(change),
                auto_generated: true,
                include_in_report: true,
                financial_impact: change.final_amt,
                status_from: change.from_status,
                status_to: change.to_status
            });
        });
        
        // Deadline impacts (MEDIUM to HIGH priority)
        const deadlineChanges = await getDeadlineChanges(pool, accountManager, weekStart, weekEnd);
        deadlineChanges.forEach(change => {
            highlights.push({
                opportunity_uid: change.opportunity_uid,
                account_manager: accountManager,
                meeting_date: meetingDate,
                highlight_type: 'DEADLINE_CHANGE',
                highlight_priority: calculateDeadlinePriority(change),
                presentation_notes: generateDeadlineChangeNote(change),
                auto_generated: true,
                include_in_report: true,
                financial_impact: change.final_amt,
                status_from: null,
                status_to: null
            });
        });
        
        // Sort by priority and financial impact
        highlights.sort((a, b) => {
            const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            const priorityDiff = priorityOrder[b.highlight_priority] - priorityOrder[a.highlight_priority];
            if (priorityDiff !== 0) return priorityDiff;
            
            // Secondary sort by financial impact
            const aImpact = Math.abs(a.financial_impact || 0);
            const bImpact = Math.abs(b.financial_impact || 0);
            return bImpact - aImpact;
        });
        
        return highlights.slice(0, 15); // Limit to top 15 highlights
        
    } catch (error) {
        console.error('Error detecting meeting highlights:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

/**
 * Get submissions for the week
 */
async function getSubmissionsThisWeek(pool, accountManager, weekStart, weekEnd) {
    const query = `
        SELECT DISTINCT o.*, r.changed_at
        FROM opps_monitoring o
        JOIN opportunity_revisions r ON o.uid = r.opportunity_uid
        WHERE o.account_mgr = $1
        AND r.submission_flag = true
        AND r.changed_at BETWEEN $2 AND $3
        ORDER BY o.final_amt DESC
    `;
    
    const result = await pool.query(query, [accountManager, weekStart, weekEnd]);
    return result.rows;
}

/**
 * Get status progressions for the week
 */
async function getStatusProgressions(pool, accountManager, weekStart, weekEnd) {
    const query = `
        SELECT 
            r.*,
            o.project_name,
            o.client,
            o.final_amt,
            o.opp_status as current_status,
            COALESCE(r.changed_fields->>'opp_status', o.opp_status) as to_status,
            'Previous Status' as from_status
        FROM opportunity_revisions r
        JOIN opps_monitoring o ON r.opportunity_uid = o.uid
        WHERE r.account_manager_at_time = $1
        AND r.changed_at BETWEEN $2 AND $3
        AND r.status_progression_type IN ('FORWARD', 'BACKWARD')
        AND (r.changed_fields ? 'opp_status' OR r.status_progression_type IS NOT NULL)
        ORDER BY r.change_velocity_score DESC, o.final_amt DESC
    `;
    
    const result = await pool.query(query, [accountManager, weekStart, weekEnd]);
    return result.rows;
}

/**
 * Get financial changes for the week
 */
async function getFinancialChanges(pool, accountManager, weekStart, weekEnd) {
    const query = `
        SELECT 
            r.*,
            o.project_name,
            o.client,
            o.final_amt,
            r.financial_impact_amount
        FROM opportunity_revisions r
        JOIN opps_monitoring o ON r.opportunity_uid = o.uid
        WHERE r.account_manager_at_time = $1
        AND r.changed_at BETWEEN $2 AND $3
        AND (r.changed_fields ? 'final_amt' OR ABS(COALESCE(r.financial_impact_amount, 0)) > 0)
        ORDER BY ABS(COALESCE(r.financial_impact_amount, 0)) DESC
    `;
    
    const result = await pool.query(query, [accountManager, weekStart, weekEnd]);
    return result.rows;
}

/**
 * Get new opportunities for the week
 */
async function getNewOpportunities(pool, accountManager, weekStart, weekEnd) {
    // Since there's no created_at column, we'll look for the earliest revision per opportunity
    // that occurred within the week as a proxy for "new opportunities"
    const query = `
        SELECT DISTINCT o.*, MIN(r.changed_at) as first_change
        FROM opps_monitoring o
        JOIN opportunity_revisions r ON o.uid = r.opportunity_uid
        WHERE o.account_mgr = $1
        AND r.changed_at BETWEEN $2 AND $3
        GROUP BY o.uid, o.project_name, o.client, o.final_amt, o.opp_status, 
                 o.account_mgr, o.status, o.decision, o.project_code
        HAVING MIN(r.changed_at) BETWEEN $2 AND $3
        ORDER BY o.final_amt DESC
    `;
    
    const result = await pool.query(query, [accountManager, weekStart, weekEnd]);
    return result.rows;
}

/**
 * Get concerning changes (backward progressions, critical issues)
 */
async function getConcerningChanges(pool, accountManager, weekStart, weekEnd) {
    const query = `
        SELECT 
            r.*,
            o.project_name,
            o.client,
            o.final_amt,
            'Previous Status' as from_status,
            COALESCE(r.changed_fields->>'opp_status', o.opp_status) as to_status
        FROM opportunity_revisions r
        JOIN opps_monitoring o ON r.opportunity_uid = o.uid
        WHERE r.account_manager_at_time = $1
        AND r.changed_at BETWEEN $2 AND $3
        AND (
            r.status_progression_type = 'BACKWARD'
            OR r.client_impact_level = 'CRITICAL'
            OR (r.changed_fields->>'opp_status' IN ('LOST', 'Inactive'))
            OR o.opp_status IN ('LOST', 'Inactive')
        )
        ORDER BY r.client_impact_level DESC, o.final_amt DESC
    `;
    
    const result = await pool.query(query, [accountManager, weekStart, weekEnd]);
    return result.rows;
}

/**
 * Get deadline changes for the week
 */
async function getDeadlineChanges(pool, accountManager, weekStart, weekEnd) {
    const query = `
        SELECT 
            r.*,
            o.project_name,
            o.client,
            o.final_amt,
            o.client_deadline
        FROM opportunity_revisions r
        JOIN opps_monitoring o ON r.opportunity_uid = o.uid
        WHERE r.account_manager_at_time = $1
        AND r.changed_at BETWEEN $2 AND $3
        AND (r.changed_fields ? 'client_deadline' OR r.changed_fields ? 'submitted_date' OR r.changed_fields ? 'forecast_date')
        ORDER BY o.final_amt DESC
    `;
    
    const result = await pool.query(query, [accountManager, weekStart, weekEnd]);
    return result.rows;
}

/**
 * Check if a status progression is significant enough to highlight
 */
function isSignificantProgression(fromStatus, toStatus) {
    const statusHierarchy = {
        'OP30': 1,
        'OP60': 2,
        'OP90': 3,
        'OP100': 4,
        'Submitted': 5
    };
    
    const fromLevel = statusHierarchy[fromStatus] || 0;
    const toLevel = statusHierarchy[toStatus] || 0;
    
    // Significant if moving forward by at least 1 level, or any submission
    return toLevel > fromLevel || toStatus === 'Submitted';
}

/**
 * Calculate priority for status progression
 */
function calculateProgressionPriority(change) {
    if (change.to_status === 'Submitted') return 'HIGH';
    if (change.to_status === 'OP100' || change.final_amt > 100000) return 'HIGH';
    if (change.status_progression_type === 'BACKWARD') return 'HIGH';
    return 'MEDIUM';
}

/**
 * Calculate priority for deadline changes
 */
function calculateDeadlinePriority(change) {
    if (change.final_amt > 100000) return 'HIGH';
    if (change.change_type === 'DEADLINE_ACCELERATION') return 'MEDIUM';
    return 'LOW';
}

/**
 * Generate narrative notes for different highlight types
 */
function generateSubmissionNote(opp) {
    return `Submitted ${opp.project_name} for ${formatCurrency(opp.final_amt)} to ${opp.client}`;
}

function generateProgressionNarrative(change) {
    const direction = change.status_progression_type === 'FORWARD' ? 'advanced' : 'moved';
    return `${change.project_name} ${direction} from ${change.from_status} to ${change.to_status} (${formatCurrency(change.final_amt)})`;
}

function generateFinancialChangeNote(change) {
    const changeStr = change.financial_impact_amount > 0 ? 'increased' : 'decreased';
    const amount = formatCurrency(Math.abs(change.financial_impact_amount));
    return `${change.project_name} amount ${changeStr} by ${amount}`;
}

function generateNewOpportunityNote(opp) {
    return `New opportunity: ${opp.project_name} (${opp.client}) - ${formatCurrency(opp.final_amt)}`;
}

function generateConcernNote(change) {
    if (change.to_status === 'LOST') {
        return `❌ ${change.project_name} moved to LOST status (${formatCurrency(change.final_amt)})`;
    }
    if (change.to_status === 'Inactive') {
        return `⚠️ ${change.project_name} became Inactive (${formatCurrency(change.final_amt)})`;
    }
    if (change.status_progression_type === 'BACKWARD') {
        return `⬇️ ${change.project_name} regressed from ${change.from_status} to ${change.to_status}`;
    }
    return `⚠️ ${change.project_name} requires attention (${change.change_type})`;
}

function generateDeadlineChangeNote(change) {
    return `📅 ${change.project_name} deadline updated`;
}

/**
 * Store highlights in database
 */
async function storeHighlights(highlights) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        for (const highlight of highlights) {
            const query = `
                INSERT INTO meeting_highlights (
                    opportunity_uid, account_manager, meeting_date, highlight_type,
                    highlight_priority, presentation_notes, auto_generated,
                    include_in_report, financial_impact, status_from, status_to
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (opportunity_uid, meeting_date, highlight_type) 
                DO UPDATE SET
                    presentation_notes = EXCLUDED.presentation_notes,
                    highlight_priority = EXCLUDED.highlight_priority,
                    financial_impact = EXCLUDED.financial_impact,
                    status_from = EXCLUDED.status_from,
                    status_to = EXCLUDED.status_to
            `;
            
            await pool.query(query, [
                highlight.opportunity_uid,
                highlight.account_manager,
                highlight.meeting_date,
                highlight.highlight_type,
                highlight.highlight_priority,
                highlight.presentation_notes,
                highlight.auto_generated,
                highlight.include_in_report,
                highlight.financial_impact,
                highlight.status_from,
                highlight.status_to
            ]);
        }
    } finally {
        await pool.end();
    }
}

/**
 * Generate and store highlights for an account manager
 */
async function generateAndStoreHighlights(accountManager, meetingDate) {
    const highlights = await detectMeetingHighlights(accountManager, meetingDate);
    await storeHighlights(highlights);
    return highlights;
}

/**
 * Get stored highlights for a meeting
 */
async function getMeetingHighlights(accountManager, meetingDate) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        const query = `
            SELECT 
                h.*,
                o.project_name,
                o.client,
                o.final_amt,
                o.opp_status
            FROM meeting_highlights h
            JOIN opps_monitoring o ON h.opportunity_uid = o.uid
            WHERE h.account_manager = $1
            AND h.meeting_date = $2
            AND h.include_in_report = true
            ORDER BY 
                CASE h.highlight_priority 
                    WHEN 'HIGH' THEN 3 
                    WHEN 'MEDIUM' THEN 2 
                    ELSE 1 
                END DESC,
                ABS(h.financial_impact) DESC NULLS LAST
        `;
        
        const result = await pool.query(query, [accountManager, meetingDate]);
        return result.rows;
    } finally {
        await pool.end();
    }
}

module.exports = {
    detectMeetingHighlights,
    generateAndStoreHighlights,
    getMeetingHighlights,
    storeHighlights,
    isSignificantProgression,
    calculateProgressionPriority,
    generateSubmissionNote,
    generateProgressionNarrative,
    generateFinancialChangeNote,
    generateNewOpportunityNote,
    generateConcernNote,
    generateDeadlineChangeNote
};