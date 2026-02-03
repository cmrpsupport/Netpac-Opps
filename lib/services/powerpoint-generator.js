/**
 * PowerPoint Generation Pipeline
 * Creates presentation-ready PowerPoint files for weekly meetings
 */

const PptxGenJS = require('pptxgenjs');
const { Pool } = require('pg');
const { 
    getBusinessWeek, 
    getLastMeetingDate, 
    formatBusinessWeek,
    formatCurrency,
    getChangesSinceLastMeeting,
    getWeeklySummary
} = require('../business-logic/meeting-dates');
const { getMeetingHighlights } = require('../business-logic/highlight-detection');

/**
 * Main PowerPoint generation function
 * @param {string} accountManager - Account manager name
 * @param {Date} meetingDate - Wednesday meeting date
 * @param {string} templateId - Template ID to use (optional)
 * @returns {Promise<Buffer>} - PowerPoint file buffer
 */
async function generateWeeklyPresentation(accountManager, meetingDate, templateId = 'standard') {
    const pres = new PptxGenJS();
    
    // Set presentation properties
    pres.layout = 'LAYOUT_16x9';
    pres.author = 'CMRP Opportunities Management System';
    pres.company = 'CMRP';
    pres.subject = `${accountManager} Weekly Report`;
    pres.title = `Weekly Report - ${formatBusinessWeek(getBusinessWeek(meetingDate))}`;
    
    try {
        // Gather all necessary data
        const presentationData = await generatePresentationData(accountManager, meetingDate);
        
        // Get template configuration
        const template = await getTemplateConfig(templateId);
        
        // Generate slides based on template
        await generateSlides(pres, presentationData, template);
        
        // Return the PowerPoint file as buffer
        return await pres.write({ outputType: 'nodebuffer' });
        
    } catch (error) {
        console.error('Error generating PowerPoint presentation:', error);
        throw error;
    }
}

/**
 * Gather comprehensive data for presentation
 */
async function generatePresentationData(accountManager, meetingDate) {
    const weekStart = getBusinessWeek(meetingDate);
    const lastWeek = new Date(weekStart);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(weekStart);
    lastMonth.setDate(lastMonth.getDate() - 28);
    
    const [
        currentMetrics,
        weeklyComparison,
        monthlyComparison,
        recentChanges,
        highlights,
        weeklySummary
    ] = await Promise.all([
        getCurrentMetrics(accountManager),
        getWeeklyComparison(accountManager, weekStart, lastWeek),
        getMonthlyComparison(accountManager, weekStart, lastMonth),
        getChangesSinceLastMeeting(accountManager, getLastMeetingDate()),
        getMeetingHighlights(accountManager, meetingDate),
        getWeeklySummary(accountManager, meetingDate)
    ]);
    
    return {
        accountManager,
        meetingDate,
        weekStart,
        weekDisplay: formatBusinessWeek(weekStart),
        current: currentMetrics,
        weeklyComparison,
        monthlyComparison,
        recentChanges,
        highlights,
        weeklySummary,
        executiveSummary: generateExecutiveSummary(currentMetrics, weeklyComparison, highlights),
        actionItems: generateActionItems(recentChanges, highlights),
        concerns: identifyConcerns(recentChanges, highlights),
        wins: identifyWins(recentChanges, highlights)
    };
}

/**
 * Get current metrics for account manager
 */
