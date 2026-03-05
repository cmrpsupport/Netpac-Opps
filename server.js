require('dotenv').config(); // Load environment variables from .env
console.log("=== SERVER.JS STARTED ===");
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log('🔗 Database: SQLite Cloud or local SQLite (see db_adapter)');
console.log(`🚀 Bind: ${process.env.HOST || '0.0.0.0'}:${process.env.PORT || 3000}`);

const express = require('express');
const path = require('path'); // Import the path module
const db = require('./db_adapter'); // Database adapter for PostgreSQL / local SQLite
const { v4: uuidv4 } = require('uuid'); // Import uuid package
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey'; // Use env var in production
// Net Pacific only: single allowed tenant (default = Net Pacific company)
const NETPACIFIC_TENANT_CODE = (process.env.NETPACIFIC_TENANT_CODE || 'default').toString().trim().toLowerCase() || 'default';
// Project code prefix: set once in .env (e.g. PROJECT_CODE_PREFIX=NETPAC) to align with your company; default CMRP. Format: PREFIX + YYMM + 4-digit sequence.
const PROJECT_CODE_PREFIX = (process.env.PROJECT_CODE_PREFIX || 'CMRP').toString().trim().toUpperCase() || 'CMRP';
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0'; // 0.0.0.0 = all interfaces; use 127.0.0.1 for local only

// Import routes
const snapshotsRouter = require('./backend/routes/snapshots');
const flexibleSnapshotsRouter = require('./backend/routes/flexible-snapshots');
const realtimeMetricsRouter = require('./backend/routes/realtime-metrics');
const proposalWorkbenchRouter = require('./backend/routes/proposal-workbench');
const presentationRouter = require('./backend/routes/presentation');
const notificationsRouter = require('./backend/routes/notifications');

// Trust proxy for Render deployment (fixes rate limiting with X-Forwarded-For headers)
app.set('trust proxy', true);

// CORS - frontend is served by this same Express server, so allow same-origin.
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// JSON body parser + ensure req.body is always a plain object (avoids hasOwnProperty on undefined in validators)
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) return next(err);
    if (req.body == null || typeof req.body !== 'object' || Array.isArray(req.body)) {
      req.body = {};
    } else {
      req.body = { ...req.body };
    }
    next();
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin || 'no-origin',
    timestamp: new Date().toISOString()
  });
});

// Database: init then run migrations, then start listening so tables exist before first request
let pool;
function startServer() {
  const server = app.listen(port, host, () => {
    console.log(`🚀 Server listening at http://${host}:${port}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Serving static files from: ${__dirname}`);
    console.log(`🩺 Health check: http://localhost:${port}/api/health`);
    console.log(`📊 Win/Loss Dashboard available at http://localhost:${port}/win-loss_dashboard.html`);
    console.log(`📈 Forecast Dashboard available at http://localhost:${port}/forecast_dashboard.html`);
  });
  server.on('error', (error) => {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  });
  return server;
}

(async () => {
  try {
    pool = await db.initDatabase();
    await ensureAccountManagerAndPicTables();
    server = startServer();
  } catch (error) {
    console.error('❌ Database init error:', error);
    server = startServer();
  }
})();

