/**
 * Meeting-Centric Date Calculations
 * Handles Wednesday-to-Tuesday business weeks for weekly meeting reports
 */

/**
 * Calculate Wednesday-to-Tuesday business weeks
 * @param {Date} date - Input date
 * @returns {Date} - Wednesday that starts the business week
 */
function getBusinessWeek(date) {
    const dayOfWeek = date.getDay();
    const daysToSubtract = (dayOfWeek + 4) % 7; // Make Wednesday = 0
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - daysToSubtract);
    weekStart.setHours(0, 0, 0, 0); // Set to start of day
    return weekStart;
}

/**
 * Get the last Wednesday meeting date
 * @returns {Date} - Last Wednesday (or current Wednesday if today is Wednesday or later)
 */
function getLastMeetingDate() {
    const today = new Date();
    const lastWednesday = getBusinessWeek(today);
    
    // If today is before Wednesday, go back one more week
    if (today.getDay() < 3) {
        lastWednesday.setDate(lastWednesday.getDate() - 7);
    }
    
    return lastWednesday;
}

/**
 * Get the next Wednesday meeting date
 * @returns {Date} - Next Wednesday meeting date
 */
function getNextMeetingDate() {
    const today = new Date();
    const currentWeek = getBusinessWeek(today);
    
    // If today is Wednesday or later, next meeting is next week
    if (today.getDay() >= 3) {
        currentWeek.setDate(currentWeek.getDate() + 7);
    }
    
    return currentWeek;
}

/**
 * Get all Wednesdays in a date range
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @returns {Date[]} - Array of Wednesday dates
 */
function getWednesdaysInRange(startDate, endDate) {
    const wednesdays = [];
    const current = getBusinessWeek(startDate);
    
    while (current <= endDate) {
        wednesdays.push(new Date(current));
        current.setDate(current.getDate() + 7);
    }
    
    return wednesdays;
}

/**
 * Check if a date falls within a specific business week
 * @param {Date} date - Date to check
 * @param {Date} weekStart - Wednesday start of business week
 * @returns {boolean} - True if date is in the business week
 */
function isDateInBusinessWeek(date, weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Tuesday of same week
    weekEnd.setHours(23, 59, 59, 999); // End of day
    
    return date >= weekStart && date <= weekEnd;
}

/**
 * Get the business week range (Wednesday to Tuesday)
 * @param {Date} referenceDate - Any date within the week
 * @returns {Object} - {start: Date, end: Date}
 */
