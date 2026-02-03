const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Database connection
const pool = new Pool({
    connectionString: 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require'
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('✅ Connected to PostgreSQL database');
        release();
    }
});

// API Routes for snapshots
app.get('/api/snapshots/:type', async (req, res) => {
    try {
        const { type } = req.params;
        
        if (type !== 'weekly' && type !== 'monthly') {
            return res.status(400).json({ error: 'Invalid snapshot type. Must be weekly or monthly.' });
        }

        const result = await pool.query(
            'SELECT * FROM dashboard_snapshots WHERE snapshot_type = $1 ORDER BY created_at DESC LIMIT 1',
            [type]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Snapshot not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching snapshot:', error);
        res.status(500).json({ error: 'Internal server error' });
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

        if (!snapshot_type || (snapshot_type !== 'weekly' && snapshot_type !== 'monthly')) {
            return res.status(400).json({ error: 'Invalid snapshot_type. Must be weekly or monthly.' });
        }

        const result = await pool.query(`
            INSERT INTO dashboard_snapshots (
                snapshot_type, total_opportunities, submitted_count, submitted_amount,
                op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
                op30_count, op30_amount, lost_count, lost_amount, inactive_count,
                ongoing_count, pending_count, declined_count, revised_count
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19
            ) ON CONFLICT (snapshot_type) DO UPDATE SET
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
                saved_date = CURRENT_TIMESTAMP
            RETURNING *
        `, [
            snapshot_type, total_opportunities, submitted_count, submitted_amount,
            op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
            op30_count, op30_amount, lost_count, lost_amount, inactive_count,
            ongoing_count, pending_count, declined_count, revised_count
        ]);

        res.json({
            success: true,
            message: `${snapshot_type} snapshot saved successfully`,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error saving snapshot:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all snapshots
app.get('/api/snapshots', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM dashboard_snapshots ORDER BY snapshot_type, created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching snapshots:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}`);
    console.log(`🔗 Snapshots API available at http://localhost:${PORT}/api/snapshots`);
});

module.exports = app;
