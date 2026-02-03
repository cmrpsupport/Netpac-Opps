const { google } = require('googleapis');
require('dotenv').config();

const OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/google/calendar/callback'
};

console.log('🔍 OAuth Configuration Diagnostic');
console.log('=====================================');

// Check environment variables
console.log('\n1. Environment Variables:');
console.log(`   CLIENT_ID: ${OAUTH_CONFIG.clientId ? '✅ Set' : '❌ Missing'}`);
console.log(`   CLIENT_SECRET: ${OAUTH_CONFIG.clientSecret ? '✅ Set' : '❌ Missing'}`);
console.log(`   REDIRECT_URI: ${OAUTH_CONFIG.redirectUri}`);

if (!OAUTH_CONFIG.clientId || !OAUTH_CONFIG.clientSecret) {
  console.log('\n❌ Missing OAuth credentials. Please check your .env file.');
  process.exit(1);
}

// Initialize OAuth client
console.log('\n2. OAuth Client Initialization:');
try {
  const oauth2Client = new google.auth.OAuth2(
    OAUTH_CONFIG.clientId,
    OAUTH_CONFIG.clientSecret,
    OAUTH_CONFIG.redirectUri
  );
  console.log('   ✅ OAuth client created successfully');

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]
  });

  console.log('\n3. Generated Auth URL:');
  console.log(`   ${authUrl.substring(0, 100)}...`);
  console.log('   ✅ Auth URL generation successful');

  console.log('\n4. Configuration Check:');
  console.log('   📋 Next Steps:');
  console.log('      1. Verify redirect URI in Google Cloud Console exactly matches:');
  console.log(`         ${OAUTH_CONFIG.redirectUri}`);
  console.log('      2. Ensure Calendar API is enabled in Google Cloud Console');
  console.log('      3. Make sure OAuth consent screen is configured');
  console.log('      4. Try a fresh OAuth flow (don\'t reuse authorization codes)');

} catch (error) {
  console.log(`   ❌ OAuth client initialization failed: ${error.message}`);
  process.exit(1);
}

console.log('\n✅ OAuth configuration appears valid');
console.log('   If you\'re still getting errors, the issue is likely:');
console.log('   - Authorization code already used/expired');
console.log('   - Redirect URI mismatch in Google Cloud Console');
console.log('   - Calendar API not enabled in Google Cloud Console');