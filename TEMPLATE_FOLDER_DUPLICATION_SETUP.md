# Template Folder Duplication Setup Guide

## Overview
The app now automatically duplicates a template Google Drive folder whenever a new opportunity is created. The duplicated folder is renamed using the format: `[Project Code]-[Username] [Client Name] [Project Name]`

## Setup Instructions

### 1. Configure Environment Variables
Add the following to your `.env` file:

```bash
# Template folder ID for duplication (the CMRPYYMMXXXX-AAA folder)
GOOGLE_DRIVE_TEMPLATE_FOLDER_ID=your_template_folder_id_here

# Optional: Root folder where new folders should be created
GOOGLE_DRIVE_ROOT_FOLDER_ID=your_shared_folder_id_here

# Optional: Auto-share created folders
GOOGLE_DRIVE_AUTO_SHARE=true
```

### 2. Get Your Template Folder ID
1. Navigate to your "CMRPYYMMXXXX-AAA Client-Location-Project Name" folder in Google Drive
2. Look at the URL: `https://drive.google.com/drive/folders/[FOLDER_ID]`
3. Copy the FOLDER_ID and add it to your `.env` file

### 3. Verify Google Drive Credentials
Ensure your `google-drive-credentials.json` file is in the project root with proper service account credentials.

## How It Works

### Automatic Process
1. User creates a new opportunity through the web interface
2. System saves the opportunity to the database
3. System automatically duplicates the template folder
4. New folder is renamed to: `[Project Code]-[Username] [Client Name] [Project Name]`
5. All files and subfolders from the template are copied
6. Database is updated with the new folder information

### Folder Naming Examples
- Template: `CMRPYYMMXXXX-AAA Client-Location-Project Name`
- New folder: `CMRP240815001-John Smith ABC Corp New Office Project`
- New folder: `PROJ2024-Jane Doe XYZ Inc Website Redesign`

### Fallback Behavior
- If template folder is not configured, creates an empty folder
- If template duplication fails, falls back to regular folder creation
- Opportunity creation continues even if folder creation fails

## Features

### Template Duplication
- Copies all files and folders from the template
- Maintains folder structure
- Preserves file permissions and sharing settings
- Recursive copying of nested folders

### Smart Naming
- Uses actual username from login token
- Cleans invalid characters for folder names
- Limits length to 100 characters
- Format: `[Project Code]-[Username] [Client Name] [Project Name]`

### Error Handling
- Graceful fallback if template is missing
- Continues opportunity creation if Drive folder fails
- Logs detailed error messages for troubleshooting

## Configuration Options

### Environment Variables
- `GOOGLE_DRIVE_TEMPLATE_FOLDER_ID`: Template folder to duplicate
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`: Parent folder for organization
- `GOOGLE_DRIVE_AUTO_SHARE`: Auto-share new folders (true/false)
- `GOOGLE_DRIVE_CREDENTIALS_PATH`: Path to service account credentials

### Folder Structure
The system can organize folders by year and client:
- Root folder > Year folder > Client folder > Project folder
- Configurable in `google_drive_service.js`

## Troubleshooting

### Common Issues
1. **Credentials Error**: Ensure `google-drive-credentials.json` exists and has proper permissions
2. **Template Not Found**: Verify the template folder ID in `.env`
3. **Permission Denied**: Check service account has access to template folder
4. **Folder Creation Fails**: Check Google Drive API quotas and limits

### Testing
Run the Google Drive service directly to test configuration:
```bash
node google_drive_service.js
```

### Logs
Check server logs for detailed information about folder creation:
- `📋 Duplicating template folder...`
- `✅ Template folder duplicated successfully`
- `⚠️ Failed to auto-create Drive folder...`

## Benefits
- Consistent folder structure for all opportunities
- Automatic setup of template documents/files
- Standardized naming convention
- Seamless integration with existing workflow
- No additional user action required