async function ensureAccountManagerAndPicTables() {
  if (!db.getDB()) return;
  const dbType = db.getDBType();
  try {
    if (dbType === 'sqlite' || dbType === 'sqlite_cloud') {
      await db.query("CREATE TABLE IF NOT EXISTS account_managers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))");
      await db.query("CREATE TABLE IF NOT EXISTS pics (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))");
      try { await db.query('ALTER TABLE users ADD COLUMN account_manager_id INTEGER'); } catch (e) { if (!e.message.includes('duplicate')) throw e; }
      try { await db.query('ALTER TABLE users ADD COLUMN pic_id INTEGER'); } catch (e) { if (!e.message.includes('duplicate')) throw e; }
    } else if (dbType === 'postgresql') {
      await db.query(`CREATE TABLE IF NOT EXISTS account_managers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await db.query(`CREATE TABLE IF NOT EXISTS pics (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      try { await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS account_manager_id INTEGER'); } catch (e) { /* ignore */ }
      try { await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS pic_id INTEGER'); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.warn('Account managers/PIC tables migration warning:', err.message);
    console.warn('Migration stack:', err.stack);
  }
}

// Google Calendar OAuth Service Integration
const GoogleCalendarOAuthService = require('./google_calendar_oauth_service');

// Import NotificationService from the notifications router
const { NotificationService } = require('./backend/routes/notifications');

// Add database middleware
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// --- Mock Data for Development ---
// Only use mock data if explicitly enabled or if no database connection is available
const hasDb = !!(process.env.SQLITECLOUD_URL || process.env.USE_SQLITE_LOCAL === '1' || process.env.USE_SQLITE_LOCAL === 'true' || process.env.SQLITE_DB_PATH);
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true' || (!process.env.DATABASE_URL && !hasDb && process.env.NODE_ENV !== 'production');
console.log(`🧪 Mock data: ${USE_MOCK_DATA ? 'Enabled' : 'Disabled'}`);

// Mock login handler for development
app.post('/api/login', express.json(), async (req, res) => {
    try {
        const requestedCode = (req.body?.tenantCode || req.body?.tenant_code || 'default').toString().trim().toLowerCase() || 'default';
        // Net Pacific only: reject login for any other tenant
        if (requestedCode !== NETPACIFIC_TENANT_CODE) {
            return res.status(403).json({ error: 'This application is for Net Pacific only. Invalid organization.' });
        }
        const tenantCode = NETPACIFIC_TENANT_CODE;
        let tenantId = 'default';
        try {
            const tenantRes = await db.query('SELECT id FROM tenants WHERE code = ?', [tenantCode]);
            if (tenantRes.rows?.length) tenantId = tenantRes.rows[0].id;
        } catch (e) {
            // tenants table may not exist in older deployments; keep default
        }

        if (USE_MOCK_DATA) {
            // In development, skip password validation but still query database for user data
            const { email, password } = req.body;

            console.log(`[DEV MODE] Mock login for: ${email}`);

            // Query the database to get real user data
            const result = await db.query(
                'SELECT * FROM users WHERE email = ? AND tenant_id = ?',
                [email.toLowerCase(), tenantId]
            );

            const user = result.rows[0];

            if (!user) {
                return res.status(401).json({ error: 'User not found in database' });
            }

            // Update last login time in database
            await db.query(
                db.convertSQL(`UPDATE users SET last_login_at = NOW() WHERE id = ?`),
                [user.id]
            );

            // Create JWT token with real database data
            const token = jwt.sign({
                id: user.id,
                email: user.email,
                name: user.name,
                tenantId: user.tenant_id || tenantId,
                tenantCode,
                roles: (typeof user.roles === "string" ? JSON.parse(user.roles) : user.roles) || [],
                accountType: user.account_type
            }, JWT_SECRET, { expiresIn: '24h' });

            console.log(`[DEV MODE] Token created with accountType: ${user.account_type}`);

            return res.json({ success: true, token });
        } else {
            // In production, use the database
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            // Query the database
            const result = await db.query(
                'SELECT * FROM users WHERE email = ? AND tenant_id = ?',
                [email.toLowerCase(), tenantId]
            );

            const user = result.rows[0];

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Compare password
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);

            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Update last login time in database with Manila timezone
            await db.query(
                db.convertSQL(`UPDATE users SET last_login_at = NOW() WHERE id = ?`),
                [user.id]
            );

            // Create JWT token
            const token = jwt.sign({
                id: user.id,
                email: user.email,
                name: user.name,
                tenantId: user.tenant_id || tenantId,
                tenantCode,
                roles: (typeof user.roles === "string" ? JSON.parse(user.roles) : user.roles) || [],
                accountType: user.account_type
            }, JWT_SECRET, { expiresIn: '24h' });

            // Log successful login
            const now = new Date().toISOString();
            const logMsg = `[${now}] User logged in: ${user.email} (ID: ${user.id})`;
            console.log(logMsg);

            res.json({ success: true, token });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// --- Custom Snapshot Routes (must come before generic routes) ---
app.get('/api/snapshots/custom-dates', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT 
                snapshot_date,
                snapshot_type,
                created_at,
                'Global' as description
            FROM dashboard_snapshots 
            UNION ALL
            SELECT DISTINCT 
                snapshot_date,
                'custom' as snapshot_type,
                created_at,
                COALESCE(description, CONCAT('Custom - ', snapshot_date)) as description
            FROM custom_snapshots
            ORDER BY snapshot_date DESC, created_at DESC
        `;

        const result = await db.query(query);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('[ERROR] Failed to fetch snapshot dates:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve snapshot dates'
        });
    }
});

app.post('/api/snapshots/custom', async (req, res) => {
    try {
        const {
            snapshot_date,
            description,
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
            op30_amount,
            lost_count,
            lost_amount,
            inactive_count,
            ongoing_count,
            pending_count,
            declined_count,
            revised_count
        } = req.body;

        if (!snapshot_date) {
            return res.status(400).json({ 
                error: 'Missing required field',
                message: 'snapshot_date is required'
            });
        }

        if (total_opportunities === undefined || total_opportunities === null) {
            return res.status(400).json({ 
                error: 'Missing required field',
                message: 'total_opportunities is required'
            });
        }

        const query = `
            INSERT INTO custom_snapshots (
                snapshot_date, description, total_opportunities, submitted_count, submitted_amount,
                op100_count, op100_amount, op90_count, op90_amount,
                op60_count, op60_amount, op30_count, op30_amount,
                lost_count, lost_amount, inactive_count, ongoing_count,
                pending_count, declined_count, revised_count
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            ON CONFLICT (snapshot_date) DO UPDATE SET
                description = EXCLUDED.description,
                total_opportunities = EXCLUDED.total_opportunities,
                submitted_count = EXCLUDED.submitted_count,
                submitted_amount = EXCLUDED.submitted_amount,
                op100_count = EXCLUDED.op100_count,
                op100_amount = EXCLUDED.op100_amount,
                op90_count = EXCLUDED.op90_count,
                op90_amount = EXCLUDED.op90_amount,
                op60_count = EXCLUDED.op60_count,
                op60_amount = EXCLUDED.op60_amount,
                op30_count = EXCLUDED.op30_count,
                op30_amount = EXCLUDED.op30_amount,
                lost_count = EXCLUDED.lost_count,
                lost_amount = EXCLUDED.lost_amount,
                inactive_count = EXCLUDED.inactive_count,
                ongoing_count = EXCLUDED.ongoing_count,
                pending_count = EXCLUDED.pending_count,
                declined_count = EXCLUDED.declined_count,
                revised_count = EXCLUDED.revised_count,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const values = [
            snapshot_date, description || `Custom snapshot - ${snapshot_date}`,
            total_opportunities, submitted_count, submitted_amount,
            op100_count, op100_amount, op90_count, op90_amount,
            op60_count, op60_amount, op30_count, op30_amount,
            lost_count, lost_amount, inactive_count, ongoing_count,
            pending_count, declined_count, revised_count
        ];

        const result = await db.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Custom snapshot saved successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[ERROR] Failed to save custom snapshot:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to save custom snapshot data'
        });
    }
});

app.get('/api/snapshots/custom/:date', async (req, res) => {
    try {
        const { date } = req.params;

        const query = `
            SELECT
                id,
                snapshot_date,
                description,
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
                op30_amount,
                lost_count,
                lost_amount,
                inactive_count,
                ongoing_count,
                pending_count,
                declined_count,
                revised_count,
                created_at
            FROM custom_snapshots
            WHERE snapshot_date = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const result = await db.query(query, [date]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Snapshot not found',
                message: `No custom snapshot found for date ${date}`
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(`[ERROR] Failed to fetch custom snapshot for ${req.params.date}:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve custom snapshot data'
        });
    }
});

// Use routes
app.use('/api', snapshotsRouter);
app.use('/api', flexibleSnapshotsRouter);
app.use('/api', realtimeMetricsRouter);
app.use('/api/proposal-workbench', authenticateToken, proposalWorkbenchRouter);
app.use('/api/presentation', authenticateToken, presentationRouter);
app.use('/api/notifications', notificationsRouter);

// === PROPOSAL STORY API ENDPOINTS ===

// Get complete proposal story timeline (revision history + manual entries)
app.get('/api/proposal-story/:opportunityUid', authenticateToken, async (req, res) => {
    try {
        const { opportunityUid } = req.params;
        console.log(`[PROPOSAL-STORY] Getting story for opportunity: ${opportunityUid}`);
        
        let story = [];
        
        try {
            // Try to use the database function first
            const result = await db.query(
                'SELECT * FROM get_proposal_story(?) ORDER BY timeline_date DESC',
                [opportunityUid]
            );
            story = result.rows;
        } catch (funcError) {
            console.log('[PROPOSAL-STORY] Database function not available, using fallback query');
            
            // Fallback query if the function doesn't exist
            try {
                // Get manual story entries
                const manualEntries = await db.query(`
                    SELECT
                        'manual' as source_type,
                        created_at as timeline_date,
                        created_by as author,
                        COALESCE(title, 'Team Comment') as story_title,
                        content as story_content,
                        entry_type as entry_category,
                        'medium' as story_priority,
                        entry_type as story_subtype,
                        id::TEXT as reference_id,
                        metadata as story_metadata,
                        true as is_manual,
                        'User' as author_role
                    FROM proposal_story_entries
                    WHERE opportunity_uid = ? AND is_deleted = false
                    ORDER BY created_at DESC
                `, [opportunityUid]);
                
                // Get revision history if available
                let revisionEntries = { rows: [] };
                try {
                    revisionEntries = await db.query(`
                        SELECT
                            'revision' as source_type,
                            changed_at as timeline_date,
                            changed_by as author,
                            'System Update' as story_title,
                            CASE
                                WHEN changed_fields::TEXT = '{}' OR changed_fields IS NULL THEN 'General update'
                                ELSE 'Project updated'
                            END as story_content,
                            'system_update' as entry_category,
                            'medium' as story_priority,
                            'system_change' as story_subtype,
                            revision_number::TEXT as reference_id,
                            changed_fields as story_metadata,
                            false as is_manual,
                            'System' as author_role
                        FROM opportunity_revisions
                        WHERE opportunity_uid = ?
                        ORDER BY changed_at DESC
                    `, [opportunityUid]);
                } catch (revError) {
                    console.log('[PROPOSAL-STORY] Revision history table not available');
                }
                
                // Combine and sort by date
                story = [...manualEntries.rows, ...revisionEntries.rows]
                    .sort((a, b) => new Date(b.timeline_date) - new Date(a.timeline_date));
                
            } catch (fallbackError) {
                console.log('[PROPOSAL-STORY] Fallback query failed, returning empty story');
                story = [];
            }
        }
        
        console.log(`[PROPOSAL-STORY] Retrieved ${story.length} story entries`);
        
        res.json({
            success: true,
            story: story,
            total: story.length,
            opportunityUid: opportunityUid
        });
        
    } catch (error) {
        console.error('[PROPOSAL-STORY] Error getting proposal story:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve proposal story',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Add new manual story entry
app.post('/api/proposal-story', authenticateToken, [
    body('opportunity_uid').notEmpty().withMessage('Opportunity UID is required'),
    body('entry_type').isIn(['comment', 'milestone', 'decision_point', 'client_feedback', 'status_update', 'internal_note', 'issue', 'resolution']).withMessage('Invalid entry type'),
    body('content').notEmpty().withMessage('Content is required'),
    body('visibility').optional().isIn(['internal', 'client_visible', 'team_only']).withMessage('Invalid visibility option')
], async (req, res) => {
    try {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        
        const { opportunity_uid, entry_type, title, content, visibility = 'internal', metadata = {} } = req.body;
        const username = req.user?.name || 'unknown';
        
        console.log(`[PROPOSAL-STORY] Adding story entry for ${opportunity_uid} by ${username}`);
        
        // Check if table exists before inserting
        let result;
        try {
            // Insert story entry
            result = await db.query(`
                INSERT INTO proposal_story_entries
                (opportunity_uid, created_by, entry_type, title, content, visibility, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id, created_at
            `, [opportunity_uid, username, entry_type, title, content, visibility, JSON.stringify(metadata)]);
        } catch (tableError) {
            console.error('[PROPOSAL-STORY] Table does not exist:', tableError.message);
            return res.status(500).json({
                success: false,
                error: 'Proposal story feature not available. Database schema needs to be updated.',
                details: process.env.NODE_ENV === 'development' ? tableError.message : undefined
            });
        }
        
        const newEntry = result.rows[0];
        console.log(`[PROPOSAL-STORY] Story entry added with ID: ${newEntry.id}`);
        
        // Check for @mentions in the content and create notifications
        try {
            const notificationService = new NotificationService(pool);
            
            // Extract @mentions from content and title
            const mentionRegex = /@(\w+(?:\.\w+)*)/g;
            const allText = `${title || ''} ${content}`;
            const mentions = [];
            let match;
            
            while ((match = mentionRegex.exec(allText)) !== null) {
                mentions.push(match[1]); // Extract username without @
            }
            
            if (mentions.length > 0) {
                console.log(`[PROPOSAL-STORY] Found mentions: ${mentions.join(', ')}`);
                
                // Get project name for context
                const projectQuery = 'SELECT project_name FROM opps_monitoring WHERE uid = ?';
                const projectResult = await db.query(projectQuery, [opportunity_uid]);
                const projectName = projectResult.rows[0]?.project_name || 'Unknown Project';
                
                // Create notifications for each mentioned user
                for (const mentionedUsername of mentions) {
                    // Find user by username, name, or email
                    const userQuery = `
                        SELECT id FROM users
                        WHERE name ILIKE ? OR email ILIKE ? OR
                              REPLACE(LOWER(name), ' ', '.') = LOWER(?) OR
                              REPLACE(LOWER(name), ' ', '') = LOWER(?)
                        LIMIT 1
                    `;
                    const userResult = await db.query(userQuery, [mentionedUsername, mentionedUsername, mentionedUsername, mentionedUsername]);
                    
                    if (userResult.rows.length > 0) {
                        const mentionedUserId = userResult.rows[0].id;
                        
                        // Don't notify if user mentions themselves
                        if (mentionedUserId !== req.user?.id) {
                            await notificationService.notifyMention({
                                opportunity_uid,
                                mentioned_user_id: mentionedUserId,
                                mention_context: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                                project_name: projectName,
                                mentioned_by_id: req.user?.id || null
                            });
                            
                            console.log(`[NOTIFICATION] Created mention notification for user ${mentionedUserId} (${mentionedUsername}) on project ${projectName}`);
                        }
                    } else {
                        console.log(`[PROPOSAL-STORY] User not found for mention: ${mentionedUsername}`);
                    }
                }
            }
        } catch (notificationError) {
            // Don't fail the story entry creation if notification creation fails
            console.error('Error creating mention notifications:', notificationError);
        }
        
        res.json({
            success: true,
            message: 'Story entry added successfully',
            entry: {
                id: newEntry.id,
                created_at: newEntry.created_at,
                opportunity_uid,
                created_by: username,
                entry_type,
                title,
                content,
                visibility,
                metadata
            }
        });
        
    } catch (error) {
        console.error('[PROPOSAL-STORY] Error adding story entry:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add story entry',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update existing manual story entry
app.put('/api/proposal-story/:entryId', authenticateToken, [
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
    body('title').optional(),
    body('visibility').optional().isIn(['internal', 'client_visible', 'team_only']).withMessage('Invalid visibility option')
], async (req, res) => {
    try {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors.array()
            });
        }
        
        const { entryId } = req.params;
        const { content, title, visibility } = req.body;
        const username = req.user?.name || 'unknown';
        
        console.log(`[PROPOSAL-STORY] Updating story entry ${entryId} by ${username}`);
        
        // Build dynamic update query
        const updates = [];
        const values = [];

        if (content !== undefined) {
            updates.push(`content = ?`);
            values.push(content);
        }
        if (title !== undefined) {
            updates.push(`title = ?`);
            values.push(title);
        }
        if (visibility !== undefined) {
            updates.push(`visibility = ?`);
            values.push(visibility);
        }

        updates.push(`edited_at = ${db.convertSQL('NOW()')}`);
        updates.push(`edited_by = ?`);
        values.push(username);
        values.push(entryId); // for WHERE clause
        values.push(username); // for created_by check

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }

        const result = await db.query(`
            UPDATE proposal_story_entries
            SET ${updates.join(', ')}
            WHERE id = ? AND created_by = ?
            RETURNING id, edited_at
        `, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Story entry not found or not authorized to edit'
            });
        }
        
        console.log(`[PROPOSAL-STORY] Story entry ${entryId} updated successfully`);
        
        res.json({
            success: true,
            message: 'Story entry updated successfully',
            entry: result.rows[0]
        });
        
    } catch (error) {
        console.error('[PROPOSAL-STORY] Error updating story entry:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update story entry',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Delete/mark as deleted a manual story entry
app.delete('/api/proposal-story/:entryId', authenticateToken, async (req, res) => {
    try {
        const { entryId } = req.params;
        const username = req.user?.name || 'unknown';
        
        console.log(`[PROPOSAL-STORY] Marking story entry ${entryId} as deleted by ${username}`);
        
        // Soft delete - mark as deleted instead of removing
        const result = await db.query(
            db.convertSQL(`
            UPDATE proposal_story_entries
            SET is_deleted = true, edited_at = NOW(), edited_by = ?
            WHERE id = ? AND created_by = ?
            RETURNING id
        `), [username, entryId, username]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Story entry not found or not authorized to delete'
            });
        }
        
        console.log(`[PROPOSAL-STORY] Story entry ${entryId} marked as deleted`);
        
        res.json({
            success: true,
            message: 'Story entry deleted successfully'
        });
        
    } catch (error) {
        console.error('[PROPOSAL-STORY] Error deleting story entry:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete story entry',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Initialize Regular Snapshot Automation Service (Fixed timing: 1:30 PM Wednesday)
const SnapshotAutomationService = require('./backend/services/snapshot-automation');
const snapshotService = new SnapshotAutomationService(pool);

// Initialize Business-Specific Snapshot Scheduler
const BusinessSnapshotScheduler = require('./backend/services/business-snapshot-scheduler');
const businessSnapshotService = new BusinessSnapshotScheduler(pool);

// Start automated snapshots in production or when explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_AUTO_SNAPSHOTS === 'true') {
    console.log('[SERVER] Starting snapshot automation service (1:30 PM Monday schedule)...');
    snapshotService.start();
    console.log('[SERVER] Starting business-specific snapshot scheduler (Monday 1:30 PM Weekly + First Friday Townhall)...');
    businessSnapshotService.start();
} else {
    console.log('[SERVER] Snapshot automation service disabled (development mode)');
}

// Snapshot automation service status endpoint
app.get('/api/snapshots/status', authenticateToken, (req, res) => {
    const status = snapshotService.getStatus();
    res.json({
        success: true,
        business_scheduler: status
    });
});

// Manual business meeting snapshot triggers
app.post('/api/snapshots/business/weekly-report', authenticateToken, async (req, res) => {
    try {
        const { description } = req.body;
        
        const results = await businessSnapshotService.triggerPresidentReport(description);
        
        res.json({
            success: true,
            message: 'Manual Weekly Report snapshot triggered successfully',
            results: results,
            comparison_info: {
                type: 'weekly_president',
                compares_to: 'Previous Wednesday',
                purpose: 'Wednesday weekly meeting'
            }
        });

    } catch (error) {
        console.error('[ERROR] Manual Weekly Report snapshot failed:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to create Weekly Report snapshot'
        });
    }
});

app.post('/api/snapshots/business/townhall', authenticateToken, async (req, res) => {
    try {
        const { description } = req.body;
        
        const results = await businessSnapshotService.triggerTownhall(description);
        
        res.json({
            success: true,
            message: 'Manual Townhall snapshot triggered successfully',
            results: results,
            comparison_info: {
                type: 'monthly_townhall',
                compares_to: 'First day of previous month',
                purpose: 'First Friday townhall meeting'
            }
        });

    } catch (error) {
        console.error('[ERROR] Manual Townhall snapshot failed:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to create Townhall snapshot'
        });
    }
});

// Get business-specific comparison data
app.get('/api/snapshots/business/comparison/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        
        let comparisonData = null;
        
        if (type === 'weekly-report') {
            comparisonData = await businessSnapshotService.getPresidentReportComparison();
        } else if (type === 'townhall') {
            comparisonData = await businessSnapshotService.getTownhallComparison();
        } else {
            return res.status(400).json({
                error: 'Invalid comparison type',
                message: 'Type must be either "weekly-report" or "townhall"'
            });
        }
        
        res.json({
            success: true,
            comparison_type: type,
            comparison_data: comparisonData
        });

    } catch (error) {
        console.error(`[ERROR] Failed to get ${req.params.type} comparison:`, error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to retrieve comparison data'
        });
    }
});

// --- Online Users Tracking Endpoints ---
let onlineUsers = new Map();
const PRESENCE_TIMEOUT = 30000; // 30 seconds

// Heartbeat endpoint for user presence
app.post('/api/heartbeat', authenticateToken, (req, res) => {
    try {
        const userId = req.user?.id;
        const { currentPage } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID not found in token' });
        }
        
        onlineUsers.set(userId, {
            name: req.user.name,
            role: req.user.role,
            lastSeen: Date.now(),
            currentPage
        });
        
        res.json({ 
            success: true, 
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[HEARTBEAT] Error processing heartbeat:', error);
        res.status(500).json({ 
            success: false,
            error: 'Heartbeat processing failed', 
            details: error.message 
        });
    }
});

// Get current online users
app.get('/api/online-users', authenticateToken, (req, res) => {
    const now = Date.now();
    const activeUsers = [];
    
    onlineUsers.forEach((user, userId) => {
        if (now - user.lastSeen <= PRESENCE_TIMEOUT) {
            activeUsers.push({
                id: userId,
                name: user.name,
                role: user.role,
                currentPage: user.currentPage
            });
        } else {
            onlineUsers.delete(userId);
        }
    });
    
    res.json(activeUsers);
});

// Cleanup inactive users periodically
setInterval(() => {
    const now = Date.now();
    onlineUsers.forEach((user, userId) => {
        if (now - user.lastSeen > PRESENCE_TIMEOUT) {
            onlineUsers.delete(userId);
        }
    });
}, PRESENCE_TIMEOUT);

// --- Helper Functions ---

function parseCurrency(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleanedValue = value.replace(/[₱,]/g, '').trim();
    if (cleanedValue.startsWith('(') && cleanedValue.endsWith(')')) {
        return parseFloat(cleanedValue.replace(/[()]/g, '')) * -1 || 0;
    }
    return parseFloat(cleanedValue) || 0;
  }
  return 0;
}

// Function to format date as 'Month Year' (e.g., "January 2025") using UTC
function formatMonthYear(date) {
  if (!(date instanceof Date) || isNaN(date)) {
      // console.warn("formatMonthYear received invalid date:", date); // Optional logging
      return 'Invalid Date';
  }
  // Use UTC methods to avoid timezone issues affecting month/year display
  const year = date.getUTCFullYear();
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${year}`;
}

function getColumnInsensitive(obj, target) {
    if (!obj || typeof obj !== 'object') return null; // Add check for valid object
    const norm = s => (s || '').toLowerCase().replace(/\s|_/g, '');
    const targetNorm = norm(target);
    for (const key of Object.keys(obj)) {
        if (norm(key) === targetNorm) return key;
    }
    return null;
}

/** Safe hasOwnProperty: avoids "Cannot read properties of undefined (reading 'hasOwnProperty')". */
function safeHas(obj, key) {
    return obj != null && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
}

// Robust date parsing function - attempts to parse various formats into a JS Date object (UTC midnight)
function robustParseDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) {
        // If already a Date object, normalize to UTC midnight
        return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()));
    }

    // Handle potential Excel serial dates (numbers)
    if (typeof val === 'number' && val > 25569) {
        try {
             // Excel epoch starts Dec 30 1899 (or Jan 1 1904 for Mac). Assuming Windows epoch.
             const utc_days = val - 25569; // Days from 1/1/1970 UTC
             const utc_milliseconds = utc_days * 86400 * 1000;
             const date_info = new Date(utc_milliseconds); // This date is already UTC
             if (!isNaN(date_info)) {
                 // Return as UTC midnight
                 return new Date(Date.UTC(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate()));
             }
        } catch (e) { console.warn("Error parsing potential Excel date number:", val, e); }
    }

    if (typeof val !== 'string') return null;

    const trimmedVal = val.trim();
    let d = null;

    // Try ISO format (YYYY-MM-DD...) - Handle both with and without time component
    if (trimmedVal.match(/^\d{4}-\d{1,2}-\d{1,2}/)) {
        // If already has time component, parse as-is
        if (trimmedVal.includes('T')) {
            d = new Date(trimmedVal);
        } else {
            // If just date, append time for UTC midnight
            d = new Date(trimmedVal + 'T00:00:00Z');
        }
        if (!isNaN(d)) {
            // Normalize to UTC midnight
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        }
    }
    // Try MM/DD/YYYY or M/D/YYYY
    if (trimmedVal.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const [m, d1, y] = trimmedVal.split('/').map(Number);
        if (m >= 1 && m <= 12 && d1 >= 1 && d1 <= 31) {
            // Construct as UTC
            d = new Date(Date.UTC(y, m - 1, d1)); // Month is 0-indexed
             if (!isNaN(d) && d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === d1) return d;
        }
    }
    // Try DD/MM/YYYY (only if day > 12)
    if (trimmedVal.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const [d1, m, y] = trimmedVal.split('/').map(Number);
        if (d1 > 12 && m >= 1 && m <= 12 && d1 >= 1 && d1 <= 31) {
             d = new Date(Date.UTC(y, m - 1, d1));
             if (!isNaN(d) && d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === d1) return d;
        }
    }
     // Try YYYY/MM/DD
    if (trimmedVal.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
         const [y, m, d1] = trimmedVal.split('/').map(Number);
         if (m >= 1 && m <= 12 && d1 >= 1 && d1 <= 31) {
             d = new Date(Date.UTC(y, m - 1, d1));
             if (!isNaN(d) && d.getUTCFullYear() === y && d.getUTCMonth() === m - 1 && d.getUTCDate() === d1) return d;
         }
    }
    // Try 'Day, Mon-DD' (e.g., 'Sat, Feb-01') - Append current year, then normalize
    if (trimmedVal.match(/^[A-Za-z]{3},\s[A-Za-z]{3}-\d{1,2}$/)) {
        const currentYear = new Date().getUTCFullYear(); // Use current UTC year
        // Use Date.parse which is generally better for month names, assume English
        const timestamp = Date.parse(`${trimmedVal.split(', ')[1]} ${currentYear} 00:00:00 GMT`);
        if (!isNaN(timestamp)) {
             d = new Date(timestamp);
             // Normalize to UTC midnight
             return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        }
    }
    // Try 'Mon-DD' (e.g., 'Feb-01') - Append current year, then normalize
     if (trimmedVal.match(/^[A-Za-z]{3}-\d{1,2}$/)) {
         const currentYear = new Date().getUTCFullYear();
         const timestamp = Date.parse(`${trimmedVal} ${currentYear} 00:00:00 GMT`);
         if (!isNaN(timestamp)) {
             d = new Date(timestamp);
             return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
         }
     }

    console.warn("[robustParseDate] Could not parse date string:", val);
    return null; // Return null if no format matches
}


// NOTE: calculateWinLossDashboardData_ClientSide is now used on the FRONTEND
// This function remains here as a reference or if needed for other server-side tasks.
function calculateWinLossDashboardData_ServerReference(opportunities) {
    // ... (calculation logic as before) ...
}

// Function to calculate Forecast dashboard data
function calculateForecastDashboardData(opportunities) {
    console.log(`[calculateForecastDashboardData] Processing ${opportunities?.length ?? 0} opportunities.`);
    const now = new Date();
    const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); // Start of next month UTC

    let totalForecastCount = 0;
    let totalForecastAmount = 0;
    let nextMonthForecastCount = 0;
    let nextMonthForecastAmount = 0;
    const forecastMonthly = {}; // Key: YYYY-MM, Value: { monthName, count, totalAmount, projects }
    const projectDetails = []; // Array for project details table

    if (!opportunities || !Array.isArray(opportunities)) {
        console.error("[calculateForecastDashboardData] Invalid opportunities data received.");
        opportunities = [];
    }

    opportunities.forEach((opp, index) => {
        if (typeof opp !== 'object' || opp === null) {
            console.warn(`[calculateForecastDashboardData] Skipping invalid opportunity at index ${index}:`, opp);
            return;
        }

        const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
        const amtKey = getColumnInsensitive(opp, 'final_amt'); // Use final amount for forecast value
        const projNameKey = getColumnInsensitive(opp, 'project_name'); // Get project name key

        const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
        const finalAmt = amtKey ? parseCurrency(opp[amtKey]) : 0;
        const projectName = projNameKey ? opp[projNameKey] : 'Unknown Project'; // Default name

        let parsedForecastDate = robustParseDate(forecastDateValue); // Returns UTC Date or null
        // --- Add forecastMonth and forecastWeek ---
        let forecastMonth = '';
        let forecastWeek = '';
        if (parsedForecastDate && !isNaN(parsedForecastDate)) {
            forecastMonth = formatMonthYear(parsedForecastDate);
            // Calculate week of month (1-based)
            const day = parsedForecastDate.getUTCDate();
            const firstDayOfMonth = new Date(Date.UTC(parsedForecastDate.getUTCFullYear(), parsedForecastDate.getUTCMonth(), 1));
            const firstDayWeekday = firstDayOfMonth.getUTCDay(); // 0=Sun
            forecastWeek = Math.ceil((day + firstDayWeekday) / 7);
        }

        if (parsedForecastDate && !isNaN(parsedForecastDate)) {
            totalForecastCount++;
            totalForecastAmount += finalAmt;

            const year = parsedForecastDate.getUTCFullYear();
            const month = parsedForecastDate.getUTCMonth();
            const monthYearKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            const formattedMonthYear = formatMonthYear(parsedForecastDate);

            if (!forecastMonthly[monthYearKey]) {
                forecastMonthly[monthYearKey] = { monthName: formattedMonthYear, count: 0, totalAmount: 0 };
            }
            forecastMonthly[monthYearKey].count++;
            forecastMonthly[monthYearKey].totalAmount += finalAmt;

            projectDetails.push({ name: projectName, amount: finalAmt, forecastMonth: formattedMonthYear, forecastWeek: forecastWeek });

            if (year === nextMonthDate.getUTCFullYear() && month === nextMonthDate.getUTCMonth()) {
                nextMonthForecastCount++;
                nextMonthForecastAmount += finalAmt;
            }
        } else {
             if (forecastDateKey && forecastDateValue) {
                 console.warn(`[calculateForecastDashboardData index ${index}] Invalid or missing forecast date: '${forecastDateValue}'`);
             }
        }
    });

    const sortedMonthKeys = Object.keys(forecastMonthly).sort();
    const forecastMonthlySummary = sortedMonthKeys.map(key => ({
        monthYear: forecastMonthly[key].monthName,
        count: forecastMonthly[key].count,
        totalAmount: forecastMonthly[key].totalAmount
    }));

     console.log("[calculateForecastDashboardData] Forecast Summary:", forecastMonthlySummary);

    return {
        totalForecastCount,
        totalForecastAmount,
        nextMonthForecastCount,
        nextMonthForecastAmount,
        forecastMonthlySummary,
        projectDetails
    };
}


// --- CMRP Week Helper ---
/**
 * Returns an array of objects: [{ weekNumber, startDate, endDate }]
 * Only includes weeks whose start date is in the given month/year.
 * Week starts on Sunday or Monday (whichever comes first in the month),
 * and each week is Sunday–Saturday.
 *
 * If the week start date is not in the current month, it is not included (e.g., if the last Sunday/Monday is the last day of the month, skip it).
 */
function getCMRPWeeksForMonth(year, month) {
    // month: 0-based (0=Jan)
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
    // Find first Sunday or Monday
    let firstWeekStart = new Date(firstOfMonth);
    while (firstWeekStart.getUTCDay() !== 0 && firstWeekStart.getUTCDay() !== 1) {
        firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() + 1);
    }
    const weeks = [];
    let weekStart = new Date(firstWeekStart);
    let weekNumber = 1;
    
    while (weekStart.getUTCMonth() === month && weekStart <= lastOfMonth) {
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        
        // Count how many days of this week are in the current month
        let daysInCurrentMonth = 0;
        let dateCounter = new Date(weekStart);
        for (let i = 0; i < 7; i++) {
            if (dateCounter.getUTCMonth() === month) {
                daysInCurrentMonth++;
            }
            dateCounter.setUTCDate(dateCounter.getUTCDate() + 1);
        }
        
        // Only include the week if at least 4 days (more than half) are in the current month
        if (daysInCurrentMonth >= 4) {
            weeks.push({
                weekNumber,
                startDate: new Date(weekStart),
                endDate: new Date(weekEnd)
            });
        }
        
        weekNumber++;
        weekStart.setUTCDate(weekStart.getUTCDate() + 7);
    }
    return weeks;
}

// --- Express Setup ---
// JSON body parser is already configured earlier in the file

// --- HTTPS Enforcement in Production ---
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
      // Redirect to HTTPS
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

// Serve static files except for /api/*
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  express.static(__dirname)(req, res, next);
});

// --- AUTH MIDDLEWARE ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  console.log('[REQUIRE_ADMIN] Checking admin access for user:', {
    user: req.user ? {
      email: req.user.email,
      accountType: req.user.accountType,
      roles: req.user.roles
    } : 'No user found',
    url: req.originalUrl
  });
  
  if (!req.user || (req.user.accountType !== 'Admin' && req.user.accountType !== 'System Admin' && (!req.user.roles || !req.user.roles.includes('Admin')))) {
    // Log forbidden admin access attempt
    const attemptedBy = req.user ? `${req.user.email} (${req.user.id})` : 'Unauthenticated';
    const now = new Date().toISOString();
    const logMsg = `[${now}] Forbidden admin API access attempt by: ${attemptedBy} on ${req.originalUrl}`;
    console.warn(logMsg);
    console.warn('[REQUIRE_ADMIN] Access denied. User details:', {
      hasUser: !!req.user,
      accountType: req.user?.accountType,
      roles: req.user?.roles,
      accountTypeCheck: req.user?.accountType !== 'Admin',
      rolesCheck: !req.user?.roles || !req.user.roles.includes('Admin')
    });
    // --- Append to audit.log ---
    try {
      fs.appendFileSync(path.join(__dirname, 'audit.log'), logMsg + '\n');
    } catch (err) {
      console.error('Failed to write to audit.log:', err);
    }
    return res.status(403).json({ error: 'Admin access required.' });
  }
  console.log('[REQUIRE_ADMIN] Access granted for admin user:', req.user.email);
  next();
}

// --- Health Check Endpoint ---
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'CMRP Opps Management Backend',
    version: '1.0.0'
  });
});

// --- User Preferences Endpoint ---
app.get('/api/user-preferences', authenticateToken, (req, res) => {
  // Placeholder endpoint to prevent 404 errors
  // TODO: Implement actual user preferences functionality
  res.json({ 
    preferences: {},
    message: 'User preferences endpoint placeholder'
  });
});

app.post('/api/user-preferences', authenticateToken, (req, res) => {
  // Placeholder endpoint to prevent 404 errors
  // TODO: Implement actual user preferences functionality
  res.json({ 
    success: true,
    message: 'User preferences updated (placeholder)'
  });
});

// --- Account Manager Snapshots Endpoints ---
app.get('/api/snapshots/:type/:accountManager', async (req, res) => {
  console.log(`[DEBUG] Account Manager Snapshot Request: type=${req.params.type}, accountManager=${req.params.accountManager}`);
  try {
    const { type, accountManager } = req.params;
    
    if (!['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid snapshot type',
        message: 'Snapshot type must be either "weekly" or "monthly"'
      });
    }

    const query = `
      SELECT * FROM account_manager_snapshots
      WHERE snapshot_type = ? AND account_manager = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [type, accountManager]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Snapshot not found',
        message: `No ${type} snapshot available for account manager ${accountManager}`
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `${type} snapshot for ${accountManager} retrieved successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[ERROR] Failed to fetch ${req.params.type} snapshot for ${req.params.accountManager}:`, error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve account manager snapshot data'
    });
  }
});

// --- Dashboard Snapshots Endpoints ---
// General Dashboard Snapshots (less specific route)
app.get('/api/snapshots/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid snapshot type',
        message: 'Snapshot type must be either "weekly" or "monthly"'
      });
    }

    const query = `
      SELECT * FROM dashboard_snapshots
      WHERE snapshot_type = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [type]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Snapshot not found',
        message: `No ${type} snapshot available`
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error(`[ERROR] Failed to fetch ${req.params.type} snapshot:`, error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve snapshot data'
    });
  }
});

app.post('/api/snapshots', async (req, res) => {
  try {
    const {
      snapshot_type,
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
      op30_amount,
      lost_count,
      lost_amount,
      inactive_count,
      ongoing_count,
      pending_count,
      declined_count,
      revised_count
    } = req.body;

    if (!snapshot_type || !['weekly', 'monthly'].includes(snapshot_type)) {
      return res.status(400).json({ 
        error: 'Invalid snapshot_type',
        message: 'snapshot_type must be either "weekly" or "monthly"'
      });
    }

    const query = `
      INSERT INTO dashboard_snapshots (
        snapshot_type, total_opportunities, submitted_count, submitted_amount,
        op100_count, op100_amount, op90_count, op90_amount,
        op60_count, op60_amount, op30_count, op30_amount,
        lost_count, lost_amount, inactive_count, ongoing_count,
        pending_count, declined_count, revised_count
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT (snapshot_type)
      DO UPDATE SET
        total_opportunities = EXCLUDED.total_opportunities,
        submitted_count = EXCLUDED.submitted_count,
        submitted_amount = EXCLUDED.submitted_amount,
        op100_count = EXCLUDED.op100_count,
        op100_amount = EXCLUDED.op100_amount,
        op90_count = EXCLUDED.op90_count,
        op90_amount = EXCLUDED.op90_amount,
        op60_count = EXCLUDED.op60_count,
        op60_amount = EXCLUDED.op60_amount,
        op30_count = EXCLUDED.op30_count,
        op30_amount = EXCLUDED.op30_amount,
        lost_count = EXCLUDED.lost_count,
        lost_amount = EXCLUDED.lost_amount,
        inactive_count = EXCLUDED.inactive_count,
        ongoing_count = EXCLUDED.ongoing_count,
        pending_count = EXCLUDED.pending_count,
        declined_count = EXCLUDED.declined_count,
        revised_count = EXCLUDED.revised_count,
        saved_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      snapshot_type, total_opportunities, submitted_count, submitted_amount,
      op100_count, op100_amount, op90_count, op90_amount,
      op60_count, op60_amount, op30_count, op30_amount,
      lost_count, lost_amount, inactive_count, ongoing_count,
      pending_count, declined_count, revised_count
    ];

    const result = await db.query(query, values);

    res.status(201).json({
      success: true,
      message: `${snapshot_type} snapshot saved successfully`,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('[ERROR] Failed to save snapshot:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to save snapshot data'
    });
  }
});