function getBusinessWeekRange(referenceDate) {
    const start = getBusinessWeek(referenceDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Tuesday
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
}

/**
 * Format business week for display
 * @param {Date} weekStart - Wednesday start date
 * @returns {string} - Formatted week string "Jan 15-21, 2025"
 */
function formatBusinessWeek(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const options = { month: 'short', day: 'numeric' };
    const startStr = weekStart.toLocaleDateString('en-US', options);
    const endStr = weekEnd.toLocaleDateString('en-US', options);
    const year = weekStart.getFullYear();
    
    return `${startStr}-${endStr.split(' ')[1]}, ${year}`;
}

/**
 * Get changes since last meeting for an account manager
 * @param {string} accountManager - Account manager name
 * @param {Date} sinceDate - Date to look for changes since (typically last Wednesday)
 * @returns {Promise<Object>} - Changes categorized by type
 */
async function getChangesSinceLastMeeting(accountManager, sinceDate = null) {
    const since = sinceDate || getLastMeetingDate();
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        const query = `
            SELECT 
                r.*,
                o.project_name,
                o.client,
                o.final_amt,
                o.opp_status
            FROM opportunity_revisions r
            JOIN opps_monitoring o ON r.opportunity_uid = o.uid
            WHERE r.account_manager_at_time = $1
            AND r.changed_at >= $2
            AND r.meeting_reportable = true
            ORDER BY r.changed_at DESC, r.change_velocity_score DESC
        `;
        
        const result = await pool.query(query, [accountManager, since]);
        
        // Categorize changes for presentation
        const changes = {
            submissions: [],
            statusProgressions: [],
            financialChanges: [],
            newOpportunities: [],
            concerns: [],
            total: result.rows.length
        };
        
        result.rows.forEach(row => {
            if (row.submission_flag) {
                changes.submissions.push(row);
            }
            if (row.status_progression_type === 'FORWARD') {
                changes.statusProgressions.push(row);
            }
            if (row.change_category === 'FINANCIAL' && Math.abs(row.financial_impact_amount || 0) > 0) {
                changes.financialChanges.push(row);
            }
            if (row.change_category === 'NEW_OPPORTUNITY') {
                changes.newOpportunities.push(row);
            }
            if (row.status_progression_type === 'BACKWARD' || row.client_impact_level === 'CRITICAL') {
                changes.concerns.push(row);
            }
        });
        
        return changes;
        
    } catch (error) {
        console.error('Error fetching changes since last meeting:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

/**
 * Get weekly summary metrics for an account manager
 * @param {string} accountManager - Account manager name
 * @param {Date} weekDate - Any date within the week
 * @returns {Promise<Object>} - Weekly summary data
 */
async function getWeeklySummary(accountManager, weekDate = null) {
    const targetWeek = getBusinessWeek(weekDate || new Date());
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        const query = `
            SELECT * FROM weekly_change_summaries
            WHERE account_manager = $1
            AND week_starting_date = $2
        `;
        
        const result = await pool.query(query, [accountManager, targetWeek]);
        
        if (result.rows.length === 0) {
            // Generate summary if it doesn't exist
            await pool.query(
                'SELECT generate_weekly_summary($1, $2)',
                [accountManager, targetWeek]
            );
            
            // Fetch the generated summary
            const summaryResult = await pool.query(query, [accountManager, targetWeek]);
            return summaryResult.rows[0];
        }
        
        return result.rows[0];
        
    } catch (error) {
        console.error('Error fetching weekly summary:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

/**
 * Generate meeting highlights for PowerPoint
 * @param {string} accountManager - Account manager name
 * @param {Date} meetingDate - Wednesday meeting date
 * @returns {Promise<Array>} - Array of highlight objects
 */
async function generateMeetingHighlights(accountManager, meetingDate = null) {
    const meeting = meetingDate || getNextMeetingDate();
    const weekRange = getBusinessWeekRange(meeting);
    
    const changes = await getChangesSinceLastMeeting(accountManager, weekRange.start);
    const highlights = [];
    
    // High priority: New submissions
    changes.submissions.forEach(submission => {
        highlights.push({
            type: 'NEW_SUBMISSION',
            priority: 'HIGH',
            title: `Submitted ${submission.project_name}`,
            description: `Submitted for ${formatCurrency(submission.final_amt)}`,
            opportunity_uid: submission.opportunity_uid,
            financial_impact: submission.final_amt
        });
    });
    
    // Medium priority: Forward status progressions
    changes.statusProgressions.forEach(progression => {
        if (progression.status_progression_type === 'FORWARD') {
            highlights.push({
                type: 'STATUS_PROGRESSION',
                priority: 'MEDIUM',
                title: `${progression.project_name} Advanced`,
                description: `Moved from ${progression.status_from} to ${progression.status_to}`,
                opportunity_uid: progression.opportunity_uid
            });
        }
    });
    
    // High priority: Large financial changes
    changes.financialChanges.forEach(change => {
        if (Math.abs(change.financial_impact_amount) > 50000) {
            highlights.push({
                type: 'FINANCIAL_CHANGE',
                priority: 'HIGH',
                title: `Major Financial Update`,
                description: `${change.project_name}: ${formatCurrency(change.financial_impact_amount, true)} change`,
                opportunity_uid: change.opportunity_uid,
                financial_impact: change.financial_impact_amount
            });
        }
    });
    
    // High priority: Concerns (backward movements, critical issues)
    changes.concerns.forEach(concern => {
        highlights.push({
            type: 'CONCERN',
            priority: 'HIGH',
            title: `Attention Required`,
            description: `${concern.project_name}: ${concern.change_type}`,
            opportunity_uid: concern.opportunity_uid
        });
    });
    
    // Sort by priority and limit to top 10
    const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    highlights.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    
    return highlights.slice(0, 10);
}

/**
 * Format currency for display
 * @param {number} amount - Dollar amount
 * @param {boolean} showSign - Whether to show +/- sign
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount, showSign = false) {
    if (!amount) return '$0';
    
    const formatted = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0
    }).format(Math.abs(amount));
    
    if (showSign && amount !== 0) {
        return `${amount > 0 ? '+' : '-'}${formatted}`;
    }
    
    return formatted;
}

module.exports = {
    getBusinessWeek,
    getLastMeetingDate,
    getNextMeetingDate,
    getWednesdaysInRange,
    isDateInBusinessWeek,
    getBusinessWeekRange,
    formatBusinessWeek,
    getChangesSinceLastMeeting,
    getWeeklySummary,
    generateMeetingHighlights,
    formatCurrency
};