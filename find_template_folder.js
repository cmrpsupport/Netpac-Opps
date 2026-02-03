const { google } = require('googleapis');

async function findTemplateFolder() {
    try {
        console.log('🔍 Searching for template folders in shared drive...');
        
        // Initialize Google Drive API
        const auth = new google.auth.GoogleAuth({
            keyFile: './google-drive-credentials.json',
            scopes: ['https://www.googleapis.com/auth/drive']
        });
        
        const drive = google.drive({ version: 'v3', auth });
        
        // List folders in the shared drive
        const rootFolderId = '0BwLYHtwPeCSpX0ZYU1EwTUhsOEk';
        console.log(`📁 Searching in folder: ${rootFolderId}`);
        
        const response = await drive.files.list({
            q: `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
            fields: 'files(id, name, createdTime, modifiedTime)',
            orderBy: 'name'
        });
        
        const folders = response.data.files;
        console.log(`\n📂 Found ${folders.length} folders:\n`);
        
        // Look for potential template folders
        const templateCandidates = [];
        
        folders.forEach((folder, index) => {
            console.log(`${index + 1}. ${folder.name}`);
            console.log(`   ID: ${folder.id}`);
            console.log(`   Created: ${new Date(folder.createdTime).toLocaleDateString()}`);
            console.log(`   Modified: ${new Date(folder.modifiedTime).toLocaleDateString()}`);
            
            // Check if this looks like a template folder
            const namePattern = /CMRP.*[A-Z]{3}.*Client.*Project/i;
            if (namePattern.test(folder.name) || folder.name.includes('template') || folder.name.includes('Template')) {
                templateCandidates.push(folder);
                console.log(`   ⭐ POTENTIAL TEMPLATE FOLDER`);
            }
            console.log('');
        });
        
        if (templateCandidates.length > 0) {
            console.log('🎯 Template folder candidates found:');
            templateCandidates.forEach((folder, index) => {
                console.log(`${index + 1}. ${folder.name} (ID: ${folder.id})`);
            });
            
            console.log('\n📝 To use one of these as template, add to your .env file:');
            console.log(`GOOGLE_DRIVE_TEMPLATE_FOLDER_ID=${templateCandidates[0].id}`);
        } else {
            console.log('❌ No template folders found.');
            console.log('💡 You may need to create a template folder with structure like:');
            console.log('   "CMRPYYMMXXXX-AAA Client-Location-Project Name"');
        }
        
        // Also check for any specific CMRP pattern folders
        console.log('\n🔍 Checking for CMRP-pattern folders...');
        const cmrpFolders = folders.filter(folder => 
            folder.name.match(/CMRP\d{8}\d{3}/i) || folder.name.includes('CMRP')
        );
        
        if (cmrpFolders.length > 0) {
            console.log('📋 CMRP-pattern folders found:');
            cmrpFolders.forEach(folder => {
                console.log(`   • ${folder.name} (ID: ${folder.id})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error accessing Google Drive:', error.message);
        
        if (error.message.includes('ENOENT')) {
            console.log('\n💡 Missing credentials file. Please:');
            console.log('1. Download google-drive-credentials.json from Google Cloud Console');
            console.log('2. Place it in the project root directory');
        }
        
        if (error.message.includes('permission') || error.message.includes('access')) {
            console.log('\n💡 Permission issue. Please:');
            console.log('1. Share the Google Drive folder with: cmrp-oppsmon-sync@oppsmon.iam.gserviceaccount.com');
            console.log('2. Give it "Editor" permissions');
        }
    }
}

// Run the script
findTemplateFolder();