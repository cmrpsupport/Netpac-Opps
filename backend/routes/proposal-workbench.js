const db = require('../../db_adapter');
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const XlsxPopulate = require('xlsx-populate');
const GoogleDriveService = require('../../google_drive_service');

// Add JSON parsing middleware for this router
router.use(express.json());

// Database-backed schedule storage (replaces MOCK_SCHEDULE)
// Note: Custom tasks are still stored in localStorage (frontend)

// Map database status to proposal workbench status
function mapDatabaseStatusToWorkbenchStatus(dbStatus) {
    const statusMap = {
        'Submitted': 'submitted',
        'On-Going': 'ongoing', 
        'For Approval': 'for_approval',
        'For Revision': 'for_revision',
        'Not Yet Started': 'not_yet_started',
        'No Decision Yet': 'no_decision_yet',
        'Declined': 'declined',
        'Awarded': 'awarded',
        'Lost': 'lost'
    };
    return statusMap[dbStatus] || 'unknown';
}

// Map workbench status back to database status
function mapWorkbenchStatusToDatabase(workbenchStatus) {
    const statusMap = {
        'submitted': 'Submitted',
        'ongoing': 'On-Going',
        'for_approval': 'For Approval',
        'for_revision': 'For Revision', 
        'not_yet_started': 'Not Yet Started',
        'no_decision_yet': 'No Decision Yet',
        'pending': 'No Decision Yet',
        'declined': 'Declined',
        'awarded': 'Awarded',
        'lost': 'Lost'
    };
    return statusMap[workbenchStatus] || workbenchStatus;
}

// Check if user should see all proposals (admin/manager roles)
function canViewAllProposals(userRoles) {
    if (!userRoles || !Array.isArray(userRoles)) return false;
    const adminRoles = ['ADMIN', 'MANAGER'];
    return userRoles.some(role => adminRoles.includes(role.toUpperCase()));
}

// --- ROUTES ---

// Get proposals for the workbench
router.get('/proposals/workbench', async (req, res) => {
    try {
        console.log('[DATABASE] Fetching real proposals for workbench');
        
        // Get user info from the authenticated token
        const userId = req.user.id;
        const userName = req.user.name;
        const userRoles = req.user.roles || [];
        
        console.log(`[ACCOUNT-FILTER] User: ${userName} (${userId}), Roles: ${userRoles.join(', ')}`);
        
        // Always fetch all proposals - filtering will be done on frontend
        const query = `
            SELECT 
                uid,
                project_name,
                client,
                status,
                final_amt,
                account_mgr,
                remarks_comments,
                submitted_date,
                rev,
                opp_status,
                pic,
                bom,
                solutions
            FROM opps_monitoring 
            WHERE status IN ('Submitted', 'On-Going', 'For Approval', 'For Revision', 'Not Yet Started', 'No Decision Yet')
            ORDER BY
                CASE status
                    WHEN 'For Revision' THEN 1
                    WHEN 'On-Going' THEN 2
                    WHEN 'For Approval' THEN 3
                    WHEN 'Submitted' THEN 4
                    WHEN 'Not Yet Started' THEN 5
                    WHEN 'No Decision Yet' THEN 6
                    ELSE 7
                END,
                submitted_date DESC NULLS LAST,
                project_name
        `;

        const result = await db.query(query);
        
        // Transform database results to match workbench format
        const proposals = result.rows.map(row => ({
            uid: row.uid,
            project_name: row.project_name,
            client_name: row.client,
            status: mapDatabaseStatusToWorkbenchStatus(row.status),
            final_amount: parseFloat(row.final_amt) || 0,
            revision_number: row.rev !== null && row.rev !== undefined ? parseInt(row.rev) : 1,
            account_manager: row.account_mgr,
            comment: row.remarks_comments,
            submission_date: row.submitted_date,
            opp_status: row.opp_status,
            pic: row.pic,
            bom: row.bom,
            solutions: row.solutions
        }));
        
        // Add user info to response for frontend filtering
        const response = {
            proposals,
            user: {
                name: userName,
                roles: userRoles,
                isAdmin: canViewAllProposals(userRoles)
            }
        };
        
        console.log(`[DATABASE] Retrieved ${proposals.length} proposals for workbench`);
        res.json(response);
        
    } catch (error) {
        console.error('[ERROR] Failed to fetch proposals for workbench:', error);
        res.status(500).json({ error: 'Failed to fetch proposals' });
    }
});

// EXCEL SYNC ENDPOINT - moved to top for priority
router.post('/sync-from-drive/:proposalUid', async (req, res) => {
    try {
        const { proposalUid } = req.params;
        const userId = req.user?.id;
        const userName = req.user?.name || req.user?.email;
        
        console.log(`[EXCEL_SYNC] Starting sync for proposal ${proposalUid} by user ${userId}`);
        
        if (!proposalUid) {
            return res.status(400).json({ error: 'Proposal UID is required' });
        }
        
        // Initialize Google Drive service
        const driveService = new GoogleDriveService();
        await driveService.initialize();
        
        // Sync proposal from Drive and get Excel file
        const syncResult = await driveService.syncProposalFromDrive(proposalUid);
        
        if (!syncResult.success) {
            console.log(`[EXCEL_SYNC] Sync failed: ${syncResult.error}`);
            return res.status(400).json({ 
                success: false, 
                error: syncResult.error,
                step: 'drive_sync'
            });
        }
        
        // Parse Excel file with password
        console.log(`[EXCEL_SYNC] Attempting to parse Excel file: ${syncResult.excelFile.name} (Rev: ${syncResult.excelFile.revisionNumber})`);
        console.log(`[EXCEL_SYNC] File size: ${syncResult.excelFile.buffer.length} bytes`);
        
        // For debugging: save first few KB to check if download is working
        const sampleSize = Math.min(1024, syncResult.excelFile.buffer.length);
        const sampleHex = syncResult.excelFile.buffer.slice(0, sampleSize).toString('hex').substring(0, 100);
        console.log(`[EXCEL_SYNC] File sample (first 50 hex chars): ${sampleHex}`);
        
        // Try multiple password variations and parsing approaches
        const passwordVariations = [
            null, // Try without password first
            '0601CMRP!',
            '0601CMRP',
            '0601cmrp!',
            '0601cmrp',
            // Add some variations based on common mistakes
            '0601 CMRP!',
            '0601_CMRP!',
            'CMRP0601!',
            '0601cmrp'
        ];
        
        let excelData = null;
        let lastError = null;
        
        for (const password of passwordVariations) {
            const passwordLabel = password === null ? 'no password' : `"${password}"`;
            console.log(`[EXCEL_SYNC] Trying with: ${passwordLabel}`);
            excelData = await parseExcelFile(syncResult.excelFile.buffer, password);
            if (excelData.success) {
                console.log(`[EXCEL_SYNC] Successfully parsed with: ${passwordLabel}`);
                break;
            } else {
                lastError = excelData.error;
                console.log(`[EXCEL_SYNC] Failed with ${passwordLabel}: ${excelData.error}`);
            }
        }
        
        if (!excelData || !excelData.success) {
            console.log(`[EXCEL_SYNC] Excel parsing failed for file ${syncResult.excelFile.name} with all password attempts: ${lastError}`);
            return res.status(400).json({ 
                success: false, 
                error: `Failed to parse Excel file "${syncResult.excelFile.name}" with all password attempts. Last error: ${lastError}`,
                step: 'excel_parse',
                fileName: syncResult.excelFile.name,
                revisionNumber: syncResult.excelFile.revisionNumber,
                passwordsAttempted: passwordVariations
            });
        }
        
        // Update proposal in database
        const updateResult = await updateProposalFromExcel(
            req.db, 
            proposalUid, 
            {
                revisionNumber: syncResult.excelFile.revisionNumber,
                margin: excelData.margin,
                finalAmount: excelData.finalAmount,
                submittedDate: syncResult.excelFile.modifiedTime,
                excelFileName: syncResult.excelFile.name
            },
            userName
        );
        
        if (!updateResult.success) {
            console.log(`[EXCEL_SYNC] Database update failed: ${updateResult.error}`);
            return res.status(500).json({ 
                success: false, 
                error: updateResult.error,
                step: 'database_update'
            });
        }
        
        console.log(`[EXCEL_SYNC] Successfully synced proposal ${proposalUid}`);
        
        res.json({
            success: true,
            proposalUid: proposalUid,
            syncedData: {
                revisionNumber: syncResult.excelFile.revisionNumber,
                margin: excelData.margin,
                finalAmount: excelData.finalAmount,
                submittedDate: syncResult.excelFile.modifiedTime,
                excelFileName: syncResult.excelFile.name
            },
            calcsheetFolder: syncResult.calcsheetFolder
        });
        
    } catch (error) {
        console.error('[ERROR] Excel sync failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Excel sync failed: ' + error.message,
            step: 'general_error'
        });
    }
});

