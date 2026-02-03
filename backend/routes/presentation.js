const db = require('../../db_adapter');
/**
 * Presentation API Routes
 * Handles PowerPoint generation and presentation data endpoints
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { generateSimpleWeeklyPresentation } = require('../../lib/services/simple-powerpoint-generator');
const { generateAndStoreHighlights, getMeetingHighlights } = require('../../lib/business-logic/highlight-detection');
const { 
    getBusinessWeek, 
    getLastMeetingDate, 
    getNextMeetingDate,
    getWeeklySummary,
    getChangesSinceLastMeeting
} = require('../../lib/business-logic/meeting-dates');

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/presentation/test
 * Test endpoint to verify router and authentication
 */
router.get('/test', (req, res) => {
    res.json({ 
        message: 'Presentation API is working', 
        user: req.user ? req.user.email : 'No user',
        timestamp: new Date().toISOString() 
    });
});

/**
 * GET /api/presentation/weekly-data/:accountManager
 * Get comprehensive weekly report data for an account manager
 */
router.get('/weekly-data/:accountManager', async (req, res) => {
    try {
        const { accountManager } = req.params;
        const { meetingDate } = req.query;
        
        const meeting = meetingDate ? new Date(meetingDate) : getNextMeetingDate();
        const weekStart = getBusinessWeek(meeting);
        
        // Generate highlights if they don't exist
        await generateAndStoreHighlights(accountManager, meeting);
        
        // Gather all data
        const [
            currentMetrics,
            weeklySummary,
            highlights,
            recentChanges
        ] = await Promise.all([
            getCurrentMetrics(accountManager),
            getWeeklySummary(accountManager, meeting),
            getMeetingHighlights(accountManager, meeting),
            getChangesSinceLastMeeting(accountManager, getLastMeetingDate())
        ]);
        
        res.json({
            accountManager,
            meetingDate: meeting,
            weekStart,
            currentMetrics,
            weeklySummary,
            highlights,
            recentChanges,
            summary: {
                totalOpportunities: currentMetrics.total_opportunities,
                totalPipelineValue: currentMetrics.total_pipeline_value,
                highPriorityItems: highlights.filter(h => h.highlight_priority === 'HIGH').length,
                newSubmissions: highlights.filter(h => h.highlight_type === 'NEW_SUBMISSION').length
            }
        });
        
    } catch (error) {
        console.error('Error fetching weekly presentation data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch presentation data',
            details: error.message 
        });
    }
});

/**
 * GET /api/presentation/changes-since/:accountManager
 * Get changes since a specific date for an account manager
 */
router.get('/changes-since/:accountManager', async (req, res) => {
    try {
        const { accountManager } = req.params;
        const { fromDate } = req.query;
        
        const since = fromDate ? new Date(fromDate) : getLastMeetingDate();
        const changes = await getChangesSinceLastMeeting(accountManager, since);
        
        res.json({
            accountManager,
            fromDate: since,
            changes,
            summary: {
                totalChanges: changes.total,
                submissions: changes.submissions.length,
                statusProgressions: changes.statusProgressions.length,
                financialChanges: changes.financialChanges.length,
                concerns: changes.concerns.length
            }
        });
        
    } catch (error) {
        console.error('Error fetching changes:', error);
        res.status(500).json({ 
            error: 'Failed to fetch changes',
            details: error.message 
        });
    }
});

/**
 * GET /api/presentation/submissions/:accountManager
 * Get submissions for a specific week
 */
router.get('/submissions/:accountManager', async (req, res) => {
    try {
        const { accountManager } = req.params;
        const { weekDate } = req.query;
        
        const targetWeek = weekDate ? new Date(weekDate) : new Date();
        const weekStart = getBusinessWeek(targetWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        const query = `
            SELECT DISTINCT
                o.uid,
                o.project_name,
                o.client,
                o.final_amt,
                o.opp_status,
                r.changed_at as submitted_date,
                r.changed_by
            FROM opps_monitoring o
            JOIN opportunity_revisions r ON o.uid = r.opportunity_uid
            WHERE o.account_mgr = $1
            AND r.submission_flag = true
            AND r.changed_at BETWEEN $2 AND $3
            ORDER BY o.final_amt DESC, r.changed_at DESC
        `;
        
        const result = await db.query(query, [accountManager, weekStart, weekEnd]);
        
        const totalValue = result.rows.reduce((sum, row) => sum + (parseFloat(row.final_amt) || 0), 0);
        
        res.json({
            accountManager,
            weekStart,
            weekEnd,
            submissions: result.rows,
            summary: {
                count: result.rows.length,
                totalValue,
                avgValue: result.rows.length > 0 ? totalValue / result.rows.length : 0
            }
        });
        
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ 
            error: 'Failed to fetch submissions',
            details: error.message 
        });
    }
});

/**
 * GET /api/presentation/highlights/:accountManager
 * Get meeting highlights for a specific date
 */
router.get('/highlights/:accountManager', async (req, res) => {
    try {
        const { accountManager } = req.params;
        const { meetingDate } = req.query;
        
        const meeting = meetingDate ? new Date(meetingDate) : getNextMeetingDate();
        const highlights = await getMeetingHighlights(accountManager, meeting);
        
        res.json({
            accountManager,
            meetingDate: meeting,
            highlights,
            summary: {
                total: highlights.length,
                high: highlights.filter(h => h.highlight_priority === 'HIGH').length,
                medium: highlights.filter(h => h.highlight_priority === 'MEDIUM').length,
                low: highlights.filter(h => h.highlight_priority === 'LOW').length
            }
        });
        
    } catch (error) {
        console.error('Error fetching highlights:', error);
        res.status(500).json({ 
            error: 'Failed to fetch highlights',
            details: error.message 
        });
    }
});

