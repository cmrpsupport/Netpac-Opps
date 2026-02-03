# 🚀 DEPLOYMENT PROCESS GUIDE - CMRP Opportunities Management

## ⚠️ CRITICAL: PRODUCTION DEPLOYMENT CHECKLIST

### **🔴 ALWAYS REMEMBER:**
Your production environment deploys from the **`master`** branch, NOT the `main` branch!

---

## 📋 **STEP-BY-STEP DEPLOYMENT PROCESS**

### **1. 🔍 PRE-DEPLOYMENT VERIFICATION**

Before making any changes, verify your current branch and status:

```bash
# Check current branch and status
git status
git branch -a

# Expected output should show:
# * main (or master)
# Your branch is up to date with 'origin/main'
```

### **2. 💻 DEVELOPMENT WORKFLOW**

#### **Make Changes on Main Branch:**
```bash
# Ensure you're on main branch for development
git checkout main

# Make your code changes
# Test locally at http://localhost:3000

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "Feature: [Description of changes]

✅ What was fixed/added:
- Specific change 1
- Specific change 2  
- Specific change 3

✅ Files modified:
- file1.js
- file2.html
- file3.css"

# Push to main branch
git push origin main
```

### **3. 🚀 PRODUCTION DEPLOYMENT PROCESS**

#### **CRITICAL: Deploy to Master Branch**

```bash
# Step 1: Switch to master branch
git checkout master

# Step 2: Merge changes from main to master
git merge main

# Expected output:
# Fast-forward merge OR
# Merge commit (if there are conflicts, resolve them)

# Step 3: Push to master to trigger production deployment
git push origin master

# Step 4: Switch back to main for future development
git checkout main
```

### **4. ✅ POST-DEPLOYMENT VERIFICATION**

```bash
# Verify both branches are synchronized
git log --oneline -3

# Check that master has latest commits
git checkout master
git log --oneline -3

# Return to main for development
git checkout main
```

---

## 🔧 **TROUBLESHOOTING COMMON ISSUES**

### **Issue 1: Production Deploys Old Code**

**Symptom:** Production shows older version despite recent commits
**Cause:** Changes pushed to `main` but production deploys from `master`

**Solution:**
```bash
git checkout master
git merge main
git push origin master
```

### **Issue 2: Merge Conflicts**

**Symptom:** Git merge fails with conflicts
**Cause:** Divergent changes between main and master

**Solution:**
```bash
# On master branch
git merge main
# Resolve conflicts in editor
git add .
git commit -m "Resolve merge conflicts"
git push origin master
```

### **Issue 3: Uncommitted Changes Block Branch Switch**

**Symptom:** "Your local changes would be overwritten by checkout"
**Cause:** Uncommitted files prevent branch switching

**Solution:**
```bash
# Option 1: Commit changes
git add .
git commit -m "WIP: Save current changes"

# Option 2: Stash changes temporarily
git stash
git checkout master
# ... do deployment
git checkout main
git stash pop
```

---

## 📊 **DEPLOYMENT VERIFICATION CHECKLIST**

### **Before Deployment:**
- [ ] All changes tested locally
- [ ] Server starts without errors (`node server.js`)
- [ ] All features work as expected
- [ ] No console errors in browser
- [ ] Changes committed with descriptive message

### **During Deployment:**
- [ ] Currently on `main` branch for development
- [ ] Switch to `master` branch for deployment
- [ ] Merge `main` → `master` successfully
- [ ] Push to `origin/master` successful
- [ ] Return to `main` branch for future work

### **After Deployment:**
- [ ] Check deployment platform for build status
- [ ] Verify production site has latest changes
- [ ] Test critical functionality in production
- [ ] Monitor for any deployment errors

---

## 🎯 **PRODUCTION DEPLOYMENT PLATFORMS**

### **If Using Render:**
1. Login to Render dashboard
2. Navigate to your service
3. Check "Events" tab for deployment status
4. Look for commit hash matching your latest push
5. Verify deployment completes successfully

### **If Using Heroku:**
```bash
# Check deployment status
heroku logs --tail --app your-app-name

# Manual deployment trigger (if needed)
heroku git:remote -a your-app-name
git push heroku master
```

### **If Using Manual Server:**
```bash
# SSH to production server
ssh user@your-server.com

# Navigate to app directory
cd /path/to/your/app

# Pull latest changes
git pull origin master

# Restart application (example with PM2)
pm2 restart your-app-name
```

---

## 🚨 **EMERGENCY ROLLBACK PROCEDURE**

If deployment causes issues in production:

```bash
# Step 1: Identify last working commit
git log --oneline

# Step 2: Create rollback branch
git checkout master
git reset --hard <last-working-commit-hash>

# Step 3: Force push (USE WITH CAUTION)
git push --force origin master

# Step 4: Verify production is restored
# Check your production site

# Step 5: Fix issues on main branch
git checkout main
# Fix the problems
# Follow normal deployment process
```

---

## 📝 **DEPLOYMENT LOG TEMPLATE**

Keep track of deployments:

```
DATE: June 10, 2025
TIME: 11:51 AM
DEVELOPER: [Your Name]
BRANCH: master
COMMIT: ff1d9ea
CHANGES:
- Filter label dark mode fixes
- Auto-filter functionality implementation
- 71 files updated

DEPLOYMENT STATUS: ✅ SUCCESS
VERIFICATION: ✅ All features working
ISSUES: None
```

---

## 🔄 **AUTOMATED DEPLOYMENT SCRIPT**

Create a deployment script to automate the process:

```bash
#!/bin/bash
# save as: deploy.sh

echo "🚀 Starting deployment process..."

# Ensure we're on main and up to date
git checkout main
git pull origin main

# Get current commit info
COMMIT_HASH=$(git rev-parse --short HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)

echo "📋 Deploying commit: $COMMIT_HASH"
echo "📝 Message: $COMMIT_MSG"

# Switch to master and merge
git checkout master
git merge main

if [ $? -eq 0 ]; then
    echo "✅ Merge successful"
    
    # Push to production
    git push origin master
    
    if [ $? -eq 0 ]; then
        echo "🎉 Deployment completed successfully!"
        echo "🔗 Check your production site for changes"
    else
        echo "❌ Push failed!"
        exit 1
    fi
else
    echo "❌ Merge failed! Please resolve conflicts manually"
    exit 1
fi

# Return to main branch
git checkout main
echo "✅ Returned to main branch for continued development"
```

**Usage:**
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📚 **QUICK REFERENCE**

### **Common Commands:**
```bash
# Check current status
git status

# Development workflow
git checkout main → make changes → git add . → git commit → git push origin main

# Production deployment
git checkout master → git merge main → git push origin master → git checkout main

# View recent commits
git log --oneline -5

# Check all branches
git branch -a
```

### **Branch Strategy:**
- **`main`**: Development and testing branch
- **`master`**: Production deployment branch
- **Always develop on `main`**
- **Always deploy from `master`**

---

## ⭐ **BEST PRACTICES**

1. **Always test locally** before deployment
2. **Use descriptive commit messages** with details
3. **Deploy during low-traffic hours** when possible
4. **Keep deployments small and frequent** rather than large batches
5. **Monitor production** after each deployment
6. **Have a rollback plan** ready
7. **Document any issues** and solutions
8. **Communicate deployments** to team members

---

**Remember: Production deploys from `master`, develop on `main`!** 🎯