// Get available PICs for filtering (available to all users)
router.get('/proposals/pics', async (req, res) => {
    try {
        // Get user roles
        const userRoles = req.user.roles || [];
        
        // Allow all authenticated users to access PIC filtering
        // Admins/Managers can see all PICs, regular users can see all PICs too for filtering purposes
        
        console.log('[DATABASE] Fetching available PICs/BOMs for filtering');
        
        const query = `
            SELECT person_name, SUM(proposal_count) as total_count
            FROM (
                SELECT pic as person_name, COUNT(*) as proposal_count
                FROM opps_monitoring 
                WHERE status IN ('Submitted', 'On-Going', 'For Approval', 'For Revision', 'Not Yet Started', 'No Decision Yet')
                    AND pic IS NOT NULL 
                    AND pic != ''
                GROUP BY pic
                
                UNION ALL
                
                SELECT bom as person_name, COUNT(*) as proposal_count
                FROM opps_monitoring 
                WHERE status IN ('Submitted', 'On-Going', 'For Approval', 'For Revision', 'Not Yet Started', 'No Decision Yet')
                    AND bom IS NOT NULL 
                    AND bom != ''
                GROUP BY bom
            ) combined
            GROUP BY person_name
            ORDER BY total_count DESC, person_name
        `;

        const result = await db.query(query);
        
        const pics = result.rows.map(row => ({
            pic: row.person_name,
            count: parseInt(row.total_count)
        }));
        
        console.log(`[DATABASE] Retrieved ${pics.length} PICs/BOMs for filtering`);
        res.json(pics);
        
    } catch (error) {
        console.error('[ERROR] Failed to fetch PICs:', error);
        res.status(500).json({ error: 'Failed to fetch PICs' });
    }
});

// Update proposal status
router.put('/proposals/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        console.log(`[DATABASE] Updating proposal ${id} status to ${status}`);
        
        // Map workbench status to database status
        const dbStatus = mapWorkbenchStatusToDatabase(status);
        
        const query = `
            UPDATE opps_monitoring
            SET status = ?
            WHERE uid = ?
            RETURNING uid, project_name, client, status, final_amt, account_mgr, remarks_comments, pic
        `;

        const result = await db.query(query, [dbStatus, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proposal not found' });
        }
        
        const updatedRow = result.rows[0];
        const proposal = {
            uid: updatedRow.uid,
            project_name: updatedRow.project_name,
            client_name: updatedRow.client,
            status: mapDatabaseStatusToWorkbenchStatus(updatedRow.status),
            final_amount: parseFloat(updatedRow.final_amt) || 0,
            account_manager: updatedRow.account_mgr,
            comment: updatedRow.remarks_comments,
            pic: updatedRow.pic
        };
        
        console.log(`[DATABASE] Successfully updated proposal ${id} status`);
        res.json({ success: true, proposal });
        
    } catch (error) {
        console.error(`[ERROR] Failed to update proposal ${req.params.id} status:`, error);
        res.status(500).json({ error: 'Failed to update proposal status' });
    }
});

// Update proposal comment
router.put('/proposals/:id/comment', async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        
        console.log(`[DATABASE] Updating proposal ${id} comment`);
        
        const query = `
            UPDATE opps_monitoring
            SET remarks_comments = ?
            WHERE uid = ?
            RETURNING uid, project_name, client, status, final_amt, account_mgr, remarks_comments, pic
        `;

        const result = await db.query(query, [comment, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proposal not found' });
        }
        
        const updatedRow = result.rows[0];
        const proposal = {
            uid: updatedRow.uid,
            project_name: updatedRow.project_name,
            client_name: updatedRow.client,
            status: mapDatabaseStatusToWorkbenchStatus(updatedRow.status),
            final_amount: parseFloat(updatedRow.final_amt) || 0,
            account_manager: updatedRow.account_mgr,
            comment: updatedRow.remarks_comments,
            pic: updatedRow.pic
        };
        
        console.log(`[DATABASE] Successfully updated proposal ${id} comment`);
        res.json({ success: true, proposal });
        
    } catch (error) {
        console.error(`[ERROR] Failed to update proposal ${req.params.id} comment:`, error);
        res.status(500).json({ error: 'Failed to update proposal comment' });
    }
});