// --- Rate Limiting for Auth Endpoints ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  trustProxy: true, // Trust proxy headers for proper IP detection in Render
});

// --- API Endpoints ---

// Endpoint for users to update their own password
app.post('/api/update-password', authenticateToken, authLimiter, [
    body('currentPassword').isLength({ min: 1 }).withMessage('Current password is required.'),
    body('newPassword').isLength({ min: 8, max: 100 }).withMessage('New password must be 8-100 characters.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // User ID from JWT
    const userEmail = req.user.email;
    const tenantId = req.user.tenantId || req.user.tenant_id || 'default';

    if (!userId) {
        return res.status(400).json({ message: 'User ID not found in token.' });
    }

    try {
        const userResult = await db.query('SELECT * FROM users WHERE id = ? AND tenant_id = ?', [userId, tenantId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password_hash = ? WHERE id = ? AND tenant_id = ?', [hashedNewPassword, userId, tenantId]);

        // Log password change
        const now = new Date().toISOString();
        const logMsg = `[${now}] User password updated by user: ${userEmail} (ID: ${userId})`;
        console.log(logMsg);
        fs.appendFileSync(path.join(__dirname, 'audit.log'), logMsg + '\n');

        res.json({ message: 'Password updated successfully.' });

    } catch (error) {
        console.error('Error updating password:', error);
        // Log detailed error for admin, generic for user
        const now = new Date().toISOString();
        const errorLogMsg = `[${now}] Error updating password for user ${userEmail} (ID: ${userId}): ${error.message}`;
        fs.appendFileSync(path.join(__dirname, 'audit.log'), errorLogMsg + '\n');
        res.status(500).json({ message: 'An internal error occurred. Please try again later.' });
    }
});


// POST Signup endpoint (public self-registration with default role)
const DEFAULT_SIGNUP_ROLE = 'technical';
app.post('/api/signup', authLimiter, [
    body('tenantCode').optional().trim().isLength({ min: 2, max: 40 }).withMessage('Organization code must be 2-40 characters'),
    body('tenantName').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Organization name must be 2-80 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8, max: 100 }).withMessage('Password must be 8-100 characters'),
    body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be at most 100 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg || 'Invalid input', details: errors.array() });
    }

    const { email, password, name } = req.body;
    const emailLower = (email || '').toLowerCase();
    // Net Pacific only: always use the single allowed tenant; ignore any org from body
    const orgCode = NETPACIFIC_TENANT_CODE;

    try {
        let tenantId = 'default';
        try {
            const tenantRes = await db.query('SELECT id, name FROM tenants WHERE code = ?', [orgCode]);
            if (tenantRes.rows?.length) {
                tenantId = tenantRes.rows[0].id;
            }
            // Do not create new tenants; signup is Net Pacific only
        } catch (e) {
            tenantId = 'default';
        }

        const existingUser = await db.query('SELECT id FROM users WHERE email = ? AND tenant_id = ?', [emailLower, tenantId]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const id = uuidv4();
        const rolesJson = JSON.stringify([DEFAULT_SIGNUP_ROLE]);

        await db.query(
            'INSERT INTO users (id, tenant_id, email, password_hash, name, is_verified, roles, account_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, tenantId, emailLower, password_hash, (name || '').trim() || null, 1, rolesJson, 'User']
        );

        // Link default role in user_roles if roles table has it
        const roleRow = await db.query('SELECT id FROM roles WHERE name = ?', [DEFAULT_SIGNUP_ROLE]);
        if (roleRow.rows.length > 0) {
            await db.query('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, roleRow.rows[0].id]);
        }

        const now = new Date().toISOString();
        console.log(`[${now}] New signup: ${emailLower} (ID: ${id})`);

        const token = jwt.sign({
            id,
            email: emailLower,
            name: (name || '').trim() || null,
            tenantId,
            tenantCode: orgCode,
            roles: [DEFAULT_SIGNUP_ROLE],
            accountType: 'User'
        }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: { id, email: emailLower, name: (name || '').trim() || null, tenantId, tenantCode: orgCode, roles: [DEFAULT_SIGNUP_ROLE], accountType: 'User' }
        });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ error: 'Unable to create account. Please try again.' });
    }
});

// POST Register endpoint (admin/API: requires roles)
app.post('/api/register', authLimiter, [
    body('tenantCode').optional().trim().isLength({ min: 2, max: 40 }).withMessage('Organization code must be 2-40 characters'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8, max: 100 }).withMessage('Password must be 8-100 characters'),
    body('name').optional().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters if provided'),
    body('roles').isArray({ min: 1 }).withMessage('At least one role is required'),
    body('roles.*').isString().trim().escape().withMessage('Role must be a valid string')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { email, password, name, roles, tenantCode } = req.body;
    const emailLower = (email || '').toLowerCase();
    const orgCode = (tenantCode || 'default').toString().trim().toLowerCase() || 'default';

    try {
        let tenantId = 'default';
        try {
            const tenantRes = await db.query('SELECT id FROM tenants WHERE code = ?', [orgCode]);
            if (tenantRes.rows?.length) tenantId = tenantRes.rows[0].id;
        } catch (e) {
            tenantId = 'default';
        }

        const existingUser = await db.query('SELECT id FROM users WHERE email = ? AND tenant_id = ?', [emailLower, tenantId]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const id = uuidv4();
        const rolesArr = Array.isArray(roles) ? roles : [roles];
        const rolesJson = JSON.stringify(rolesArr);

        await db.query(
            'INSERT INTO users (id, tenant_id, email, password_hash, name, is_verified, roles, account_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, tenantId, emailLower, password_hash, name || null, true, rolesJson, 'User']
        );

        const now = new Date().toISOString();
        const logMsg = `[${now}] New user registered: ${emailLower} (ID: ${id})`;
        console.log(logMsg);
        fs.appendFileSync(path.join(__dirname, 'audit.log'), logMsg + '\n');

        res.status(201).json({
            message: 'User registered successfully',
            user: { id, email: emailLower, name: name || null, roles: rolesArr, accountType: 'User' }
        });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/opportunities', authenticateToken, async (req, res) => {
  console.log('[DEBUG] GET /api/opportunities request received');
  try {
    // Use mock data in development mode
    if (USE_MOCK_DATA) {
      console.log('[DEV MODE] Returning mock opportunities data');
      const mockOpportunities = [
        {
          uid: 'opp001',
          project_name: 'Network Infrastructure Upgrade',
          client: 'ABC Corporation',
          solutions: 'Network Infrastructure',
          pic: 'Development User',
          account_mgr: 'John Smith',
          final_amt: 1500000,
          opp_status: 'OP90',
          status: 'ongoing',
          forecast_date: '2025-07-15',
          submitted_date: null,
          date_received: '2025-01-15',
          client_deadline: '2025-08-01',
          margin: 25,
          revision: 2
        },
        {
          uid: 'opp002',
          project_name: 'Cloud Migration Project',
          client: 'XYZ Company',
          solutions: 'Cloud Services',
          pic: 'Development User',
          account_mgr: 'Jane Doe',
          final_amt: 2200000,
          opp_status: 'OP60',
          status: 'not_yet_started',
          forecast_date: '2025-08-01',
          submitted_date: null,
          date_received: '2025-01-20',
          client_deadline: '2025-09-01',
          margin: 30,
          revision: 1
        },
        {
          uid: 'opp003',
          project_name: 'Security Assessment',
          client: 'Government Agency',
          solutions: 'Cybersecurity',
          pic: 'Development User',
          account_mgr: 'John Smith',
          final_amt: 800000,
          opp_status: 'OP90',
          status: 'ongoing',
          forecast_date: '2025-07-10',
          submitted_date: null,
          date_received: '2025-01-10',
          client_deadline: '2025-07-30',
          margin: 22,
          revision: 3
        },
        {
          uid: 'opp004',
          project_name: 'Data Center Expansion',
          client: 'Financial Corp',
          solutions: 'Data Center',
          pic: 'Development User',
          account_mgr: 'Jane Doe',
          final_amt: 3500000,
          opp_status: 'OP100',
          status: 'submitted',
          forecast_date: '2025-06-15',
          submitted_date: '2025-06-15',
          date_received: '2025-01-05',
          client_deadline: '2025-06-30',
          margin: 18,
          revision: 4
        },
        {
          uid: 'opp005',
          project_name: 'VoIP Implementation',
          client: 'Healthcare Provider',
          solutions: 'Communications',
          pic: 'Development User',
          account_mgr: 'John Smith',
          final_amt: 950000,
          opp_status: 'OP60',
          status: 'ongoing',
          forecast_date: '2025-07-25',
          submitted_date: null,
          date_received: '2025-01-25',
          client_deadline: '2025-08-15',
          margin: 28,
          revision: 1
        }
      ];
      return res.json(mockOpportunities);
    }
    
    const result = await db.query(`
      SELECT uid, encoded_date, project_name, project_code, rev, client, solutions,
             sol_particulars, industries, ind_particulars, date_received, client_deadline,
             decision, account_mgr, pic, bom, status, submitted_date, margin, final_amt,
             opp_status, date_awarded_lost, lost_rca, l_particulars, a, c, r, u,
             remarks_comments, forecast_date, google_drive_folder_id,
             google_drive_folder_url, google_drive_folder_name, drive_folder_created_at,
             drive_folder_created_by
      FROM opps_monitoring
    `);
    console.log(`[DEBUG] Fetched ${result.rows?.length || 0} opportunities from database`);
    res.json(result.rows);
  } catch (error) {
    console.error('[ERROR] Error fetching data from database:', error);
    res.status(500).json({ error: 'Failed to fetch data from database' });
  }
});

// Check if project code already exists
app.get('/api/opportunities/check-project-code', authenticateToken, async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'Project code is required' });
  }
  
  try {
    const result = await db.query(
      'SELECT uid FROM opps_monitoring WHERE project_code = ?',
      [code.trim()]
    );
    
    res.json({ 
      exists: result.rows.length > 0,
      code: code.trim()
    });
  } catch (error) {
    console.error('Error checking project code:', error);
    res.status(500).json({ error: 'Failed to check project code' });
  }
});

// Next project code (database-only)
app.get('/api/next-project-code', authenticateToken, async (req, res) => {
  console.log('[API /api/next-project-code] Request received');
  try {
    const result = await db.query(
      'SELECT project_code FROM opps_monitoring WHERE project_code IS NOT NULL AND project_code LIKE ? ORDER BY project_code DESC LIMIT 1',
      [PROJECT_CODE_PREFIX + '%']
    );
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefixEscaped = PROJECT_CODE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fallbackPattern = new RegExp(`^${prefixEscaped}(\\d{2})(\\d{2})(\\d{4})$`);
    let nextCode;
    if (result.rows.length === 0) {
      nextCode = `${PROJECT_CODE_PREFIX}${currentYear}${currentMonth}0001`;
    } else {
      const lastCode = result.rows[0].project_code;
      const match = lastCode.match(fallbackPattern);
      if (match) {
        const [, lastYear, lastMonth, lastSequence] = match;
        if (currentYear === lastYear && currentMonth === lastMonth) {
          const nextSequence = (parseInt(lastSequence) + 1).toString().padStart(4, '0');
          nextCode = `${PROJECT_CODE_PREFIX}${currentYear}${currentMonth}${nextSequence}`;
        } else {
          nextCode = `${PROJECT_CODE_PREFIX}${currentYear}${currentMonth}0001`;
        }
      } else {
        nextCode = `${PROJECT_CODE_PREFIX}${currentYear}${currentMonth}0001`;
      }
    }
    console.log('[API] Generated next project code:', nextCode);
    res.json({ nextProjectCode: nextCode });
  } catch (error) {
    console.error('[API /api/next-project-code] Error:', error);
    res.status(500).json({ error: 'Failed to generate project code' });
  }
});

// API endpoint for Win/Loss dashboard data (sends all data + unique solutions)
app.get('/api/dashboard', async (req, res) => {
  console.log(`[API /api/dashboard] Request received.`);
  try {
    // Use mock data in development mode
    if (USE_MOCK_DATA) {
      console.log('[DEV MODE] Returning mock dashboard data');
      const mockOpportunities = [
        {
          opp_status: 'OP90',
          date_awarded_lost: null,
          final_amt: 1500000,
          solutions: 'Network Infrastructure',
          account_mgr: 'John Smith',
          project_name: 'Network Infrastructure Upgrade',
          client: 'ABC Corporation',
          margin: 25
        },
        {
          opp_status: 'OP60',
          date_awarded_lost: null,
          final_amt: 2200000,
          solutions: 'Cloud Services',
          account_mgr: 'Jane Doe',
          project_name: 'Cloud Migration Project',
          client: 'XYZ Company',
          margin: 30
        },
        {
          opp_status: 'OP90',
          date_awarded_lost: null,
          final_amt: 800000,
          solutions: 'Cybersecurity',
          account_mgr: 'John Smith',
          project_name: 'Security Assessment',
          client: 'Government Agency',
          margin: 22
        },
        {
          opp_status: 'OP100',
          date_awarded_lost: '2025-06-15',
          final_amt: 3500000,
          solutions: 'Data Center',
          account_mgr: 'Jane Doe',
          project_name: 'Data Center Expansion',
          client: 'Financial Corp',
          margin: 18
        }
      ];
      
      const uniqueSolutions = ['Network Infrastructure', 'Cloud Services', 'Cybersecurity', 'Data Center', 'Communications'];
      const uniqueAccountMgrs = ['John Smith', 'Jane Doe'];
      
      return res.json({
        opportunities: mockOpportunities,
        uniqueSolutions: uniqueSolutions,
        uniqueAccountMgrs: uniqueAccountMgrs
      });
    }
    
    // Updated: Select all fields needed for the dashboard table
    const result = await db.query(`
      SELECT
        opp_status,
        date_awarded_lost,
        final_amt,
        solutions,
        account_mgr,
        project_name,
        client,
        margin
      FROM opps_monitoring
    `);
    const allOpportunities = Array.isArray(result.rows) ? result.rows : [];

    // Unique Solutions
    const solutionKey = 'solutions';
    const firstOpp = allOpportunities.length > 0 ? allOpportunities[0] : null;
    const uniqueSolutions = safeHas(firstOpp, solutionKey)
        ? Array.from(new Set(allOpportunities.map(opp => opp && opp[solutionKey]).filter(Boolean))).sort()
        : [];
    console.log(`[API /api/dashboard] Unique Solutions found: ${uniqueSolutions.join(', ')}`);

    // Unique Account Managers
    const accountMgrKey = 'account_mgr';
    const uniqueAccountMgrs = safeHas(firstOpp, accountMgrKey)
        ? Array.from(new Set(allOpportunities.map(opp => opp && opp[accountMgrKey]).filter(Boolean))).sort()
        : [];
    console.log(`[API /api/dashboard] Unique Account Managers found: ${uniqueAccountMgrs.join(', ')}`);

    res.json({
        opportunities: allOpportunities,
        uniqueSolutions: uniqueSolutions,
        uniqueAccountMgrs: uniqueAccountMgrs
    });
  } catch (error) {
    console.error('[API /api/dashboard] Error generating win/loss dashboard data:', error);
    res.status(500).json({ error: 'Failed to generate win/loss dashboard data' });
  }
});