/**
 * POST /api/presentation/generate-highlights/:accountManager
 * Generate and store highlights for a meeting
 */
router.post('/generate-highlights/:accountManager', async (req, res) => {
    try {
        const { accountManager } = req.params;
        const { meetingDate } = req.body;
        
        const meeting = meetingDate ? new Date(meetingDate) : getNextMeetingDate();
        const highlights = await generateAndStoreHighlights(accountManager, meeting);
        
        res.json({
            accountManager,
            meetingDate: meeting,
            highlights,
            summary: {
                generated: highlights.length,
                high: highlights.filter(h => h.highlight_priority === 'HIGH').length,
                medium: highlights.filter(h => h.highlight_priority === 'MEDIUM').length,
                low: highlights.filter(h => h.highlight_priority === 'LOW').length
            }
        });
        
    } catch (error) {
        console.error('Error generating highlights:', error);
        res.status(500).json({ 
            error: 'Failed to generate highlights',
            details: error.message 
        });
    }
});

/**
 * POST /api/presentation/export-powerpoint
 * Generate and download PowerPoint presentation
 */
router.post('/export-powerpoint', async (req, res) => {
    try {
        const { accountManager, meetingDate, templateId, options } = req.body;
        
        if (!accountManager) {
            return res.status(400).json({ error: 'Account manager is required' });
        }
        
        const meeting = meetingDate ? new Date(meetingDate) : getNextMeetingDate();
        
        // Generate the PowerPoint file using simple generator
        const pptBuffer = await generateSimpleWeeklyPresentation(
            accountManager, 
            meeting
        );
        
        // Set headers for file download
        const filename = `${accountManager.replace(/\s+/g, '_')}_Weekly_Report_${meeting.toISOString().split('T')[0]}.pptx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pptBuffer.length);
        
        res.send(pptBuffer);
        
    } catch (error) {
        console.error('Error exporting PowerPoint:', error);
        res.status(500).json({ 
            error: 'Failed to export PowerPoint presentation',
            details: error.message 
        });
    }
});

/**
 * GET /api/presentation/templates
 * Get available presentation templates
 */
router.get('/templates', async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                template_name,
                slide_structure,
                color_scheme,
                is_active,
                created_by,
                created_at
            FROM presentation_templates
            WHERE is_active = true
            ORDER BY template_name
        `;
        
        const result = await db.query(query);
        
        res.json({
            templates: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ 
            error: 'Failed to fetch templates',
            details: error.message 
        });
    }
});

/**
 * POST /api/presentation/templates
 * Create a new presentation template
 */
router.post('/templates', async (req, res) => {
    try {
        const { 
            template_name, 
            slide_structure, 
            color_scheme, 
            chart_types, 
            narrative_rules,
            created_by 
        } = req.body;
        
        const query = `
            INSERT INTO presentation_templates (
                template_name, slide_structure, color_scheme, 
                chart_types, narrative_rules, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        
        const result = await db.query(query, [
            template_name,
            JSON.stringify(slide_structure),
            JSON.stringify(color_scheme),
            JSON.stringify(chart_types),
            JSON.stringify(narrative_rules),
            created_by
        ]);
        
        res.status(201).json({
            template: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ 
            error: 'Failed to create template',
            details: error.message 
        });
    }
});

/**
 * GET /api/presentation/account-managers
 * Get list of account managers for presentation selection
 */
router.get('/account-managers', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT 
                account_mgr as name,
                COUNT(*) as opportunity_count,
                SUM(final_amt) as total_pipeline
            FROM opps_monitoring 
            WHERE account_mgr IS NOT NULL 
            AND account_mgr != ''
            GROUP BY account_mgr
            ORDER BY account_mgr
        `;
        
        const result = await db.query(query);
        
        res.json({
            accountManagers: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching account managers:', error);
        res.status(500).json({ 
            error: 'Failed to fetch account managers',
            details: error.message 
        });
    }
});

/**
 * Helper function to get current metrics
 */
async function getCurrentMetrics(accountManager) {
    const query = `
        SELECT 
            COUNT(*) as total_opportunities,
            COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as submitted_count,
            COALESCE(SUM(CASE WHEN status = 'Submitted' THEN final_amt END), 0) as submitted_amount,
            COUNT(CASE WHEN opp_status = 'OP100' THEN 1 END) as op100_count,
            COALESCE(SUM(CASE WHEN opp_status = 'OP100' THEN final_amt END), 0) as op100_amount,
            COUNT(CASE WHEN opp_status = 'OP90' THEN 1 END) as op90_count,
            COALESCE(SUM(CASE WHEN opp_status = 'OP90' THEN final_amt END), 0) as op90_amount,
            COUNT(CASE WHEN opp_status = 'OP60' THEN 1 END) as op60_count,
            COALESCE(SUM(CASE WHEN opp_status = 'OP60' THEN final_amt END), 0) as op60_amount,
            COUNT(CASE WHEN opp_status = 'OP30' THEN 1 END) as op30_count,
            COALESCE(SUM(CASE WHEN opp_status = 'OP30' THEN final_amt END), 0) as op30_amount,
            COUNT(CASE WHEN opp_status = 'LOST' THEN 1 END) as lost_count,
            COALESCE(SUM(CASE WHEN opp_status = 'LOST' THEN final_amt END), 0) as lost_amount,
            COUNT(CASE WHEN opp_status = 'Inactive' THEN 1 END) as inactive_count,
            COALESCE(SUM(final_amt), 0) as total_pipeline_value
        FROM opps_monitoring
        WHERE account_mgr = ?
    `;

    const result = await db.query(query, [accountManager]);
    return result.rows[0];
}

module.exports = router;