/**
 * Simplified PowerPoint Generator
 * Works with current database schema without complex audit trail queries
 */

const PptxGenJS = require('pptxgenjs');
const { Pool } = require('pg');
const { getBusinessWeek, formatBusinessWeek } = require('../business-logic/meeting-dates');

/**
 * Generate a simple weekly presentation using basic data
 */
async function generateSimpleWeeklyPresentation(accountManager, meetingDate) {
    const pres = new PptxGenJS();
    
    // Set presentation properties
    pres.layout = 'LAYOUT_16x9';
    pres.author = 'CMRP Opportunities Management System';
    pres.company = 'CMRP';
    pres.subject = `${accountManager} Weekly Report`;
    pres.title = `Weekly Report - ${formatBusinessWeek(getBusinessWeek(meetingDate))}`;
    
    try {
        // Get basic data from database
        const data = await getBasicPresentationData(accountManager);
        
        // Generate slides
        await generateSimpleSlides(pres, data, accountManager, meetingDate);
        
        // Return the PowerPoint file as buffer
        return await pres.write({ outputType: 'nodebuffer' });
        
    } catch (error) {
        console.error('Error generating simple PowerPoint presentation:', error);
        throw error;
    }
}

/**
 * Get basic presentation data from current database
 */
async function getBasicPresentationData(accountManager) {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        // Get current metrics
        const metricsQuery = `
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
        
        const metricsResult = await pool.query(metricsQuery, [accountManager]);
        const metrics = metricsResult.rows[0];
        
        // Get recent opportunities for examples
        const recentQuery = `
            SELECT project_name, client, final_amt, opp_status, status
            FROM opps_monitoring 
            WHERE account_mgr = $1
            ORDER BY final_amt DESC
            LIMIT 10
        `;
        
        const recentResult = await pool.query(recentQuery, [accountManager]);
        const recentOpportunities = recentResult.rows;
        
        // Get high-value opportunities
        const highValueQuery = `
            SELECT project_name, client, final_amt, opp_status
            FROM opps_monitoring 
            WHERE account_mgr = $1
            AND final_amt > 100000
            ORDER BY final_amt DESC
            LIMIT 5
        `;
        
        const highValueResult = await pool.query(highValueQuery, [accountManager]);
        const highValueOpportunities = highValueResult.rows;
        
        return {
            accountManager,
            metrics,
            recentOpportunities,
            highValueOpportunities
        };
        
    } finally {
        await pool.end();
    }
}

/**
 * Generate simple slides
 */
async function generateSimpleSlides(pres, data, accountManager, meetingDate) {
    const colors = {
        primary: '1f2937',
        secondary: '6b7280',
        success: '22c55e',
        warning: 'f59e0b',
        info: '3b82f6'
    };
    
    // Title slide
    const titleSlide = pres.addSlide();
    titleSlide.addText(`${accountManager} Weekly Report`, {
        x: 1, y: 2, w: 8, h: 1.5,
        fontSize: 36,
        bold: true,
        color: colors.primary,
        align: 'center'
    });
    
    titleSlide.addText(formatBusinessWeek(getBusinessWeek(meetingDate)), {
        x: 1, y: 3.5, w: 8, h: 1,
        fontSize: 24,
        color: colors.secondary,
        align: 'center'
    });
    
    titleSlide.addText(new Date().toLocaleDateString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    }), {
        x: 1, y: 5, w: 8, h: 0.5,
        fontSize: 16,
        color: colors.secondary,
        align: 'center'
    });
    
    // Executive Summary slide
    const summarySlide = pres.addSlide();
    summarySlide.addText('Executive Summary', {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 32,
        bold: true,
        color: colors.primary
    });
    
    // Summary table
    const tableData = [
        ['Status', 'Count', 'Amount'],
        ['OP100', data.metrics.op100_count.toString(), formatCurrency(data.metrics.op100_amount)],
        ['OP90', data.metrics.op90_count.toString(), formatCurrency(data.metrics.op90_amount)],
        ['OP60', data.metrics.op60_count.toString(), formatCurrency(data.metrics.op60_amount)],
        ['OP30', data.metrics.op30_count.toString(), formatCurrency(data.metrics.op30_amount)],
        ['Submitted', data.metrics.submitted_count.toString(), formatCurrency(data.metrics.submitted_amount)],
        ['LOST', data.metrics.lost_count.toString(), formatCurrency(data.metrics.lost_amount)]
    ];
    
    summarySlide.addTable(tableData, {
        x: 0.5, y: 1.5, w: 9, h: 4,
        fontSize: 14,
        border: { pt: 1, color: colors.secondary }
    });
    
    // Key metrics
    summarySlide.addText(`Total Pipeline: ${formatCurrency(data.metrics.total_pipeline_value)}`, {
        x: 0.5, y: 6, w: 9, h: 0.8,
        fontSize: 20,
        bold: true,
        color: colors.success,
        align: 'center'
    });
    
    // High-Value Opportunities slide
    if (data.highValueOpportunities.length > 0) {
        const highValueSlide = pres.addSlide();
        highValueSlide.addText('High-Value Opportunities (>$100K)', {
            x: 0.5, y: 0.5, w: 9, h: 0.8,
            fontSize: 32,
            bold: true,
            color: colors.primary
        });
        
        const highValueData = [
            ['Project', 'Client', 'Amount', 'Status'],
            ...data.highValueOpportunities.map(opp => [
                opp.project_name || 'N/A',
                opp.client || 'N/A',
                formatCurrency(opp.final_amt),
                opp.opp_status || 'N/A'
            ])
        ];
        
        highValueSlide.addTable(highValueData, {
            x: 0.5, y: 1.5, w: 9, h: 4,
            fontSize: 12,
            border: { pt: 1, color: colors.secondary }
        });
    }
    
    // Pipeline Overview slide
    const pipelineSlide = pres.addSlide();
    pipelineSlide.addText('Pipeline Status Distribution', {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 32,
        bold: true,
        color: colors.primary
    });
    
    // Status distribution as text (since charts are complex)
    const distributionText = [
        `• OP100 (Ready): ${data.metrics.op100_count} opportunities (${formatCurrency(data.metrics.op100_amount)})`,
        `• OP90 (Likely): ${data.metrics.op90_count} opportunities (${formatCurrency(data.metrics.op90_amount)})`,
        `• OP60 (Possible): ${data.metrics.op60_count} opportunities (${formatCurrency(data.metrics.op60_amount)})`,
        `• OP30 (Early): ${data.metrics.op30_count} opportunities (${formatCurrency(data.metrics.op30_amount)})`,
        `• Submitted: ${data.metrics.submitted_count} opportunities (${formatCurrency(data.metrics.submitted_amount)})`
    ].join('\n');
    
    pipelineSlide.addText(distributionText, {
        x: 0.5, y: 1.5, w: 9, h: 4,
        fontSize: 16,
        bullet: { code: '2022' }
    });
    
    // Summary slide
    const finalSlide = pres.addSlide();
    finalSlide.addText('Summary & Next Steps', {
        x: 0.5, y: 0.5, w: 9, h: 0.8,
        fontSize: 32,
        bold: true,
        color: colors.primary
    });
    
    const summaryPoints = [
        `Total active opportunities: ${data.metrics.total_opportunities}`,
        `Total pipeline value: ${formatCurrency(data.metrics.total_pipeline_value)}`,
        `Submitted this period: ${data.metrics.submitted_count} (${formatCurrency(data.metrics.submitted_amount)})`,
        `High-confidence opportunities (OP90+): ${data.metrics.op90_count + data.metrics.op100_count}`,
        'Continue focusing on advancing OP60 and OP30 opportunities',
        'Follow up on submitted proposals for feedback'
    ].join('\n');
    
    finalSlide.addText(summaryPoints, {
        x: 0.5, y: 1.5, w: 9, h: 4.5,
        fontSize: 16,
        bullet: { code: '2022' }
    });
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
    if (!amount || amount === 0) return '$0';
    
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

module.exports = {
    generateSimpleWeeklyPresentation
};