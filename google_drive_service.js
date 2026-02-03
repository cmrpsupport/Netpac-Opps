const { google } = require('googleapis');
const { Pool } = require('pg');
require('dotenv').config();

// Database connection using existing configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://cmrp_user:cmrp0601@100.118.59.44:5432/cmrp_opps_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Set search path for all new connections
pool.on('connect', (client) => {
  client.query('SET search_path TO public');
});

// Configuration
const GOOGLE_DRIVE_CONFIG = {
  // Service account credentials file path for Google Drive
  credentialsPath: process.env.GOOGLE_DRIVE_CREDENTIALS_PATH || './google-drive-credentials.json',
  
  // Root folder for CMRP opportunities (can be configured)
  rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null, // Set this in .env for organization
  
  // Template folder for duplication (CMRPYYMMXXXX-AAA Client-Location-Project Name)
  templateFolderId: process.env.GOOGLE_DRIVE_TEMPLATE_FOLDER_ID || null,
  
  // OP100 folder where completed/awarded opportunities are moved
  op100FolderId: process.env.GOOGLE_DRIVE_OP100_FOLDER_ID || '0BwLYHtwPeCSpZzRmd0ZONlVTWjA',
  
  // Default folder structure
  folderStructure: {
    byYear: false,
    byClient: false,
    byStatus: false
  }
};

class GoogleDriveService {
  constructor() {
    this.auth = null;
    this.drive = null;
  }

  async initialize() {
    try {
      console.log('🔑 Initializing Google Drive API...');
      
      // Check if we have environment variables for service account
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      
      let authConfig;
      
      if (serviceAccountKey) {
        console.log('🔑 Using service account key from environment variables');
        // Parse the service account key from environment variable
        const credentials = JSON.parse(serviceAccountKey);
        
        authConfig = {
          credentials: credentials,
          scopes: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.metadata'
          ]
        };
      } else {
        console.log('🔑 Using keyFile from local credentials path');
        // Fallback to keyFile for local development
        authConfig = {
          keyFile: GOOGLE_DRIVE_CONFIG.credentialsPath,
          scopes: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.metadata'
          ]
        };
      }
      
      // Use GoogleAuth with the determined configuration
      this.auth = new google.auth.GoogleAuth(authConfig);
      
      // Create Drive API client
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      
      // Test the authentication
      await this.auth.getClient();
      
