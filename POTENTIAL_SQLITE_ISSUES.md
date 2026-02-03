# PostgreSQL → SQLite Compatibility Issues & Solutions

## Issues Already Fixed ✅

### 1. **NOW() Function**
- ✅ **Fixed**: All `NOW()` converted to `datetime('now')`
- **Impact**: Timestamps in all tables
- **Files**: server.js, all backend routes

### 2. **JSONB Functions**
- ✅ **Fixed**: `JSONB_AGG` → `json_group_array`, `JSONB_BUILD_OBJECT` → `json_object`
- **Impact**: Proposal workbench aggregations
- **Files**: server.js (lines 4862-4888)

### 3. **INTERVAL Syntax**
- ✅ **Fixed**: `INTERVAL '7 days'` → `'-7 days'` with datetime modifiers
- **Impact**: Date range queries
- **Files**: server.js

### 4. **Database Connection**
- ✅ **Fixed**: Using universal db_adapter.js
- **Impact**: All database queries
- **Files**: server.js, all backend routes

---

## Potential Issues to Watch For ⚠️

### 1. **RETURNING * Clause** (5 instances)
**Problem**: SQLite doesn't support `RETURNING *` like PostgreSQL

**Locations**:
- server.js:334 - Notifications
- server.js:1476 - Unknown
- server.js:2549 - Insert opportunities
- server.js:2801 - Update opportunities
- server.js:4682 - Unknown

**Current Status**:
- ❌ Not fully handled - queries may fail silently
- ✅ db_adapter strips `RETURNING *` but doesn't fetch inserted row

**Solution**: Use helper function from `sqlite_compatibility_fixes.js`:
```javascript
const { insertWithReturning } = require('./sqlite_compatibility_fixes');
// Instead of:
const result = await db.query('INSERT ... RETURNING *', params);
// Use:
const row = await insertWithReturning('INSERT ... RETURNING *', params, 'table_name');
```

### 2. **Boolean Values**
**Problem**: SQLite stores booleans as 0/1, PostgreSQL as true/false

**Affected Fields**:
- `is_deleted`
- `is_all_day`
- `is_verified`
- `is_active`

**Current Status**:
- ⚠️ May cause issues when checking `if (row.is_deleted)`
- SQLite returns 0/1, JavaScript expects true/false

**Solution**: The enhanced db_adapter now auto-converts `is_*` fields

### 3. **JSON/JSONB Fields**
**Problem**: SQLite stores JSON as TEXT strings, needs parsing

**Affected Fields**:
- `column_settings` in user_column_preferences
- `roles` in users table
- Any JSONB columns

**Current Status**:
- ⚠️ Need to JSON.parse() when reading
- ⚠️ Need to JSON.stringify() when writing

**Solution**: Auto-conversion in db_adapter for string fields starting with `{` or `[`

### 4. **Array Fields**
**Problem**: PostgreSQL has native arrays, SQLite stores as JSON strings

**Affected Fields**:
- `roles` arrays
- Any TEXT[] columns

**Current Status**:
- ⚠️ May return string instead of array
- ⚠️ Need to parse JSON

**Solution**: Use `fromSQLiteArray()` helper

### 5. **ILIKE (Case-Insensitive Search)**
**Problem**: PostgreSQL has `ILIKE`, SQLite doesn't

**Potential Locations**: Any search functionality

**Current Status**: ❓ Not checked yet

**Solution**: Replace `ILIKE` with `LIKE` and convert both sides to lowercase:
```sql
-- PostgreSQL
WHERE name ILIKE '%search%'

-- SQLite
WHERE LOWER(name) LIKE LOWER('%search%')
```

### 6. **LIMIT vs FETCH**
**Problem**: Different pagination syntax

**Current Status**: ✅ Both support `LIMIT` so no issue

### 7. **String Concatenation**
**Problem**: PostgreSQL uses `||`, SQLite also supports it

**Current Status**: ✅ No issue

### 8. **Date Functions**
**Problem**: Different date function names

**Examples**:
- PostgreSQL: `EXTRACT(YEAR FROM date)`
- SQLite: `strftime('%Y', date)`

**Current Status**: ❓ Need to check if used

---

## Recommended Actions 🔧

### Immediate (Critical)

1. **Test Login Flow** ✅
   - Already testing
   - Check if boolean fields work

2. **Test RETURNING Queries**
   ```bash
   # Test insert opportunity
   # Test update opportunity
   # Check if returned data is correct
   ```

3. **Test JSON Fields**
   ```bash
   # Test column_settings save/load
   # Test roles array
   ```

### Short Term (Important)

4. **Add Error Logging**
   - Enhanced db_adapter already logs errors
   - Monitor Render logs for SQLite errors

5. **Test Each Dashboard**
   - Executive Dashboard
   - Account Manager Dashboard
   - Forecaster Dashboard
   - Win-Loss Dashboard
   - Proposal Workbench

6. **Test CRUD Operations**
   - Create opportunity
   - Update opportunity
   - Delete opportunity
   - Restore opportunity

### Long Term (Nice to Have)

7. **Performance Optimization**
   - SQLite may be slower on complex JOINs
   - Consider adding indexes
   - Monitor query performance

8. **Add Unit Tests**
   - Test db_adapter with both databases
   - Test compatibility helpers

---

## Monitoring Checklist ✅

After deployment, monitor for:

- [ ] Login works
- [ ] Dashboards load data
- [ ] Create opportunity works
- [ ] Update opportunity works
- [ ] Delete/restore works
- [ ] Filters work
- [ ] Search works
- [ ] JSON fields save correctly
- [ ] Date filters work
- [ ] Proposal workbench loads
- [ ] Custom tasks work
- [ ] Notifications work
- [ ] Export to CSV/Excel works

---

## SQLite Advantages ✨

Despite differences, SQLite offers:

- ✅ **Simpler deployment** - No separate database server
- ✅ **Lower latency** - Direct file access
- ✅ **Cost effective** - No database hosting fees
- ✅ **Easy backups** - Just copy the database file
- ✅ **Predictable** - No connection pooling issues

---

## Rollback Plan 🔄

If critical issues arise:

1. Change `DATABASE_URL` back to PostgreSQL in Render environment variables
2. Redeploy - db_adapter auto-detects and uses PostgreSQL
3. All data preserved (SQLite doesn't modify PostgreSQL)

---

## Files Added

- `sqlite_compatibility_fixes.js` - Helper functions for compatibility
- `POTENTIAL_SQLITE_ISSUES.md` - This document

## Next Steps

1. ✅ Deploy CSP fix
2. ⏳ Test login after redeploy
3. ⏳ Test all dashboards
4. ⏳ Monitor for errors in Render logs
5. ⏳ Apply fixes as needed

**Most issues are already handled by db_adapter! 🎉**
