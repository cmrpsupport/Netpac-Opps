// Account Manager Snapshots (specific route before general)
app.get('/api/snapshots/:type/:accountManager', async (req, res) => {
  console.log(`[DEBUG] Account Manager Snapshot: type=${req.params.type}, accountManager=${req.params.accountManager}`);
  try {
    const { type, accountManager } = req.params;
    if (!['weekly', 'monthly'].includes(type)) {
      return res.status(400).json({ error: 'Invalid snapshot type' });
    }
    const query = `SELECT * FROM account_manager_snapshots WHERE snapshot_type = $1 AND account_manager = $2 ORDER BY created_at DESC LIMIT 1`;
    const result = await pool.query(query, [type, accountManager]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `No ${type} snapshot for ${accountManager}` });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Failed to fetch snapshot for ${req.params.accountManager}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
