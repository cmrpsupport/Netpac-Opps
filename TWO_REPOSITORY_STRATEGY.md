# Two Repository Strategy

## Overview

You now have **two separate Git repositories** for your CMRP Opportunities Management application:

1. **PostgreSQL Version** (Original)
2. **SQLiteCloud Version** (New)

This allows you to:
- Maintain both database solutions independently
- Easy rollback if needed
- Test SQLiteCloud without affecting production
- Gradually migrate users

---

## Repository Details

### 📁 PostgreSQL Version (Original)

**Location:** `C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx`

**Database:**
- Type: PostgreSQL
- Provider: Neon
- Connection: `postgresql://opps_management_owner:...`

**Status:**
- ✅ Production-ready
- ✅ All data intact
- ✅ Stable and tested

**Use Cases:**
- Keep as backup
- Fallback if SQLiteCloud has issues
- For users who need PostgreSQL compatibility

---

### 📁 SQLiteCloud Version (New)

**Location:** `C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud`

**Database:**
- Type: SQLiteCloud
- Connection: `sqlitecloud://cguxse6mvk.g4.sqlite.cloud:8860/cmrp-oppx?apikey=...`

**Status:**
- ✅ Migration complete (4,411 rows)
- ✅ All files copied
- ✅ Git initialized and committed
- ⏳ **Ready to push** to https://github.com/cmrpsupport/cmrp-oppx

**New Files Added:**
- `db_adapter.js` - Universal database adapter
- Migration scripts (`migrate_to_sqlitecloud.js`, etc.)
- Complete documentation
- `.env` configured for SQLiteCloud

**Use Cases:**
- New production deployment
- Better performance (depending on region)
- Simpler connection management
- Cost optimization

---

## Key Differences

| Feature | PostgreSQL | SQLiteCloud |
|---------|-----------|-------------|
| **Location** | `CMRP-Oppx/` | `CMRP-Oppx-SQLiteCloud/` |
| **Database** | PostgreSQL (Neon) | SQLiteCloud |
| **Connection** | Pool-based | Direct |
| **UUID Gen** | `gen_random_uuid()` | `uuid` npm package |
| **Booleans** | Native | 0/1 integers |
| **JSON** | Native JSONB | TEXT (parse/stringify) |
| **Adapter** | Direct `pg` module | `db_adapter.js` |

---

## Working with Both Repositories

### Quick Switch Commands

**Switch to PostgreSQL version:**
```bash
cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx"
npm start
```

**Switch to SQLiteCloud version:**
```bash
cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud"
npm start
```

### Running Both Simultaneously

You can run both on different ports:

**PostgreSQL (Port 3000):**
```bash
cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx"
npm start
```

**SQLiteCloud (Port 3001):**
```bash
cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud"
PORT=3001 npm start
```

---

## Git Workflow

### PostgreSQL Repository

```bash
cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx"

# Make changes
git add .
git commit -m "Your changes"
git push
```

### SQLiteCloud Repository

```bash
cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud"

# Make changes
git add .
git commit -m "Your changes"
git push
```

---

## Deployment Strategy

### Phase 1: Testing (Current)
- ✅ SQLiteCloud repository created
- ⏳ Push to GitHub
- ⏳ Deploy SQLiteCloud version to staging
- ⏳ Test thoroughly

### Phase 2: Parallel Running
- Keep PostgreSQL version running
- Deploy SQLiteCloud version to production
- Monitor both for a period
- Compare performance and stability

### Phase 3: Full Migration
- Migrate all users to SQLiteCloud
- Keep PostgreSQL as backup
- Eventually deprecate PostgreSQL version

### Phase 4: Cleanup (Optional)
- Archive PostgreSQL repository
- Fully commit to SQLiteCloud

---

## Syncing Features Between Repositories

When you add a new feature to one repository and want it in the other:

### Method 1: Manual Copy
1. Make changes in one repository
2. Copy changed files to the other repository
3. Commit in both

### Method 2: Git Cherry-pick
```bash
# In the target repository
git remote add other-repo ../CMRP-Oppx  # or ../CMRP-Oppx-SQLiteCloud
git fetch other-repo
git cherry-pick <commit-hash>
```

### Method 3: Patch File
```bash
# In source repository
git format-patch -1 HEAD

# In target repository
git am < 0001-your-patch.patch
```

---

## Environment Configuration

Both repositories need their own `.env` file:

### PostgreSQL `.env`
```env
DATABASE_URL=postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@...
NODE_ENV=production
SESSION_SECRET=your-secret
```

### SQLiteCloud `.env`
```env
DATABASE_URL=sqlitecloud://cguxse6mvk.g4.sqlite.cloud:8860/cmrp-oppx?apikey=22C0CAgc51jfEnavN6i0kGGUNafnvDzW01U53xD2aMI
NODE_ENV=production
SESSION_SECRET=your-secret
```

**Important:** Never commit `.env` files! They're in `.gitignore`.

---

## Backup Strategy

### PostgreSQL Version
- Database backups handled by Neon
- Git repository is your code backup

### SQLiteCloud Version
- Database backups handled by SQLiteCloud (configure in dashboard)
- Git repository is your code backup
- **Plus:** You have `postgres_data_export.json` as a data snapshot

---

## Migration Path

If you want to move a change from PostgreSQL → SQLiteCloud:

1. **Test in PostgreSQL first**
2. **Copy code to SQLiteCloud repo**
3. **Adjust for SQLiteCloud differences:**
   - UUID generation
   - Boolean handling
   - JSON fields
   - RETURNING clauses
4. **Test in SQLiteCloud**
5. **Deploy**

---

## Rollback Plan

If SQLiteCloud has issues:

1. **Immediate:** Point users back to PostgreSQL version
2. **Update DNS/URLs** to PostgreSQL deployment
3. **Keep PostgreSQL database in sync** during testing period

---

## Cost Comparison

| Item | PostgreSQL (Neon) | SQLiteCloud |
|------|------------------|-------------|
| Free Tier | 0.5GB | 1GB storage, 1GB transfer |
| Paid Plans | $19+/month | $29+/month |
| Performance | Good | Potentially better |
| Scaling | Auto | Manual |

---

## Next Steps

1. ✅ **DONE:** Created SQLiteCloud repository
2. ✅ **DONE:** Migrated all data
3. ✅ **DONE:** Committed all files
4. ⏳ **TODO:** Push to GitHub (see [GIT_PUSH_INSTRUCTIONS.md](GIT_PUSH_INSTRUCTIONS.md))
5. ⏳ **TODO:** Deploy SQLiteCloud version
6. ⏳ **TODO:** Test thoroughly
7. ⏳ **TODO:** Compare performance
8. ⏳ **TODO:** Choose primary version

---

## Quick Reference

| Need | Go To |
|------|-------|
| PostgreSQL Version | `cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx"` |
| SQLiteCloud Version | `cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud"` |
| Migration Guide | [MIGRATION_COMPLETE.md](MIGRATION_COMPLETE.md) |
| Push Instructions | [GIT_PUSH_INSTRUCTIONS.md](GIT_PUSH_INSTRUCTIONS.md) |
| Check Data | `node check_sqlitecloud_status.js` |

---

**You now have full flexibility!** 🎉

- Keep both versions
- Test and compare
- Choose the best for your needs
- Easy rollback if needed
