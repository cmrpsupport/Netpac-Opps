# 🚀 Database Snapshot Deployment Guide

## 📋 Current Status
- ✅ **Database:** Snapshots stored in PostgreSQL (available to both environments)
- ✅ **Frontend:** Updated to use database APIs
- ⚠️ **Backend:** Snapshot endpoints needed in production

## 🎯 Deployment Steps

### **Step 1: Development Environment**
```bash
# Start the local snapshot server
npm run snapshot-server
# OR
node snapshot_server.js

# Server will run on http://localhost:3001
# Dashboard available at http://localhost:3001
```

### **Step 2: Production Environment**

#### **Option A: Add to Existing Backend (Recommended)**
1. **Add snapshot endpoints** to your existing production backend server
2. **Copy the routes** from `snapshot_endpoints_for_production.js`
3. **Deploy** your updated backend to Render

#### **Option B: Deploy Snapshot Server Separately**
1. **Create new Render service** for snapshot server
2. **Deploy** `snapshot_server.js` to new service
3. **Update** config.js with new production URL

### **Step 3: Verify Deployment**

#### **Test Development:**
```bash
# Test local snapshot API
curl http://localhost:3001/api/snapshots/weekly

# Expected: JSON with snapshot data
```

#### **Test Production:**
```bash
# Test production snapshot API
curl https://cmrp-opps-backend.onrender.com/api/snapshots/weekly

# Expected: JSON with snapshot data
```

## 🔧 Configuration Matrix

| Environment | Frontend URL | Backend API | Snapshot Storage |
|-------------|--------------|-------------|------------------|
| **Development** | localhost:3001 | localhost:3001 | PostgreSQL DB |
| **Production** | your-domain.com | cmrp-opps-backend.onrender.com | PostgreSQL DB |

## ✅ Verification Checklist

- [ ] Database table `dashboard_snapshots` exists
- [ ] Snapshot data populated with screenshot metrics
- [ ] Local snapshot server running on port 3001
- [ ] Production backend has snapshot endpoints
- [ ] Frontend config points to correct APIs
- [ ] Both environments can fetch snapshots

## 🚨 Quick Fix Commands

### **Reset Config for Development:**
```bash
# Use local snapshot server
node snapshot_server.js
```

### **Deploy to Production:**
```bash
# Deploy frontend changes
./deploy.sh

# OR manually:
git checkout master
git merge main  
git push origin master
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/snapshots/weekly` | Get weekly snapshot |
| `GET` | `/api/snapshots/monthly` | Get monthly snapshot |
| `POST` | `/api/snapshots` | Save new snapshot |
| `GET` | `/api/snapshots` | Get all snapshots |

## 🔗 Next Steps

1. **Choose deployment option** (A or B above)
2. **Add snapshot endpoints** to production backend
3. **Test both environments** work correctly
4. **Monitor dashboard** for proper baseline comparisons

The snapshots will automatically sync between environments since they use the same PostgreSQL database! 🎯