// API endpoint for Forecast dashboard data (with status filter)
app.get('/api/forecast-dashboard', async (req, res) => {
  const requestedStatus = req.query.status;
  try {
    // Use mock data in development mode
    if (USE_MOCK_DATA) {
      console.log('[DEV MODE] Returning mock forecast dashboard data');
      
      const mockOpportunities = [
        {
          uid: 'opp001',
          forecast_date: '2025-07-15',
          final_amt: 1500000,
          opp_status: 'OP90',
          project_name: 'Network Infrastructure Upgrade',
          account_mgr: 'John Smith',
          pic: 'Development User',
          client: 'ABC Corporation',
          solutions: 'Network Infrastructure'
        },
        {
          uid: 'opp002',
          forecast_date: '2025-08-01',
          final_amt: 2200000,
          opp_status: 'OP60',
          project_name: 'Cloud Migration Project',
          account_mgr: 'Jane Doe',
          pic: 'Development User',
          client: 'XYZ Company',
          solutions: 'Cloud Services'
        },
        {
          uid: 'opp003',
          forecast_date: '2025-07-10',
          final_amt: 800000,
          opp_status: 'OP90',
          project_name: 'Security Assessment',
          account_mgr: 'John Smith',
          pic: 'Development User',
          client: 'Government Agency',
          solutions: 'Cybersecurity'
        },
        {
          uid: 'opp005',
          forecast_date: '2025-07-25',
          final_amt: 950000,
          opp_status: 'OP60',
          project_name: 'VoIP Implementation',
          account_mgr: 'John Smith',
          pic: 'Development User',
          client: 'Healthcare Provider',
          solutions: 'Communications'
        }
      ];
      
      // Filter by status if requested
      let filteredOpportunities = mockOpportunities;
      if (requestedStatus && requestedStatus.toLowerCase() !== 'all') {
        filteredOpportunities = mockOpportunities.filter(opp => opp.opp_status === requestedStatus);
      }
      
      // Calculate mock forecast data
      const forecastMonthlySummary = [
        { monthYear: 'July 2025', count: 3, totalAmount: 3250000 },
        { monthYear: 'August 2025', count: 1, totalAmount: 2200000 }
      ];
      
      const projectDetails = filteredOpportunities.map(opp => ({
        uid: opp.uid,
        name: opp.project_name,
        amount: opp.final_amt,
        forecastMonth: new Date(opp.forecast_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        forecastWeek: `W${Math.ceil(new Date(opp.forecast_date).getDate() / 7)}`,
        forecast_date: opp.forecast_date,
        client: opp.client,
        solutions: opp.solutions,
        account_mgr: opp.account_mgr,
        status: opp.opp_status
      }));
      
      return res.json({
        forecastMonthlySummary,
        projectDetails,
        totalForecastCount: filteredOpportunities.length,
        totalForecastAmount: filteredOpportunities.reduce((sum, opp) => sum + opp.final_amt, 0),
        nextMonthForecastCount: 3,
        nextMonthForecastAmount: 3250000
      });
    }
    
    // *** MODIFIED: Added uid, account_mgr, pic, client, and solutions to the SELECT statement ***
    let sql = `
        SELECT uid, forecast_date, final_amt, opp_status, project_name, account_mgr, pic, client, solutions
        FROM opps_monitoring
        WHERE forecast_date IS NOT NULL
          AND (decision IS NULL OR decision NOT IN ('DECLINE', 'DECLINED'))
          AND (opp_status IS NULL OR opp_status NOT IN ('LOST', 'OP100'))
    `;
    const queryParams = [];
    if (requestedStatus && requestedStatus.toLowerCase() !== 'all') {
        sql += ` AND opp_status = ?`;
        queryParams.push(requestedStatus);
    }
    const result = await db.query(sql, queryParams);
    const opportunities = result.rows;

    // --- Find min/max forecast date ---
    let minDate = null, maxDate = null;
    opportunities.forEach(opp => {
        const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
        const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
        const parsedDate = robustParseDate(forecastDateValue);
        if (!parsedDate || isNaN(parsedDate)) return;
        if (!minDate || parsedDate < minDate) minDate = parsedDate;
        if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;
    });
    // --- Build all months between min and max ---
    let allMonths = [];
    if (minDate && maxDate) {
      let cursor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
      const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1));
      while (cursor <= end) {
        const monthName = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        allMonths.push(monthName);
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      }
    }

    // --- Calculate monthly summary (with zero fill) ---
    const forecastMonthly = {};
    opportunities.forEach(opp => {
        const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
        const amtKey = getColumnInsensitive(opp, 'final_amt');
        const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
        const finalAmt = amtKey ? parseCurrency(opp[amtKey]) : 0;
        const parsedForecastDate = robustParseDate(forecastDateValue);
        if (!parsedForecastDate || isNaN(parsedForecastDate)) return;
        const monthName = parsedForecastDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        if (!forecastMonthly[monthName]) forecastMonthly[monthName] = { monthYear: monthName, count: 0, totalAmount: 0 };
        forecastMonthly[monthName].count++;
        forecastMonthly[monthName].totalAmount += finalAmt;
    });
    // Fill missing months with zero
    if (allMonths.length > 0) {
      allMonths.forEach(monthName => {
        if (!forecastMonthly[monthName]) forecastMonthly[monthName] = { monthYear: monthName, count: 0, totalAmount: 0 };
      });
    }
    // Sort months chronologically
    const forecastMonthlySummary = Object.values(forecastMonthly).sort((a, b) => {
      const pa = new Date(a.monthYear);
      const pb = new Date(b.monthYear);
      return pa - pb;
    });

    // --- Calculate other summary data as before ---
    // ...existing code for totalForecastCount, totalForecastAmount, nextMonthForecastCount, nextMonthForecastAmount, projectDetails...
    let totalForecastCount = 0;
    let totalForecastAmount = 0;
    let nextMonthForecastCount = 0;
    let nextMonthForecastAmount = 0;
    const now = new Date();
    const nextMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const projectDetails = [];
    opportunities.forEach((opp, index) => {
        if (typeof opp !== 'object' || opp === null) return;
        const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
        const amtKey = getColumnInsensitive(opp, 'final_amt');
        const projNameKey = getColumnInsensitive(opp, 'project_name');
        const uidKey = getColumnInsensitive(opp, 'uid'); // Get uid key

        const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
        const finalAmt = amtKey ? parseCurrency(opp[amtKey]) : 0;
        const projectName = projNameKey ? opp[projNameKey] : 'Unknown Project';
        const projectUid = uidKey ? opp[uidKey] : null; // Get actual uid

        let parsedForecastDate = robustParseDate(forecastDateValue);
        let forecastMonth = '';
        let forecastWeek = '';
        let displayableForecastDate = null; // For YYYY-MM-DD format or null

        if (parsedForecastDate && !isNaN(parsedForecastDate)) {
            forecastMonth = parsedForecastDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            displayableForecastDate = parsedForecastDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            
            // --- CORRECTED: Use getCMRPWeeksForMonth to calculate forecastWeek ---
            const year = parsedForecastDate.getUTCFullYear();
            const month = parsedForecastDate.getUTCMonth(); // 0-indexed
            const cmrpMonthWeeks = getCMRPWeeksForMonth(year, month);
            
            forecastWeek = ''; // Default to empty if not found in a CMRP week
            for (const cmrpWeek of cmrpMonthWeeks) {
                // Ensure dates are compared correctly. parsedForecastDate is already UTC midnight.
                // cmrpWeek.startDate and cmrpWeek.endDate are also UTC.
                if (parsedForecastDate >= cmrpWeek.startDate && parsedForecastDate <= cmrpWeek.endDate) {
                    forecastWeek = cmrpWeek.weekNumber;
                    break;
                }
            }
            // console.log(`[SERVER DEBUG /api/forecast-dashboard] Parsed Date=${parsedForecastDate.toISOString()}, Calculated CMRP Week=${forecastWeek}`);
        } else {
            // console.log(`[SERVER DEBUG /api/forecast-dashboard] ForecastDate invalid or not parsable: ${forecastDateValue}`);
        }

        // This block pushes to projectDetails
        if (projectUid && projectName) { // Push project even if forecast date is invalid/missing, so it appears in list
            if (parsedForecastDate && !isNaN(parsedForecastDate)) {
                totalForecastCount++;
                totalForecastAmount += finalAmt;
                const year = parsedForecastDate.getUTCFullYear();
                const month = parsedForecastDate.getUTCMonth();
                if (year === nextMonthDate.getUTCFullYear() && month === nextMonthDate.getUTCMonth()) {
                    nextMonthForecastCount++;
                    nextMonthForecastAmount += finalAmt;
                }
            }
            projectDetails.push({
                uid: projectUid,
                name: projectName,
                amount: finalAmt,
                forecastMonth,
                forecastWeek,
                forecast_date: displayableForecastDate, // MODIFIED: Use YYYY-MM-DD formatted string or null
                account_mgr: getColumnInsensitive(opp, 'account_mgr') ? opp[getColumnInsensitive(opp, 'account_mgr')] : null,
                pic: getColumnInsensitive(opp, 'pic') ? opp[getColumnInsensitive(opp, 'pic')] : null,
                opp_status: getColumnInsensitive(opp, 'opp_status') ? opp[getColumnInsensitive(opp, 'opp_status')] : null,
                client: getColumnInsensitive(opp, 'client') ? opp[getColumnInsensitive(opp, 'client')] : null,
                solutions: getColumnInsensitive(opp, 'solutions') ? opp[getColumnInsensitive(opp, 'solutions')] : null
            });
        }
    });

    return res.json({
        totalForecastCount,
        totalForecastAmount,
        nextMonthForecastCount,
        nextMonthForecastAmount,
        forecastMonthlySummary,
        projectDetails
    });
  } catch (error) {
    console.error('[API /api/forecast-dashboard] Error generating forecast dashboard data:', error);
    console.error('[API /api/forecast-dashboard] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to generate forecast dashboard data' });
  }
});

// API endpoint: Forecast revision summary (by revision date and by new forecast date)
app.get('/api/forecast-revision-summary', async (req, res) => {
    // ... (implementation remains the same) ...
    try {
        const byRevisionDate = await db.query(`...`);
        const byForecastDate = await db.query(`...`);
        res.json({ byRevisionDate: byRevisionDate.rows, byForecastDate: byForecastDate.rows });
    } catch (error) { /* ... error handling ... */ }
});

// API endpoint: Forecast dashboard data by CMRP week (Month-Week)
app.get('/api/forecast-dashboard-weeks', async (req, res) => {
    try {
        // Query only relevant opportunities (same filter as /api/forecast-dashboard)
        const result = await db.query(`
            SELECT forecast_date, final_amt, opp_status, project_name
            FROM opps_monitoring
            WHERE forecast_date IS NOT NULL
              AND (decision IS NULL OR decision NOT IN ('DECLINE', 'DECLINED'))
              AND (opp_status IS NULL OR opp_status NOT IN ('LOST', 'OP100'))
        `);
        const opportunities = result.rows;
        // Helper to get week of month (1-based, UTC)
        function getWeekOfMonth(date) {
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();
            const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
            const firstDayWeekday = firstDayOfMonth.getUTCDay(); // 0=Sun
            const dayOfMonth = date.getUTCDate();
            const daysOffset = dayOfMonth + firstDayWeekday;
            return Math.ceil(daysOffset / 7);
        }
        // --- Find min/max forecast date ---
        let minDate = null, maxDate = null;
        opportunities.forEach(opp => {
            const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
            const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
            const parsedDate = robustParseDate(forecastDateValue);
            if (!parsedDate || isNaN(parsedDate)) return;
            if (!minDate || parsedDate < minDate) minDate = parsedDate;
            if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;
        });
        if (!minDate || !maxDate) {
            res.json({ weekSummary: [] });
            return;
        }
        // --- Build all CMRP weeks between min and max ---
        const allWeeks = [];
        let cursor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
        const end = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), maxDate.getUTCDate()));
        while (cursor <= end) {
            const year = cursor.getUTCFullYear();
            const month = cursor.getUTCMonth();
            const monthName = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            // Use CMRP week logic
            const cmrpWeeks = getCMRPWeeksForMonth(year, month);
            for (const w of cmrpWeeks) {
                const monthWeek = `${monthName} - Week ${w.weekNumber}`;
                allWeeks.push(monthWeek);
            }
            // Move to next month
            cursor = new Date(Date.UTC(year, month + 1, 1));
        }
        // --- Build weekMap using only valid CMRP weeks ---
        const weekMap = {};
        // Precompute all valid CMRP monthWeek labels for the range
        const validMonthWeeksSet = new Set();
        let validCursor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
        while (validCursor <= end) {
            const year = validCursor.getUTCFullYear();
            const month = validCursor.getUTCMonth();
            const monthName = validCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            const cmrpWeeks = getCMRPWeeksForMonth(year, month);
            for (const w of cmrpWeeks) {
                validMonthWeeksSet.add(`${monthName} - Week ${w.weekNumber}`);
            }
            validCursor = new Date(Date.UTC(year, month + 1, 1));
        }
        // Only count opportunities for valid CMRP weeks
        opportunities.forEach(opp => {
            const forecastDateKey = getColumnInsensitive(opp, 'forecast_date');
            const amtKey = getColumnInsensitive(opp, 'final_amt');
            const forecastDateValue = forecastDateKey ? opp[forecastDateKey] : null;
            const finalAmt = amtKey ? parseCurrency(opp[amtKey]) : 0;
            const parsedDate = robustParseDate(forecastDateValue);
            if (!parsedDate || isNaN(parsedDate)) return;
            const monthName = parsedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            const weekNumber = getWeekOfMonth(parsedDate);
            const monthWeek = `${monthName} - Week ${weekNumber}`;
            if (!validMonthWeeksSet.has(monthWeek)) return; // Only count valid CMRP weeks
            if (!weekMap[monthWeek]) weekMap[monthWeek] = { monthWeek, count: 0, totalAmount: 0 };
            weekMap[monthWeek].count++;
            weekMap[monthWeek].totalAmount += finalAmt;
        });
        // --- Build weekSummaryArr with only valid CMRP weeks ---
        const weekSummaryArr = [];
        let cursor2 = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
        while (cursor2 <= end) {
            const year = cursor2.getUTCFullYear();
            const month = cursor2.getUTCMonth();
            const monthName = cursor2.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
            const cmrpWeeks = getCMRPWeeksForMonth(year, month); // Only weeks whose start and end are in the month
            for (const w of cmrpWeeks) {
                const monthWeek = `${monthName} - Week ${w.weekNumber}`;
                if (weekMap[monthWeek]) {
                    weekSummaryArr.push(weekMap[monthWeek]);
                } else {
                    weekSummaryArr.push({ monthWeek, count: 0, totalAmount: 0 });
                }
            }
            cursor2 = new Date(Date.UTC(year, month + 1, 1));
        }
        // No further filtering needed: weekSummaryArr now contains only valid CMRP weeks for each month
        weekSummaryArr.sort((a, b) => {
            function parseMonthWeek(mw) {
                const match = mw.match(/^([A-Za-z]+) (\d{4}) - Week (\d+)$/);
                if (!match) return { y: 0, m: 0, w: 0 };
                const [_, monthStr, yearStr, weekStr] = match;
                const m = new Date(`${monthStr} 1, ${yearStr}`).getMonth();
                return { y: +yearStr, m, w: +weekStr };
            }
            const pa = parseMonthWeek(a.monthWeek);
            const pb = parseMonthWeek(b.monthWeek);
            if (pa.y !== pb.y) return pa.y - pb.y;
            if (pa.m !== pb.m) return pa.m - pb.m;
            return pa.w - pb.w;
        });
        res.json({ weekSummary: weekSummaryArr });
        return;
    } catch (error) {
        console.error('[API /api/forecast-dashboard-weeks] Error:', error);
        res.status(500).json({ error: 'Failed to generate weekly forecast dashboard data' });
    }
});

// API endpoint: Forecast Sliding Summary (Monthly)
app.get('/api/forecast-sliding-summary', async (req, res) => {
  console.log(`[API /api/forecast-sliding-summary] Request received.`);
  try {
    const intervalDays = '30 days'; // Period for considering revisions

    const slidingSummarySql = `
      WITH recent_revisions AS (
        SELECT
          fr.opportunity_uid,
          fr.old_forecast_date,
          fr.new_forecast_date,
          om.final_amt
        FROM forecast_revisions fr
        JOIN opps_monitoring om ON fr.opportunity_uid::uuid = om.uid -- CORRECTED: Cast TEXT to UUID for join
        WHERE fr.changed_at >= NOW() - INTERVAL '${intervalDays}'
      ),
      monthly_changes AS (
        SELECT
          to_char(new_forecast_date::date, 'YYYY-MM') AS month_year_key, -- Cast to DATE
          SUM(final_amt) AS inflow_amount,
          COUNT(DISTINCT opportunity_uid) AS inflow_count
        FROM recent_revisions
        WHERE new_forecast_date IS NOT NULL
          AND (old_forecast_date IS NULL OR to_char(old_forecast_date::date, 'YYYY-MM') != to_char(new_forecast_date::date, 'YYYY-MM')) -- Cast to DATE
        GROUP BY to_char(new_forecast_date::date, 'YYYY-MM') -- Cast to DATE

        UNION ALL

        SELECT
          to_char(old_forecast_date::date, 'YYYY-MM') AS month_year_key, -- Cast to DATE
          SUM(final_amt * -1) AS inflow_amount, -- Negative for outflow
          COUNT(DISTINCT opportunity_uid) * -1 AS inflow_count -- Negative for outflow
        FROM recent_revisions
        WHERE old_forecast_date IS NOT NULL
          AND (new_forecast_date IS NULL OR to_char(new_forecast_date::date, 'YYYY-MM') != to_char(old_forecast_date::date, 'YYYY-MM')) -- Cast to DATE
        GROUP BY to_char(old_forecast_date::date, 'YYYY-MM') -- Cast to DATE
      )
      SELECT
        month_year_key,
        SUM(inflow_amount) AS net_change_amount,
        SUM(inflow_count) AS net_change_count
      FROM monthly_changes
      WHERE month_year_key IS NOT NULL
      GROUP BY month_year_key
      ORDER BY month_year_key ASC;
    `;

    const result = await db.query(slidingSummarySql);
    
    const formattedResult = result.rows.map(row => ({
      // Ensure monthYear is formatted correctly for matching with main chart labels
      monthYear: formatMonthYear(new Date(row.month_year_key + '-02T00:00:00Z')), // Use day 02 to avoid timezone issues with day 01
      netChangeAmount: parseFloat(row.net_change_amount) || 0,
      netChangeCount: parseInt(row.net_change_count) || 0
    }));

    console.log(`[API /api/forecast-sliding-summary] Sending summary:`, formattedResult);
    res.json(formattedResult);

  } catch (error) {
    console.error('[API /api/forecast-sliding-summary] Error:', error);
    res.status(500).json({ error: 'Failed to generate forecast sliding summary' });
  }
});