async function getCurrentMetrics(accountManager) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
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
            WHERE account_mgr = $1
        `;
        
        const result = await pool.query(query, [accountManager]);
        return result.rows[0];
        
    } finally {
        await pool.end();
    }
}

/**
 * Get weekly comparison metrics
 */
async function getWeeklyComparison(accountManager, currentWeek, lastWeek) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        const query = `
            SELECT 
                'current' as period,
                total_opportunities,
                submitted_count,
                submitted_amount,
                op100_count,
                op100_amount,
                op90_count,
                op90_amount,
                op60_count,
                op60_amount,
                op30_count,
                op30_amount
            FROM account_manager_snapshots
            WHERE account_manager = $1 AND snapshot_type = 'weekly'
            UNION ALL
            SELECT 
                'previous' as period,
                total_opportunities,
                submitted_count,
                submitted_amount,
                op100_count,
                op100_amount,
                op90_count,
                op90_amount,
                op60_count,
                op60_amount,
                op30_count,
                op30_amount
            FROM account_manager_snapshots
            WHERE account_manager = $1 AND snapshot_type = 'weekly'
            -- This would ideally get historical snapshot, simplified for now
        `;
        
        const result = await pool.query(query, [accountManager]);
        const current = result.rows.find(r => r.period === 'current') || {};
        const previous = result.rows.find(r => r.period === 'previous') || {};
        
        return calculateDeltas(current, previous);
        
    } finally {
        await pool.end();
    }
}

/**
 * Get monthly comparison metrics
 */
async function getMonthlyComparison(accountManager, currentWeek, lastMonth) {
    // Similar to weekly comparison but with monthly snapshots
    return getWeeklyComparison(accountManager, currentWeek, lastMonth);
}

/**
 * Calculate deltas between periods
 */
function calculateDeltas(current, previous) {
    const fields = [
        'total_opportunities', 'submitted_count', 'submitted_amount',
        'op100_count', 'op100_amount', 'op90_count', 'op90_amount',
        'op60_count', 'op60_amount', 'op30_count', 'op30_amount'
    ];
    
    const deltas = {};
    fields.forEach(field => {
        const curr = parseFloat(current[field]) || 0;
        const prev = parseFloat(previous[field]) || 0;
        deltas[field] = curr - prev;
        deltas[`${field}_percent`] = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    });
    
    return { current, previous, deltas };
}

/**
 * Generate executive summary text
 */
function generateExecutiveSummary(metrics, comparison, highlights) {
    const totalPipeline = formatCurrency(metrics.total_pipeline_value);
    const highPriorityCount = highlights.filter(h => h.highlight_priority === 'HIGH').length;
    const submissionsCount = highlights.filter(h => h.highlight_type === 'NEW_SUBMISSION').length;
    
    return [
        `Total pipeline: ${totalPipeline} across ${metrics.total_opportunities} opportunities`,
        `${submissionsCount} new submissions this week`,
        `${highPriorityCount} high-priority items requiring attention`,
        `${metrics.op100_count} opportunities at OP100 stage (${formatCurrency(metrics.op100_amount)})`
    ];
}

/**
 * Generate action items
 */
function generateActionItems(changes, highlights) {
    const actionItems = [];
    
    // Items from concerns
    highlights
        .filter(h => h.highlight_type === 'CONCERN')
        .forEach(concern => {
            actionItems.push({
                type: 'concern',
                priority: 'HIGH',
                item: `Follow up on ${concern.project_name}: ${concern.presentation_notes}`
            });
        });
    
    // Items from backward progressions
    changes.concerns.forEach(concern => {
        actionItems.push({
            type: 'regression',
            priority: 'HIGH',
            item: `Investigate regression: ${concern.project_name}`
        });
    });
    
    return actionItems.slice(0, 5); // Top 5 action items
}

/**
 * Identify concerns from data
 */
function identifyConcerns(changes, highlights) {
    return [
        ...highlights.filter(h => h.highlight_priority === 'HIGH' && h.highlight_type === 'CONCERN'),
        ...changes.concerns.map(c => ({
            project_name: c.project_name,
            issue: c.change_type,
            financial_impact: c.final_amt
        }))
    ];
}

/**
 * Identify wins from data
 */
function identifyWins(changes, highlights) {
    return [
        ...highlights.filter(h => h.highlight_type === 'NEW_SUBMISSION'),
        ...highlights.filter(h => h.highlight_type === 'STATUS_PROGRESSION' && h.highlight_priority === 'HIGH')
    ];
}

/**
 * Get template configuration
 */
async function getTemplateConfig(templateId) {
    const pool = new Pool();
    
    try {
        const query = `
            SELECT * FROM presentation_templates 
            WHERE id = $1 OR template_name = $1
            AND is_active = true
        `;
        
        const result = await pool.query(query, [templateId]);
        
        if (result.rows.length === 0) {
            // Return default template
            return getDefaultTemplate();
        }
        
        return result.rows[0];
        
    } finally {
        await pool.end();
    }
}

/**
 * Default template configuration
 */
function getDefaultTemplate() {
    return {
        template_name: 'Standard Weekly Report',
        slide_structure: {
            slides: [
                { type: 'title', title: '{ACCOUNT_MANAGER} Weekly Report', subtitle: 'Week of {WEEK_DATE}' },
                { type: 'executive_summary', title: 'Executive Summary' },
                { type: 'submissions', title: 'New Submissions' },
                { type: 'status_movements', title: 'Status Progressions' },
                { type: 'highlights', title: 'This Week\'s Highlights' },
                { type: 'concerns', title: 'Items Requiring Attention' },
                { type: 'next_week', title: 'Looking Ahead' }
            ]
        },
        color_scheme: {
            OP100: '#22c55e',
            OP90: '#a7f3d0',
            OP60: '#fde047',
            OP30: '#60a5fa',
            LOST: '#fca5a5',
            Inactive: '#9ca3af',
            Submitted: '#3b82f6',
            primary: '#1f2937',
            secondary: '#6b7280'
        }
    };
}

/**
 * Generate all slides based on template
 */
async function generateSlides(pres, data, template) {
    const slides = template.slide_structure.slides;
    
    for (const slideConfig of slides) {
        switch (slideConfig.type) {
            case 'title':
                await generateTitleSlide(pres, data, slideConfig, template);
                break;
            case 'executive_summary':
                await generateExecutiveSummarySlide(pres, data, slideConfig, template);
                break;
            case 'submissions':
                await generateSubmissionsSlide(pres, data, slideConfig, template);
                break;
            case 'status_movements':
                await generateStatusMovementsSlide(pres, data, slideConfig, template);
                break;
            case 'highlights':
                await generateHighlightsSlide(pres, data, slideConfig, template);
                break;
            case 'concerns':
                await generateConcernsSlide(pres, data, slideConfig, template);
                break;
            case 'next_week':
                await generateNextWeekSlide(pres, data, slideConfig, template);
                break;
        }
    }
}

/**
 * Generate title slide
 */
async function generateTitleSlide(pres, data, config, template) {
    const slide = pres.addSlide();
    
    slide.addText(
        config.title.replace('{ACCOUNT_MANAGER}', data.accountManager),
        {
            x: 1, y: 2, w: 8, h: 1.5,
            fontSize: 36,
            bold: true,
            color: template.color_scheme.primary,
            align: 'center'
        }
    );
    
    slide.addText(
        config.subtitle.replace('{WEEK_DATE}', data.weekDisplay),
        {
            x: 1, y: 3.5, w: 8, h: 1,
            fontSize: 24,
            color: template.color_scheme.secondary,
            align: 'center'
        }
    );
    
    slide.addText(
        new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }),
        {
            x: 1, y: 5, w: 8, h: 0.5,
            fontSize: 16,
            color: template.color_scheme.secondary,
            align: 'center'
        }
    );
}

/**
 * Generate executive summary slide
 */
async function generateExecutiveSummarySlide(pres, data, config, template) {
    const slide = pres.addSlide();
    
    slide.addText(config.title, {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 32,
        bold: true,
        color: template.color_scheme.primary
    });
    
    // Summary table
    const tableData = [
        ['Status', 'Count', 'Amount', 'Δ Week', 'Δ Week $'],
        ['OP100', data.current.op100_count, formatCurrency(data.current.op100_amount), '+/-', '+/-'],
        ['OP90', data.current.op90_count, formatCurrency(data.current.op90_amount), '+/-', '+/-'],
        ['OP60', data.current.op60_count, formatCurrency(data.current.op60_amount), '+/-', '+/-'],
        ['OP30', data.current.op30_count, formatCurrency(data.current.op30_amount), '+/-', '+/-'],
        ['Submitted', data.current.submitted_count, formatCurrency(data.current.submitted_amount), '+/-', '+/-']
    ];
    
    slide.addTable(tableData, {
        x: 0.5, y: 1.5, w: 9, h: 3,
        fontSize: 14,
        border: { pt: 1, color: template.color_scheme.secondary }
    });
    
    // Key highlights
    const highlights = data.executiveSummary;
    slide.addText(highlights.join('\n• '), {
        x: 0.5, y: 5, w: 9, h: 2,
        fontSize: 16,
        bullet: { code: '2022' }
    });
}

/**
 * Generate submissions slide
 */
async function generateSubmissionsSlide(pres, data, config, template) {
    const slide = pres.addSlide();
    
    slide.addText(config.title, {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 32,
        bold: true,
        color: template.color_scheme.primary
    });
    
    const submissions = data.highlights.filter(h => h.highlight_type === 'NEW_SUBMISSION');
    
    if (submissions.length === 0) {
        slide.addText('No new submissions this week', {
            x: 0.5, y: 2, w: 9, h: 1,
            fontSize: 18,
            color: template.color_scheme.secondary,
            align: 'center'
        });
        return;
    }
    
    // Submissions table
    const submissionData = [
        ['Project', 'Client', 'Amount', 'Status'],
        ...submissions.slice(0, 8).map(sub => [
            sub.project_name,
            sub.client,
            formatCurrency(sub.financial_impact),
            'Submitted'
        ])
    ];
    
    slide.addTable(submissionData, {
        x: 0.5, y: 1.5, w: 9, h: 4,
        fontSize: 12,
        border: { pt: 1, color: template.color_scheme.secondary }
    });
    
    // Total value
    const totalValue = submissions.reduce((sum, s) => sum + (s.financial_impact || 0), 0);
    slide.addText(`Total Submission Value: ${formatCurrency(totalValue)}`, {
        x: 0.5, y: 6, w: 9, h: 0.8,
        fontSize: 20,
        bold: true,
        color: template.color_scheme.success,
        align: 'center'
    });
}

/**
 * Generate status movements slide
 */
async function generateStatusMovementsSlide(pres, data, config, template) {
    const slide = pres.addSlide();
    
    slide.addText(config.title, {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 32,
        bold: true,
        color: template.color_scheme.primary
    });
    
    const progressions = data.highlights.filter(h => h.highlight_type === 'STATUS_PROGRESSION');
    
    if (progressions.length === 0) {
        slide.addText('No significant status progressions this week', {
            x: 0.5, y: 2, w: 9, h: 1,
            fontSize: 18,
            color: template.color_scheme.secondary,
            align: 'center'
        });
        return;
    }
    
    // Status movements table
    const movementData = [
        ['Project', 'From', 'To', 'Amount'],
        ...progressions.slice(0, 8).map(prog => [
            prog.project_name,
            prog.status_from,
            prog.status_to,
            formatCurrency(prog.financial_impact)
        ])
    ];
    
    slide.addTable(movementData, {
        x: 0.5, y: 1.5, w: 9, h: 4,
        fontSize: 12,
        border: { pt: 1, color: template.color_scheme.secondary }
    });
}

/**
 * Generate highlights slide
 */
async function generateHighlightsSlide(pres, data, config, template) {
    const slide = pres.addSlide();
    
    slide.addText(config.title, {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 32,
        bold: true,
        color: template.color_scheme.primary
    });
    
    const topHighlights = data.highlights
        .filter(h => h.highlight_priority === 'HIGH')
        .slice(0, 6);
    
    const highlightText = topHighlights
        .map(h => h.presentation_notes)
        .join('\n• ');
    
    slide.addText(highlightText, {
        x: 0.5, y: 1.5, w: 9, h: 4,
        fontSize: 16,
        bullet: { code: '2022' }
    });
}

/**
 * Generate concerns slide
 */
async function generateConcernsSlide(pres, data, config, template) {
    const slide = pres.addSlide();
    
    slide.addText(config.title, {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 32,
        bold: true,
        color: template.color_scheme.primary
    });
    
    const concerns = data.concerns.slice(0, 5);
    
    if (concerns.length === 0) {
        slide.addText('No major concerns identified this week', {
            x: 0.5, y: 2, w: 9, h: 1,
            fontSize: 18,
            color: template.color_scheme.success,
            align: 'center'
        });
        return;
    }
    
    const concernText = concerns
        .map(c => `${c.project_name || c.presentation_notes}: ${c.issue || 'Requires attention'}`)
        .join('\n• ');
    
    slide.addText(concernText, {
        x: 0.5, y: 1.5, w: 9, h: 4,
        fontSize: 16,
        bullet: { code: '2022' },
        color: template.color_scheme.danger
    });
}

/**
 * Generate next week slide
 */
async function generateNextWeekSlide(pres, data, config, template) {
    const slide = pres.addSlide();
    
    slide.addText(config.title, {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 32,
        bold: true,
        color: template.color_scheme.primary
    });
    
    const actionItems = data.actionItems
        .map(item => item.item)
        .slice(0, 5)
        .join('\n• ');
    
    slide.addText('Action Items for Next Week:', {
        x: 0.5, y: 1.5, w: 9, h: 0.5,
        fontSize: 20,
        bold: true,
        color: template.color_scheme.primary
    });
    
    slide.addText(actionItems, {
        x: 0.5, y: 2.2, w: 9, h: 3,
        fontSize: 16,
        bullet: { code: '2022' }
    });
}

module.exports = {
    generateWeeklyPresentation,
    generatePresentationData,
    getCurrentMetrics,
    getWeeklyComparison,
    getMonthlyComparison,
    generateExecutiveSummary,
    generateActionItems
};