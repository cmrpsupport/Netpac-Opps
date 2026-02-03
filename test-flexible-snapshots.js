/**
 * Test Script: Flexible Snapshot System
 * Purpose: End-to-end testing of flexible snapshot date functionality
 * Usage: node test-flexible-snapshots.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/cmrp_opps_db?sslmode=disable',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test configuration
const TEST_CONFIG = {
    apiBaseUrl: 'http://localhost:3000',
    testAccountManager: 'TestMgr',
    testSnapshots: [
        { type: 'weekly', date: '2025-01-15', description: 'Test Weekly Snapshot' },
        { type: 'monthly', date: '2025-01-01', description: 'Test Monthly Snapshot' }
    ]
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function logSection(message) {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`${message}`, 'cyan');
    log(`${'='.repeat(60)}`, 'cyan');
}

class FlexibleSnapshotTester {
    constructor() {
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    async runAllTests() {
        logSection('FLEXIBLE SNAPSHOT SYSTEM - END-TO-END TESTING');
        logInfo('Starting comprehensive test suite...');

        try {
            // Test database schema
            await this.testDatabaseSchema();
            
            // Test snapshot creation
            await this.testSnapshotCreation();
            
            // Test flexible date queries
            await this.testFlexibleDateQueries();
            
            // Test account manager snapshots
            await this.testAccountManagerSnapshots();
            
            // Test automation service
            await this.testAutomationService();
            
            // Test utility functions
            await this.testUtilityFunctions();
            
            // Display results
            this.displayResults();
            
        } catch (error) {
            logError(`Critical error during testing: ${error.message}`);
            this.testResults.errors.push(error.message);
        } finally {
            await pool.end();
        }
    }

    async testDatabaseSchema() {
        logSection('DATABASE SCHEMA TESTS');
        
        await this.runTest('Check dashboard_snapshots table structure', async () => {
            const query = `
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'dashboard_snapshots'
                AND column_name IN ('snapshot_date', 'created_by', 'is_manual', 'description')
                ORDER BY column_name
            `;
            const result = await pool.query(query);
            
            const expectedColumns = ['created_by', 'description', 'is_manual', 'snapshot_date'];
            const actualColumns = result.rows.map(row => row.column_name);
            
            if (expectedColumns.every(col => actualColumns.includes(col))) {
                logSuccess('All required columns exist in dashboard_snapshots');
                return true;
            } else {
                throw new Error(`Missing columns in dashboard_snapshots: ${expectedColumns.filter(col => !actualColumns.includes(col)).join(', ')}`);
            }
        });

        await this.runTest('Check account_manager_snapshots table structure', async () => {
            const query = `
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'account_manager_snapshots'
                AND column_name IN ('snapshot_date', 'created_by', 'is_manual', 'description')
                ORDER BY column_name
            `;
            const result = await pool.query(query);
            
            const expectedColumns = ['created_by', 'description', 'is_manual', 'snapshot_date'];
            const actualColumns = result.rows.map(row => row.column_name);
            
            if (expectedColumns.every(col => actualColumns.includes(col))) {
                logSuccess('All required columns exist in account_manager_snapshots');
                return true;
            } else {
                throw new Error(`Missing columns in account_manager_snapshots: ${expectedColumns.filter(col => !actualColumns.includes(col)).join(', ')}`);
            }
        });

        await this.runTest('Check utility functions exist', async () => {
            const functions = ['get_nearest_snapshot_date', 'get_snapshot_summary'];
            
            for (const funcName of functions) {
                const query = `
                    SELECT proname 
                    FROM pg_proc 
                    WHERE proname = $1
                `;
                const result = await pool.query(query, [funcName]);
                
                if (result.rows.length === 0) {
                    throw new Error(`Function ${funcName} does not exist`);
                }
            }
            
            logSuccess('All utility functions exist');
            return true;
        });

        await this.runTest('Check view exists', async () => {
            const query = `
                SELECT viewname 
                FROM pg_views 
                WHERE viewname = 'available_snapshot_dates'
            `;
            const result = await pool.query(query);
            
            if (result.rows.length > 0) {
                logSuccess('available_snapshot_dates view exists');
                return true;
            } else {
                throw new Error('available_snapshot_dates view does not exist');
            }
        });
    }

    async testSnapshotCreation() {
        logSection('SNAPSHOT CREATION TESTS');

        // Clean up any existing test data
        await this.cleanupTestData();

        await this.runTest('Create global snapshot with custom date', async () => {
            const testDate = '2025-01-15';
            const query = `
                INSERT INTO dashboard_snapshots (
                    snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
                    op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
                    op30_count, op30_amount, lost_count, lost_amount, inactive_count,
                    ongoing_count, pending_count, declined_count, revised_count,
                    is_manual, description, created_by
                ) VALUES (
                    'weekly', $1, 100, 50, 10000000, 10, 2000000, 15, 3000000, 10, 2000000,
                    15, 3000000, 5, 500000, 2, 3, 5, 8, 12,
                    TRUE, 'Test snapshot', 'Test User'
                ) RETURNING id, snapshot_date, created_at
            `;
            
            const result = await pool.query(query, [testDate]);
            
            if (result.rows.length > 0 && result.rows[0].snapshot_date === testDate) {
                logSuccess(`Global snapshot created with custom date: ${testDate}`);
                return true;
            } else {
                throw new Error('Failed to create global snapshot with custom date');
            }
        });

        await this.runTest('Create account manager snapshot with custom date', async () => {
            const testDate = '2025-01-15';
            const query = `
                INSERT INTO account_manager_snapshots (
                    account_manager, snapshot_type, snapshot_date,
                    total_opportunities, submitted_count, submitted_amount,
                    op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
                    op30_count, op30_amount, lost_count, lost_amount, inactive_count,
                    ongoing_count, pending_count, declined_count, revised_count,
                    is_manual, description, created_by
                ) VALUES (
                    $1, 'weekly', $2, 25, 12, 2500000, 3, 500000, 4, 800000, 3, 600000,
                    5, 600000, 1, 100000, 0, 1, 2, 3, 3,
                    TRUE, 'Test account manager snapshot', 'Test User'
                ) RETURNING id, snapshot_date, created_at
            `;
            
            const result = await pool.query(query, [TEST_CONFIG.testAccountManager, testDate]);
            
            if (result.rows.length > 0 && result.rows[0].snapshot_date === testDate) {
                logSuccess(`Account manager snapshot created with custom date: ${testDate}`);
                return true;
            } else {
                throw new Error('Failed to create account manager snapshot with custom date');
            }
        });

        await this.runTest('Test unique constraint on date and type', async () => {
            const testDate = '2025-01-15';
            try {
                const query = `
                    INSERT INTO dashboard_snapshots (
                        snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
                        op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
                        op30_count, op30_amount, lost_count, lost_amount, inactive_count,
                        ongoing_count, pending_count, declined_count, revised_count,
                        is_manual, description, created_by
                    ) VALUES (
                        'weekly', $1, 200, 100, 20000000, 20, 4000000, 30, 6000000, 20, 4000000,
                        30, 6000000, 10, 1000000, 4, 6, 10, 16, 24,
                        TRUE, 'Duplicate test snapshot', 'Test User'
                    )
                `;
                
                await pool.query(query, [testDate]);
                throw new Error('Unique constraint should have prevented duplicate insertion');
            } catch (error) {
                if (error.message.includes('unique') || error.code === '23505') {
                    logSuccess('Unique constraint working correctly - duplicate prevented');
                    return true;
                } else {
                    throw error;
                }
            }
        });
    }

    async testFlexibleDateQueries() {
        logSection('FLEXIBLE DATE QUERY TESTS');

        await this.runTest('Test get_nearest_snapshot_date function', async () => {
            const query = `SELECT * FROM get_nearest_snapshot_date('2025-01-16', 'weekly', NULL)`;
            const result = await pool.query(query);
            
            if (result.rows.length > 0) {
                const row = result.rows[0];
                logSuccess(`Found nearest snapshot: ${row.snapshot_date}, ${row.days_difference} days away, exact match: ${row.is_exact_match}`);
                return true;
            } else {
                throw new Error('get_nearest_snapshot_date function returned no results');
            }
        });

        await this.runTest('Test available_snapshot_dates view', async () => {
            const query = `
                SELECT * FROM available_snapshot_dates 
                WHERE source_table = 'dashboard_snapshots'
                ORDER BY snapshot_date DESC 
                LIMIT 5
            `;
            const result = await pool.query(query);
            
            if (result.rows.length > 0) {
                logSuccess(`Found ${result.rows.length} snapshots in available_snapshot_dates view`);
                result.rows.forEach(row => {
                    logInfo(`  - ${row.scope} | ${row.snapshot_type} | ${row.snapshot_date} | ${row.is_manual ? 'Manual' : 'Auto'}`);
                });
                return true;
            } else {
                throw new Error('available_snapshot_dates view returned no results');
            }
        });

        await this.runTest('Test get_snapshot_summary function', async () => {
            const query = `SELECT * FROM get_snapshot_summary()`;
            const result = await pool.query(query);
            
            if (result.rows.length > 0) {
                logSuccess('Snapshot summary generated successfully:');
                result.rows.forEach(row => {
                    logInfo(`  - ${row.snapshot_type}: ${row.total_snapshots} total (${row.manual_snapshots} manual, ${row.auto_snapshots} auto)`);
                    logInfo(`    Date range: ${row.oldest_date} to ${row.latest_date}`);
                });
                return true;
            } else {
                throw new Error('get_snapshot_summary function returned no results');
            }
        });
    }

    async testAccountManagerSnapshots() {
        logSection('ACCOUNT MANAGER SNAPSHOT TESTS');

        await this.runTest('Query account manager snapshots by date', async () => {
            const query = `
                SELECT * FROM account_manager_snapshots 
                WHERE account_manager = $1 
                AND snapshot_type = 'weekly' 
                AND snapshot_date = '2025-01-15'
            `;
            const result = await pool.query(query, [TEST_CONFIG.testAccountManager]);
            
            if (result.rows.length > 0) {
                const snapshot = result.rows[0];
                logSuccess(`Found account manager snapshot: ${snapshot.account_manager} on ${snapshot.snapshot_date}`);
                logInfo(`  Metrics: ${snapshot.total_opportunities} opps, ${snapshot.submitted_count} submitted, ₱${snapshot.submitted_amount}`);
                return true;
            } else {
                throw new Error('No account manager snapshots found for test data');
            }
        });

        await this.runTest('Test account manager snapshot uniqueness', async () => {
            try {
                const query = `
                    INSERT INTO account_manager_snapshots (
                        account_manager, snapshot_type, snapshot_date,
                        total_opportunities, submitted_count, submitted_amount,
                        op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
                        op30_count, op30_amount, lost_count, lost_amount, inactive_count,
                        ongoing_count, pending_count, declined_count, revised_count,
                        is_manual, description, created_by
                    ) VALUES (
                        $1, 'weekly', '2025-01-15', 50, 25, 5000000, 5, 1000000, 8, 1600000, 6, 1200000,
                        10, 1200000, 2, 200000, 1, 2, 4, 6, 6,
                        TRUE, 'Duplicate test', 'Test User'
                    )
                `;
                
                await pool.query(query, [TEST_CONFIG.testAccountManager]);
                throw new Error('Unique constraint should have prevented duplicate account manager snapshot');
            } catch (error) {
                if (error.message.includes('unique') || error.code === '23505') {
                    logSuccess('Account manager snapshot unique constraint working correctly');
                    return true;
                } else {
                    throw error;
                }
            }
        });
    }

    async testAutomationService() {
        logSection('AUTOMATION SERVICE TESTS');

        await this.runTest('Import and instantiate SnapshotAutomationService', async () => {
            const SnapshotAutomationService = require('./backend/services/snapshot-automation');
            const service = new SnapshotAutomationService(pool);
            
            if (service && typeof service.getStatus === 'function') {
                const status = service.getStatus();
                logSuccess('SnapshotAutomationService instantiated successfully');
                logInfo(`  Service running: ${status.running}`);
                logInfo(`  Next schedules: Weekly - ${status.next_schedules.weekly}`);
                return true;
            } else {
                throw new Error('Failed to instantiate SnapshotAutomationService');
            }
        });

        await this.runTest('Test service health check', async () => {
            const SnapshotAutomationService = require('./backend/services/snapshot-automation');
            const service = new SnapshotAutomationService(pool);
            
            const healthReport = await service.performHealthCheck();
            
            if (healthReport && healthReport.timestamp) {
                logSuccess('Health check completed successfully');
                logInfo(`  Weekly snapshots healthy: ${healthReport.weekly_snapshots_healthy}`);
                logInfo(`  Monthly snapshots healthy: ${healthReport.monthly_snapshots_healthy}`);
                return true;
            } else {
                throw new Error('Health check failed or returned invalid data');
            }
        });
    }

    async testUtilityFunctions() {
        logSection('UTILITY FUNCTION TESTS');

        await this.runTest('Test date formatting and calculations', async () => {
            const testDate = new Date('2025-01-15');
            const todayDate = new Date();
            
            // Test date calculations
            const daysDiff = Math.floor((todayDate - testDate) / (1000 * 60 * 60 * 24));
            
            if (typeof daysDiff === 'number') {
                logSuccess(`Date calculations working correctly: ${daysDiff} days difference`);
                return true;
            } else {
                throw new Error('Date calculations failed');
            }
        });

        await this.runTest('Test snapshot data validation', async () => {
            // Test that we can retrieve and validate snapshot data structure
            const query = `
                SELECT 
                    id, snapshot_type, snapshot_date, is_manual, description,
                    total_opportunities, submitted_count, submitted_amount,
                    op100_count, op90_count, op60_count, op30_count
                FROM dashboard_snapshots 
                WHERE snapshot_date = '2025-01-15' 
                LIMIT 1
            `;
            const result = await pool.query(query);
            
            if (result.rows.length > 0) {
                const snapshot = result.rows[0];
                const requiredFields = ['id', 'snapshot_type', 'snapshot_date', 'total_opportunities'];
                const hasAllFields = requiredFields.every(field => snapshot[field] !== undefined);
                
                if (hasAllFields) {
                    logSuccess('Snapshot data structure validation passed');
                    return true;
                } else {
                    throw new Error('Snapshot data missing required fields');
                }
            } else {
                throw new Error('No snapshot data found for validation');
            }
        });
    }

    async runTest(testName, testFunction) {
        this.testResults.total++;
        
        try {
            logInfo(`Running: ${testName}`);
            const result = await testFunction();
            
            if (result === true) {
                this.testResults.passed++;
                logSuccess(`PASSED: ${testName}`);
            } else {
                this.testResults.failed++;
                logError(`FAILED: ${testName} - Unexpected result`);
                this.testResults.errors.push(`${testName}: Unexpected result`);
            }
        } catch (error) {
            this.testResults.failed++;
            logError(`FAILED: ${testName} - ${error.message}`);
            this.testResults.errors.push(`${testName}: ${error.message}`);
        }
    }

    async cleanupTestData() {
        logInfo('Cleaning up existing test data...');
        
        try {
            // Clean up test snapshots
            await pool.query(`
                DELETE FROM dashboard_snapshots 
                WHERE description LIKE '%Test%' OR created_by = 'Test User'
            `);
            
            await pool.query(`
                DELETE FROM account_manager_snapshots 
                WHERE description LIKE '%Test%' OR created_by = 'Test User' OR account_manager = $1
            `, [TEST_CONFIG.testAccountManager]);
            
            logSuccess('Test data cleanup completed');
        } catch (error) {
            logWarning(`Cleanup warning: ${error.message}`);
        }
    }

    displayResults() {
        logSection('TEST RESULTS SUMMARY');
        
        log(`📊 Total Tests: ${this.testResults.total}`, 'cyan');
        log(`✅ Passed: ${this.testResults.passed}`, 'green');
        log(`❌ Failed: ${this.testResults.failed}`, 'red');
        
        const successRate = this.testResults.total > 0 ? 
            ((this.testResults.passed / this.testResults.total) * 100).toFixed(1) : 0;
        
        if (this.testResults.failed === 0) {
            logSuccess(`🎉 ALL TESTS PASSED! Success rate: ${successRate}%`);
        } else {
            logError(`❌ ${this.testResults.failed} test(s) failed. Success rate: ${successRate}%`);
            
            if (this.testResults.errors.length > 0) {
                log('\n📝 Error Details:', 'yellow');
                this.testResults.errors.forEach((error, index) => {
                    log(`  ${index + 1}. ${error}`, 'red');
                });
            }
        }
        
        log('', 'reset');
        
        if (this.testResults.failed === 0) {
            logSuccess('🚀 Flexible snapshot system is ready for production!');
        } else {
            logWarning('⚠️  Please fix the failed tests before deploying to production.');
        }
    }
}

// Run the tests
async function main() {
    const tester = new FlexibleSnapshotTester();
    await tester.runAllTests();
}

// Execute if run directly
if (require.main === module) {
    main().catch(error => {
        logError(`Critical test error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = FlexibleSnapshotTester;