// Update proposal fields (revision, final amount, margin, opp status, submission date)
router.put('/proposals/:id/fields', async (req, res) => {
    try {
        const { id } = req.params;
        const { revision_number, final_amount, margin, opp_status, submission_date } = req.body;
        
        console.log(`[DATABASE] Updating proposal ${id} fields`);
        
        // Build dynamic query based on provided fields
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        if (revision_number !== undefined) {
            updateFields.push(`rev = ?`);
            values.push(revision_number);
        }

        if (final_amount !== undefined) {
            updateFields.push(`final_amt = ?`);
            values.push(final_amount);
        }

        if (margin !== undefined) {
            updateFields.push(`margin = ?`);
            values.push(margin);
        }

        if (opp_status !== undefined) {
            updateFields.push(`opp_status = ?`);
            values.push(opp_status);
        }

        if (submission_date !== undefined) {
            updateFields.push(`submitted_date = ?`);
            values.push(submission_date || null);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields provided to update' });
        }

        // Add the proposal ID as the last parameter
        values.push(id);

        const query = `
            UPDATE opps_monitoring
            SET ${updateFields.join(', ')}
            WHERE uid = ?
            RETURNING uid, project_name, client, status, final_amt, account_mgr, remarks_comments, pic, bom, rev, margin, opp_status, submitted_date
        `;

        const result = await db.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proposal not found' });
        }
        
        const updatedRow = result.rows[0];
        const proposal = {
            uid: updatedRow.uid,
            project_name: updatedRow.project_name,
            client_name: updatedRow.client,
            status: mapDatabaseStatusToWorkbenchStatus(updatedRow.status),
            final_amount: parseFloat(updatedRow.final_amt) || 0,
            account_manager: updatedRow.account_mgr,
            comment: updatedRow.remarks_comments,
            pic: updatedRow.pic,
            bom: updatedRow.bom,
            revision_number: updatedRow.rev !== null && updatedRow.rev !== undefined ? parseInt(updatedRow.rev) : 1,
            margin: parseFloat(updatedRow.margin) || 0,
            opp_status: updatedRow.opp_status,
            submission_date: updatedRow.submitted_date
        };
        
        console.log(`[DATABASE] Successfully updated proposal ${id} fields: ${updateFields.join(', ')}`);
        res.json({ success: true, proposal });
        
    } catch (error) {
        console.error(`[ERROR] Failed to update proposal ${req.params.id} fields:`, error);
        res.status(500).json({ error: 'Failed to update proposal fields' });
    }
});

// --- SCHEDULE ROUTES (Using database storage) ---

