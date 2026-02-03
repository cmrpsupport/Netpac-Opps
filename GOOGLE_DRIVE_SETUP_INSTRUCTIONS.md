# Google Drive Integration Setup Instructions

## Current Status
✅ **Modal closing fixed**: Create opportunity modal now closes after successful submission  
⚠️ **Google Drive folder creation**: Missing credentials and template folder configuration  

## Required Setup Steps

### 1. Google Cloud Service Account Setup

✅ **Service Account Ready**: `cmrp-oppsmon-sync@oppsmon.iam.gserviceaccount.com`

**Download Credentials**:
1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Navigate to Service Accounts**: IAM & Admin > Service Accounts
3. **Find the service account**: `cmrp-oppsmon-sync@oppsmon.iam.gserviceaccount.com`
4. **Click on it**, then go to "Keys" tab
5. **Generate JSON Key**:
   - Click "Add Key" > "Create new key"
   - Choose "JSON" format
   - Download the file
   - **Rename it to `google-drive-credentials.json`**
   - **Place it in the project root directory**

### 2. Configure Shared Drive Access

1. **Share the target folder** with the service account:
   - **Open your shared drive**: https://drive.google.com/drive/folders/0BwLYHtwPeCSpX0ZYU1EwTUhsOEk?resourcekey=0-3m-OlBAKq2SQCj7i4wx0yg&usp=sharing
   - **Click "Share" button** (top right)
   - **Add service account email**: `cmrp-oppsmon-sync@oppsmon.iam.gserviceaccount.com`
   - **Give it "Editor" permissions**
   - **Click "Send"**

2. **Find the template folder**:
   - **Run the template finder script**: `node find_template_folder.js`
   - **Look for folders** named like "CMRPYYMMXXXX-AAA Client-Location-Project Name"
   - **If no template exists**, create one with the desired file/folder structure
   - **Copy the folder ID** and update `.env` with `GOOGLE_DRIVE_TEMPLATE_FOLDER_ID=<folder_id>`

### 3. Update Environment Configuration

Add to your `.env` file:
```bash
# Google Drive Configuration
GOOGLE_DRIVE_ROOT_FOLDER_ID=0BwLYHtwPeCSpX0ZYU1EwTUhsOEk
GOOGLE_DRIVE_TEMPLATE_FOLDER_ID=<your_template_folder_id_here>
GOOGLE_DRIVE_AUTO_SHARE=true
GOOGLE_DRIVE_CREDENTIALS_PATH=./google-drive-credentials.json
```

### 4. Test the Integration

1. **Place the credentials file**: Ensure `google-drive-credentials.json` is in the project root
2. **Restart the server**: `npm start` or restart your development server
3. **Check server logs**: Should see "✅ Google Drive API initialized successfully"
4. **Test folder creation**: Create a new opportunity and check if folder is created

### 5. Troubleshooting

**Common Issues:**
- **Credentials not found**: Ensure file path is correct
- **Permission denied**: Make sure service account has access to the shared folder
- **Template not found**: Verify template folder ID exists and is accessible
- **Folder creation fails**: Check Google Drive API quotas and limits

**Error Logs to Watch:**
- `❌ Failed to initialize Google Drive API`
- `⚠️ Failed to auto-create Drive folder`
- `📋 Duplicating template folder...`
- `✅ Template folder duplicated successfully`

## Current Configuration Status

✅ **Root folder ID configured**: `0BwLYHtwPeCSpX0ZYU1EwTUhsOEk`  
❌ **Template folder ID missing**: Need to find/create template folder  
❌ **Credentials file missing**: Need to create service account and download JSON  
✅ **Code integration complete**: Ready to work once credentials are set up  

## Next Steps

1. **Immediate**: Set up Google Cloud service account and download credentials
2. **Find template**: Locate or create the template folder in the shared drive
3. **Configure**: Update `.env` with template folder ID
4. **Test**: Create a test opportunity to verify folder duplication works

## Fallback Behavior

Currently, if Google Drive setup fails:
- Opportunity creation will still work (database records are saved)
- No folder will be created in Google Drive
- Users see no error (graceful fallback)
- Opportunities can be manually linked to folders later