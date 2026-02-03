# 🚀 QUICK DEPLOYMENT REFERENCE CARD

## ⚠️ CRITICAL REMINDER
**Production deploys from `master` branch, NOT `main`!**

## 🔄 AUTOMATED DEPLOYMENT (RECOMMENDED)
```bash
./deploy.sh
```
*This script handles everything automatically with safety checks*

## 📋 MANUAL DEPLOYMENT PROCESS

### 1. Development Workflow
```bash
git checkout main          # Always develop on main
# Make your changes
git add .
git commit -m "Description of changes"
git push origin main       # Push development changes
```

### 2. Production Deployment
```bash
git checkout master        # Switch to production branch
git merge main            # Merge development changes
git push origin master    # TRIGGER PRODUCTION DEPLOYMENT
git checkout main         # Return to development branch
```

## 🚨 EMERGENCY COMMANDS

### Check Current Status
```bash
git status
git branch -a
git log --oneline -3
```

### Fix "Wrong Branch" Issues
```bash
# If you pushed to main but production needs master:
git checkout master
git merge main
git push origin master
```

### Rollback Production
```bash
git checkout master
git reset --hard <previous-commit-hash>
git push --force origin master  # ⚠️ USE WITH CAUTION
```

## ✅ VERIFICATION CHECKLIST
- [ ] Tested locally at http://localhost:3000
- [ ] Committed with descriptive message
- [ ] Pushed to main first
- [ ] Merged main → master
- [ ] Pushed to origin/master
- [ ] Verified production deployment
- [ ] Returned to main branch

---
**Remember: main = development, master = production** 🎯