// Get schedule for a specific week
router.get('/schedule', async (req, res) => {
    try {
        const { week, user_id, pic } = req.query; // Expects YYYY-MM-DD format (Monday of the week)
        console.log(`[SCHEDULE] Fetching schedule for week: ${week}, user: ${user_id}, pic: ${pic} (using database)`);
        
        if (!week) {
            return res.status(400).json({ error: 'Week parameter is required (YYYY-MM-DD format)' });
        }

        // Get user info from the authenticated token
        const currentUserId = req.user?.id;
        const currentUserName = req.user?.name;
        const userRoles = req.user?.roles || [];
        
        // Determine which user's schedule to fetch
        let targetUserId = currentUserId; // Default to current user
        
        // If user_id is provided in query, allow viewing for collaboration purposes
        if (user_id && user_id !== 'current') {
            targetUserId = user_id === 'all' ? null : user_id; // null means all users
            console.log(`[SCHEDULE] User ${currentUserName} viewing schedule for user: ${user_id}`);
        } else {
            console.log(`[SCHEDULE] User ${currentUserName} viewing their own schedule`);
        }
        
        // Get proposals for the week
        const proposalQuery = `
            SELECT
                ps.day_index,
                ps.proposal_id as id,
                ps.proposal_name as name,
                ps.id as schedule_id,
                om.project_name,
                om.client,
                om.status,
                om.final_amt,
                om.pic,
                ps.user_id,
                u.name as created_by
            FROM proposal_schedule ps
            LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
            LEFT JOIN users u ON ps.user_id = u.id
            WHERE ps.week_start_date = ?
            ${targetUserId ? 'AND ps.user_id = ?' : ''}
            ORDER BY ps.day_index
        `;

        const proposalParams = targetUserId ? [week, targetUserId] : [week];
        const proposalResult = await db.query(proposalQuery, proposalParams);

        // Get custom tasks for the week
        const taskQuery = `
            SELECT
                ct.day_index,
                ct.task_id as id,
                ct.title,
                ct.description,
                ct.time,
                ct.is_all_day as isAllDay,
                ct.comment,
                ct.id as db_id,
                ct.user_id,
                u.name as created_by
            FROM custom_tasks ct
            LEFT JOIN users u ON ct.user_id = u.id
            WHERE ct.week_start_date = ?
            ${targetUserId ? 'AND ct.user_id = ?' : ''}
            ORDER BY ct.day_index
        `;

        const taskParams = targetUserId ? [week, targetUserId] : [week];
        const taskResult = await db.query(taskQuery, taskParams);

        // Transform the result into the expected format
        const scheduleForWeek = {
            proposals: {},
            customTasks: {}
        };

        // Organize proposals by day
        proposalResult.rows.forEach(row => {
            // Apply PIC filter if specified
            if (pic && pic.trim() !== '' && row.pic !== pic) {
                return; // Skip this proposal
            }

            if (!scheduleForWeek.proposals[row.day_index]) {
                scheduleForWeek.proposals[row.day_index] = [];
            }

            scheduleForWeek.proposals[row.day_index].push({
                id: row.id,
                name: row.name,
                schedule_id: row.schedule_id,
                project_name: row.project_name,
                client: row.client,
                status: row.status,
                final_amt: row.final_amt,
                pic: row.pic,
                user_id: row.user_id,
                created_by: row.created_by,
                type: 'proposal'
            });
        });

        // Organize custom tasks by day
        taskResult.rows.forEach(row => {
            if (!scheduleForWeek.customTasks[row.day_index]) {
                scheduleForWeek.customTasks[row.day_index] = [];
            }

            scheduleForWeek.customTasks[row.day_index].push({
                id: row.id,
                title: row.title,
                description: row.description,
                time: row.time,
                isAllDay: row.isAllDay,
                comment: row.comment,
                db_id: row.db_id,
                user_id: row.user_id,
                created_by: row.created_by,
                type: 'custom'
            });
        });

        // Apply PIC filter logging if specified
        if (pic && pic.trim() !== '') {
            const totalProposals = proposalResult.rows.length;
            const filteredCount = Object.values(scheduleForWeek.proposals).reduce((sum, arr) => sum + arr.length, 0);
            console.log(`[SCHEDULE] PIC filter applied: ${totalProposals} -> ${filteredCount} proposals`);
        }

        const totalDays = Object.keys({...scheduleForWeek.proposals, ...scheduleForWeek.customTasks}).length;
        console.log(`[SCHEDULE] Retrieved ${totalDays} scheduled days for week ${week} (user: ${targetUserId || 'all'}, pic: ${pic || 'all'})`);
        res.json(scheduleForWeek);
        
    } catch (error) {
        console.error('[ERROR] Failed to fetch schedule:', error);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

// Add a proposal to the schedule
router.post('/schedule/add', async (req, res) => {
    try {
        const { proposalId, proposalName, dayIndex, week } = req.body;
        const scheduledBy = req.user?.name || 'unknown';
        const userId = req.user?.id;
        
        console.log(`[SCHEDULE] Adding ${proposalId} to schedule on week ${week}, day ${dayIndex} by ${scheduledBy} (user: ${userId})`);
        
        // Validate input
        if (!proposalId || !proposalName || dayIndex === undefined || !week) {
            return res.status(400).json({ error: 'Missing required fields: proposalId, proposalName, dayIndex, week' });
        }
        
        if (dayIndex < 0 || dayIndex > 6) {
            return res.status(400).json({ error: 'dayIndex must be between 0 (Monday) and 6 (Sunday)' });
        }
        
        // Check if the proposal is already scheduled for this exact day (prevent exact duplicates only)
        const existingResult = await db.query(
            'SELECT id FROM proposal_schedule WHERE proposal_id = ? AND week_start_date = ? AND day_index = ? AND user_id = ?',
            [proposalId, week, dayIndex, userId]
        );
        
        if (existingResult.rows.length > 0) {
            // Already scheduled for the exact same day - do nothing
            console.log(`[SCHEDULE] Proposal ${proposalId} already scheduled for day ${dayIndex} for user ${userId}`);
            res.status(200).json({ success: true, message: 'Proposal already scheduled for this day' });
            return;
        }
        
        // Add new proposal to schedule
        const result = await db.query(
            `INSERT INTO proposal_schedule (proposal_id, proposal_name, week_start_date, day_index, user_id, scheduled_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            [proposalId, proposalName, week, dayIndex, userId, scheduledBy]
        );
        
        if (result.rows.length > 0) {
            console.log(`[SCHEDULE] Successfully added ${proposalId} to schedule for user ${userId}`);
            res.status(201).json({ success: true });
        } else {
            console.error(`[SCHEDULE] Failed to add ${proposalId} to schedule`);
            res.status(500).json({ error: 'Failed to add proposal to schedule' });
        }
        
    } catch (error) {
        console.error('[ERROR] Failed to add proposal to schedule:', error);
        
        // Handle duplicate key errors gracefully
        if (error.code === '23505') { // PostgreSQL unique violation
            res.status(409).json({ error: 'Proposal is already scheduled for this week' });
        } else {
            res.status(500).json({ error: 'Failed to add proposal to schedule' });
        }
    }
});

// Move a proposal to a different day in schedule
router.put('/schedule/proposals/:proposalId/move', async (req, res) => {
    try {
        const { proposalId } = req.params;
        const { newWeekStartDate, newDayIndex, sourceDayIndex, sourceWeekStartDate } = req.body;
        const userId = req.user?.id;
        
        console.log(`[SCHEDULE] Moving proposal ${proposalId} from day ${sourceDayIndex} to day ${newDayIndex} of week ${newWeekStartDate} (user: ${userId})`);
        
        // Validate input
        if (!proposalId || !newWeekStartDate || newDayIndex === undefined || sourceDayIndex === undefined || !sourceWeekStartDate) {
            return res.status(400).json({ error: 'Missing required fields: proposalId, newWeekStartDate, newDayIndex, sourceDayIndex, sourceWeekStartDate' });
        }
        
        if (newDayIndex < 0 || newDayIndex > 6) {
            return res.status(400).json({ error: 'newDayIndex must be between 0 (Monday) and 6 (Sunday)' });
        }
        
        // Get proposal name for the move operation
        const proposalResult = await db.query(
            'SELECT project_name FROM opps_monitoring WHERE uid = ?',
            [proposalId]
        );
        
        if (proposalResult.rows.length === 0) {
            return res.status(404).json({ error: 'Proposal not found' });
        }
        
        const proposalName = proposalResult.rows[0].project_name;
        
        // Get the current completion status from the specific source position
        const completionResult = await db.query(
            'SELECT is_completed, completed_at, completion_notes FROM schedule_task_completion WHERE task_id = ? AND task_type = ? AND week_start_date = ? AND day_index = ? AND user_id = ?',
            [proposalId, 'proposal', sourceWeekStartDate, sourceDayIndex, userId]
        );
        const currentCompletion = completionResult.rows[0];

        // First, remove the proposal from its specific current schedule position
        await db.query(
            'DELETE FROM proposal_schedule WHERE proposal_id = ? AND user_id = ? AND week_start_date = ? AND day_index = ?',
            [proposalId, userId, sourceWeekStartDate, sourceDayIndex]
        );

        // Then add it to the new position
        const result = await db.query(
            `INSERT INTO proposal_schedule (proposal_id, proposal_name, week_start_date, day_index, user_id, scheduled_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id, proposal_id, week_start_date, day_index) DO UPDATE SET
             updated_at = CURRENT_TIMESTAMP
             RETURNING id`,
            [proposalId, proposalName, newWeekStartDate, newDayIndex, userId, req.user?.name || 'unknown']
        );

        // If the task was completed before moving, restore its completion status
        if (currentCompletion && currentCompletion.is_completed) {
            await db.query(
                `INSERT INTO schedule_task_completion (task_id, task_type, week_start_date, day_index, user_id, is_completed, completed_at, completion_notes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (task_id, task_type, week_start_date, day_index, user_id) DO UPDATE SET
                 is_completed = ?, completed_at = ?, completion_notes = ?, updated_at = CURRENT_TIMESTAMP`,
                [proposalId, 'proposal', newWeekStartDate, newDayIndex, userId, true, currentCompletion.completed_at, currentCompletion.completion_notes, true, currentCompletion.completed_at, currentCompletion.completion_notes]
            );
            console.log(`[SCHEDULE] Preserved completion status for moved proposal ${proposalId}`);
        }
        
        if (result.rows.length > 0) {
            // Clean up the old completion status from the source position
            await db.query(
                'DELETE FROM schedule_task_completion WHERE task_id = ? AND task_type = ? AND week_start_date = ? AND day_index = ? AND user_id = ?',
                [proposalId, 'proposal', sourceWeekStartDate, sourceDayIndex, userId]
            );
            
            console.log(`[SCHEDULE] Successfully moved proposal ${proposalId} from day ${sourceDayIndex} to day ${newDayIndex}`);
            res.json({ success: true });
        } else {
            console.error(`[SCHEDULE] Failed to move proposal ${proposalId}`);
            res.status(500).json({ error: 'Failed to move proposal' });
        }
        
    } catch (error) {
        console.error('[ERROR] Failed to move proposal:', error);
        res.status(500).json({ error: 'Failed to move proposal: ' + error.message });
    }
});

// Remove a proposal from the schedule
router.post('/schedule/remove', async (req, res) => {
    try {
        const { proposalId, week } = req.body;
        const userId = req.user?.id;
        
        console.log(`[SCHEDULE] Removing ${proposalId} from schedule on week ${week} (user: ${userId})`);
        
        // Validate input
        if (!proposalId || !week) {
            return res.status(400).json({ error: 'Missing required fields: proposalId, week' });
        }
        
        // Use the database function to remove from schedule (now with user_id)
        const result = await db.query(
            'SELECT remove_proposal_from_schedule(?, ?, ?) as success',
            [proposalId, week, userId]
        );
        
        if (result.rows[0].success) {
            console.log(`[SCHEDULE] Successfully removed ${proposalId} from schedule for user ${userId}`);
            res.json({ success: true });
        } else {
            console.log(`[SCHEDULE] Proposal ${proposalId} was not found in week ${week} schedule for user ${userId}`);
            res.json({ success: true, message: 'Proposal was not scheduled for this week' });
        }
        
    } catch (error) {
        console.error('[ERROR] Failed to remove proposal from schedule:', error);
        res.status(500).json({ error: 'Failed to remove proposal from schedule' });
    }
});

// --- CUSTOM TASK ROUTES ---

// Add a custom task
router.post('/schedule/tasks/add', async (req, res) => {
    try {
        const { taskId, weekStartDate, dayIndex, title, description, time, isAllDay, comment } = req.body;
        const userId = req.user?.id;
        
        console.log(`[CUSTOM_TASK] Adding task ${taskId} for user ${userId} on week ${weekStartDate}, day ${dayIndex}`);
        
        // Validate input
        if (!taskId || !weekStartDate || dayIndex === undefined || !title || !userId) {
            return res.status(400).json({ error: 'Missing required fields: taskId, weekStartDate, dayIndex, title' });
        }
        
        if (dayIndex < 0 || dayIndex > 6) {
            return res.status(400).json({ error: 'dayIndex must be between 0 (Monday) and 6 (Sunday)' });
        }
        
        // Use the database function to add the custom task
        const result = await db.query(
            'SELECT add_custom_task(?, ?, ?, ?, ?, ?, ?, ?, ?) as success',
            [taskId, userId, weekStartDate, dayIndex, title, description, time, isAllDay || false, comment]
        );
        
        if (result.rows[0].success) {
            console.log(`[CUSTOM_TASK] Successfully added task ${taskId}`);
            res.status(201).json({ success: true });
        } else {
            console.error(`[CUSTOM_TASK] Failed to add task ${taskId}`);
            res.status(500).json({ error: 'Failed to add custom task' });
        }
        
    } catch (error) {
        console.error('[ERROR] Failed to add custom task:', error);
        
        // Handle duplicate key errors gracefully
        if (error.code === '23505') { // PostgreSQL unique violation
            res.status(409).json({ error: 'Task ID already exists for this user' });
        } else {
            res.status(500).json({ error: 'Failed to add custom task' });
        }
    }
});

// Update a custom task
router.put('/schedule/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { title, description, time, isAllDay, comment } = req.body;
        const userId = req.user?.id;
        
        console.log(`[CUSTOM_TASK] Updating task ${taskId} for user ${userId}`);
        
        // Validate input
        if (!title || !userId) {
            return res.status(400).json({ error: 'Missing required fields: title' });
        }
        
        // Use the database function to update the custom task
        const result = await db.query(
            'SELECT update_custom_task(?, ?, ?, ?, ?, ?, ?) as success',
            [taskId, userId, title, description, time, isAllDay || false, comment]
        );
        
        if (result.rows[0].success) {
            console.log(`[CUSTOM_TASK] Successfully updated task ${taskId}`);
            res.json({ success: true });
        } else {
            console.log(`[CUSTOM_TASK] Task ${taskId} not found or access denied`);
            res.status(404).json({ error: 'Task not found or access denied' });
        }
        
    } catch (error) {
        console.error('[ERROR] Failed to update custom task:', error);
        res.status(500).json({ error: 'Failed to update custom task' });
    }
});

// Delete a custom task
router.delete('/schedule/tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user?.id;
        
        console.log(`[CUSTOM_TASK] Deleting task ${taskId} for user ${userId}`);
        
        if (!userId) {
            return res.status(401).json({ error: 'User authentication required' });
        }
        
        // Use the database function to delete the custom task
        const result = await db.query(
            'SELECT delete_custom_task(?, ?) as success',
            [taskId, userId]
        );
        
        if (result.rows[0].success) {
            console.log(`[CUSTOM_TASK] Successfully deleted task ${taskId}`);
            res.json({ success: true });
        } else {
            console.log(`[CUSTOM_TASK] Task ${taskId} not found or access denied`);
            res.status(404).json({ error: 'Task not found or access denied' });
        }
        
    } catch (error) {
        console.error('[ERROR] Failed to delete custom task:', error);
        res.status(500).json({ error: 'Failed to delete custom task' });
    }
});

// Move a custom task to a different day/week
router.put('/schedule/tasks/:taskId/move', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { newWeekStartDate, newDayIndex } = req.body;
        const userId = req.user?.id;
        
        console.log(`[CUSTOM_TASK] Moving task ${taskId} for user ${userId} to week ${newWeekStartDate}, day ${newDayIndex}`);
        
        // Validate input
        if (!newWeekStartDate || newDayIndex === undefined || !userId) {
            return res.status(400).json({ error: 'Missing required fields: newWeekStartDate, newDayIndex' });
        }
        
        if (newDayIndex < 0 || newDayIndex > 6) {
            return res.status(400).json({ error: 'newDayIndex must be between 0 (Monday) and 6 (Sunday)' });
        }
        
        // Use the database function to move the custom task
        const result = await db.query(
            'SELECT move_custom_task(?, ?, ?, ?) as success',
            [taskId, userId, newWeekStartDate, newDayIndex]
        );
        
        if (result.rows[0].success) {
            console.log(`[CUSTOM_TASK] Successfully moved task ${taskId}`);
            res.json({ success: true });
        } else {
            console.log(`[CUSTOM_TASK] Task ${taskId} not found or access denied`);
            res.status(404).json({ error: 'Task not found or access denied' });
        }
        
    } catch (error) {
        console.error('[ERROR] Failed to move custom task:', error);
        res.status(500).json({ error: 'Failed to move custom task' });
    }
});

// Get users who have scheduled items (for user filtering dropdown)
router.get('/schedule/users', async (req, res) => {
    try {
        // Allow all authenticated users to view schedule users for collaboration
        // This enables users to see who has scheduled items for better coordination
        
        console.log('[SCHEDULE] Fetching users with scheduled items');

        // Get users with scheduled items (SQLite version)
        const query = `
            SELECT
                user_id,
                user_name,
                SUM(count) as schedule_count
            FROM (
                SELECT ps.user_id, u.name as user_name, COUNT(*) as count
                FROM proposal_schedule ps
                LEFT JOIN users u ON ps.user_id = u.id
                WHERE ps.user_id IS NOT NULL
                GROUP BY ps.user_id, u.name

                UNION ALL

                SELECT ct.user_id, u.name as user_name, COUNT(*) as count
                FROM custom_tasks ct
                LEFT JOIN users u ON ct.user_id = u.id
                WHERE ct.user_id IS NOT NULL
                GROUP BY ct.user_id, u.name
            ) schedule_users
            WHERE user_id IS NOT NULL
            GROUP BY user_id, user_name
            ORDER BY schedule_count DESC, user_name
        `;

        const result = await db.query(query);

        // Transform the result to match expected format
        const users = result.rows.map(row => ({
            id: row.user_id,
            username: row.user_name,
            schedule_count: parseInt(row.schedule_count)
        }));

        console.log(`[SCHEDULE] Retrieved ${users.length} users with scheduled items`);
        res.json(users);
        
    } catch (error) {
        console.error('[ERROR] Failed to fetch schedule users:', error);
        res.status(500).json({ error: 'Failed to fetch schedule users' });
    }
});

// Helper function to parse Excel file using xlsx-populate (another approach)
async function parseExcelFileWithPopulate(buffer, password) {
    try {
        console.log(`📊 Trying xlsx-populate library for password-protected file... Buffer size: ${buffer.length} bytes, Password: "${password}"`);
        
        const workbook = await XlsxPopulate.fromDataAsync(buffer, { password: password });
        
        console.log('✅ Successfully loaded Excel file with xlsx-populate');
        
        // Find the Summary worksheet
        const summarySheet = workbook.sheet('Summary');
        if (!summarySheet) {
            return {
                success: false,
                error: 'Summary sheet not found in Excel file'
            };
        }
        
        // Read specific cells: E48 (margin) and F50 (final amount)
        const marginValue = summarySheet.cell('E48').value();
        const finalAmountValue = summarySheet.cell('F50').value();
        
        // Extract values
        let margin = marginValue ? parseNumericValue(marginValue) : null;
        const finalAmount = finalAmountValue ? parseNumericValue(finalAmountValue) : null;
        
        // Always convert margin from decimal to percentage (e.g., 0.30 -> 30) and format to 2 decimal places
        if (margin !== null) {
            const originalMargin = margin;
            margin = parseFloat((margin * 100).toFixed(2));
            console.log(`📊 Converting margin from ${originalMargin} to ${margin}% (multiplied by 100)`);
        }
        
        // Format final amount to 2 decimal places
        const formattedFinalAmount = finalAmount !== null ? parseFloat(finalAmount.toFixed(2)) : null;

        // Try to extract additional data from General Info sheet
        let clientName = null;
        let pic = null;
        let accountManager = null;
        
        try {
            const generalInfoSheet = workbook.sheet('General Info');
            if (generalInfoSheet) {
                console.log('📊 Found General Info sheet with xlsx-populate, extracting client data...');
                
                // Extract Client Name from D7
                const clientValue = generalInfoSheet.cell('D7').value();
                clientName = clientValue ? String(clientValue).trim() : null;
                
                // Extract PIC from D25
                const picValue = generalInfoSheet.cell('D25').value();
                pic = picValue ? String(picValue).trim() : null;
                
                // Extract Account Manager from D26
                const accountMgrValue = generalInfoSheet.cell('D26').value();
                accountManager = accountMgrValue ? String(accountMgrValue).trim() : null;
                
                console.log(`📊 Extracted from General Info - Client: "${clientName}", PIC: "${pic}", Account Manager: "${accountManager}"`);
            } else {
                console.log('⚠️ General Info sheet not found in xlsx-populate, skipping client data extraction');
            }
        } catch (error) {
            console.log('⚠️ Error accessing General Info sheet with xlsx-populate:', error.message);
        }
        
        console.log(`✅ Successfully parsed Excel file with xlsx-populate - Margin: ${margin}%, Final Amount: ${formattedFinalAmount}`);
        
        return {
            success: true,
            margin: margin,
            finalAmount: formattedFinalAmount,
            clientName: clientName,
            pic: pic,
            accountManager: accountManager
        };
        
    } catch (error) {
        console.error('❌ xlsx-populate failed to parse Excel file:', error.message);
        return {
            success: false,
            error: `xlsx-populate parsing failed: ${error.message}`
        };
    }
}

// Helper function to parse Excel file using ExcelJS (better password support)
async function parseExcelFileWithExcelJS(buffer, password) {
    try {
        console.log(`📊 Trying ExcelJS library for password-protected file... Buffer size: ${buffer.length} bytes, Password: "${password}"`);
        
        const workbook = new ExcelJS.Workbook();
        
        // Load the workbook with password
        await workbook.xlsx.load(buffer, { password: password });
        
        console.log('✅ Successfully loaded Excel file with ExcelJS');
        
        // Find the Summary worksheet
        const summaryWorksheet = workbook.getWorksheet('Summary');
        if (!summaryWorksheet) {
            return {
                success: false,
                error: 'Summary sheet not found in Excel file'
            };
        }
        
        // Read specific cells: E48 (margin) and F50 (final amount)
        const marginCell = summaryWorksheet.getCell('E48');
        const finalAmountCell = summaryWorksheet.getCell('F50');
        
        // Extract values
        let margin = marginCell.value ? parseNumericValue(marginCell.value) : null;
        const finalAmount = finalAmountCell.value ? parseNumericValue(finalAmountCell.value) : null;
        
        // Always convert margin from decimal to percentage (e.g., 0.30 -> 30) and format to 2 decimal places
        if (margin !== null) {
            const originalMargin = margin;
            margin = parseFloat((margin * 100).toFixed(2));
            console.log(`📊 Converting margin from ${originalMargin} to ${margin}% (multiplied by 100)`);
        }
        
        // Format final amount to 2 decimal places
        const formattedFinalAmount = finalAmount !== null ? parseFloat(finalAmount.toFixed(2)) : null;

        // Try to extract additional data from General Info sheet
        let clientName = null;
        let pic = null;
        let accountManager = null;
        
        try {
            const generalInfoWorksheet = workbook.getWorksheet('General Info');
            if (generalInfoWorksheet) {
                console.log('📊 Found General Info sheet with ExcelJS, extracting client data...');
                
                // Extract Client Name from D7
                const clientCell = generalInfoWorksheet.getCell('D7');
                clientName = clientCell.value ? String(clientCell.value).trim() : null;
                
                // Extract PIC from D25
                const picCell = generalInfoWorksheet.getCell('D25');
                pic = picCell.value ? String(picCell.value).trim() : null;
                
                // Extract Account Manager from D26
                const accountMgrCell = generalInfoWorksheet.getCell('D26');
                accountManager = accountMgrCell.value ? String(accountMgrCell.value).trim() : null;
                
                console.log(`📊 Extracted from General Info - Client: "${clientName}", PIC: "${pic}", Account Manager: "${accountManager}"`);
            } else {
                console.log('⚠️ General Info sheet not found in ExcelJS, skipping client data extraction');
            }
        } catch (error) {
            console.log('⚠️ Error accessing General Info sheet with ExcelJS:', error.message);
        }
        
        console.log(`✅ Successfully parsed Excel file with ExcelJS - Margin: ${margin}%, Final Amount: ${formattedFinalAmount}`);
        
        return {
            success: true,
            margin: margin,
            finalAmount: formattedFinalAmount,
            clientName: clientName,
            pic: pic,
            accountManager: accountManager
        };
        
    } catch (error) {
        console.error('❌ ExcelJS failed to parse Excel file:', error.message);
        return {
            success: false,
            error: `ExcelJS parsing failed: ${error.message}`
        };
    }
}

// Helper function to parse Excel file with password
async function parseExcelFile(buffer, password) {
    try {
        const passwordInfo = password ? `"${password}"` : 'none';
        console.log(`📊 Parsing Excel file... Buffer size: ${buffer.length} bytes, Password: ${passwordInfo}`);
        
        // Check file format before attempting to parse
        const fileSignature = buffer.slice(0, 8).toString('hex');
        console.log(`📄 File signature: ${fileSignature}`);
        
        if (fileSignature.startsWith('504b0304')) {
            console.log('📊 Detected XLSX format (ZIP-based)');
        } else if (fileSignature.startsWith('d0cf11e0')) {
            console.log('📊 Detected XLS format (OLE-based)');  
        } else {
            console.warn(`⚠️ Unknown file format signature: ${fileSignature}`);
        }
        
        // Only run encryption test if we're not already trying a password
        if (!password) {
            try {
                XLSX.read(buffer, { type: 'buffer' });
                console.log('ℹ️ File appears to be unencrypted');
            } catch (error) {
                if (error.message.includes('password') || error.message.includes('encrypted') || error.message.includes('PKWARE')) {
                    console.log('🔒 File is encrypted, password required');
                } else {
                    console.log('⚠️ File read error (not password related):', error.message);
                }
            }
        }
        
        // Read Excel file with or without password
        const readOptions = {
            type: 'buffer',
            cellDates: true,
            cellNF: false,
            cellText: false
        };
        
        // Only add password if provided
        if (password) {
            readOptions.password = password;
        }
        
        let workbook;
        try {
            workbook = XLSX.read(buffer, readOptions);
            const passwordInfo = password ? `with password "${password}"` : 'without password';
            console.log(`✅ Successfully read Excel file ${passwordInfo}`);
        } catch (error) {
            console.error('❌ Failed to read Excel file:', error.message);
            console.error('Error details:', error);
            
            // Check for specific error types
            const errorMsg = error.message.toLowerCase();
            
            if (errorMsg.includes('password') || errorMsg.includes('encrypted') || errorMsg.includes('pkware') || 
                errorMsg.includes('invalid signature') || errorMsg.includes('corrupted') ||
                errorMsg.includes('unsupported encryption') || errorMsg.includes('office')) {
                
                let specificError = 'Invalid password or file is not properly encrypted';
                
                if (errorMsg.includes('unsupported encryption')) {
                    specificError = 'File uses unsupported encryption method';
                } else if (errorMsg.includes('corrupted')) {
                    specificError = 'File appears to be corrupted during download';
                } else if (errorMsg.includes('invalid signature')) {
                    specificError = 'File signature is invalid - possible download issue';
                } else if (fileSignature.startsWith('d0cf11e0')) {
                    // This is a password-protected XLS file - try multiple fallback libraries
                    console.log('🔄 XLSX library failed with password-protected XLS file, trying alternative libraries...');
                    if (password) {
                        // Try xlsx-populate first (better XLS support)
                        console.log('🔄 Trying xlsx-populate...');
                        const populateResult = await parseExcelFileWithPopulate(buffer, password);
                        if (populateResult.success) {
                            console.log('✅ xlsx-populate fallback succeeded!');
                            return populateResult;
                        } else {
                            console.log(`❌ xlsx-populate failed: ${populateResult.error}`);
                        }
                        
                        // Try ExcelJS as second fallback
                        console.log('🔄 Trying ExcelJS...');
                        const excelljsResult = await parseExcelFileWithExcelJS(buffer, password);
                        if (excelljsResult.success) {
                            console.log('✅ ExcelJS fallback succeeded!');
                            return excelljsResult;
                        } else {
                            console.log(`❌ ExcelJS failed: ${excelljsResult.error}`);
                        }
                    }
                    specificError = 'Password-protected XLS files could not be parsed with any available library (XLSX, xlsx-populate, ExcelJS)';
                }
                
                return {
                    success: false,
                    error: `${specificError}. Technical details: ${error.message}`
                };
            }
            throw error;
        }
        
        // Check if Summary sheet exists
        if (!workbook.Sheets['Summary']) {
            return {
                success: false,
                error: 'Summary sheet not found in Excel file'
            };
        }
        
        const summarySheet = workbook.Sheets['Summary'];
        
        // Read specific cells: E48 (margin) and F50 (final amount)
        const marginCell = summarySheet['E48'];
        const finalAmountCell = summarySheet['F50'];
        
        // Extract values
        let margin = marginCell ? parseNumericValue(marginCell.v) : null;
        const finalAmount = finalAmountCell ? parseNumericValue(finalAmountCell.v) : null;
        
        // Always convert margin from decimal to percentage (e.g., 0.30 -> 30) and format to 2 decimal places
        if (margin !== null) {
            const originalMargin = margin;
            margin = parseFloat((margin * 100).toFixed(2));
            console.log(`📊 Converting margin from ${originalMargin} to ${margin}% (multiplied by 100)`);
        }
        
        // Format final amount to 2 decimal places
        const formattedFinalAmount = finalAmount !== null ? parseFloat(finalAmount.toFixed(2)) : null;

        // Try to extract additional data from General Info sheet
        let clientName = null;
        let pic = null;
        let accountManager = null;
        
        if (workbook.Sheets['General Info']) {
            const generalInfoSheet = workbook.Sheets['General Info'];
            console.log('📊 Found General Info sheet, extracting client data...');
            
            // Extract Client Name from D7
            const clientCell = generalInfoSheet['D7'];
            clientName = clientCell ? (typeof clientCell.v === 'string' ? clientCell.v.trim() : String(clientCell.v || '').trim()) : null;
            
            // Extract PIC from D25
            const picCell = generalInfoSheet['D25'];
            pic = picCell ? (typeof picCell.v === 'string' ? picCell.v.trim() : String(picCell.v || '').trim()) : null;
            
            // Extract Account Manager from D26
            const accountMgrCell = generalInfoSheet['D26'];
            accountManager = accountMgrCell ? (typeof accountMgrCell.v === 'string' ? accountMgrCell.v.trim() : String(accountMgrCell.v || '').trim()) : null;
            
            console.log(`📊 Extracted from General Info - Client: "${clientName}", PIC: "${pic}", Account Manager: "${accountManager}"`);
        } else {
            console.log('⚠️ General Info sheet not found, skipping client data extraction');
        }
        
        console.log(`✅ Successfully parsed Excel file - Margin: ${margin}%, Final Amount: ${formattedFinalAmount}`);
        
        return {
            success: true,
            margin: margin,
            finalAmount: formattedFinalAmount,
            clientName: clientName,
            pic: pic,
            accountManager: accountManager
        };
        
    } catch (error) {
        console.error('❌ Failed to parse Excel file:', error.message);
        return {
            success: false,
            error: 'Failed to parse Excel file: ' + error.message
        };
    }
}

// Helper function to parse numeric values from Excel cells
function parseNumericValue(value) {
    if (value === null || value === undefined) return null;
    
    // If it's already a number, return it
    if (typeof value === 'number') return value;
    
    // If it's a string, try to parse it
    if (typeof value === 'string') {
        // Remove commas and currency symbols
        const cleaned = value.replace(/[,₱$%]/g, '').trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
    }
    
    return null;
}

// Helper function to update proposal in database
async function updateProposalFromExcel(db, proposalUid, excelData, userIdentifier) {
    try {
        console.log(`💾 Updating proposal ${proposalUid} in database...`);
        
        // Build update query dynamically based on available data
        const updateFields = [];
        const updateValues = [];

        if (excelData.revisionNumber !== null && excelData.revisionNumber !== undefined) {
            updateFields.push(`rev = ?`);
            updateValues.push(excelData.revisionNumber);
        }

        if (excelData.margin !== null) {
            updateFields.push(`margin = ?`);
            updateValues.push(excelData.margin);
        }

        if (excelData.finalAmount !== null) {
            updateFields.push(`final_amt = ?`);
            updateValues.push(excelData.finalAmount);
        }

        if (excelData.submittedDate) {
            updateFields.push(`submitted_date = ?`);
            updateValues.push(new Date(excelData.submittedDate));
        }

        // Add metadata fields (check if columns exist first)
        try {
            // Check if last_excel_sync column exists
            const columnCheck = await db.query(`
                SELECT COUNT(*) as column_exists
                FROM pragma_table_info('opps_monitoring')
                WHERE name = 'last_excel_sync'
            `);

            if (columnCheck.rows[0].column_exists > 0) {
                updateFields.push(`last_excel_sync = ?`);
                updateValues.push(new Date());
            } else {
                console.log('[EXCEL_SYNC] Warning: last_excel_sync column does not exist, skipping metadata update');
            }
        } catch (err) {
            console.log('[EXCEL_SYNC] Could not check for last_excel_sync column:', err.message);
        }

        try {
            // Check if last_excel_file column exists
            const columnCheck = await db.query(`
                SELECT COUNT(*) as column_exists
                FROM pragma_table_info('opps_monitoring')
                WHERE name = 'last_excel_file'
            `);

            if (columnCheck.rows[0].column_exists > 0) {
                updateFields.push(`last_excel_file = ?`);
                updateValues.push(excelData.excelFileName);
            }
        } catch (err) {
            console.log('[EXCEL_SYNC] Could not check for last_excel_file column:', err.message);
        }

        try {
            // Check if excel_synced_by column exists
            const columnCheck = await db.query(`
                SELECT COUNT(*) as column_exists
                FROM pragma_table_info('opps_monitoring')
                WHERE name = 'excel_synced_by'
            `);

            if (columnCheck.rows[0].column_exists > 0) {
                updateFields.push(`excel_synced_by = ?`);
                updateValues.push(userIdentifier); // Store user name/email instead of UUID
            }
        } catch (err) {
            console.log('[EXCEL_SYNC] Could not check for excel_synced_by column:', err.message);
        }

        // Add WHERE clause parameter
        updateValues.push(proposalUid);

        if (updateFields.length === 0) { // No fields to update
            return {
                success: false,
                error: 'No data to update from Excel file'
            };
        }

        const updateQuery = `
            UPDATE opps_monitoring
            SET ${updateFields.join(', ')}
            WHERE uid = ?
        `;
        
        console.log(`[EXCEL_SYNC] Executing update query with ${updateFields.length} fields`);
        
        const result = await db.query(updateQuery, updateValues);
        
        if (result.rowCount === 0) {
            return {
                success: false,
                error: 'Proposal not found or no changes made'
            };
        }
        
        console.log(`✅ Successfully updated proposal ${proposalUid}`);
        
        return {
            success: true,
            updatedFields: updateFields.length - 3, // Exclude metadata fields from count
            proposalUid: proposalUid
        };
        
    } catch (error) {
        console.error('❌ Failed to update proposal in database:', error.message);
        return {
            success: false,
            error: 'Database update failed: ' + error.message
        };
    }
}

// --- Task Completion API Endpoints ---

// Toggle task completion status
router.post('/schedule/completion/toggle', async (req, res) => {
    try {
        console.log('[COMPLETION-API] Toggling task completion:', req.body);
        
        const { taskId, taskType, weekStartDate, dayIndex, userId, isCompleted } = req.body;
        
        if (!taskId || !taskType || !weekStartDate || dayIndex === undefined || !userId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const result = await db.query(
            'SELECT * FROM toggle_task_completion(?, ?, ?, ?, ?, ?)',
            [taskId, taskType, weekStartDate, dayIndex, userId, isCompleted ? 'Task marked as completed' : null]
        );
        
        console.log('[COMPLETION-API] Toggle result:', result.rows[0]);
        
        res.json({ success: result.rows[0]?.toggle_task_completion || false });
        
    } catch (error) {
        console.error('[COMPLETION-API] Error toggling task completion:', error);
        res.status(500).json({ error: 'Failed to toggle task completion: ' + error.message });
    }
});

// Get task completion status
router.get('/schedule/completion/:taskId/:taskType/:weekStartDate/:dayIndex/:userId', async (req, res) => {
    try {
        const { taskId, taskType, weekStartDate, dayIndex, userId } = req.params;
        
        const result = await db.query(
            'SELECT is_completed, completed_at, completion_notes FROM schedule_task_completion WHERE task_id = ? AND task_type = ? AND week_start_date = ? AND day_index = ? AND user_id = ?',
            [taskId, taskType, weekStartDate, parseInt(dayIndex), userId]
        );
        
        const completion = result.rows[0] || { is_completed: false, completed_at: null, completion_notes: null };
        res.json(completion);
        
    } catch (error) {
        console.error('[COMPLETION-API] Error getting task completion:', error);
        res.status(500).json({ error: 'Failed to get task completion: ' + error.message });
    }
});

// --- Status History API Endpoints ---

// Record status change
router.post('/status-history', async (req, res) => {
    try {
        console.log('[STATUS-HISTORY-API] Recording status change:', req.body);
        
        const { proposalId, newStatus, changedBy, changeReason } = req.body;
        
        if (!proposalId || !newStatus || !changedBy) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        const result = await db.query(
            'SELECT * FROM record_status_change(?, ?, ?, ?)',
            [proposalId, newStatus, changedBy, changeReason]
        );
        
        console.log('[STATUS-HISTORY-API] Record result:', result.rows[0]);
        
        res.json({ success: result.rows[0]?.record_status_change || false });
        
    } catch (error) {
        console.error('[STATUS-HISTORY-API] Error recording status change:', error);
        res.status(500).json({ error: 'Failed to record status change: ' + error.message });
    }
});

// Get historical status for a proposal on a specific date
router.get('/status-history/:proposalId', async (req, res) => {
    try {
        const { proposalId } = req.params;
        const { date } = req.query;
        
        if (!proposalId) {
            return res.status(400).json({ error: 'Missing proposal ID' });
        }
        
        const queryDate = date || new Date().toISOString().split('T')[0];
        
        const result = await db.query(
            'SELECT * FROM get_proposal_status_on_date(?, ?)',
            [proposalId, queryDate]
        );
        
        const status = result.rows[0]?.get_proposal_status_on_date || null;
        res.json({ status, date: queryDate });
        
    } catch (error) {
        console.error('[STATUS-HISTORY-API] Error getting historical status:', error);
        res.status(500).json({ error: 'Failed to get historical status: ' + error.message });
    }
});

// Get complete status history for a proposal
router.get('/status-history/:proposalId/history', async (req, res) => {
    try {
        const { proposalId } = req.params;
        
        const result = await db.query(
            'SELECT * FROM proposal_status_history WHERE proposal_id = ? ORDER BY status_date DESC, created_at DESC',
            [proposalId]
        );
        
        res.json({ history: result.rows });
        
    } catch (error) {
        console.error('[STATUS-HISTORY-API] Error getting status history:', error);
        res.status(500).json({ error: 'Failed to get status history: ' + error.message });
    }
});

module.exports = router;
module.exports.parseExcelFile = parseExcelFile; 