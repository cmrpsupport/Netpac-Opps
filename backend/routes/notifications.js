const db = require('../../db_adapter');
const express = require('express');
const router = express.Router();

// Middleware to verify JWT token
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// GET /api/notifications - Get user's notifications (returns 200 + empty list on DB errors so UI keeps working)
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('[NOTIFICATIONS] GET request received for user:', req.user?.id);

        // Check if user_notifications table exists first
        const tableExistsQuery = `
            SELECT COUNT(*) as table_exists
            FROM sqlite_master
            WHERE type = 'table'
            AND name = 'user_notifications'
        `;

        const tableCheck = await db.query(tableExistsQuery);
        const row0 = tableCheck.rows && tableCheck.rows[0];
        const exists = row0 && (row0.table_exists !== 0 && row0.table_exists !== '0');

        if (!exists) {
            console.warn('[NOTIFICATIONS] user_notifications table does not exist, returning empty list');
            return res.json({ notifications: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
        }
        
        const { page = 1, limit = 20, unread_only = false } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                n.id,
                n.type,
                n.title,
                n.message,
                n.data,
                n.is_read,
                n.created_at,
                n.read_at,
                n.opportunity_uid,
                o.project_name,
                o.client,
                creator.name as created_by_name,
                creator.email as created_by_email
            FROM user_notifications n
            LEFT JOIN opps_monitoring o ON n.opportunity_uid = o.uid
            LEFT JOIN users creator ON n.created_by = creator.id
            WHERE n.user_id = ?
        `;

        const queryParams = [req.user.id];

        if (unread_only === 'true') {
            query += ' AND n.is_read = false';
        }

        query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
        queryParams.push(limit, offset);

        console.log('[NOTIFICATIONS] Executing query for user:', req.user.id);
        const result = await db.query(query, queryParams);
        console.log('[NOTIFICATIONS] Found', result.rows.length, 'notifications');
        
        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM user_notifications WHERE user_id = ?';
        const countParams = [req.user.id];

        if (unread_only === 'true') {
            countQuery += ' AND is_read = false';
        }

        const countResult = await db.query(countQuery, countParams);
        const countRow = countResult.rows && countResult.rows[0];
        const totalCount = parseInt(countRow && (countRow.count ?? countRow['COUNT(*)']), 10) || 0;
        
        const response = {
            notifications: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        };
        
        console.log('[NOTIFICATIONS] Sending response with', response.notifications.length, 'notifications');
        res.json(response);
    } catch (error) {
        console.error('[NOTIFICATIONS] Error fetching notifications:', error.message, error.stack);
        // Return 200 with empty list so nav/UI keeps working (e.g. when DB connection is temporarily unavailable)
        return res.json({
            notifications: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
        });
    }
});

// GET /api/notifications/unread-count - Get count of unread notifications (returns 200 + count 0 on error)
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        console.log('[NOTIFICATIONS] Unread count request for user:', req.user?.id);
        
        const tableExistsQuery = `
            SELECT COUNT(*) as table_exists
            FROM sqlite_master
            WHERE type = 'table'
            AND name = 'user_notifications'
        `;

        const tableCheck = await db.query(tableExistsQuery);
        const row0 = tableCheck.rows && tableCheck.rows[0];
        const exists = row0 && (row0.table_exists !== 0 && row0.table_exists !== '0');

        if (!exists) {
            return res.json({ count: 0 });
        }

        const query = 'SELECT COUNT(*) as cnt FROM user_notifications WHERE user_id = ? AND is_read = false';
        const result = await db.query(query, [req.user.id]);
        const countRow = result.rows && result.rows[0];
        const count = parseInt(countRow && (countRow.cnt ?? countRow.count ?? countRow['COUNT(*)']), 10) || 0;
        res.json({ count });
    } catch (error) {
        console.error('[NOTIFICATIONS] Error fetching unread count:', error.message);
        return res.json({ count: 0 });
    }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('[NOTIFICATIONS] Mark as read request for notification:', id, 'user:', req.user?.id);
        
        if (!req.db) {
            console.error('[NOTIFICATIONS] req.db is not available');
            return res.status(500).json({ error: 'Database connection not available' });
        }
        
        const query = `
            UPDATE user_notifications
            SET is_read = true
            WHERE id = ? AND user_id = ?
            RETURNING *
        `;

        const result = await db.query(query, [id, req.user.id]);
        
        if (result.rows.length === 0) {
            console.log('[NOTIFICATIONS] Notification not found:', id);
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        console.log('[NOTIFICATIONS] Marked notification as read:', id);
        res.json({ success: true, notification: result.rows[0] });
    } catch (error) {
        console.error('[NOTIFICATIONS] Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read', details: error.message });
    }
});

// PUT /api/notifications/mark-all-read - Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
    try {
        console.log('[NOTIFICATIONS] Mark all read request for user:', req.user?.id);
        
        if (!req.db) {
            console.error('[NOTIFICATIONS] req.db is not available');
            return res.status(500).json({ error: 'Database connection not available' });
        }
        
        const query = `
            UPDATE user_notifications
            SET is_read = true
            WHERE user_id = ? AND is_read = false
        `;

        const result = await db.query(query, [req.user.id]);
        
        console.log('[NOTIFICATIONS] Marked', result.rowCount, 'notifications as read');
        res.json({ success: true, updated_count: result.rowCount });
    } catch (error) {
        console.error('[NOTIFICATIONS] Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read', details: error.message });
    }
});

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = 'DELETE FROM user_notifications WHERE id = ? AND user_id = ? RETURNING *';
        const result = await db.query(query, [id, req.user.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

// POST /api/notifications - Create a new notification (internal use)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { user_id, opportunity_uid, type, title, message, data } = req.body;
        
        // Validate required fields
        if (!user_id || !type || !title || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const query = `
            INSERT INTO user_notifications (user_id, opportunity_uid, type, title, message, data, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING *
        `;

        const result = await db.query(query, [
            user_id,
            opportunity_uid,
            type,
            title,
            message,
            data ? JSON.stringify(data) : null,
            req.user.id
        ]);
        
        res.status(201).json({ success: true, notification: result.rows[0] });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

// Notification service helper functions
class NotificationService {
    constructor(db) {
        this.db = db;
    }
    
    async createNotification({ user_id, opportunity_uid, type, title, message, data, created_by }) {
        try {
            const query = `
                INSERT INTO user_notifications (user_id, opportunity_uid, type, title, message, data, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING *
            `;

            const result = await this.db.query(query, [
                user_id,
                opportunity_uid,
                type,
                title,
                message,
                data ? JSON.stringify(data) : null,
                created_by
            ]);
            
            return result.rows[0];
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }
    
    async notifyAssignment({ opportunity_uid, assigned_user_id, assignment_type, project_name, assigned_by_id }) {
        // Don't create notification if user assigns themselves
        if (assigned_user_id === assigned_by_id) {
            console.log(`[NOTIFICATION-SERVICE] Skipping self-assignment notification for ${assignment_type}`);
            return null;
        }
        
        const typeMap = {
            'pic': 'pic_assignment',
            'bom': 'bom_assignment', 
            'account_mgr': 'account_mgr_assignment'
        };
        
        const titleMap = {
            'pic': 'Assigned as PIC',
            'bom': 'Assigned as BOM',
            'account_mgr': 'Assigned as Account Manager'
        };
        
        const type = typeMap[assignment_type];
        const title = titleMap[assignment_type];
        const message = `You have been assigned as ${assignment_type.toUpperCase()} for "${project_name}"`;
        
        return await this.createNotification({
            user_id: assigned_user_id,
            opportunity_uid,
            type,
            title,
            message,
            data: { assignment_type, project_name },
            created_by: assigned_by_id
        });
    }
    
    async notifyMention({ opportunity_uid, mentioned_user_id, mention_context, project_name, mentioned_by_id }) {
        return await this.createNotification({
            user_id: mentioned_user_id,
            opportunity_uid,
            type: 'mention',
            title: 'Mentioned in Proposal Story',
            message: `You were mentioned in the proposal story for "${project_name}"`,
            data: { mention_context, project_name },
            created_by: mentioned_by_id
        });
    }
    
    async notifyStatusChange({ opportunity_uid, affected_user_ids, old_status, new_status, project_name, changed_by_id }) {
        const notifications = [];
        
        for (const user_id of affected_user_ids) {
            const notification = await this.createNotification({
                user_id,
                opportunity_uid,
                type: 'status_change',
                title: 'Proposal Status Changed',
                message: `Status changed from "${old_status}" to "${new_status}" for "${project_name}"`,
                data: { old_status, new_status, project_name },
                created_by: changed_by_id
            });
            notifications.push(notification);
        }
        
        return notifications;
    }
}

// Export the service for use in other modules
router.NotificationService = NotificationService;

module.exports = router;