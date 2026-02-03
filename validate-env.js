#!/usr/bin/env node

// Environment Validation Script
// This script validates that all required environment variables are set

require('dotenv').config();

const requiredVars = [
    'NODE_ENV',
    'JWT_SECRET',
    'PORT',
    'FRONTEND_URL',
    'API_BASE_URL'
];

const optionalVars = [
    'APP_NAME',
    'VERSION'
];

console.log('🔍 Environment Validation');
console.log('========================');
console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`);
console.log('');

let missingVars = [];
let validVars = [];

// Check required variables
requiredVars.forEach(varName => {
    if (process.env[varName]) {
        validVars.push(varName);
        // Don't log sensitive values
        if (varName.includes('SECRET') || varName.includes('PASSWORD')) {
            console.log(`✅ ${varName}: [HIDDEN]`);
        } else {
            console.log(`✅ ${varName}: ${process.env[varName]}`);
        }
    } else if (varName === 'PORT' && process.env.NODE_ENV === 'production') {
        // PORT can be empty in production (Render sets it automatically)
        validVars.push(varName);
        console.log(`✅ ${varName}: (will be set by Render)`);
    } else {
        missingVars.push(varName);
        console.log(`❌ ${varName}: NOT SET`);
    }
});

// Check optional variables
console.log('\n📋 Optional Variables:');
optionalVars.forEach(varName => {
    if (process.env[varName]) {
        console.log(`✅ ${varName}: ${process.env[varName]}`);
    } else {
        console.log(`⚠️  ${varName}: not set (optional)`);
    }
});

console.log('\n📊 Summary:');
console.log(`✅ Valid required variables: ${validVars.length}/${requiredVars.length}`);

if (missingVars.length > 0) {
    console.log(`❌ Missing required variables: ${missingVars.join(', ')}`);
    console.log('\n🔧 Fix by updating your .env file or environment variables');
    process.exit(1);
} else {
    console.log('🎉 All required environment variables are set!');
    
    // Additional checks
    if (process.env.NODE_ENV === 'production') {
        console.log('\n🚀 Production Environment Checks:');
        
        if (process.env.JWT_SECRET === 'dev-secret-key-for-local-development') {
            console.log('⚠️  WARNING: Using development JWT secret in production!');
        }
        
        if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.includes('localhost')) {
            console.log('⚠️  WARNING: Frontend URL contains localhost in production!');
        }
    }
    
    process.exit(0);
}
