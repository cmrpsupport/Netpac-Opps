# Repository Cleanup Plan

## Files to Remove (238+ files)

### Categories to Clean:

1. **Test Files** (~100 files)
   - test_*.html, test_*.js
   - *_test.html, *_test.js
   - comprehensive_test.html
   - final_test*.html

2. **Debug Files** (~30 files)
   - debug_*.html, debug_*.js
   - auth_debug*.html

3. **Backup/Data Files** (~20 files)
   - *.sql (except migrations/)
   - *.dump
   - *.tar.gz
   - *.csv (data files)
   - postgres_data_export.json (650KB - keep in migrations only)

4. **Python Scripts** (~10 files)
   - *.py files

5. **Old Documentation** (~50 files)
   - *_COMPLETE.md
   - *_FIX*.md
   - *_REPORT*.md
   - Keep only: MIGRATION_COMPLETE.md, SQLITECLOUD_MIGRATION_GUIDE.md, TWO_REPOSITORY_STRATEGY.md

6. **Verification Scripts** (~30 files)
   - verify_*.js, check_*.js, analyze_*.js
   - Keep only: check_sqlitecloud_status.js, verify_migration.js

## Files to KEEP

### Core Application
- server.js
- index.html
- login.html
- All dashboard HTML files
- All .js modules in lib/
- backend/ directory
- migrations/ directory
- assets/

### Migration Tools
- db_adapter.js
- migrate_to_sqlitecloud.js
- import_to_sqlitecloud.js
- clean_import_sqlitecloud.js
- import_remaining_data.js
- check_sqlitecloud_status.js
- verify_migration.js
- sqlite_schema.sql

### Documentation
- README.md (if exists)
- MIGRATION_COMPLETE.md
- SQLITECLOUD_MIGRATION_GUIDE.md
- TWO_REPOSITORY_STRATEGY.md
- GIT_PUSH_INSTRUCTIONS.md
- MIGRATION_SUMMARY.md
- MIGRATION_INSTRUCTIONS.md

### Configuration
- package.json
- .env.example, .env.*.template
- .gitignore
- tailwind.config.js
- postcss.config.js

## Cleanup Commands

Run these from the repository root:

```bash
cd "C:\Users\Lenovo\Documents\GitHub\CMRP-Oppx-SQLiteCloud"

# Remove test files
git rm test_*.html test_*.js *_test.html *_test.js comprehensive_*.html final_test*.html 2>/dev/null

# Remove debug files
git rm debug_*.html debug_*.js auth_debug*.html 2>/dev/null

# Remove backup/data files
git rm *backup*.sql *.dump *.tar.gz 2>/dev/null
git rm cleaned_*.csv processed_*.csv formatted_*.csv incomplete_*.csv 2>/dev/null
git rm "Opportunity_All - 2025.csv" "gsheet sample.csv" 2>/dev/null

# Remove Python files
git rm *.py 2>/dev/null

# Remove old SQL files (not in migrations/)
git rm create_*.sql fix_*.sql update_*.sql restore_*.sql migrate_*.sql opps_*.sql 2>/dev/null

# Remove old documentation
git rm *_COMPLETE.md *_FIX*.md *_REPORT*.md *_SUMMARY.md *_GUIDE*.md *_PLAN.md *_VERIFICATION*.md 2>/dev/null
git restore --staged MIGRATION_COMPLETE.md SQLITECLOUD_MIGRATION_GUIDE.md

# Remove verification scripts
git rm verify_*.js check_*.js analyze_*.js count_*.js quick_*.js manual_*.js 2>/dev/null
git rm fix_*.js overwrite_*.js run_*.js cleanup_*.js clean_*.js 2>/dev/null
git restore --staged check_sqlitecloud_status.js verify_migration.js

# Remove test pages
git rm live_*.html minimal_*.html quick_*.html emergency_*.html simple_*.html 2>/dev/null
git rm direct_*.html css_*.html csp_*.html clear_*.html auto_*.html 2>/dev/null
git rm button_*.html modal_*.html role_*.html security_*.html selective_*.html 2>/dev/null
git rm dashboard_test.html implementation_*.html 2>/dev/null

# Remove temporary scripts
git rm auto_github_backup.sh cleanup_*.js deploy.sh force_deploy.txt 2>/dev/null

# Remove Excel files
git rm "CMRP25050242-PCS001-01 Yokogawa AVEVA PI Systems Annual Sub.xlsx" 2>/dev/null

# Commit the cleanup
git commit -m "Clean up repository: remove test, debug, backup, and temporary files"

# Push to GitHub
git push origin main
```

## After Cleanup

Repository size should reduce significantly:
- Before: ~625 files
- After: ~150-200 files (core application only)

## What You'll Have

A clean repository with only:
- ✅ Working application code
- ✅ Essential migration scripts
- ✅ Core documentation
- ✅ Configuration files
- ❌ No test files
- ❌ No debug files
- ❌ No data dumps
- ❌ No old documentation