app.post('/api/opportunities', authenticateToken,
  [
    body().customSanitizer(obj => {
      if (obj == null || typeof obj !== 'object') return {};
      const out = {};
      for (const key of Object.keys(obj)) {
        const v = obj[key];
        out[key] = typeof v === 'string' ? v.trim() : v;
      }
      return out;
    }),
    body('opp_name').optional().custom(value => {
      if (value == null || typeof value !== 'string') return true;
      if (value.length > 0) return value.length >= 2 && value.length <= 200;
      return true;
    }).escape(),
    body('project_name').optional().custom(value => {
      if (value == null || typeof value !== 'string') return true;
      if (value.length > 0) return value.length >= 2 && value.length <= 200;
      return true;
    }).escape(),
    body('project_code').optional().custom(async (value) => {
      if (value == null || (typeof value !== 'string') || value.trim() === '') return true;
      const existingProject = await db.query(
        'SELECT uid FROM opps_monitoring WHERE project_code = ?',
        [value.trim()]
      );
      if (existingProject && Array.isArray(existingProject.rows) && existingProject.rows.length > 0) {
        throw new Error(`Project code "${value}" already exists`);
      }
      return true;
    }),
    body('client').optional().custom(value => {
      if (value == null || typeof value !== 'string') return true;
      if (value.length > 0) return value.length >= 2 && value.length <= 200;
      return true;
    }).escape(),
    body('account_mgr').optional().custom(value => {
      if (value == null || typeof value !== 'string') return true;
      if (value.length > 0) return value.length >= 2 && value.length <= 100;
      return true;
    }).escape(),
    body('margin').optional().custom(value => {
      if (value == null || value === '') return true;
      const cleanedValue = typeof value === 'string' ? value.replace(/[%]/g, '').trim() : value;
      return !isNaN(parseFloat(cleanedValue)) && isFinite(cleanedValue);
    }),
    body('margin_percentage').optional().custom(value => {
      if (value == null || value === '') return true;
      const cleanedValue = typeof value === 'string' ? value.replace(/[%]/g, '').trim() : value;
      return !isNaN(parseFloat(cleanedValue)) && isFinite(cleanedValue);
    }),
    body('final_amt').optional().custom(value => {
      if (value == null || value === '') return true;
      const cleanedValue = typeof value === 'string' ? value.replace(/[₱$,]/g, '').trim() : value;
      return !isNaN(parseFloat(cleanedValue)) && isFinite(cleanedValue);
    }),
    body('date_awarded_lost').optional().isISO8601().toDate(),
  ],
  async (req, res) => {
    if (req.body == null || typeof req.body !== 'object') req.body = {};
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }
    console.log("=== POST /api/opportunities ===");
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request body keys:', Object.keys(req.body));
    let newOpp = { ...req.body };
    const changed_by = newOpp.changed_by || null;
    delete newOpp.changed_by;
    delete newOpp.uid; delete newOpp.UID; delete newOpp.Uid;
    newOpp.uid = uuidv4();
    
    // Automatically generate encoded_date for new opportunities if not provided
    if (!newOpp.encoded_date) {
      const currentDate = new Date();
      newOpp.encoded_date = currentDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      console.log('[SERVER] Auto-generated encoded_date:', newOpp.encoded_date);
    }
    
    newOpp = Object.fromEntries(Object.entries(newOpp).map(([k, v]) => [k, (typeof v === 'string' && v.trim() === '') ? null : v]));

    const keys = Object.keys(newOpp);
    const values = keys.map(k => newOpp[k]);
    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO opps_monitoring (${columns}) VALUES (${placeholders}) RETURNING *`;

    console.log('Executing SQL:', sql); console.log('With Values:', values);
    try {
      const result = await db.query(sql, values);
      // SQLite strips RETURNING *, so rows[0] may be undefined; use newOpp + uid as fallback
      let createdOpp = result.rows && result.rows[0];
      if (!createdOpp && newOpp && newOpp.uid) {
        createdOpp = { ...newOpp, ...Object.fromEntries(keys.map((k, i) => [k, values[i]])) };
      }
      if (!createdOpp) {
        return res.status(500).json({ error: 'Failed to create opportunity (no row returned)' });
      }
      createdOpp = { ...createdOpp };
      const revKey = getColumnInsensitive(createdOpp, 'rev');
      const revNumber = revKey ? (Number(createdOpp[revKey]) || 0) : 0;
      // *** FIX: Use correct database column names in fieldsToStore ***
      const fieldsToStore = ['rev', 'final_amt', 'margin', 'client_deadline', 'submitted_date', 'forecast_date'];
      const snapshotFields = {};
      fieldsToStore.forEach(f => {
        const key = (f === 'rev') ? 'rev' : getColumnInsensitive(createdOpp, f);
        if (safeHas(createdOpp, key)) snapshotFields[f] = createdOpp[key]; else snapshotFields[f] = null;
      });
      await db.query(
        db.convertSQL(`INSERT INTO opportunity_revisions (opportunity_uid, revision_number, changed_by, changed_at, changed_fields, full_snapshot)
         VALUES (?, ?, ?, NOW(), ?, ?)`),
        [createdOpp.uid, revNumber, changed_by, JSON.stringify(snapshotFields), JSON.stringify(snapshotFields)]
      );
      console.log(`Revision ${revNumber} created for new opportunity ${createdOpp.uid}`);
      
      // Create notifications for assignments in new opportunities (only when pool has .query, e.g. pg)
      try {
        const assignmentFields = ['pic', 'bom', 'account_mgr'];
        const canNotify = pool && typeof pool.query === 'function';
        if (canNotify) {
          const notificationService = new NotificationService(pool);
        for (const field of assignmentFields) {
          const assignedValue = createdOpp[field];
          if (typeof assignedValue !== 'string' || assignedValue.trim() === '') continue;
            // Find user by name (assuming the field contains user names)
            const userQuery = 'SELECT id FROM users WHERE name ILIKE ? OR email ILIKE ? LIMIT 1';
            const userResult = await db.query(userQuery, [assignedValue.trim(), assignedValue.trim()]);
            
            if (userResult.rows.length > 0) {
              const assignedUserId = userResult.rows[0].id;
              const projectName = createdOpp.project_name || 'New Project';
              
              // Don't notify if user assigns themselves
              if (assignedUserId !== req.user?.id) {
                // Create assignment notification
                await notificationService.notifyAssignment({
                  opportunity_uid: createdOpp.uid,
                  assigned_user_id: assignedUserId,
                  assignment_type: field === 'account_mgr' ? 'account_mgr' : field,
                  project_name: projectName,
                  assigned_by_id: req.user?.id || null
                });
                
                console.log(`[NOTIFICATION] Created ${field} assignment notification for user ${assignedUserId} on new project ${projectName}`);
              } else {
                console.log(`[NOTIFICATION] Skipped self-assignment notification for ${field} on project ${projectName}`);
              }
            }
        }
        }
      } catch (notificationError) {
        // Don't fail the creation if notification creation fails
        console.error('Error creating assignment notifications for new opportunity:', notificationError);
      }
      
      res.status(201).json(createdOpp);
    } catch (error) {
      console.error('Error inserting new opportunity or revision:', error);
      if (error && error.stack) console.error('Stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        detail: error.detail,
        hint: error.hint,
        position: error.position,
        constraint: error.constraint,
        table: error.table,
        column: error.column
      });
      console.error('SQL that failed:', sql);
      console.error('Values that failed:', values);
      
      res.status(500).json({ 
        error: 'Failed to create opportunity.',
        details: error.message,
        hint: error.hint || error.detail || 'Check server logs for more details'
      });
    }
  }
);


// PUT Endpoint with Revision Logic v5
app.put('/api/opportunities/:uid', authenticateToken,
  [
    body().customSanitizer(obj => {
      if (obj == null || typeof obj !== 'object') return {};
      const out = {};
      for (const key of Object.keys(obj)) {
        const v = obj[key];
        out[key] = typeof v === 'string' ? v.trim() : v;
      }
      return out;
    }),
    body('opp_name').optional().custom(value => {
      if (value == null || typeof value !== 'string') return true;
      if (value.length > 0) {
        return value.length >= 2 && value.length <= 200;
      }
      return true; // Allow empty values
    }).escape(),
    body('project_name').optional().custom(value => {
      if (value == null || typeof value !== 'string') return true;
      if (value.length > 0) return value.length >= 2 && value.length <= 200;
      return true;
    }).escape(),
    body('client').optional().custom(value => {
      if (value == null || typeof value !== 'string') return true;
      if (value.length > 0) return value.length >= 2 && value.length <= 200;
      return true;
    }).escape(),
    body('account_mgr').optional().custom(value => {
      if (value == null || typeof value !== 'string') return true;
      if (value.length > 0) return value.length >= 2 && value.length <= 100;
      return true;
    }).escape(),
    body('margin').optional().custom(value => {
      if (!value) return true; // Allow empty values
      // Handle percentage format (e.g., "15%")
      const cleanedValue = typeof value === 'string' ? value.replace(/[%]/g, '').trim() : value;
      return !isNaN(parseFloat(cleanedValue)) && isFinite(cleanedValue);
    }),
    body('margin_percentage').optional().custom(value => {
      if (!value) return true; // Allow empty values
      // Handle percentage format (e.g., "15%")
      const cleanedValue = typeof value === 'string' ? value.replace(/[%]/g, '').trim() : value;
      return !isNaN(parseFloat(cleanedValue)) && isFinite(cleanedValue);
    }),
    body('final_amt').optional().custom(value => {
      if (!value) return true; // Allow empty values
      // Handle currency format (e.g., "₱10,000.00", "$1,000.00")
      const cleanedValue = typeof value === 'string' ? value.replace(/[₱$,]/g, '').trim() : value;
      return !isNaN(parseFloat(cleanedValue)) && isFinite(cleanedValue);
    }),
    body('date_awarded_lost').optional().isISO8601().toDate(),
    // Add more fields as needed
  ],
  async (req, res) => {
    if (req.body == null || typeof req.body !== 'object') req.body = {};
    console.log(`[PUT /api/opportunities/${req.params.uid}] === START ===`);
    console.log(`[PUT] Request headers:`, req.headers);
    console.log(`[PUT] Raw body received:`, JSON.stringify(req.body, null, 2));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(`[PUT] Validation errors:`, errors.array());
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: errors.array(),
        message: `Validation failed: ${errors.array().map(e => `${e.param}: ${e.msg}`).join(', ')}`
      });
    }
    const { uid } = req.params;
    console.log(`[PUT /api/opportunities/${uid}] Received raw body:`, JSON.stringify(req.body, null, 2));
    let updateData = { ...req.body };
    const changed_by = updateData.changed_by || null;
    delete updateData.changed_by;
    delete updateData.uid; delete updateData.UID; delete updateData.Uid;
    updateData = Object.fromEntries(Object.entries(updateData).map(([k, v]) => [k, (typeof v === 'string' && v.trim() === '') ? null : v]));
    console.log(`[PUT /api/opportunities/${uid}] Processed updateData:`, JSON.stringify(updateData, null, 2));

    if (!uid) return res.status(400).json({ error: 'UID is required.' });
    const keysToUpdate = Object.keys(updateData);
    if (keysToUpdate.length === 0) return res.status(400).json({ error: 'No data provided for update.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch Current State
      console.log(`[PUT /api/opportunities/${uid}] Fetching current state...`);
      const currentResult = await client.query('SELECT * FROM opps_monitoring WHERE uid = $1 FOR UPDATE', [uid]);
      const currentOpp = currentResult.rows[0];
      if (!currentResult.rows.length) {
        await client.query('ROLLBACK');
        console.log(`[PUT /api/opportunities/${uid}] Opportunity not found.`);
        return res.status(404).json({ error: 'Opportunity not found.' });
      }
      console.log(`[PUT /api/opportunities/${uid}] Current Opp Data:`, JSON.stringify(currentOpp, null, 2));

      // After fetching currentOpp and before updating the main table:
      const oldForecastDate = currentOpp['forecast_date'] || null;
      const newForecastDate = updateData['forecast_date'] || null;
      if (oldForecastDate !== newForecastDate && newForecastDate) {
        await client.query(
          `INSERT INTO forecast_revisions (opportunity_uid, old_forecast_date, new_forecast_date, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [uid, oldForecastDate, newForecastDate, changed_by]
        );
        console.log(`[PUT /api/opportunities/${uid}] Forecast change logged: ${oldForecastDate} -> ${newForecastDate}`);
      }

      // 2. Determine Revision Numbers and if Changed (using direct key access and number conversion)
      const oldRevValue = currentOpp['rev'];
      const newRevValue = updateData['rev'];
      console.log(`[PUT /api/opportunities/${uid}] Comparing Old Rev Value: ${oldRevValue} (Type: ${typeof oldRevValue}), New Rev Value: ${newRevValue} (Type: ${typeof newRevValue})`);
      const oldRevNumber = Number(oldRevValue) || 0;
      const newRevNumber = (newRevValue !== undefined && !isNaN(Number(newRevValue))) ? Number(newRevValue) : oldRevNumber;
      const isRevChanged = newRevNumber !== oldRevNumber;
      console.log(`[PUT /api/opportunities/${uid}] Determined Old Rev#: ${oldRevNumber}, Determined New Rev#: ${newRevNumber}, isRevChanged: ${isRevChanged}`);

      // 3. Build Snapshot of State *Before* Update
      // *** FIX: Use correct database column names in fieldsToStore ***
      const fieldsToStore = ['rev', 'final_amt', 'margin', 'client_deadline', 'submitted_date', 'forecast_date'];
      const buildSnapshot = (row) => {
          const snap = {};
          if (!row || typeof row !== 'object') return snap;
          fieldsToStore.forEach(f => {
              const key = (f === 'rev') ? 'rev' : getColumnInsensitive(row, f);
              if (safeHas(row, key)) { snap[f] = row[key]; }
              else { snap[f] = null; }
          });
          return snap;
      };
      const prevSnapshot = buildSnapshot(currentOpp);
      console.log(`[PUT /api/opportunities/${uid}] Previous Snapshot (for rev ${oldRevNumber}):`, JSON.stringify(prevSnapshot, null, 2));

      // 4. Update Main Table
      const setClause = keysToUpdate.map((key, idx) => `"${key}" = $${idx + 1}`).join(', ');
      const values = keysToUpdate.map(key => updateData[key]);
      values.push(uid);
      const updateSql = `UPDATE opps_monitoring SET ${setClause} WHERE uid = $${values.length} RETURNING *`;
      console.log('[PUT] Executing Update SQL:', updateSql); console.log('With Values:', values);
      const updateResult = await client.query(updateSql, values);
      const updatedOpp = updateResult.rows[0];
      console.log(`[PUT /api/opportunities/${uid}] Updated Opp Data:`, JSON.stringify(updatedOpp, null, 2));

      // 5. Build Snapshot of State *After* Update
      const updatedSnapshot = buildSnapshot(updatedOpp);
      console.log(`[PUT /api/opportunities/${uid}] Updated Snapshot (for rev ${newRevNumber}):`, JSON.stringify(updatedSnapshot, null, 2));

      // 6. Track Actual Field Changes for Revision History
      const actualChangedFields = {};
      
      // Compare each field that was updated to determine actual changes
      keysToUpdate.forEach(fieldName => {
          const oldValue = currentOpp[fieldName];
          const newValue = updatedOpp[fieldName];
          
          // Only record as changed if values are actually different
          if (oldValue !== newValue) {
              actualChangedFields[fieldName] = {
                  old: oldValue,
                  new: newValue
              };
          }
      });
      
      console.log(`[PUT /api/opportunities/${uid}] Actual Changed Fields:`, JSON.stringify(actualChangedFields, null, 2));

      // 7. Handle Revision History Logic (Enhanced to track actual changes)
      // Always UPSERT the *current* state for the current/new revision number with the changes made
      console.log(`[Revision] Upserting current revision state: ${newRevNumber}`);
      const revisionSqlUpsert = `
          INSERT INTO opportunity_revisions (opportunity_uid, revision_number, changed_by, changed_at, changed_fields, full_snapshot)
          VALUES ($1, $2, $3, NOW(), $4, $5)
          ON CONFLICT (opportunity_uid, revision_number)
          DO UPDATE SET
              changed_by = EXCLUDED.changed_by,
              changed_at = NOW(),
              changed_fields = EXCLUDED.changed_fields,
              full_snapshot = EXCLUDED.full_snapshot`;
      await client.query(revisionSqlUpsert, [
          uid,
          newRevNumber, // Use the potentially new revision number
          changed_by,
          JSON.stringify(actualChangedFields), // Store what changed in this revision
          JSON.stringify(updatedSnapshot)
      ]);

      // If revision changed, also ensure previous state is recorded (without field changes since that's for the current revision)
      if (isRevChanged) {
          console.log(`[Revision] Revision Changed. Inserting previous revision (if not exists): ${oldRevNumber}`);
          const insertOldSql = `
              INSERT INTO opportunity_revisions (opportunity_uid, revision_number, changed_by, changed_at, changed_fields, full_snapshot)
              VALUES ($1, $2, $3, NOW(), $4, $5)
              ON CONFLICT (opportunity_uid, revision_number) DO NOTHING`;
          await client.query(insertOldSql, [
              uid,
              oldRevNumber,
              changed_by,
              JSON.stringify({}), // No field changes for historical record
              JSON.stringify(prevSnapshot)
          ]);
      }

      // COMMIT the transaction
      await client.query('COMMIT');
      
      // Check for assignment changes and create notifications
      try {
        const notificationService = new NotificationService(pool);
        const assignmentFields = ['pic', 'bom', 'account_mgr'];
        
        for (const field of assignmentFields) {
          const oldValue = currentOpp[field];
          const newValue = updatedOpp[field];
          
          // Check if assignment changed and new value is not empty
          if (oldValue !== newValue && newValue && newValue.trim() !== '') {
            // Find user by name (assuming the field contains user names)
            const userQuery = 'SELECT id FROM users WHERE name ILIKE ? OR email ILIKE ? LIMIT 1';
            const userResult = await db.query(userQuery, [newValue.trim(), newValue.trim()]);
            
            if (userResult.rows.length > 0) {
              const assignedUserId = userResult.rows[0].id;
              const projectName = updatedOpp.project_name || 'Unknown Project';
              
              // Don't notify if user assigns themselves
              if (assignedUserId !== req.user?.id) {
                // Create assignment notification
                await notificationService.notifyAssignment({
                  opportunity_uid: uid,
                  assigned_user_id: assignedUserId,
                  assignment_type: field === 'account_mgr' ? 'account_mgr' : field,
                  project_name: projectName,
                  assigned_by_id: req.user?.id || null
                });
                
                console.log(`[NOTIFICATION] Created ${field} assignment notification for user ${assignedUserId} on project ${projectName}`);
              } else {
                console.log(`[NOTIFICATION] Skipped self-assignment notification for ${field} on project ${projectName}`);
              }
            }
          }
        }
      } catch (notificationError) {
        // Don't fail the update if notification creation fails
        console.error('Error creating assignment notifications:', notificationError);
      }
      
      // Return success response with updated data
      res.json({
          success: true,
          message: 'Opportunity updated successfully',
          data: updatedOpp,
          revisionNumber: newRevNumber,
          changedFields: actualChangedFields
      });

    } catch (error) {
      // ROLLBACK on any error
      await client.query('ROLLBACK');
      console.error(`[PUT /api/opportunities/${uid}] Error:`, error);
      res.status(500).json({ 
          error: 'Failed to update opportunity',
          message: error.message,
          details: error.stack
      });
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  }
);

