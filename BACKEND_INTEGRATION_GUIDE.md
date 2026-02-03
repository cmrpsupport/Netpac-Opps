# 🏗️ Standard Backend Integration Guide

## 📋 Overview
This guide shows how to properly integrate dashboard snapshots into your existing backend infrastructure using standard development practices.

## 🗄️ Database Migration

### 1. Run the Migration Script
```bash
# Connect to your database and run the migration
psql "postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require" -f migrations/001_add_dashboard_snapshots.sql
```

### 2. Verify Migration
```sql
-- Check if table was created correctly
\d dashboard_snapshots

-- Verify baseline data was inserted
SELECT snapshot_type, total_opportunities, submitted_count, op100_count 
FROM dashboard_snapshots;
```

## 🔧 Backend Integration

### 1. Add Routes to Your Existing Backend

In your main backend server file (e.g., `server.js` or `app.js`), add:

```javascript
// Import the snapshots router
const snapshotsRouter = require('./routes/snapshots');

// Add the router to your app (after other middleware)
app.use('/api', snapshotsRouter);
```

### 2. Database Connection Middleware

Ensure your database connection is available in routes via middleware:

```javascript
// Add database middleware (if not already present)
app.use((req, res, next) => {
    req.db = pool; // Your existing database pool
    next();
});
```

### 3. Test the Integration

```bash
# Test in development
curl http://localhost:3000/api/snapshots/weekly

# Test in production (after deployment)
curl https://cmrp-opps-backend.onrender.com/api/snapshots/weekly
```

## 📦 File Structure
```
backend/
├── routes/
│   ├── snapshots.js          # Snapshot API routes
│   └── (your existing routes)
├── migrations/
│   └── 001_add_dashboard_snapshots.sql
└── server.js                 # Your main server file
```

## 🚀 Deployment Process

### 1. Development Testing
```bash
# Start your backend in development
npm run dev
# OR
node server.js

# Test snapshot endpoints
curl http://localhost:3000/api/snapshots/weekly
```

### 2. Deploy to Production
```bash
# Use your existing deployment process
# For Render: git push triggers automatic deployment
git add .
git commit -m "feat: Add dashboard snapshots API endpoints"
git push origin main
```

### 3. Run Migration in Production
```bash
# Connect to production database and run migration
psql "your-production-db-url" -f migrations/001_add_dashboard_snapshots.sql
```

## 🎯 API Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/snapshots/weekly` | Get weekly snapshot | JSON object |
| `GET` | `/api/snapshots/monthly` | Get monthly snapshot | JSON object |
| `POST` | `/api/snapshots` | Save snapshot | Success message |
| `GET` | `/api/snapshots` | Get all snapshots | Array of objects |
| `DELETE` | `/api/snapshots/:type` | Delete snapshot | Success message |

## 📊 Frontend Integration

The frontend (`executive_dashboard.js`) is already updated to use these endpoints. It will automatically:

1. **Fetch snapshots** from the database via API
2. **Save new snapshots** when conditions are met (Monday for weekly, 1st for monthly)
3. **Display comparisons** using database-stored baseline data

## ✅ Verification Checklist

- [ ] Database migration completed successfully
- [ ] Snapshot routes added to backend
- [ ] Backend can connect to database
- [ ] API endpoints respond correctly
- [ ] Frontend config uses correct API base URL
- [ ] Development environment working
- [ ] Production deployment completed
- [ ] Production migration completed
- [ ] Dashboard displays baseline comparisons

## 🔧 Troubleshooting

### Database Connection Issues
```bash
# Test database connection
psql "your-db-url" -c "SELECT 1;"
```

### API Endpoint Issues
```bash
# Check if backend is running
curl http://localhost:3000/health

# Test specific snapshot endpoint
curl -v http://localhost:3000/api/snapshots/weekly
```

### Frontend API Issues
```javascript
// Check browser console for API errors
// Verify config.js has correct API_BASE_URL
```

## 📈 Benefits of This Approach

- ✅ **Standard Architecture:** Integrates with existing backend
- ✅ **Proper Migration:** Database changes are versioned and reproducible
- ✅ **Environment Parity:** Same code works in dev and production
- ✅ **Maintainable:** Clean separation of concerns
- ✅ **Scalable:** Can easily add more snapshot features
- ✅ **Testable:** API endpoints can be unit and integration tested

## 🎯 Next Steps

1. **Integrate the routes** into your existing backend
2. **Run the database migration** in both environments
3. **Deploy using your standard process**
4. **Test the dashboard** shows proper baseline comparisons
5. **Monitor for any issues** and iterate as needed

This approach follows standard development practices and integrates cleanly with your existing infrastructure! 🚀
