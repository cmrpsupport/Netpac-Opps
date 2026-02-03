#!/bin/bash

echo "🧹 Repository Cleanup Script"
echo "=============================="
echo ""

# Files to remove
echo "Removing test files..."
find . -maxdepth 1 -name "test_*.html" -delete
find . -maxdepth 1 -name "test_*.js" -delete
find . -maxdepth 1 -name "*_test.html" -delete
find . -maxdepth 1 -name "*_test.js" -delete

echo "Removing debug files..."
find . -maxdepth 1 -name "debug_*.html" -delete
find . -maxdepth 1 -name "debug_*.js" -delete

echo "Removing backup files..."
find . -maxdepth 1 -name "*backup*.sql" -delete
find . -maxdepth 1 -name "*backup*.tar.gz" -delete
find . -maxdepth 1 -name "*.dump" -delete

echo "Removing CSV data files..."
find . -maxdepth 1 -name "*.csv" -delete

echo "Removing SQL migration/test files..."
find . -maxdepth 1 -name "create_*.sql" -delete
find . -maxdepth 1 -name "fix_*.sql" -delete
find . -maxdepth 1 -name "update_*.sql" -delete
find . -maxdepth 1 -name "restore_*.sql" -delete

echo "Removing Python scripts..."
find . -maxdepth 1 -name "*.py" -delete

echo "Removing temporary/verification files..."
rm -f auto_github_backup.sh
rm -f cleanup_debug_logs.js
rm -f clear_storage_test.html
rm -f css_*.html
rm -f csp_*.html
rm -f dashboard_test.html
rm -f deploy.sh
rm -f final_*.html
rm -f live_*.html
rm -f minimal_*.html
rm -f quick_*.html
rm -f comprehensive_*.html
rm -f emergency_*.html
rm -f simple_*.html
rm -f direct_*.html
rm -f auth_*.html
rm -f dev-auth.html

echo "Removing duplicate/old migration scripts..."
rm -f run_*.js
rm -f check_*.js
rm -f analyze_*.js
rm -f clean_*.js
rm -f count_*.js
rm -f overwrite_*.js

echo "Removing old documentation..."
find . -maxdepth 1 -name "*COMPLETE.md" -delete
find . -maxdepth 1 -name "*FIX*.md" -delete
find . -maxdepth 1 -name "*REPORT*.md" -delete
find . -maxdepth 1 -name "*IMPLEMENTATION*.md" -delete

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Remaining files:"
ls -1 | wc -l