// GET Revision History for an opportunity (authenticated)
app.get('/api/opportunities/:uid/revisions', authenticateToken, async (req, res) => {
    const { uid } = req.params;
    
    try {
        console.log(`[GET /api/opportunities/${uid}/revisions] Fetching revision history...`);
        
        const result = await db.query(
            'SELECT * FROM opportunity_revisions WHERE opportunity_uid = ? ORDER BY revision_number DESC, changed_at DESC',
            [uid]
        );
        
        console.log(`[GET /api/opportunities/${uid}/revisions] Found ${result.rows.length} revisions`);
        
        // Debug: Log the changed_fields for each revision
        result.rows.forEach((row, index) => {
            console.log(`[REVISION DEBUG ${index + 1}] revision_number: ${row.revision_number}`);
            console.log(`[REVISION DEBUG ${index + 1}] changed_fields (raw): ${row.changed_fields}`);
            console.log(`[REVISION DEBUG ${index + 1}] changed_fields type: ${typeof row.changed_fields}`);
            
            if (row.changed_fields) {
                try {
                    const parsed = JSON.parse(row.changed_fields);
                    console.log(`[REVISION DEBUG ${index + 1}] parsed changed_fields:`, JSON.stringify(parsed, null, 2));
                    console.log(`[REVISION DEBUG ${index + 1}] parsed keys count: ${Object.keys(parsed).length}`);
                } catch (e) {
                    console.log(`[REVISION DEBUG ${index + 1}] failed to parse changed_fields: ${e.message}`);
                }
            }
        });
        
        res.json(result.rows);
    } catch (error) {
        console.error(`[GET /api/opportunities/${uid}/revisions] Error fetching revision history:`, error);
        res.status(500).json({ error: 'Failed to fetch revision history.' });
    }
});

// --- Static File Serving & Server Start ---
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });
app.get('/dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'dashboard.html')); }); // Keep old dashboard route if needed
app.get('/win-loss_dashboard.html', (req, res) => { res.sendFile(path.join(__dirname, 'win-loss_dashboard.html')); });
// *** UPDATED: Route for the new forecast dashboard page (matching case) ***
app.get('/forecast_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'forecast_dashboard.html'));
});

// Route for the Proposal Engineer's Workbench page
app.get('/proposal_workbench.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'proposal_workbench.html'));
});
app.get('/forecastr_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'forecastr_dashboard.html'));
});
app.get('/update_password.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'update_password.html'));
});

// --- User Management API (PostgreSQL-backed, schema-aligned) ---

// GET all users
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT u.id, u.email, u.name, u.is_verified, u.roles, u.account_type, u.last_login_at, u.account_manager_id, am.name AS account_manager_name, u.pic_id, p.name AS pic_name FROM users u LEFT JOIN account_managers am ON am.id = u.account_manager_id LEFT JOIN pics p ON p.id = u.pic_id ORDER BY u.email ASC'
    );
    const users = (result.rows || []).map(u => ({
      _id: u.id,
      id: u.id,
      username: u.name,
      name: u.name,
      email: u.email,
      roles: typeof u.roles === 'string' ? JSON.parse(u.roles) : (Array.isArray(u.roles) ? u.roles : []),
      accountType: u.account_type || 'User',
      is_verified: u.is_verified,
      lastLoginAt: u.last_login_at,
      accountManagerId: u.account_manager_id,
      accountManagerName: u.account_manager_name,
      picId: u.pic_id,
      picName: u.pic_name
    }));
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// GET a single user by ID
app.get('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT u.id, u.email, u.name, u.is_verified, u.roles, u.account_type, u.account_manager_id, am.name AS account_manager_name, u.pic_id, p.name AS pic_name FROM users u LEFT JOIN account_managers am ON am.id = u.account_manager_id LEFT JOIN pics p ON p.id = u.pic_id WHERE u.id = ?',
      [req.params.id]
    );
    if (!result.rows || result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      _id: u.id,
      id: u.id,
      username: u.name,
      name: u.name,
      email: u.email,
      roles: Array.isArray(u.roles) ? u.roles : [],
      accountType: u.account_type || 'User',
      is_verified: u.is_verified,
      accountManagerId: u.account_manager_id,
      accountManagerName: u.account_manager_name,
      picId: u.pic_id,
      picName: u.pic_name
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// POST (create) a new user
app.post('/api/users', authenticateToken, requireAdmin,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8, max: 100 }).withMessage('Password must be 8-100 characters'), // Required for new users
    body('roles').isArray({ min: 1 }).withMessage('At least one role is required'),
    body('roles.*').isString().trim().escape().withMessage('Role must be a valid string'),
    body('accountType').optional().isIn(['Admin', 'User', 'System Admin']).withMessage('Account type must be Admin, User, or System Admin'),
    body('accountManagerId').optional({ checkFalsy: true }).isInt().toInt(),
    body('picId').optional({ checkFalsy: true }).isInt().toInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }
    try {
      const { username, name, email, password, roles, accountType, accountManagerId, picId } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }
      // Check for duplicate email
      const check = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (check.rows.length > 0) {
        return res.status(409).json({ message: 'Email already registered.' });
      }
      const password_hash = await bcrypt.hash(password, 10);
      const id = uuidv4();
      const finalName = name || username || null;
      await db.query(
        'INSERT INTO users (id, email, password_hash, name, is_verified, roles, account_type, account_manager_id, pic_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, email, password_hash, finalName, true, Array.isArray(roles) ? roles : (roles ? [roles] : []), accountType || 'User', accountManagerId || null, picId || null]
      );
      res.status(201).json({
        _id: id,
        id: id,
        username: finalName,
        name: finalName,
        email,
        roles: Array.isArray(roles) ? roles : (roles ? [roles] : []),
        accountType: accountType || 'User',
        accountManagerId: accountManagerId || null,
        picId: picId || null,
        is_verified: true
      });
    } catch (err) {
      console.error('Error creating user:', err);
      res.status(500).json({ error: 'Failed to create user.' });
    }
  }
);

// PUT (update) an existing user
app.put('/api/users/:id', authenticateToken, requireAdmin,
  [
    body('email').isEmail(),
    body('password').optional().isLength({ min: 8, max: 100 }),
    body('roles').isArray({ min: 1 }),
    body('roles.*').isString().trim().escape(),
    body('accountType').optional().isIn(['Admin', 'User', 'System Admin']),
    body('accountManagerId').optional({ checkFalsy: true }).isInt().toInt(),
    body('picId').optional({ checkFalsy: true }).isInt().toInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }
    try {
      const { username, name, email, password, roles, accountType, accountManagerId, picId } = req.body;
      const id = req.params.id;
      const finalName = name || username || null;
      let updateSql = 'UPDATE users SET name=?, email=?, roles=?, account_type=?, account_manager_id=?, pic_id=?';
      let params = [finalName, email, Array.isArray(roles) ? roles : (roles ? [roles] : []), accountType || 'User', accountManagerId || null, picId || null, id];
      if (password) {
        const password_hash = await bcrypt.hash(password, 10);
        updateSql = 'UPDATE users SET name=?, email=?, password_hash=?, roles=?, account_type=?, account_manager_id=?, pic_id=? WHERE id=?';
        params = [finalName, email, password_hash, Array.isArray(roles) ? roles : (roles ? [roles] : []), accountType || 'User', accountManagerId || null, picId || null, id];
      } else {
        updateSql += ' WHERE id=?';
      }
      const result = await db.query(updateSql, params);
      if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
      res.json({
        _id: id,
        id: id,
        username: finalName,
        name: finalName,
        email,
        roles: Array.isArray(roles) ? roles : (roles ? [roles] : []),
        accountType: accountType || 'User',
        accountManagerId: accountManagerId || null,
        picId: picId || null
      });
    } catch (err) {
      console.error('Error updating user:', err);
      res.status(500).json({ error: 'Failed to update user.' });
    }
  }
);

// DELETE a user
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// --- Account Managers API (master list; tag users to one when they have an account) ---
app.get('/api/account-managers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, is_active, created_at, updated_at FROM account_managers ORDER BY name ASC'
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Error fetching account managers:', err);
    res.json([]);
  }
});

app.post('/api/account-managers', authenticateToken, requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional({ checkFalsy: true }).trim().isEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    const { name, email } = req.body;
    const doInsert = async () => {
      const result = await db.query(
        'INSERT INTO account_managers (name, email, is_active) VALUES (?, ?, 1) RETURNING id',
        [name, email || null]
      );
      return (result.rows && result.rows[0] && result.rows[0].id) || result.lastID;
    };
    try {
      let id = await doInsert();
      if (id == null || id === undefined) return res.status(500).json({ error: 'Failed to create account manager.' });
      res.status(201).json({ id, name, email: email || null, is_active: 1 });
    } catch (err) {
      try {
        await ensureAccountManagerAndPicTables();
        const id = await doInsert();
        if (id != null && id !== undefined) {
          return res.status(201).json({ id, name, email: email || null, is_active: 1 });
        }
      } catch (retryErr) {
        console.error('Error creating account manager (after migration):', retryErr);
      }
      console.error('Error creating account manager:', err);
      res.status(500).json({ error: 'Failed to create account manager.', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
    }
  }
);

app.put('/api/account-managers/:id', authenticateToken, requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional({ checkFalsy: true }).trim().isEmail(),
    body('is_active').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    try {
      const id = req.params.id;
      const { name, email, is_active } = req.body;
      await db.query(
        'UPDATE account_managers SET name = ?, email = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, email || null, is_active !== false ? 1 : 0, id]
      );
      res.json({ id: parseInt(id, 10), name, email: email || null, is_active: is_active !== false ? 1 : 0 });
    } catch (err) {
      console.error('Error updating account manager:', err);
      res.status(500).json({ error: 'Failed to update account manager.' });
    }
  }
);

app.delete('/api/account-managers/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await db.query('UPDATE users SET account_manager_id = NULL WHERE account_manager_id = ?', [id]);
    const result = await db.query('DELETE FROM account_managers WHERE id = ?', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Account manager not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting account manager:', err);
    res.status(500).json({ error: 'Failed to delete account manager.' });
  }
});

// --- PIC (Person in Charge) API ---
app.get('/api/pics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, is_active, created_at, updated_at FROM pics ORDER BY name ASC'
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Error fetching pics:', err);
    res.json([]);
  }
});

app.post('/api/pics', authenticateToken, requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional({ checkFalsy: true }).trim().isEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    const { name, email } = req.body;
    const doInsert = async () => {
      const result = await db.query(
        'INSERT INTO pics (name, email, is_active) VALUES (?, ?, 1) RETURNING id',
        [name, email || null]
      );
      return (result.rows && result.rows[0] && result.rows[0].id) || result.lastID;
    };
    try {
      let id = await doInsert();
      if (id == null || id === undefined) return res.status(500).json({ error: 'Failed to create PIC.' });
      res.status(201).json({ id, name, email: email || null, is_active: 1 });
    } catch (err) {
      const isNoTable = (err.message || '').includes('no such table') || (err.message || '').includes('does not exist');
      if (isNoTable) {
        try {
          await ensureAccountManagerAndPicTables();
          const id = await doInsert();
          if (id != null && id !== undefined) {
            return res.status(201).json({ id, name, email: email || null, is_active: 1 });
          }
        } catch (retryErr) {
          console.error('Error creating PIC (after migration):', retryErr);
        }
      }
      console.error('Error creating PIC:', err);
      res.status(500).json({ error: 'Failed to create PIC.' });
    }
  }
);

app.put('/api/pics/:id', authenticateToken, requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').optional({ checkFalsy: true }).trim().isEmail(),
    body('is_active').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    try {
      const id = req.params.id;
      const { name, email, is_active } = req.body;
      await db.query(
        'UPDATE pics SET name = ?, email = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, email || null, is_active !== false ? 1 : 0, id]
      );
      res.json({ id: parseInt(id, 10), name, email: email || null, is_active: is_active !== false ? 1 : 0 });
    } catch (err) {
      console.error('Error updating PIC:', err);
      res.status(500).json({ error: 'Failed to update PIC.' });
    }
  }
);

app.delete('/api/pics/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await db.query('UPDATE users SET pic_id = NULL WHERE pic_id = ?', [id]);
    const result = await db.query('DELETE FROM pics WHERE id = ?', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'PIC not found' });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting PIC:', err);
    res.status(500).json({ error: 'Failed to delete PIC.' });
  }
});

// --- User Mentions API (Public) ---
// GET users for mention system (non-admin endpoint)
app.get('/api/users/mentions', authenticateToken, async (req, res) => {
  try {
    // Get only basic user info needed for mentions (name, email)
    // No admin privileges required since this is just for mention autocomplete
    const result = await db.query('SELECT id, name, email FROM users ORDER BY name ASC');
    const users = result.rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      displayName: u.name,
      searchText: `${u.name} ${u.email}`.toLowerCase()
    }));
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users for mentions:', error);
    res.status(500).json({ error: 'Failed to fetch users for mentions.' });
  }
});

// --- User Column Preferences API ---

// GET user's column preferences for a specific page
app.get('/api/user-column-preferences/:pageName', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pageName = req.params.pageName;
    
    const result = await db.query(
      'SELECT column_settings FROM user_column_preferences WHERE user_id = ? AND page_name = ?',
      [userId, pageName]
    );
    
    if (result.rows.length === 0) {
      // No preferences found, return null to indicate defaults should be used
      return res.json({ columnSettings: null });
    }
    
    res.json({ columnSettings: result.rows[0].column_settings });
  } catch (err) {
    console.error('Error fetching user column preferences:', err);
    res.status(500).json({ error: 'Failed to fetch column preferences.' });
  }
});

// POST/PUT user's column preferences for a specific page
app.post('/api/user-column-preferences/:pageName', authenticateToken, [
  body('columnSettings').isObject().withMessage('Column settings must be an object')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Invalid input', details: errors.array() });
  }
  
  try {
    const userId = req.user.id;
    const pageName = req.params.pageName;
    const { columnSettings } = req.body;
    
    // Upsert operation - update if exists, insert if not
    const result = await db.query(
      db.convertSQL(`
      INSERT INTO user_column_preferences (user_id, page_name, column_settings, updated_at)
      VALUES (?, ?, ?, NOW())
      ON CONFLICT (user_id, page_name)
      DO UPDATE SET
        column_settings = EXCLUDED.column_settings,
        updated_at = NOW()
      RETURNING id
    `), [userId, pageName, JSON.stringify(columnSettings)]);
    
    res.json({ 
      success: true, 
      message: 'Column preferences saved successfully',
      id: result.rows[0].id 
    });
  } catch (err) {
    console.error('Error saving user column preferences:', err);
    res.status(500).json({ error: 'Failed to save column preferences.' });
  }
});

// DELETE user's column preferences for a specific page (reset to defaults)
app.delete('/api/user-column-preferences/:pageName', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pageName = req.params.pageName;
    
    const result = await db.query(
      'DELETE FROM user_column_preferences WHERE user_id = ? AND page_name = ?',
      [userId, pageName]
    );
    
    res.json({ 
      success: true, 
      message: 'Column preferences reset to defaults',
      deletedRows: result.rowCount 
    });
  } catch (err) {
    console.error('Error deleting user column preferences:', err);
    res.status(500).json({ error: 'Failed to reset column preferences.' });
  }
});

// --- Audit endpoint for unauthorized user-management page access ---
app.post('/api/audit-log-page-access', authenticateToken, requireAdmin, (req, res) => {
  const now = new Date().toISOString();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const user = req.user ? `${req.user.email} (${req.user.id})` : 'unknown';
  const page = req.body && req.body.page ? req.body.page : 'unknown';
  const logMsg = `[${now}] Admin page access by: ${user} (IP: ${ip}, UA: ${ua}) Page: ${page}`;
  try {
    fs.appendFileSync(path.join(__dirname, 'audit.log'), logMsg + '\n');
  } catch (err) {
    console.error('Failed to write to audit.log:', err);
  }
  res.json({ success: true });
});

// --- Opps Monitoring Import/Export API ---
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
// const fs = require('fs'); // Duplicate import removed
const csv = require('fast-csv');
const XLSX = require('xlsx');

// Export opps_monitoring as CSV (import-template ready)
app.get('/api/opps-monitoring/export', async (req, res) => {
  try {
    // Get all columns in correct order for import template
    const columns = [
      'encoded_date','project_name','project_code','rev','client','solutions','sol_particulars','industries','ind_particulars','date_received','client_deadline','decision','account_mgr','pic','bom','status','submitted_date','margin','final_amt','opp_status','date_awarded_lost','lost_rca','l_particulars','a','c','r','u','d','remarks_comments','uid','forecast_date','revision'
    ];
    const result = await db.query('SELECT ' + columns.map(c => `"${c}"`).join(', ') + ' FROM opps_monitoring ORDER BY encoded_date ASC');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="opps_monitoring_import_template.csv"');
    csv.write([columns, ...result.rows.map(row => columns.map(c => row[c]))], { headers: false }).pipe(res);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).send('Failed to export opps_monitoring');
  }
});

// Import opps_monitoring from CSV (upsert/merge, preserve forecast values)
app.post('/api/opps-monitoring/import', upload.single('csvFile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
  const fileRows = [];
  const columns = [
    'encoded_date','project_name','project_code','rev','client','solutions','sol_particulars','industries','ind_particulars','date_received','client_deadline','decision','account_mgr','pic','bom','status','submitted_date','margin','final_amt','opp_status','date_awarded_lost','lost_rca','l_particulars','a','c','r','u','d','remarks_comments','uid','forecast_date','revision'
  ];
  fs.createReadStream(req.file.path)
    .pipe(csv.parse({ headers: columns, ignoreEmpty: true, trim: true }))
    .on('error', error => {
      console.error('CSV parse error:', error);
      res.status(400).json({ success: false, error: 'CSV parse error' });
    })
    .on('data', row => fileRows.push(row))
    .on('end', async () => {
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          for (const row of fileRows) {
            // Upsert: update all fields except forecast_date if uid exists, else insert
            const uid = row.uid;
            if (!uid) continue;
            // Remove empty strings/nulls for optional fields
            Object.keys(row).forEach(k => { if (row[k] === '') row[k] = null; });
            // Do not overwrite forecast_date if already present in DB
            const existing = await client.query('SELECT forecast_date FROM opps_monitoring WHERE uid = $1', [uid]);
            if (existing.rows.length > 0 && existing.rows[0].forecast_date) {
              row.forecast_date = existing.rows[0].forecast_date;
            }
            // Upsert
            const updateCols = columns.filter(c => c !== 'uid');
            const setClause = updateCols.map((c, i) => `"${c}" = $${i+2}`).join(', ');
            const values = updateCols.map(c => row[c]);
            values.unshift(uid); // $1 = uid
            const updateRes = await client.query(`UPDATE opps_monitoring SET ${setClause} WHERE uid = $1`, values);
            if (updateRes.rowCount === 0) {
              // Insert if not exists
              const insertCols = columns;
              const insertVals = insertCols.map((c, i) => `$${i+1}`);
              await client.query(`INSERT INTO opps_monitoring (${insertCols.map(c => `"${c}"`).join(', ')}) VALUES (${insertVals.join(', ')})`, insertCols.map(c => row[c]));
            }
          }
          await client.query('COMMIT');
          res.json({ success: true });
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('Import error:', err);
          res.status(500).json({ success: false, error: 'DB import error' });
        } finally {
          client.release();
          fs.unlink(req.file.path, () => {}); // Clean up temp file
        }
      } catch (err) {
        console.error('DB connect error:', err);
        res.status(500).json({ success: false, error: 'DB connect error' });
      }
    });
});