      console.log('✅ Google Drive API initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive API:', error.message);
      if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
        console.error('💡 Hint: Make sure GOOGLE_SERVICE_ACCOUNT_KEY environment variable is set in production');
      }
      return false;
    }
  }

  async createFolderForOpportunity(opportunityData, createdBy = 'SYSTEM') {
    try {
      if (!this.drive) {
        throw new Error('Google Drive API not initialized');
      }

      console.log(`📁 Creating Drive folder for opportunity: ${opportunityData.project_name}`);

      // Generate folder name from opportunity data
      const folderName = this.generateFolderName(opportunityData, createdBy);
      
      // Determine parent folder
      const parentFolderId = await this.getOrCreateParentFolder(opportunityData);
      
      // Create the folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const response = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      const folder = response.data;
      console.log(`✅ Created folder: ${folder.name} (ID: ${folder.id})`);

      // Set folder permissions (optional - make it accessible to organization)
      await this.setFolderPermissions(folder.id);

      // Update database with folder information
      await this.updateOpportunityWithFolder(opportunityData.uid, {
        folderId: folder.id,
        folderUrl: folder.webViewLink,
        folderName: folder.name,
        createdBy: createdBy
      });

      return {
        id: folder.id,
        name: folder.name,
        url: folder.webViewLink,
        success: true
      };

    } catch (error) {
      console.error('❌ Failed to create Drive folder:', error.message);
      throw error;
    }
  }

  async linkExistingFolder(opportunityUid, folderId, linkedBy = 'USER') {
    try {
      if (!this.drive) {
        throw new Error('Google Drive API not initialized');
      }

      console.log(`🔗 Linking existing folder ${folderId} to opportunity ${opportunityUid}`);

      // Get folder information from Drive
      const response = await this.drive.files.get({
        fileId: folderId,
        fields: 'id, name, webViewLink, mimeType'
      });

      const folder = response.data;
      
      // Verify it's actually a folder
      if (folder.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('The provided ID is not a folder');
      }

      // Update database with folder information
      await this.updateOpportunityWithFolder(opportunityUid, {
        folderId: folder.id,
        folderUrl: folder.webViewLink,
        folderName: folder.name,
        createdBy: linkedBy
      });

      console.log(`✅ Linked folder: ${folder.name}`);

      return {
        id: folder.id,
        name: folder.name,
        url: folder.webViewLink,
        success: true
      };

    } catch (error) {
      console.error('❌ Failed to link folder:', error.message);
      throw error;
    }
  }

  async unlinkFolder(opportunityUid, unlinkedBy = 'USER', deleteFolder = false) {
    try {
      const client = await pool.connect();
      
      try {
        // Get current folder information
        const result = await client.query(
          'SELECT google_drive_folder_id, google_drive_folder_name FROM opps_monitoring WHERE uid = $1',
          [opportunityUid]
        );

        if (result.rows.length === 0) {
          throw new Error('Opportunity not found');
        }

        const folderId = result.rows[0].google_drive_folder_id;
        const folderName = result.rows[0].google_drive_folder_name;

        if (!folderId) {
          throw new Error('No folder linked to this opportunity');
        }

        // Optionally delete the folder from Drive
        if (deleteFolder && this.drive) {
          try {
            await this.drive.files.delete({ fileId: folderId });
            console.log(`🗑️ Deleted folder from Drive: ${folderName}`);
          } catch (driveError) {
            console.warn(`⚠️ Could not delete folder from Drive: ${driveError.message}`);
          }
        }

        // Clear folder information from database
        await client.query(
          `UPDATE opps_monitoring 
           SET google_drive_folder_id = NULL,
               google_drive_folder_url = NULL,
               google_drive_folder_name = NULL,
               drive_folder_created_by = $2
           WHERE uid = $1`,
          [opportunityUid, unlinkedBy]
        );

        console.log(`✅ Unlinked folder from opportunity: ${opportunityUid}`);

        return { success: true, deleted: deleteFolder };

      } finally {
        client.release();
      }

    } catch (error) {
      console.error('❌ Failed to unlink folder:', error.message);
      throw error;
    }
  }

  generateFolderName(opportunityData, createdBy = 'Unknown User') {
    // Generate folder name in format: [Project Code]-[Username] [Project Name]
    const projectCode = opportunityData.project_code || 'NO_CODE';
    const projectName = opportunityData.project_name || 'Unnamed Project';
    const username = createdBy || 'Unknown User';
    
    // Clean the name for folder usage (remove invalid characters)
    const cleanName = `${projectCode}-${username} ${projectName}`
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // Keep reasonable length

    return cleanName;
  }

  async getOrCreateParentFolder(opportunityData) {
    try {
      if (!GOOGLE_DRIVE_CONFIG.rootFolderId) {
        return null; // Use Drive root
      }

      let parentFolderId = GOOGLE_DRIVE_CONFIG.rootFolderId;

      // Create year-based structure if enabled
      if (GOOGLE_DRIVE_CONFIG.folderStructure.byYear) {
        const year = new Date().getFullYear().toString();
        parentFolderId = await this.getOrCreateSubfolder(parentFolderId, year);
      }

      // Create client-based structure if enabled
      if (GOOGLE_DRIVE_CONFIG.folderStructure.byClient && opportunityData.client) {
        const clientFolder = opportunityData.client.replace(/[<>:"/\\|?*]/g, '_');
        parentFolderId = await this.getOrCreateSubfolder(parentFolderId, clientFolder);
      }

      return parentFolderId;

    } catch (error) {
      console.warn(`⚠️ Could not create parent folder structure: ${error.message}`);
      return GOOGLE_DRIVE_CONFIG.rootFolderId; // Fallback to root
    }
  }

  async getOrCreateSubfolder(parentId, folderName) {
    try {
      // First, check if folder already exists
      const searchResponse = await this.drive.files.list({
        q: `parents in '${parentId}' and mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
        fields: 'files(id, name)'
      });

      if (searchResponse.data.files.length > 0) {
        return searchResponse.data.files[0].id;
      }

      // Create the folder if it doesn't exist
      const createResponse = await this.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        },
        fields: 'id'
      });

      return createResponse.data.id;

    } catch (error) {
      console.warn(`⚠️ Could not create subfolder ${folderName}: ${error.message}`);
      return parentId; // Return parent as fallback
    }
  }

  async setFolderPermissions(folderId) {
    try {
      // Set folder to be viewable by anyone with the link (optional)
      // You may want to customize this based on your organization's needs
      if (process.env.GOOGLE_DRIVE_AUTO_SHARE === 'true') {
        await this.drive.permissions.create({
          fileId: folderId,
          resource: {
            role: 'reader',
            type: 'anyone'
          }
        });
        console.log(`🔓 Set folder permissions to public viewing`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not set folder permissions: ${error.message}`);
    }
  }

  async updateOpportunityWithFolder(opportunityUid, folderData) {
    const client = await pool.connect();
    
    try {
      await client.query(
        `UPDATE opps_monitoring 
         SET google_drive_folder_id = $1,
             google_drive_folder_url = $2,
             google_drive_folder_name = $3,
             drive_folder_created_at = CURRENT_TIMESTAMP,
             drive_folder_created_by = $4
         WHERE uid = $5`,
        [
          folderData.folderId,
          folderData.folderUrl,
          folderData.folderName,
          folderData.createdBy,
          opportunityUid
        ]
      );

      console.log(`✅ Updated opportunity ${opportunityUid} with folder information`);

    } catch (error) {
      console.error('❌ Failed to update opportunity with folder data:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async getFolderInfo(folderId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive API not initialized');
      }

      const response = await this.drive.files.get({
        fileId: folderId,
        fields: 'id, name, webViewLink, createdTime, modifiedTime, size'
      });

      return response.data;

    } catch (error) {
      console.error('❌ Failed to get folder info:', error.message);
      throw error;
    }
  }

  async listOpportunitiesWithFolders() {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT 
          uid,
          project_code,
          project_name,
          client,
          google_drive_folder_id,
          google_drive_folder_url,
          google_drive_folder_name,
          drive_folder_created_at,
          drive_folder_created_by
        FROM opps_monitoring 
        WHERE google_drive_folder_id IS NOT NULL
        ORDER BY drive_folder_created_at DESC
      `);

      return result.rows;

    } catch (error) {
      console.error('❌ Failed to list opportunities with folders:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  async validateFolderAccess(folderId) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      await this.drive.files.get({
        fileId: folderId,
        fields: 'id'
      });

      return { valid: true };

    } catch (error) {
      return { 
        valid: false, 
        error: error.message.includes('File not found') ? 'Folder not found or access denied' : error.message 
      };
    }
  }

  async searchFolders(searchQuery, maxResults = 10, includeOP100Folder = false) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      console.log(`🔍 Searching for folders matching: "${searchQuery}"`);

      const allFolders = [];

      // Search globally for folders containing the search query
      const globalSearchResponse = await this.drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name contains '${searchQuery}' and trashed=false`,
        fields: 'files(id, name, webViewLink, createdTime, parents)',
        pageSize: maxResults,
        orderBy: 'modifiedTime desc'
      });

      allFolders.push(...(globalSearchResponse.data.files || []));

      // If includeOP100Folder is true or we have the OP100 folder configured, also search specifically in OP100 folder
      if ((includeOP100Folder || GOOGLE_DRIVE_CONFIG.op100FolderId) && GOOGLE_DRIVE_CONFIG.op100FolderId) {
        console.log(`🔍 Also searching in OP100 folder for: "${searchQuery}"`);
        
        try {
          const op100SearchResponse = await this.drive.files.list({
            q: `parents in '${GOOGLE_DRIVE_CONFIG.op100FolderId}' and mimeType='application/vnd.google-apps.folder' and name contains '${searchQuery}' and trashed=false`,
            fields: 'files(id, name, webViewLink, createdTime, parents)',
            pageSize: maxResults,
            orderBy: 'modifiedTime desc'
          });

          const op100Folders = op100SearchResponse.data.files || [];
          console.log(`📁 Found ${op100Folders.length} matching folders in OP100 folder`);
          
          // Add OP100 indicator to these folders
          const markedOP100Folders = op100Folders.map(folder => ({
            ...folder,
            isInOP100Folder: true,
            location: 'OP100 Folder'
          }));
          
          allFolders.push(...markedOP100Folders);
        } catch (op100Error) {
          console.warn(`⚠️ Failed to search in OP100 folder: ${op100Error.message}`);
        }
      }

      // Remove duplicates based on folder ID
      const uniqueFolders = allFolders.filter((folder, index, self) => 
        index === self.findIndex(f => f.id === folder.id)
      );

      console.log(`📁 Found ${uniqueFolders.length} total matching folders`);

      return uniqueFolders.map(folder => ({
        id: folder.id,
        name: folder.name,
        url: folder.webViewLink,
        createdTime: folder.createdTime,
        parents: folder.parents,
        isInOP100Folder: folder.isInOP100Folder || false,
        location: folder.location || 'Drive'
      })).slice(0, maxResults);

    } catch (error) {
      console.error('❌ Failed to search folders:', error.message);
      throw error;
    }
  }

  async smartSearchForOpportunity(opportunityData) {
    try {
      const searchTerms = [];
      
      // Add project code if available
      if (opportunityData.project_code) {
        searchTerms.push(opportunityData.project_code);
      }
      
      // Add project name (first few words) if available
      if (opportunityData.project_name) {
        const projectWords = opportunityData.project_name.split(' ').slice(0, 3).join(' ');
        searchTerms.push(projectWords);
      }
      
      // Add client name if available
      if (opportunityData.client) {
        searchTerms.push(opportunityData.client);
      }

      if (searchTerms.length === 0) {
        return [];
      }

      // Determine if we should search in OP100 folder
      const isOP100Status = opportunityData.opp_status === 'OP100' || 
                           (opportunityData.opp_status && opportunityData.opp_status.toLowerCase().includes('op100'));

      console.log(`🎯 Smart searching for opportunity folders using terms: ${searchTerms.join(', ')}`);
      if (isOP100Status) {
        console.log(`📋 OP100 status detected - will include OP100 folder in search`);
      }

      // Perform multiple searches and combine results
      const allResults = [];
      
      for (const term of searchTerms) {
        try {
          // Include OP100 folder search for OP100 status opportunities
          const results = await this.searchFolders(term, 5, isOP100Status);
          allResults.push(...results);
        } catch (error) {
          console.warn(`⚠️ Search failed for term "${term}": ${error.message}`);
        }
      }

      // Remove duplicates and sort by relevance
      const uniqueResults = allResults.filter((folder, index, self) => 
        index === self.findIndex(f => f.id === folder.id)
      );

      // Sort by relevance (folders that match multiple terms rank higher)
      // Give extra points to folders found in OP100 folder if this is an OP100 opportunity
      const scoredResults = uniqueResults.map(folder => {
        let score = 0;
        const folderNameLower = folder.name.toLowerCase();
        
        searchTerms.forEach(term => {
          if (folderNameLower.includes(term.toLowerCase())) {
            score += 1;
          }
        });
        
        // Bonus points for OP100 folder matches on OP100 opportunities
        if (isOP100Status && folder.isInOP100Folder) {
          score += 2; // Give higher priority to OP100 folder results
        }
        
        return { ...folder, relevanceScore: score };
      });

      scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

      console.log(`✅ Found ${scoredResults.length} relevant folders for opportunity`);
      
      return scoredResults.slice(0, 10); // Return top 10 results

    } catch (error) {
      console.error('❌ Failed to perform smart search:', error.message);
      throw error;
    }
  }

  async duplicateTemplateFolder(opportunityData, createdBy = 'SYSTEM') {
    try {
      if (!this.drive) {
        throw new Error('Google Drive API not initialized');
      }

      if (!GOOGLE_DRIVE_CONFIG.templateFolderId) {
        console.warn('⚠️ No template folder configured, creating empty folder instead');
        return await this.createFolderForOpportunity(opportunityData, createdBy);
      }

      console.log(`📋 Duplicating template folder for opportunity: ${opportunityData.project_name}`);

      // Generate folder name from opportunity data
      const folderName = this.generateFolderName(opportunityData, createdBy);
      
      // Determine parent folder
      const parentFolderId = await this.getOrCreateParentFolder(opportunityData);

      // First, create the main folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const response = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      const newFolder = response.data;
      console.log(`✅ Created main folder: ${newFolder.name} (ID: ${newFolder.id})`);

      // Copy contents from template folder
      await this.copyFolderContents(GOOGLE_DRIVE_CONFIG.templateFolderId, newFolder.id);

      // Set folder permissions
      await this.setFolderPermissions(newFolder.id);

      // Update database with folder information
      await this.updateOpportunityWithFolder(opportunityData.uid, {
        folderId: newFolder.id,
        folderUrl: newFolder.webViewLink,
        folderName: newFolder.name,
        createdBy: createdBy
      });

      return {
        id: newFolder.id,
        name: newFolder.name,
        url: newFolder.webViewLink,
        success: true,
        templated: true
      };

    } catch (error) {
      console.error('❌ Failed to duplicate template folder:', error.message);
      // Return error instead of creating fallback folder to avoid duplicates
      return {
        success: false,
        error: `Template duplication failed: ${error.message}`,
        templated: false
      };
    }
  }

  async copyFolderContents(sourceFolderId, destinationFolderId) {
    try {
      console.log(`📂 Copying contents from template folder...`);

      // List all files and folders in the source folder
      const listResponse = await this.drive.files.list({
        q: `parents in '${sourceFolderId}' and trashed=false`,
        fields: 'files(id, name, mimeType, parents)'
      });

      const items = listResponse.data.files;
      console.log(`📊 Found ${items.length} items to copy`);

      for (const item of items) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          // It's a folder - create it and recursively copy its contents
          const subFolderMetadata = {
            name: item.name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [destinationFolderId]
          };

          const subFolderResponse = await this.drive.files.create({
            resource: subFolderMetadata,
            fields: 'id, name'
          });

          console.log(`📁 Created subfolder: ${subFolderResponse.data.name}`);
          
          // Recursively copy subfolder contents
          await this.copyFolderContents(item.id, subFolderResponse.data.id);

        } else {
          // It's a file - copy it
          const fileMetadata = {
            name: item.name,
            parents: [destinationFolderId]
          };

          await this.drive.files.copy({
            fileId: item.id,
            resource: fileMetadata,
            fields: 'id, name'
          });

          console.log(`📄 Copied file: ${item.name}`);
        }
      }

      console.log('✅ Template folder contents copied successfully');

    } catch (error) {
      console.error('❌ Failed to copy folder contents:', error.message);
      throw error;
    }
  }

  // NEW METHODS FOR EXCEL SYNC FUNCTIONALITY

  async findCalcsheetFolder(mainFolderId) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      console.log(`🔍 Looking for Calcsheet folder in: ${mainFolderId}`);

      // Search for "Calcsheet" folder within the main folder
      const searchResponse = await this.drive.files.list({
        q: `parents in '${mainFolderId}' and mimeType='application/vnd.google-apps.folder' and name contains 'Calcsheet' and trashed=false`,
        fields: 'files(id, name, webViewLink)'
      });

      const folders = searchResponse.data.files || [];
      
      if (folders.length === 0) {
        console.log('📁 No Calcsheet folder found');
        return null;
      }

      // Return the first Calcsheet folder found
      const calcsheetFolder = folders[0];
      console.log(`✅ Found Calcsheet folder: ${calcsheetFolder.name} (ID: ${calcsheetFolder.id})`);
      
      return {
        id: calcsheetFolder.id,
        name: calcsheetFolder.name,
        url: calcsheetFolder.webViewLink
      };

    } catch (error) {
      console.error('❌ Failed to find Calcsheet folder:', error.message);
      throw error;
    }
  }

  async findExcelFiles(folderId, filePattern = 'CMRP') {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      console.log(`📄 Searching for Excel files in folder: ${folderId}`);

      // Search for Excel files matching the CMRP pattern
      const searchResponse = await this.drive.files.list({
        q: `parents in '${folderId}' and (name contains '${filePattern}' and (name contains '.xlsx' or name contains '.xls')) and trashed=false`,
        fields: 'files(id, name, size, modifiedTime, createdTime)',
        orderBy: 'modifiedTime desc'
      });

      const files = searchResponse.data.files || [];
      console.log(`📊 Found ${files.length} Excel files matching pattern`);

      return files.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size,
        modifiedTime: file.modifiedTime,
        createdTime: file.createdTime
      }));

    } catch (error) {
      console.error('❌ Failed to find Excel files:', error.message);
      throw error;
    }
  }

  async downloadExcelFile(fileId, fileName) {
    try {
      if (!this.drive) {
        await this.initialize();
      }

      console.log(`⬇️ Downloading Excel file: ${fileName} (ID: ${fileId})`);

      // Download the file
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });

      const buffer = Buffer.from(response.data);
      console.log(`✅ Downloaded Excel file: ${fileName} (${buffer.length} bytes)`);
      
      // Check if the buffer looks like a valid file
      const firstBytes = buffer.slice(0, 8);
      console.log(`📄 File signature (first 8 bytes): ${firstBytes.toString('hex')}`);
      
      // Check for common Excel signatures
      const xlsxSignature = buffer.slice(0, 4).toString('hex');
      if (xlsxSignature === '504b0304') {
        console.log('📊 File appears to be a valid ZIP/XLSX file');
      } else if (xlsxSignature === 'd0cf11e0') {
        console.log('📊 File appears to be a valid XLS file');
      } else {
        console.warn(`⚠️ Unexpected file signature: ${xlsxSignature}`);
      }
      
      return buffer;

    } catch (error) {
      console.error('❌ Failed to download Excel file:', error.message);
      throw error;
    }
  }

  parseRevisionFromFilename(filename) {
    try {
      // Pattern: CMRPYYMM00xx-[PCS|PCB|etc]001-XX (where XX is the revision number)
      // Updated to handle different codes and additional text after revision number
      const pattern = /CMRP\d{8}-[A-Z]{3}\d{3}-(\d{2})/i;
      const match = filename.match(pattern);
      
      if (match && match[1]) {
        const revision = parseInt(match[1], 10);
        console.log(`📝 Extracted revision ${revision} from filename: ${filename}`);
        return revision;
      }
      
      // Try alternative patterns in case the format varies
      const alternativePatterns = [
        /CMRP\d{8}-[A-Z]{3}\d{3}-(\d{2})\s/i,  // With space after revision
        /CMRP.*-[A-Z]{3}\d{3}-(\d{2})/i,       // More flexible CMRP part
        /-(\d{2})\s+\w+/i,                     // Revision followed by space and text
        /Rev[\s]*(\d{1,2})/i,             // "Rev" followed by number
        /Version[\s]*(\d{1,2})/i          // "Version" followed by number
      ];
      
      for (const altPattern of alternativePatterns) {
        const altMatch = filename.match(altPattern);
        if (altMatch && altMatch[1]) {
          const revision = parseInt(altMatch[1], 10);
          console.log(`📝 Extracted revision ${revision} using alternative pattern from filename: ${filename}`);
          return revision;
        }
      }
      
      console.warn(`⚠️ Could not extract revision number from filename: ${filename}`);
      console.warn(`⚠️ Filename format: ${filename}`);
      return 0; // Default to revision 0 if pattern doesn't match
      
    } catch (error) {
      console.error('❌ Failed to parse revision from filename:', error.message);
      return 0;
    }
  }

  async syncProposalFromDrive(proposalUid) {
    try {
      console.log(`🔄 Starting sync for proposal: ${proposalUid}`);

      // Get proposal info from database
      const client = await pool.connect();
      let proposal;
      
      try {
        const result = await client.query(
          'SELECT uid, google_drive_folder_id, google_drive_folder_name, project_code FROM opps_monitoring WHERE uid = $1',
          [proposalUid]
        );

        if (result.rows.length === 0) {
          throw new Error('Proposal not found');
        }

        proposal = result.rows[0];
        
        if (!proposal.google_drive_folder_id) {
          throw new Error('No Google Drive folder linked to this proposal');
        }

      } finally {
        client.release();
      }

      // Find Calcsheet folder
      const calcsheetFolder = await this.findCalcsheetFolder(proposal.google_drive_folder_id);
      if (!calcsheetFolder) {
        throw new Error('Calcsheet folder not found in the proposal folder');
      }

      // Find Excel files
      const excelFiles = await this.findExcelFiles(calcsheetFolder.id);
      if (excelFiles.length === 0) {
        throw new Error('No Excel files found in Calcsheet folder');
      }
      
      console.log(`📊 Found ${excelFiles.length} Excel file(s) in Calcsheet folder`);

      // Sort files by priority: PCS files first, then revision number (highest first), then by modifiedTime (latest first)
      const filesWithRevisions = excelFiles.map(file => ({
        ...file,
        revisionNumber: this.parseRevisionFromFilename(file.name),
        isPCS: file.name.includes('-PCS') // Check if file contains PCS code
      }));
      
      // Sort by PCS priority, then revision number (descending), then by modifiedTime (descending)
      filesWithRevisions.sort((a, b) => {
        // First priority: PCS files over non-PCS files
        if (a.isPCS !== b.isPCS) {
          return b.isPCS - a.isPCS; // PCS files first (true > false)
        }
        
        // Second priority: Higher revision number
        if (a.revisionNumber !== b.revisionNumber) {
          return b.revisionNumber - a.revisionNumber; // Higher revision first
        }
        
        // Third priority: More recent modification time
        return new Date(b.modifiedTime) - new Date(a.modifiedTime); // More recent first
      });
      
      const latestFile = filesWithRevisions[0];
      console.log(`📊 Selected file: ${latestFile.name} (Rev: ${latestFile.revisionNumber}, PCS: ${latestFile.isPCS ? 'Yes' : 'No'}, Modified: ${latestFile.modifiedTime})`);
      
      if (filesWithRevisions.length > 1) {
        const pcsFiles = filesWithRevisions.filter(f => f.isPCS);
        const nonPcsFiles = filesWithRevisions.filter(f => !f.isPCS);
        if (pcsFiles.length > 0 && nonPcsFiles.length > 0) {
          console.log(`📋 File prioritization: ${pcsFiles.length} PCS file(s) prioritized over ${nonPcsFiles.length} non-PCS file(s)`);
        }
        console.log(`📋 Other files found:`, filesWithRevisions.slice(1).map(f => `${f.name} (Rev: ${f.revisionNumber}, PCS: ${f.isPCS ? 'Yes' : 'No'})`));
      }
      
      // Download the Excel file
      const fileBuffer = await this.downloadExcelFile(latestFile.id, latestFile.name);
      
      return {
        success: true,
        proposalUid: proposalUid,
        excelFile: {
          id: latestFile.id,
          name: latestFile.name,
          buffer: fileBuffer,
          modifiedTime: latestFile.modifiedTime,
          revisionNumber: latestFile.revisionNumber // Already parsed above
        },
        calcsheetFolder: calcsheetFolder
      };

    } catch (error) {
      console.error(`❌ Failed to sync proposal ${proposalUid}:`, error.message);
      return {
        success: false,
        error: error.message,
        proposalUid: proposalUid
      };
    }
  }

  // New method to parse folder data for opportunity creation
  async parseFolderForCreation(folderId) {
    let folder = null;
    
    try {
      console.log(`📁 Parsing Google Drive folder ${folderId} for opportunity creation...`);

      if (!this.drive) {
        throw new Error('Google Drive API not initialized');
      }

      // First, get folder information
      const folderResponse = await this.drive.files.get({
        fileId: folderId,
        fields: 'id, name, webViewLink, parents'
      });

      folder = folderResponse.data;
      console.log(`📁 Found folder: ${folder.name}`);

      // Try to find Calcsheet folder and Excel files
      const calcsheetFolder = await this.findCalcsheetFolder(folderId);
      let excelFiles = [];
      let useCalcsheetData = false;
      
      if (calcsheetFolder) {
        excelFiles = await this.findExcelFiles(calcsheetFolder.id);
        if (excelFiles.length > 0) {
          console.log(`📊 Found ${excelFiles.length} Excel file(s) in Calcsheet folder`);
          useCalcsheetData = true;
        } else {
          console.warn('⚠️ Calcsheet folder found but no Excel files - will use folder name fallback');
        }
      } else {
        console.warn('⚠️ No Calcsheet folder found - will use folder name fallback');
      }

      let projectData;
      let excelFileData = null;
      
      if (useCalcsheetData) {
        console.log(`📊 Processing calcsheet data...`);
        
        // Sort files by priority: PCS files first, then revision number (highest first), then by modifiedTime (latest first)
        const filesWithRevisions = excelFiles.map(file => ({
          ...file,
          revisionNumber: this.parseRevisionFromFilename(file.name),
          isPCS: file.name.includes('-PCS') // Check if file contains PCS code
        }));

        filesWithRevisions.sort((a, b) => {
          // First priority: PCS files over non-PCS files
          if (a.isPCS !== b.isPCS) {
            return b.isPCS - a.isPCS; // PCS files first (true > false)
          }
          
          // Second priority: Higher revision number
          if (a.revisionNumber !== b.revisionNumber) {
            return b.revisionNumber - a.revisionNumber; // Higher revision first
          }
          
          // Third priority: More recent modification time
          return new Date(b.modifiedTime) - new Date(a.modifiedTime); // More recent first
        });

        const latestFile = filesWithRevisions[0];
        console.log(`📊 Selected latest file: ${latestFile.name} (Rev: ${latestFile.revisionNumber}, PCS: ${latestFile.isPCS ? 'Yes' : 'No'})`);
        
        // Download and parse the Excel file
        const fileBuffer = await this.downloadExcelFile(latestFile.id, latestFile.name);
        
        // Parse the Excel file with different password attempts
        const passwordVariations = [
          null, '0601CMRP!', 'CMRP0601', '0601cmrp!', 'cmrp0601', 'CMRP', 'cmrp', 
          'CMRP!', 'cmrp!', '0601CMRP', '0601cmrp', 'CMRP2024', 'CMRP2023', 
          'PBI', 'pbi', 'PBI2024', 'pbi2024'
        ];

        let excelData = null;
        let lastError = null;
        const { parseExcelFile } = require('./backend/routes/proposal-workbench');

        for (const password of passwordVariations) {
          try {
            const passwordLabel = password === null ? 'no password' : `"${password}"`;
            console.log(`[PARSE_FOLDER] Trying with: ${passwordLabel}`);
            
            excelData = await parseExcelFile(fileBuffer, password);
            if (excelData.success) {
              console.log(`[PARSE_FOLDER] Successfully parsed with: ${passwordLabel}`);
              break;
            } else {
              lastError = excelData.error;
            }
          } catch (error) {
            lastError = error.message;
          }
        }

        if (excelData && excelData.success) {
          // Use data from Excel file
          const projectInfo = this.extractProjectInfoFromFilename(latestFile.name);
          const convertedPic = this.convertNameToInitials(excelData.pic);
          const convertedAccountManager = this.convertNameToInitials(excelData.accountManager);
          const formattedMargin = excelData.margin !== null ? parseFloat(excelData.margin.toFixed(2)) : null;
          const formattedFinalAmount = excelData.finalAmount !== null ? parseFloat(excelData.finalAmount.toFixed(2)) : null;

          projectData = {
            projectName: projectInfo.projectName,
            projectCode: projectInfo.projectCode,
            revision: latestFile.revisionNumber,
            clientName: excelData.clientName,
            pic: convertedPic,
            accountManager: convertedAccountManager,
            margin: formattedMargin,
            finalAmount: formattedFinalAmount
          };
          
          excelFileData = {
            name: latestFile.name,
            modifiedTime: latestFile.modifiedTime,
            revisionNumber: latestFile.revisionNumber
          };
          
          console.log(`✅ Using calcsheet data from: ${latestFile.name}`);
        } else {
          console.warn(`⚠️ Failed to parse Excel file: ${lastError} - falling back to folder name`);
          useCalcsheetData = false;
        }
      }
      
      if (!useCalcsheetData) {
        console.log(`📁 Using fallback: parsing folder name for project info...`);
        // Fall back to parsing folder name
        const folderInfo = this.extractProjectInfoFromFolderName(folder.name);
        
        projectData = {
          projectName: folderInfo.projectName,
          projectCode: folderInfo.projectCode,
          revision: 0, // Default revision when no calcsheet
          clientName: folderInfo.clientName, // Will be empty as requested
          pic: folderInfo.pic,
          accountManager: '', // Not available from folder name
          margin: null,
          finalAmount: null
        };
        
        console.log(`✅ Using folder name data: ${folder.name}`);
      }

      return {
        success: true,
        folderData: {
          id: folder.id,
          name: folder.name,
          url: folder.webViewLink
        },
        projectData: projectData,
        excelFile: excelFileData
      };

    } catch (error) {
      console.error(`❌ Failed to parse folder for creation:`, error.message);
      console.log(`🔄 Attempting fallback to folder name parsing...`);
      
      try {
        // If we don't have folder data yet, try to get it
        if (!folder) {
          const folderResponse = await this.drive.files.get({
            fileId: folderId,
            fields: 'id, name, webViewLink, parents'
          });
          folder = folderResponse.data;
        }
        
        // Fallback: try to extract info from folder name even if calcsheet parsing failed
        const folderInfo = this.extractProjectInfoFromFolderName(folder.name);
        
        return {
          success: true,
          folderData: {
            id: folder.id,
            name: folder.name,
            url: folder.webViewLink
          },
          projectData: {
            projectName: folderInfo.projectName,
            projectCode: folderInfo.projectCode,
            revision: 0,
            clientName: folderInfo.clientName, // Will be empty as requested
            pic: folderInfo.pic,
            accountManager: '',
            margin: null,
            finalAmount: null
          },
          excelFile: null,
          note: 'Data extracted from folder name due to calcsheet parsing failure'
        };
      } catch (fallbackError) {
        console.error(`❌ Fallback folder name parsing also failed:`, fallbackError.message);
        return {
          success: false,
          error: error.message
        };
      }
    }
  }

  // Helper method to extract project info from folder name (format: CMRPxxxxxxxx-[PIC] [Project Name])
  extractProjectInfoFromFolderName(folderName) {
    try {
      console.log(`📁 Extracting project info from folder name: ${folderName}`);
      
      // Primary pattern: CMRPxxxxxxxx-[PIC] [Project Name] (allow 1-4 letter PIC)
      const primaryPattern = /^(CMRP\d{8})-([A-Z]{1,4})\s+(.+?)$/i;
      let match = folderName.match(primaryPattern);
      
      if (match) {
        const projectCode = match[1]; // CMRP code
        const pic = match[2].toUpperCase(); // PIC initials
        const projectName = match[3].trim(); // Project name
        
        console.log(`✅ Extracted from folder (primary): Code="${projectCode}", PIC="${pic}", Name="${projectName}"`);
        return {
          projectCode: projectCode,
          projectName: projectName,
          pic: pic,
          clientName: '' // Leave client name blank as requested
        };
      }
      
      // Fallback pattern: Try to extract just CMRP code from start of folder name
      const fallbackPattern = /^(CMRP\d{8})/i;
      const fallbackMatch = folderName.match(fallbackPattern);
      
      if (fallbackMatch) {
        const projectCode = fallbackMatch[1];
        // Use the rest of the folder name as project name, excluding the CMRP code
        const projectName = folderName.replace(fallbackPattern, '').replace(/^[-\s]+/, '').trim();
        
        console.log(`⚠️ Partial extraction from folder (fallback): Code="${projectCode}", Name="${projectName}"`);
        return {
          projectCode: projectCode,
          projectName: projectName || folderName,
          pic: '', // No PIC extracted
          clientName: ''
        };
      }
      
      console.warn(`⚠️ Could not extract project info from folder name: ${folderName}`);
      console.warn(`   Expected format: CMRPxxxxxxxx-[PIC] [Project Name]`);
      console.warn(`   Using folder name as project name fallback`);
      
      return {
        projectCode: '',
        projectName: folderName,
        pic: '',
        clientName: ''
      };
      
    } catch (error) {
      console.error('❌ Failed to extract project info from folder name:', error.message);
      return {
        projectCode: '',
        projectName: folderName,
        pic: '',
        clientName: ''
      };
    }
  }

  // Helper method to extract project info from filename
  extractProjectInfoFromFilename(filename) {
    try {
      // Pattern: CMRPYYMM00xx-[PCS|PCB|etc]001-XX Client-Location-Project Name
      // Made more flexible to handle different codes like PCB, PCS, etc.
      const pattern = /^(CMRP\d{8})-?([A-Z]{3}\d{3})?-?(\d{2})\s+(.+?)(?:\.\w+)?$/i;
      const match = filename.match(pattern);
      
      if (match) {
        // Project code should only be the CMRP part, not include -PCS001/PCB001
        const projectCode = match[1]; // Only the CMRP portion (e.g., "CMRP25080402")
        const revisionFromMatch = match[3] ? parseInt(match[3], 10) : 0; // Revision from regex
        const projectName = match[4] ? match[4].trim() : ''; // Project name moved to match[4]
        
        // Use revision from regex match, fallback to parseRevisionFromFilename method
        const revision = revisionFromMatch || this.parseRevisionFromFilename(filename);
        
        console.log(`📝 Extracted from filename: Code="${projectCode}", Name="${projectName}", Revision="${revision}"`);
        return {
          projectCode: projectCode,
          projectName: projectName,
          revision: revision
        };
      }
      
      console.warn(`⚠️ Could not extract project info from filename: ${filename}`);
      return {
        projectCode: '',
        projectName: filename.replace(/\.\w+$/, '') // Remove extension as fallback
      };
      
    } catch (error) {
      console.error('❌ Failed to extract project info from filename:', error.message);
      return {
        projectCode: '',
        projectName: filename.replace(/\.\w+$/, '')
      };
    }
  }

  // Helper method to convert full names to initials
  convertNameToInitials(fullName) {
    if (!fullName || typeof fullName !== 'string') return fullName;
    
    const nameMapping = {
      'Crisostomo B. Diaz': 'CBD',
      'Juan M. Ortiz': 'JMO', 
      'Rojel T. Rivera': 'RTR',
      'Lindsey O. Salilig': 'LOS',
      'Ivy S. Pico': 'ISP',
      'Neil S. Gomez': 'NSG',
      'Tyrone James Caballero': 'TJC',
      'Reuel Joshua Rivera': 'RJR',
      'Christian B. Gapo': 'CBG',
      'Arvin S. Bacolod': 'ASB',
      'Jayson E. Bornales': 'JEB',
      'Via Irene P. Balleras': 'VIB'
    };
    
    const trimmedName = fullName.trim();
    
    // Check for exact match first
    if (nameMapping[trimmedName]) {
      console.log(`📝 Converted "${trimmedName}" to "${nameMapping[trimmedName]}"`);
      return nameMapping[trimmedName];
    }
    
    // Check for partial matches (case insensitive)
    for (const [fullNameKey, initials] of Object.entries(nameMapping)) {
      if (fullNameKey.toLowerCase() === trimmedName.toLowerCase()) {
        console.log(`📝 Converted "${trimmedName}" to "${initials}" (case insensitive match)`);
        return initials;
      }
    }
    
    console.log(`⚠️ No mapping found for name: "${trimmedName}", returning as-is`);
    return trimmedName;
  }

  /**
   * Get contents of a Google Drive folder
   * @param {string} folderId - The folder ID to get contents for
   * @param {string} orderBy - Sort order (name, modifiedTime, size, etc.)
   * @param {number} maxResults - Maximum number of results to return
   * @returns {object} Folder contents with files and metadata
   */
  async getFolderContents(folderId, orderBy = 'name', maxResults = 100) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive API not initialized');
      }

      console.log(`📂 Getting folder contents for: ${folderId}`);

      // Get folder information first
      const folderInfo = await this.drive.files.get({
        fileId: folderId,
        fields: 'id, name, webViewLink, createdTime, modifiedTime, size'
      });

      // List all files and folders in the specified folder
      const listResponse = await this.drive.files.list({
        q: `parents in '${folderId}' and trashed=false`,
        orderBy: orderBy,
        pageSize: maxResults,
        fields: 'files(id, name, mimeType, webViewLink, webContentLink, iconLink, createdTime, modifiedTime, size, parents, thumbnailLink, description), nextPageToken'
      });

      const files = listResponse.data.files || [];
      console.log(`📊 Found ${files.length} items in folder`);

      // Categorize files
      const categorizedFiles = {
        folders: [],
        documents: [],
        spreadsheets: [],
        presentations: [],
        images: [],
        pdfs: [],
        others: []
      };

      files.forEach(file => {
        const enrichedFile = {
          ...file,
          isFolder: file.mimeType === 'application/vnd.google-apps.folder',
          fileType: this.getFileType(file.mimeType),
          formattedSize: file.size ? this.formatFileSize(parseInt(file.size)) : 'N/A',
          formattedModifiedTime: file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : 'Unknown'
        };

        // Categorize based on MIME type
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          categorizedFiles.folders.push(enrichedFile);
        } else if (file.mimeType.includes('document') || file.mimeType.includes('word')) {
          categorizedFiles.documents.push(enrichedFile);
        } else if (file.mimeType.includes('spreadsheet') || file.mimeType.includes('excel')) {
          categorizedFiles.spreadsheets.push(enrichedFile);
        } else if (file.mimeType.includes('presentation') || file.mimeType.includes('powerpoint')) {
          categorizedFiles.presentations.push(enrichedFile);
        } else if (file.mimeType.includes('image/')) {
          categorizedFiles.images.push(enrichedFile);
        } else if (file.mimeType === 'application/pdf') {
          categorizedFiles.pdfs.push(enrichedFile);
        } else {
          categorizedFiles.others.push(enrichedFile);
        }
      });

      return {
        success: true,
        folder: {
          id: folderInfo.data.id,
          name: folderInfo.data.name,
          webViewLink: folderInfo.data.webViewLink,
          createdTime: folderInfo.data.createdTime,
          modifiedTime: folderInfo.data.modifiedTime
        },
        files: files,
        categorized: categorizedFiles,
        totalCount: files.length,
        hasMore: !!listResponse.data.nextPageToken,
        nextPageToken: listResponse.data.nextPageToken
      };

    } catch (error) {
      console.error('❌ Failed to get folder contents:', error.message);
      return {
        success: false,
        error: error.message,
        files: [],
        categorized: { folders: [], documents: [], spreadsheets: [], presentations: [], images: [], pdfs: [], others: [] },
        totalCount: 0
      };
    }
  }

  /**
   * Get file type description from MIME type
   * @param {string} mimeType - The MIME type of the file
   * @returns {string} Human-readable file type
   */
  getFileType(mimeType) {
    const typeMap = {
      'application/vnd.google-apps.folder': 'Folder',
      'application/vnd.google-apps.document': 'Google Doc',
      'application/vnd.google-apps.spreadsheet': 'Google Sheet',
      'application/vnd.google-apps.presentation': 'Google Slides',
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
      'image/jpeg': 'JPEG Image',
      'image/png': 'PNG Image',
      'image/gif': 'GIF Image',
      'text/plain': 'Text File',
      'application/zip': 'ZIP Archive'
    };

    return typeMap[mimeType] || 'Unknown File Type';
  }

  /**
   * Format file size in human-readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size string
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

}

// Export for use in other modules
module.exports = GoogleDriveService;

// Allow running this script directly for testing
if (require.main === module) {
  const driveService = new GoogleDriveService();
  
  // Test initialization
  driveService.initialize()
    .then(success => {
      if (success) {
        console.log('✅ Google Drive service test completed successfully');
        
        // List opportunities with folders
        return driveService.listOpportunitiesWithFolders();
      } else {
        throw new Error('Failed to initialize');
      }
    })
    .then(opportunities => {
      console.log(`📊 Found ${opportunities.length} opportunities with Drive folders:`);
      opportunities.forEach(opp => {
        console.log(`  - ${opp.project_code}: ${opp.google_drive_folder_name}`);
      });
    })
    .catch(error => {
      console.error('❌ Google Drive service test failed:', error);
    })
    .finally(() => {
      process.exit(0);
    });
}