// Excel bulk update for revision_number, final_amount, margin
app.post('/api/opportunities/bulk-update-excel', authenticateToken, upload.single('excelFile'), async (req, res) => {
  console.log(`[POST /api/opportunities/bulk-update-excel] === START ===`);
  
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No Excel file uploaded' });
  }

  const password = req.body.password || '0601CMRP!'; // Default CMRP password
  const proposalCode = req.body.proposalCode || null; // Optional proposal code from filename
  const expectedRevision = req.body.expectedRevision || null; // Optional revision from filename
  const updatedRecords = [];
  const errors = [];
  let workbook;

  try {
    // Read Excel file with optional password
    const fileBuffer = fs.readFileSync(req.file.path);
    const readOptions = { type: 'buffer' };
    if (password) {
      readOptions.password = password;
    }
    
    workbook = XLSX.read(fileBuffer, readOptions);
    console.log(`📊 Excel workbook loaded. Sheets: ${workbook.SheetNames.join(', ')}`);
    
  } catch (err) {
    console.error('Excel file read error:', err);
    fs.unlink(req.file.path, () => {}); // Clean up temp file
    return res.status(400).json({ 
      success: false, 
      error: 'Failed to read Excel file. Check password if file is encrypted.',
      details: err.message 
    });
  }

  try {
    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      throw new Error('Excel file must have at least 2 rows (header + data)');
    }

    // Parse headers (case-insensitive matching)
    const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
    
    // Find column indices
    const getColumnIndex = (possibleNames) => {
      for (const name of possibleNames) {
        const index = headers.findIndex(h => h.includes(name.toLowerCase()));
        if (index !== -1) return index;
      }
      return -1;
    };

    const uidIndex = getColumnIndex(['uid', 'opportunity id', 'id']);
    const proposalCodeIndex = getColumnIndex(['proposal code', 'project code', 'code']);
    const revisionIndex = getColumnIndex(['revision number', 'revision_number', 'revision', 'rev']);
    const amountIndex = getColumnIndex(['final amount', 'final_amount', 'amount']);
    const marginIndex = getColumnIndex(['margin', 'margin %', 'margin percent']);

    // For CMRP calcsheets, we can work with just proposal code if no UID column
    const canMatchByProposalCode = proposalCode && proposalCodeIndex !== -1;
    const canMatchByUID = uidIndex !== -1;
    
    if (!canMatchByUID && !canMatchByProposalCode) {
      throw new Error('Required column not found: UID/Opportunity ID or Proposal Code. For CMRP calcsheets, ensure there is a Proposal Code column.');
    }

    console.log(`📋 Column mapping - UID: ${uidIndex}, Proposal Code: ${proposalCodeIndex}, Revision: ${revisionIndex}, Amount: ${amountIndex}, Margin: ${marginIndex}`);
    console.log(`📋 Matching strategy: ${canMatchByUID ? 'UID' : 'Proposal Code'} (CMRP format: ${!!proposalCode})`);

    // Process data rows
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        let uid = null;
        let lookupValue = null;
        let existingOpp;

        // Determine lookup strategy
        if (canMatchByUID) {
          uid = row[uidIndex]?.toString().trim();
          lookupValue = uid;
          
          if (!uid) {
            errors.push(`Row ${i + 1}: Missing UID`);
            continue;
          }
          
          // Look up by UID
          existingOpp = await client.query('SELECT uid, project_code, rev, final_amt, margin FROM opps_monitoring WHERE uid = $1', [uid]);
          
        } else if (canMatchByProposalCode) {
          // For CMRP calcsheets: use filename proposal code or fallback to row data
          const rowProposalCode = row[proposalCodeIndex]?.toString().trim();
          lookupValue = proposalCode || rowProposalCode; // Use filename code or row data
          
          if (!lookupValue) {
            errors.push(`Row ${i + 1}: Missing Proposal Code`);
            continue;
          }
          
          // Look up by project_code
          existingOpp = await client.query('SELECT uid, project_code, rev, final_amt, margin FROM opps_monitoring WHERE project_code = $1', [lookupValue]);
          
          if (existingOpp.rows.length > 0) {
            uid = existingOpp.rows[0].uid; // Get the actual UID for updates
          }
        }

        if (!existingOpp || existingOpp.rows.length === 0) {
          const lookupType = canMatchByUID ? 'UID' : 'Proposal Code';
          errors.push(`Row ${i + 1}: Opportunity not found for ${lookupType}: ${lookupValue}`);
          continue;
        }

        // Log successful match
        console.log(`✅ Row ${i + 1}: Found opportunity ${uid} (${lookupValue})`);

        // Prepare update data
        const updateData = {};
        const updateFields = [];
        const updateValues = [uid]; // $1 for WHERE clause
        let paramIndex = 2;

        // Process revision number
        if (revisionIndex !== -1 && row[revisionIndex] !== undefined && row[revisionIndex] !== '') {
          const revisionValue = parseInt(row[revisionIndex]);
          if (!isNaN(revisionValue)) {
            updateData.rev = revisionValue;
            updateFields.push(`rev = $${paramIndex}`);
            updateValues.push(revisionValue);
            paramIndex++;
          }
        }

        // Process final amount (remove currency symbols and commas)
        if (amountIndex !== -1 && row[amountIndex] !== undefined && row[amountIndex] !== '') {
          let amountStr = row[amountIndex].toString().replace(/[₱$,\s]/g, '');
          const amountValue = parseFloat(amountStr);
          if (!isNaN(amountValue)) {
            updateData.final_amt = amountValue;
            updateFields.push(`final_amt = $${paramIndex}`);
            updateValues.push(amountValue);
            paramIndex++;
          }
        }

        // Process margin (remove % symbol)
        if (marginIndex !== -1 && row[marginIndex] !== undefined && row[marginIndex] !== '') {
          let marginStr = row[marginIndex].toString().replace(/[%\s]/g, '');
          const marginValue = parseFloat(marginStr);
          if (!isNaN(marginValue)) {
            updateData.margin = marginValue;
            updateFields.push(`margin = $${paramIndex}`);
            updateValues.push(marginValue);
            paramIndex++;
          }
        }

        // Update if we have any fields to update
        if (updateFields.length > 0) {
          const updateQuery = `UPDATE opps_monitoring SET ${updateFields.join(', ')} WHERE uid = $1`;
          await client.query(updateQuery, updateValues);
          
          updatedRecords.push({
            uid,
            row: i + 1,
            changes: updateData,
            previousValues: {
              rev: existingOpp.rows[0].rev,
              final_amt: existingOpp.rows[0].final_amt,
              margin: existingOpp.rows[0].margin
            }
          });
          
          console.log(`✅ Updated opportunity ${uid}:`, updateData);
        } else {
          errors.push(`Row ${i + 1}: No valid data to update for ${uid}`);
        }
      }

      await client.query('COMMIT');
      console.log(`🎉 Excel bulk update completed. Updated: ${updatedRecords.length}, Errors: ${errors.length}`);

    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    // Return results
    res.json({
      success: true,
      updated: updatedRecords.length,
      errors: errors.length,
      results: {
        updatedRecords,
        errors
      }
    });

  } catch (err) {
    console.error('Excel processing error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to process Excel file',
      details: err.message
    });
  } finally {
    // Clean up temp file
    fs.unlink(req.file.path, (unlinkErr) => {
      if (unlinkErr) console.error('Failed to delete temp file:', unlinkErr);
    });
  }
});

// === GOOGLE CALENDAR OAUTH ENDPOINTS ===
const calendarService = new GoogleCalendarOAuthService();
const calendarServiceInitialized = calendarService.initialize();

// Start OAuth flow for Google Calendar
app.get('/auth/google/calendar', authenticateToken, (req, res) => {
  try {
    console.log(`[OAUTH] Starting calendar authorization for user: ${req.user.username}`);
    
    if (!calendarServiceInitialized) {
      return res.status(503).json({
        error: 'Google Calendar service not configured',
        message: 'Google OAuth credentials not set up. Please configure GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in environment variables.',
        setupRequired: true
      });
    }
    
    // Include user ID in state for callback processing
    const state = JSON.stringify({ 
      userId: req.user.id, 
      username: req.user.username || req.user.name || req.user.email
    });
    
    const authUrl = calendarService.generateAuthUrl(state);
    
    res.json({
      success: true,
      authUrl: authUrl,
      message: 'Redirect user to this URL to authorize calendar access'
    });

  } catch (error) {
    console.error('[OAUTH] Failed to generate auth URL:', error.message);
    res.status(500).json({
      error: 'Failed to start OAuth flow',
      message: error.message,
      setupRequired: !calendarServiceInitialized
    });
  }
});

// Handle OAuth callback from Google
app.get('/auth/google/calendar/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('[OAUTH] Authorization denied:', error);
      return res.redirect('/?calendar_auth=denied');
    }

    if (!code) {
      console.error('[OAUTH] No authorization code received');
      return res.redirect('/?calendar_auth=error');
    }

    // Parse state to get user info
    let userInfo;
    try {
      userInfo = JSON.parse(state);
    } catch (parseError) {
      console.error('[OAUTH] Invalid state parameter:', parseError.message);
      return res.redirect('/?calendar_auth=error');
    }

    console.log(`[OAUTH] Processing callback for user: ${userInfo.username}`);

    // Handle the OAuth callback with extra error protection
    let result;
    try {
      result = await calendarService.handleOAuthCallback(
        code, 
        userInfo.userId, 
        userInfo.username
      );
    } catch (callbackError) {
      console.error('[OAUTH] OAuth callback threw error:', callbackError.message);
      return res.redirect('/?calendar_auth=error');
    }

    if (result && result.success) {
      console.log(`[OAUTH] Successfully connected calendar for: ${userInfo.username}`);
      res.redirect('/?calendar_auth=success&email=' + encodeURIComponent(result.googleEmail));
    } else {
      console.error('[OAUTH] Failed to connect calendar:', result?.error || 'Unknown error');
      res.redirect('/?calendar_auth=error');
    }

  } catch (error) {
    console.error('[OAUTH] OAuth callback failed:', error.message);
    res.redirect('/?calendar_auth=error');
  }
});

// Get user's calendar connection status
app.get('/api/calendar/status', authenticateToken, async (req, res) => {
  try {
    console.log(`[API] Getting calendar status for user: ${req.user.username}`);
    
    if (!calendarServiceInitialized) {
      return res.json({
        success: true,
        connected: false,
        message: 'Google Calendar service not configured',
        setupRequired: true
      });
    }
    
    const status = await calendarService.getUserCalendarStatus(req.user.id);
    
    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('[API] Failed to get calendar status:', error.message);
    res.status(500).json({
      error: 'Failed to get calendar status',
      message: error.message
    });
  }
});

// Manually trigger calendar sync for current user
app.post('/api/calendar/sync', authenticateToken, async (req, res) => {
  try {
    const { timeMin, timeMax } = req.body;
    
    console.log(`[API] Manual calendar sync requested by user: ${req.user.username}`);
    
    const syncResults = await calendarService.syncUserCalendarEvents(
      req.user.id, 
      timeMin, 
      timeMax
    );
    
    res.json({
      success: true,
      message: 'Calendar sync completed',
      results: syncResults
    });

  } catch (error) {
    console.error('[API] Calendar sync failed:', error.message);
    res.status(500).json({
      error: 'Calendar sync failed',
      message: error.message
    });
  }
});

// Disconnect user's calendar
app.delete('/api/calendar/connection', authenticateToken, async (req, res) => {
  try {
    console.log(`[API] Disconnecting calendar for user: ${req.user.username}`);
    
    const result = await calendarService.disconnectUserCalendar(req.user.id);
    
    res.json({
      success: true,
      message: 'Calendar disconnected successfully'
    });

  } catch (error) {
    console.error('[API] Failed to disconnect calendar:', error.message);
    res.status(500).json({
      error: 'Failed to disconnect calendar',
      message: error.message
    });
  }
});

// Get weekly schedule including calendar events
app.get('/api/schedule/combined', authenticateToken, async (req, res) => {
  try {
    const { week_start } = req.query;
    
    if (!week_start) {
      return res.status(400).json({
        error: 'week_start parameter is required',
        message: 'Provide week_start in YYYY-MM-DD format'
      });
    }

    console.log(`[API] Getting combined schedule for week: ${week_start}, user: ${req.user.username}`);
    
    const scheduleData = await calendarService.getWeeklyScheduleWithCalendar(
      week_start, 
      req.user.id
    );
    
    res.json({
      success: true,
      ...scheduleData
    });

  } catch (error) {
    console.error('[API] Failed to get combined schedule:', error.message);
    res.status(500).json({
      error: 'Failed to get combined schedule',
      message: error.message
    });
  }
});

// Admin endpoint: Bulk sync all users (optional)
app.post('/api/admin/calendar/bulk-sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log(`[ADMIN] Bulk calendar sync initiated by: ${req.user.username}`);
    
    const syncResults = await calendarService.bulkSyncAllUsers();
    
    res.json({
      success: true,
      message: 'Bulk calendar sync completed',
      results: syncResults
    });

  } catch (error) {
    console.error('[ADMIN] Bulk calendar sync failed:', error.message);
    res.status(500).json({
      error: 'Bulk calendar sync failed',
      message: error.message
    });
  }
});

// === END GOOGLE CALENDAR OAUTH ENDPOINTS ===

// --- PRODUCTION MIGRATION ENDPOINT ---
app.post('/api/admin/run-last-excel-sync-migration', authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to run migrations
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only admin users can run migrations'
      });
    }

    console.log(`[MIGRATION] Starting last_excel_sync column migration by ${req.user.username}`);
    
    const client = await pool.connect();
    
    try {
      // Check if column already exists
      const columnCheck = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'opps_monitoring' 
        AND column_name = 'last_excel_sync'
      `);

      if (columnCheck.rows.length > 0) {
        console.log('[MIGRATION] Column last_excel_sync already exists');
        return res.json({
          success: true,
          message: 'Column last_excel_sync already exists. No migration needed.',
          columnDetails: columnCheck.rows[0]
        });
      }

      // Add the missing column
      await client.query(`
        ALTER TABLE opps_monitoring 
        ADD COLUMN last_excel_sync TIMESTAMP
      `);
      
      // Create index for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_opps_monitoring_last_excel_sync 
        ON opps_monitoring(last_excel_sync)
      `);
      
      // Add documentation comment
      await client.query(`
        COMMENT ON COLUMN opps_monitoring.last_excel_sync 
        IS 'Timestamp of last sync from Excel/Google Drive file'
      `);

      // Verify the migration was successful
      const verifyResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'opps_monitoring' 
        AND column_name = 'last_excel_sync'
      `);

      if (verifyResult.rows.length === 0) {
        throw new Error('Migration verification failed - column was not created');
      }

      console.log('[MIGRATION] last_excel_sync column migration completed successfully');
      
      res.json({
        success: true,
        message: 'Migration completed successfully! The last_excel_sync column has been added to opps_monitoring table.',
        columnDetails: verifyResult.rows[0]
      });

    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error);
    res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
});

// --- EMERGENCY MIGRATION ENDPOINT (NO AUTH) ---
app.post('/api/emergency/run-last-excel-sync-migration', async (req, res) => {
  try {
    // Emergency endpoint for critical fixes - requires specific key
    const { emergencyKey } = req.body;
    
    if (emergencyKey !== 'CMRP_EMERGENCY_MIGRATION_2025') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Invalid emergency key'
      });
    }

    console.log(`[EMERGENCY_MIGRATION] Starting last_excel_sync column migration via emergency endpoint`);
    
    const client = await pool.connect();
    
    try {
      // Check if column already exists
      const columnCheck = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'opps_monitoring' 
        AND column_name = 'last_excel_sync'
      `);

      if (columnCheck.rows.length > 0) {
        console.log('[EMERGENCY_MIGRATION] Column last_excel_sync already exists');
        return res.json({
          success: true,
          message: 'Column last_excel_sync already exists. No migration needed.',
          columnDetails: columnCheck.rows[0]
        });
      }

      // Add the missing column
      await client.query(`
        ALTER TABLE opps_monitoring 
        ADD COLUMN last_excel_sync TIMESTAMP
      `);
      
      // Create index for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_opps_monitoring_last_excel_sync 
        ON opps_monitoring(last_excel_sync)
      `);
      
      // Add documentation comment
      await client.query(`
        COMMENT ON COLUMN opps_monitoring.last_excel_sync 
        IS 'Timestamp of last sync from Excel/Google Drive file'
      `);

      // Verify the migration was successful
      const verifyResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'opps_monitoring' 
        AND column_name = 'last_excel_sync'
      `);

      if (verifyResult.rows.length === 0) {
        throw new Error('Migration verification failed - column was not created');
      }

      console.log('[EMERGENCY_MIGRATION] last_excel_sync column migration completed successfully');
      
      res.json({
        success: true,
        message: 'EMERGENCY Migration completed successfully! The last_excel_sync column has been added to opps_monitoring table.',
        columnDetails: verifyResult.rows[0]
      });

    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[EMERGENCY_MIGRATION] Migration failed:', error);
    res.status(500).json({
      error: 'Emergency migration failed',
      message: error.message
    });
  }
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  const msg = err?.message ?? String(err);
  console.error('Unhandled error:', msg);
  if (err?.stack) console.error('Stack:', err.stack);
  if (req) {
    console.error('Request:', req.method, req.url || req.originalUrl);
    if (msg.includes('hasOwnProperty') && req.body !== undefined) {
      console.error('Body keys:', typeof req.body === 'object' ? Object.keys(req.body) : req.body);
    }
  }
  res.status(500).json({ error: msg || 'An unexpected error occurred.' });
});

let server;
// Graceful shutdown (server is set after async init)
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('✅ Server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// DELETE Endpoint for Opportunities
app.delete('/api/opportunities/:uid', authenticateToken, async (req, res) => {
  const { uid } = req.params;
  console.log(`[DELETE /api/opportunities/${uid}] === START ===`);

  if (!uid) {
    return res.status(400).json({ error: 'UID is required.' });
  }

  try {
    await db.transaction(async (query) => {
      // 1. Check if opportunity exists
      const checkResult = await query('SELECT uid FROM opps_monitoring WHERE uid = ?', [uid]);
      if (checkResult.rows.length === 0) {
        throw new Error('Opportunity not found.');
      }

      // 2. Delete child rows first (foreign key constraints)
      await query('DELETE FROM opportunity_revisions WHERE opportunity_uid = ?', [uid]);
      await query('DELETE FROM forecast_revisions WHERE opportunity_uid = ?', [uid]);
      await query('DELETE FROM drive_folder_audit WHERE opportunity_uid = ?', [uid]);
      await query('DELETE FROM proposal_story_entries WHERE opportunity_uid = ?', [uid]);
      await query('DELETE FROM user_notifications WHERE opportunity_uid = ?', [uid]);
      await query('DELETE FROM proposal_schedule WHERE proposal_id = ?', [uid]);
      await query('DELETE FROM proposal_status_history WHERE proposal_id = ?', [uid]);

      // 5. Delete the opportunity
      await query('DELETE FROM opps_monitoring WHERE uid = ?', [uid]);
    });

    res.json({ success: true, message: 'Opportunity deleted successfully' });

  } catch (error) {
    console.error(`[DELETE /api/opportunities/${uid}] Error:`, error);

    if (error.message === 'Opportunity not found.') {
      res.status(404).json({ error: 'Opportunity not found.' });
    } else {
      res.status(500).json({
        error: 'Failed to delete opportunity',
        message: error.message,
        details: error.stack
      });
    }
  }
});

// === PROJECT DETAIL PAGE API ENDPOINTS ===

// Get comprehensive project detail information
app.get('/api/project/:uid', authenticateToken, async (req, res) => {
  const { uid } = req.params;
  console.log(`[GET /api/project/${uid}] === START ===`);

  try {
    const client = await pool.connect();
    try {
      // Get main opportunity data with all fields
      const oppResult = await client.query(
        'SELECT * FROM opps_monitoring WHERE uid = $1',
        [uid]
      );

      if (!oppResult.rows.length) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = oppResult.rows[0];

      // Get Google Drive folder information if it exists
      let driveFolder = null;
      try {
        const driveResult = await client.query(
          'SELECT * FROM google_drive_folders WHERE opportunity_uid = $1',
          [uid]
        );
        if (driveResult.rows.length) {
          driveFolder = driveResult.rows[0];
        }
      } catch (driveError) {
        console.log(`[GET /api/project/${uid}] Drive folder lookup failed (table may not exist):`, driveError.message);
      }

      // Get revision count
      let revisionCount = 0;
      try {
        const revisionResult = await client.query(
          'SELECT COUNT(*) as count FROM opportunity_revisions WHERE opportunity_uid = $1',
          [uid]
        );
        revisionCount = parseInt(revisionResult.rows[0].count) || 0;
      } catch (revError) {
        console.log(`[GET /api/project/${uid}] Revision count failed:`, revError.message);
      }

      // Get schedule entries for this project
      let scheduleEntries = [];
      try {
        const scheduleResult = await client.query(
          'SELECT * FROM proposal_schedule WHERE proposal_id = $1 ORDER BY week_start_date DESC, day_index ASC',
          [uid]
        );
        scheduleEntries = scheduleResult.rows;
      } catch (schedError) {
        console.log(`[GET /api/project/${uid}] Schedule lookup failed:`, schedError.message);
      }

      console.log(`[GET /api/project/${uid}] Successfully retrieved project data`);
      
      res.json({
        success: true,
        project: project,
        driveFolder: driveFolder,
        revisionCount: revisionCount,
        scheduleEntries: scheduleEntries,
        hasStory: true // We'll always show story section
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error(`[GET /api/project/${uid}] Error:`, error);
    res.status(500).json({
      error: 'Failed to get project details',
      message: error.message
    });
  }
});

// Get enhanced proposal story/timeline for project
app.get('/api/project/:uid/story', authenticateToken, async (req, res) => {
  const { uid } = req.params;
  console.log(`[GET /api/project/${uid}/story] === START ===`);

  try {
    // Use the existing get_proposal_story function
    const result = await db.query(
      'SELECT get_proposal_story(?) as story_data',
      [uid]
    );

    const storyData = result.rows[0]?.story_data || [];
    
    console.log(`[GET /api/project/${uid}/story] Retrieved ${storyData.length} story entries`);
    
    res.json({
      success: true,
      story: storyData,
      count: storyData.length
    });

  } catch (error) {
    console.error(`[GET /api/project/${uid}/story] Error:`, error);
    res.status(500).json({
      error: 'Failed to get project story',
      message: error.message
    });
  }
});

// Add story entry to project timeline
app.post('/api/project/:uid/story', authenticateToken, [
  body('content').notEmpty().withMessage('Story content is required'),
  body('entry_type').optional().isIn(['comment', 'milestone', 'note', 'status_update', 'meeting', 'decision']),
  body('visibility').optional().isIn(['internal', 'client_visible', 'team_only'])
], async (req, res) => {
  const { uid } = req.params;
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Invalid input', 
      details: errors.array() 
    });
  }

  console.log(`[POST /api/project/${uid}/story] === START ===`);

  const {
    content,
    entry_type = 'comment',
    visibility = 'internal',
    metadata = {}
  } = req.body;

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify project exists
      const projectCheck = await client.query(
        'SELECT uid FROM opps_monitoring WHERE uid = $1',
        [uid]
      );

      if (!projectCheck.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Project not found' });
      }

      // Insert story entry
      const insertResult = await client.query(
        `INSERT INTO proposal_story_entries 
         (opportunity_uid, entry_type, content, visibility, created_by, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [uid, entry_type, content, visibility, req.user.name || req.user.email, metadata]
      );

      await client.query('COMMIT');
      
      console.log(`[POST /api/project/${uid}/story] Successfully added story entry`);
      
      res.json({
        success: true,
        entry: insertResult.rows[0],
        message: 'Story entry added successfully'
      });

    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error(`[POST /api/project/${uid}/story] Error:`, error);
    res.status(500).json({
      error: 'Failed to add story entry',
      message: error.message
    });
  }
});

// Get enhanced schedule data for project  
app.get('/api/project/:uid/schedule', authenticateToken, async (req, res) => {
  const { uid } = req.params;
  console.log(`[GET /api/project/${uid}/schedule] === START ===`);

  try {
    // Get project schedule entries with enhanced details
    const result = await db.query(
      `SELECT
        ps.*,
        om.project_name,
        om.client,
        om.status as project_status,
        om.forecast_date,
        om.client_deadline,
        om.submitted_date
       FROM proposal_schedule ps
       LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
       WHERE ps.proposal_id = ?
       ORDER BY ps.week_start_date DESC, ps.day_index ASC`,
      [uid]
    );

    // Get current week context
    const now = new Date();
    const currentWeekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1));
    const currentWeekStartStr = currentWeekStart.toISOString().split('T')[0];

    console.log(`[GET /api/project/${uid}/schedule] Found ${result.rows.length} schedule entries`);
    
    res.json({
      success: true,
      scheduleEntries: result.rows,
      currentWeek: currentWeekStartStr,
      count: result.rows.length
    });

  } catch (error) {
    console.error(`[GET /api/project/${uid}/schedule] Error:`, error);
    res.status(500).json({
      error: 'Failed to get project schedule',
      message: error.message
    });
  }
});

// Update/add project schedule entry
app.put('/api/project/:uid/schedule', authenticateToken, [
  body('week_start_date').isISO8601().withMessage('Valid week start date is required'),
  body('day_index').isInt({ min: 0, max: 6 }).withMessage('Day index must be 0-6'),
  body('proposal_name').notEmpty().withMessage('Proposal name is required')
], async (req, res) => {
  const { uid } = req.params;
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Invalid input', 
      details: errors.array() 
    });
  }

  console.log(`[PUT /api/project/${uid}/schedule] === START ===`);

  const {
    week_start_date,
    day_index,
    proposal_name
  } = req.body;

  try {
    // Use the existing add_proposal_to_schedule function
    const result = await db.query(
      'SELECT add_proposal_to_schedule(?, ?, ?, ?, ?) as result',
      [uid, proposal_name, week_start_date, day_index, req.user.username]
    );

    console.log(`[PUT /api/project/${uid}/schedule] Schedule updated successfully`);
    
    res.json({
      success: true,
      message: 'Project schedule updated successfully',
      result: result.rows[0].result
    });

  } catch (error) {
    console.error(`[PUT /api/project/${uid}/schedule] Error:`, error);
    res.status(500).json({
      error: 'Failed to update project schedule',
      message: error.message
    });
  }
});

// Get weekly schedule data (proposals and custom tasks)
app.get('/api/proposal-workbench/schedule', authenticateToken, async (req, res) => {
  const { week } = req.query;
  let { user_id } = req.query;
  
  if (!week) {
    return res.status(400).json({
      error: 'week parameter is required',
      message: 'Provide week in YYYY-MM-DD format'
    });
  }
  
  console.log(`[GET /api/proposal-workbench/schedule] === START ===`);
  console.log(`[GET /api/proposal-workbench/schedule] Week: ${week}, User filter: ${user_id}`);
  
  try {
    // Handle user filtering - if user_id is 'all', pass null to get all users' data
    // If user_id is not specified or is 'current', use current user's ID
    let targetUserId = req.user.id;
    if (user_id === 'all') {
      targetUserId = null; // Get all users' data
    } else if (user_id && user_id !== 'current') {
      // For viewing other users' schedules, we'll search by their name in the schedule data
      // First try to find if they exist as a user in the users table
      console.log(`[GET /api/proposal-workbench/schedule] Looking up user: ${user_id}`);
      const userLookupResult = await db.query(
        'SELECT id, name FROM users WHERE name = ?',
        [user_id]
      );
      
      console.log(`[GET /api/proposal-workbench/schedule] User lookup result: ${userLookupResult.rows.length} rows found`);
      
      if (userLookupResult.rows.length > 0) {
        // User exists in users table, use their UUID
        targetUserId = userLookupResult.rows[0].id;
        console.log(`[GET /api/proposal-workbench/schedule] Found registered user '${user_id}' with UUID: ${targetUserId}`);
      } else {
        // User doesn't exist in users table, but might have scheduled items via PIC/BOM
        // We'll use a special query to search by name in the proposal data
        console.log(`[GET /api/proposal-workbench/schedule] User '${user_id}' not in users table, searching proposals by name`);
        targetUserId = `name:${user_id}`; // Special flag to indicate name-based search
      }
    }
    
    // Get schedule data from database (SQLite version)
    let proposalResult, taskResult;

    if (typeof targetUserId === 'string' && targetUserId.startsWith('name:')) {
      // Handle name-based search for users who aren't registered but appear in proposals
      const searchName = targetUserId.replace('name:', '');
      console.log(`[GET /api/proposal-workbench/schedule] Performing name-based search for: ${searchName}`);

      // Find proposals where the user appears as PIC/BOM/Account Manager
      proposalResult = await db.query(`
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
          COALESCE(u.name, ps.scheduled_by) as created_by
        FROM proposal_schedule ps
        LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
        LEFT JOIN users u ON ps.user_id = u.id
        WHERE ps.week_start_date = ?
        AND (om.pic = ? OR om.bom = ? OR om.account_mgr = ?)
        ORDER BY ps.day_index
      `, [week, searchName, searchName, searchName]);

      // Find custom tasks for this user by name
      taskResult = await db.query(`
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
        LEFT JOIN users u2 ON u2.name = ?
        WHERE ct.week_start_date = ?
        AND ct.user_id = u2.id
        ORDER BY ct.day_index
      `, [searchName, week]);
    } else {
      // Standard query for registered users
      const userFilter = targetUserId ? 'AND ps.user_id = ?' : '';
      const proposalParams = targetUserId ? [week, targetUserId] : [week];

      proposalResult = await db.query(`
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
          COALESCE(u.name, ps.scheduled_by) as created_by
        FROM proposal_schedule ps
        LEFT JOIN opps_monitoring om ON ps.proposal_id = om.uid
        LEFT JOIN users u ON ps.user_id = u.id
        WHERE ps.week_start_date = ?
        ${userFilter}
        ORDER BY ps.day_index
      `, proposalParams);

      const taskParams = targetUserId ? [week, targetUserId] : [week];
      taskResult = await db.query(`
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
        ${userFilter}
        ORDER BY ct.day_index
      `, taskParams);
    }

    // Transform the data into the format expected by the frontend
    const proposals = {};
    const customTasks = {};

    // Organize proposals by day
    proposalResult.rows.forEach(row => {
      if (!proposals[row.day_index]) {
        proposals[row.day_index] = [];
      }
      proposals[row.day_index].push({
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
      if (!customTasks[row.day_index]) {
        customTasks[row.day_index] = [];
      }
      customTasks[row.day_index].push({
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

    const totalDays = Object.keys({...proposals, ...customTasks}).length;
    console.log(`[GET /api/proposal-workbench/schedule] Retrieved ${totalDays} day entries (${proposalResult.rows.length} proposals, ${taskResult.rows.length} tasks)`);

    res.json({
      success: true,
      proposals: proposals,
      customTasks: customTasks
    });
  } catch (error) {
    console.error(`[GET /api/proposal-workbench/schedule] Error:`, error);
    res.status(500).json({
      error: 'Failed to fetch schedule',
      message: error.message
    });
  }
});

// OLD MOVE ENDPOINT REMOVED - Now handled by routes/proposal-workbench.js with proper source position tracking

// Add proposal to schedule (for duplication)
app.post('/api/proposal-workbench/schedule/proposals/add', authenticateToken, [
  body('proposalId').isUUID().withMessage('Valid proposal ID is required'),
  body('weekStartDate').isISO8601().withMessage('Valid week start date is required'),
  body('dayIndex').isInt({ min: 0, max: 6 }).withMessage('Day index must be between 0 and 6')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { proposalId, weekStartDate, dayIndex } = req.body;
  const username = req.user?.username || 'unknown';
  
  console.log(`[POST /api/proposal-workbench/schedule/proposals/add] === START ===`);
  console.log(`[POST /api/proposal-workbench/schedule/proposals/add] Proposal: ${proposalId}, Week: ${weekStartDate}, Day: ${dayIndex}, User: ${username}`);
  
  try {
    // Get proposal details first
    const proposalResult = await db.query(
      'SELECT uid, project_name FROM opps_monitoring WHERE uid = ?',
      [proposalId]
    );
    
    if (proposalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    const proposal = proposalResult.rows[0];
    
    // Use the database function to add proposal to schedule
    const result = await db.query(
      'SELECT add_proposal_to_schedule(?, ?, ?, ?, ?) as success',
      [proposalId, proposal.project_name, weekStartDate, dayIndex, username]
    );
    
    if (result.rows[0].success) {
      console.log(`[POST /api/proposal-workbench/schedule/proposals/add] Proposal added to schedule successfully`);
      res.json({ 
        success: true, 
        message: 'Proposal added to schedule successfully',
        proposal_id: proposalId,
        day_index: dayIndex 
      });
    } else {
      res.status(500).json({ error: 'Failed to add proposal to schedule' });
    }
  } catch (error) {
    console.error(`[POST /api/proposal-workbench/schedule/proposals/add] Error:`, error);
    res.status(500).json({
      error: 'Failed to add proposal to schedule',
      message: error.message
    });
  }
});

// Move custom task to different day in schedule
app.put('/api/proposal-workbench/schedule/tasks/:taskId/move', authenticateToken, [
  body('newWeekStartDate').isISO8601().withMessage('Valid week start date is required'),
  body('newDayIndex').isInt({ min: 0, max: 6 }).withMessage('Day index must be 0-6')
], async (req, res) => {
  const { taskId } = req.params;
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Invalid input', 
      details: errors.array() 
    });
  }
  
  console.log(`[PUT /api/proposal-workbench/schedule/tasks/${taskId}/move] === START ===`);
  const { newWeekStartDate, newDayIndex } = req.body;
  
  try {
    // Use the database function to move the custom task
    const result = await db.query(
      'SELECT move_custom_task(?, ?, ?, ?) as success',
      [taskId, req.user.id, newWeekStartDate, newDayIndex]
    );
    
    if (!result.rows[0].success) {
      return res.status(404).json({
        error: 'Custom task not found',
        message: `No custom task found with ID: ${taskId} for current user`
      });
    }
    
    console.log(`[PUT /api/proposal-workbench/schedule/tasks/${taskId}/move] Custom task moved successfully`);
    
    res.json({
      success: true,
      message: 'Custom task moved successfully'
    });
  } catch (error) {
    console.error(`[PUT /api/proposal-workbench/schedule/tasks/${taskId}/move] Error:`, error);
    res.status(500).json({
      error: 'Failed to move custom task',
      message: error.message
    });
  }
});

// Add new custom task
app.post('/api/proposal-workbench/schedule/tasks/add', authenticateToken, [
  body('title').notEmpty().withMessage('Task title is required'),
  body('weekStartDate').isISO8601().withMessage('Valid week start date is required'),
  body('dayIndex').isInt({ min: 0, max: 6 }).withMessage('Day index must be 0-6')
], async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Invalid input', 
      details: errors.array() 
    });
  }
  
  console.log(`[POST /api/proposal-workbench/schedule/tasks/add] === START ===`);
  const { taskId, weekStartDate, dayIndex, title, description, time, isAllDay, comment } = req.body;
  
  try {
    const result = await db.query(
      'SELECT add_custom_task(?, ?, ?, ?, ?, ?, ?, ?, ?) as success',
      [taskId, req.user.id, weekStartDate, dayIndex, title, description, time, isAllDay || false, comment]
    );
    
    if (!result.rows[0].success) {
      return res.status(500).json({
        error: 'Failed to add custom task',
        message: 'Database operation failed'
      });
    }
    
    console.log(`[POST /api/proposal-workbench/schedule/tasks/add] Custom task added successfully`);
    
    res.json({
      success: true,
      message: 'Custom task added successfully'
    });
  } catch (error) {
    console.error(`[POST /api/proposal-workbench/schedule/tasks/add] Error:`, error);
    res.status(500).json({
      error: 'Failed to add custom task',
      message: error.message
    });
  }
});

// Update existing custom task
app.put('/api/proposal-workbench/schedule/tasks/:taskId', authenticateToken, [
  body('title').notEmpty().withMessage('Task title is required')
], async (req, res) => {
  const { taskId } = req.params;
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Invalid input', 
      details: errors.array() 
    });
  }
  
  console.log(`[PUT /api/proposal-workbench/schedule/tasks/${taskId}] === START ===`);
  const { title, description, time, isAllDay, comment } = req.body;
  
  try {
    const result = await db.query(
      'SELECT update_custom_task(?, ?, ?, ?, ?, ?, ?) as success',
      [taskId, req.user.id, title, description, time, isAllDay || false, comment]
    );
    
    if (!result.rows[0].success) {
      return res.status(404).json({
        error: 'Custom task not found',
        message: `No custom task found with ID: ${taskId} for current user`
      });
    }
    
    console.log(`[PUT /api/proposal-workbench/schedule/tasks/${taskId}] Custom task updated successfully`);
    
    res.json({
      success: true,
      message: 'Custom task updated successfully'
    });
  } catch (error) {
    console.error(`[PUT /api/proposal-workbench/schedule/tasks/${taskId}] Error:`, error);
    res.status(500).json({
      error: 'Failed to update custom task',
      message: error.message
    });
  }
});

// Delete custom task
app.delete('/api/proposal-workbench/schedule/tasks/:taskId', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  
  console.log(`[DELETE /api/proposal-workbench/schedule/tasks/${taskId}] === START ===`);
  
  try {
    const result = await db.query(
      'SELECT delete_custom_task(?, ?) as success',
      [taskId, req.user.id]
    );
    
    if (!result.rows[0].success) {
      return res.status(404).json({
        error: 'Custom task not found',
        message: `No custom task found with ID: ${taskId} for current user`
      });
    }
    
    console.log(`[DELETE /api/proposal-workbench/schedule/tasks/${taskId}] Custom task deleted successfully`);
    
    res.json({
      success: true,
      message: 'Custom task deleted successfully'
    });
  } catch (error) {
    console.error(`[DELETE /api/proposal-workbench/schedule/tasks/${taskId}] Error:`, error);
    res.status(500).json({
      error: 'Failed to delete custom task',
      message: error.message
    });
  }
});

// Debug endpoint to check users in database
app.get('/api/debug/users', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email FROM users ORDER BY name'
    );
    res.json({
      success: true,
      users: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

// Google Drive removed - return disabled
app.get('/api/project/:uid/drive-folder-contents', authenticateToken, (_req, res) => {
  res.status(410).json({
    success: false,
    message: 'Google Drive integration is disabled.',
    hasFolder: false
  });
});
