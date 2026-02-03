/**
 * Project Detail Page JavaScript
 * Handles comprehensive project detail view with storyboard, schedule, and drive integration
 */

class ProjectDetailPage {
    constructor() {
        this.projectUid = null;
        this.projectData = null;
        this.currentWeekStart = null;
        this.storyData = [];
        
        this.init();
    }

    async init() {
        console.log('[ProjectDetail] Initializing project detail page...');
        
        // Initialize shared navigation first
        if (typeof SharedNavigation !== 'undefined') {
            this.sharedNav = new SharedNavigation();
            window.sharedNavigationInstance = this.sharedNav;
            await this.sharedNav.initialize();
            // Delay user info initialization to ensure DOM is fully ready
            setTimeout(() => {
                this.sharedNav.initializeUserInfo();
            }, 100);
        }
        
        // Get project UID from URL parameters
        this.projectUid = this.getProjectUidFromUrl();
        
        if (!this.projectUid) {
            console.error('[ProjectDetail] No project UID found in URL');
            this.showError('Project not found');
            return;
        }

        // Initialize event listeners
        this.initEventListeners();
        
        // Load project data
        await this.loadProjectData();
        
        // Initialize story feature after project data is loaded
        this.initializeInlineStoryFeature();
        
        // Hide loading screen and show content
        this.hideLoadingScreen();
    }

    getProjectUidFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('uid') || urlParams.get('id');
    }

    initEventListeners() {
        // Navigation
        document.getElementById('backToDashboard')?.addEventListener('click', () => {
            window.location.href = 'index.html';
        });

        document.getElementById('editProject')?.addEventListener('click', () => {
            this.editProject();
        });

        // Drive files
        document.getElementById('refreshDriveFiles')?.addEventListener('click', () => {
            this.loadDriveFiles();
        });

        // Add Entry button - show the form
        document.getElementById('addStoryboardEntry')?.addEventListener('click', () => {
            this.showAddStoryForm();
        });

        // Cancel button - hide the form
        document.getElementById('cancelStoryEntryBtn')?.addEventListener('click', () => {
            this.hideAddStoryForm();
        });
    }

    async loadProjectData() {
        console.log(`[ProjectDetail] Loading project data for UID: ${this.projectUid}`);
        
        try {
            const response = await fetch(getApiUrl(`/api/project/${this.projectUid}`), {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load project: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[ProjectDetail] Project data loaded:', data);
            
            this.projectData = data.project;
            this.populateProjectInfo(data);
            
            // Load related data
            await Promise.all([
                this.loadDriveFiles()
            ]);

        } catch (error) {
            console.error('[ProjectDetail] Error loading project data:', error);
            this.showError('Failed to load project details');
        }
    }

    populateProjectInfo(data) {
        const project = data.project;
        
        // Header information
        document.getElementById('projectTitle').textContent = project.project_name || 'Unnamed Project';
        document.getElementById('projectCode').querySelector('span:last-child').textContent = project.project_code || 'N/A';
        document.getElementById('projectClient').querySelector('span:last-child').textContent = project.client || 'N/A';
        document.getElementById('projectRevision').querySelector('span:last-child').textContent = `Rev: ${project.rev || 0}`;
        
        // Format and display amount
        const amount = project.final_amt ? this.formatCurrency(project.final_amt) : 'TBD';
        document.getElementById('projectAmount').textContent = amount;
        
        // Status badge
        const statusElement = document.getElementById('projectStatus');
        const status = project.opp_status || 'pending';
        statusElement.textContent = this.formatStatus(status);
        statusElement.className = `status-badge status-${status.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        // Overview details
        document.getElementById('projectManager').textContent = project.account_mgr || 'Not assigned';
        document.getElementById('projectPic').textContent = project.pic || 'Not assigned';
        document.getElementById('projectSolutions').textContent = project.solutions || 'Not specified';
        document.getElementById('projectIndustries').textContent = project.industries || 'Not specified';
        
        // Dates
        document.getElementById('projectForecast').textContent = this.formatDate(project.forecast_date);
        document.getElementById('projectDeadline').textContent = this.formatDate(project.client_deadline);
        
        // Financial and other info
        document.getElementById('projectMargin').textContent = project.margin ? `${project.margin}%` : 'TBD';
        document.getElementById('projectDecision').textContent = project.decision || 'Pending';
        document.getElementById('projectRemarks').textContent = project.remarks_comments || 'No remarks';

        console.log('[ProjectDetail] Project info populated successfully');
    }




    async loadDriveFiles() {
        console.log(`[ProjectDetail] Loading Google Drive files for project ${this.projectUid}`);
        
        const container = document.getElementById('driveFilesContainer');
        container.innerHTML = `
            <div class="text-center py-4">
                <div class="loading-spinner mx-auto mb-2"></div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Loading Drive files...</p>
            </div>
        `;
        
        try {
            const response = await fetch(getApiUrl(`/api/project/${this.projectUid}/drive-folder-contents`), {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load Drive files: ${response.statusText}`);
            }

            const data = await response.json();
            this.renderDriveFiles(data);
            
        } catch (error) {
            console.error('[ProjectDetail] Error loading Drive files:', error);
            container.innerHTML = `
                <div class="text-center text-red-500 py-4">
                    <span class="material-icons mb-2">error</span>
                    <p>Failed to load Drive files</p>
                </div>
            `;
        }
    }

    renderDriveFiles(data) {
        const container = document.getElementById('driveFilesContainer');

        if (!data.success || !data.hasFolder) {
            container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <span class="material-icons text-4xl mb-4 opacity-50">cloud_off</span>
                    <p>No Google Drive folder linked</p>
                    <p class="text-sm mt-2">Link a folder to browse project files</p>
                </div>
            `;
            return;
        }

        const contents = data.contents;
        const files = contents?.files || [];
        const categorized = contents?.categorized || {};
        
        if (!files.length) {
            container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <span class="material-icons text-4xl mb-4 opacity-50">folder_open</span>
                    <p>No files in Drive folder</p>
                    <a href="${data.folderUrl}" target="_blank" class="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-flex items-center">
                        <span class="material-icons text-sm mr-1">open_in_new</span>
                        Open in Drive
                    </a>
                </div>
            `;
            return;
        }

        // Create categorized file sections
        const categoryIcons = {
            folders: 'folder',
            documents: 'description',
            spreadsheets: 'table_chart',
            presentations: 'slideshow',
            images: 'image',
            pdfs: 'picture_as_pdf',
            others: 'attachment'
        };

        const categoryLabels = {
            folders: 'Folders',
            documents: 'Documents',
            spreadsheets: 'Spreadsheets',
            presentations: 'Presentations',
            images: 'Images',
            pdfs: 'PDFs',
            others: 'Other Files'
        };

        const createFileList = (files, showThumbnails = false) => {
            return files.map(file => `
                <div class="file-item group" onclick="if('${file.webViewLink}') { window.open('${file.webViewLink}', '_blank'); } else { console.log('No webViewLink for file:', '${file.name}'); }">
                    ${showThumbnails && file.thumbnailLink ? 
                        `<img src="${file.thumbnailLink}" alt="${file.name}" class="w-8 h-8 object-cover rounded mr-3">` :
                        `<span class="material-icons mr-3 text-gray-400">${this.getFileIcon(file.mimeType)}</span>`
                    }
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm truncate" title="${file.name}">${file.name}</div>
                        <div class="text-xs text-gray-500 flex items-center gap-2">
                            <span>${file.formattedModifiedTime || this.formatDate(file.modifiedTime)}</span>
                            ${file.formattedSize && file.formattedSize !== 'N/A' ? 
                                `<span class="text-gray-400">•</span><span>${file.formattedSize}</span>` : ''
                            }
                        </div>
                    </div>
                    <span class="material-icons text-gray-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                </div>
            `).join('');
        };

        const categorySections = [];
        
        // Add folder info header
        const folderInfo = contents.folder;
        if (folderInfo) {
            categorySections.push(`
                <div class="folder-info bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center">
                            <span class="material-icons text-blue-600 dark:text-blue-400 mr-2">folder</span>
                            <div>
                                <div class="font-semibold text-blue-800 dark:text-blue-300">${folderInfo.name}</div>
                                <div class="text-xs text-blue-600 dark:text-blue-400">${contents.totalCount} items</div>
                            </div>
                        </div>
                        <a href="${data.folderUrl}" target="_blank" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm inline-flex items-center bg-white dark:bg-gray-800 px-3 py-1 rounded border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <span class="material-icons text-sm mr-1">open_in_new</span>
                            Open in Drive
                        </a>
                    </div>
                </div>
            `);
        }

        // Add categorized sections
        Object.entries(categorized).forEach(([category, categoryFiles]) => {
            if (categoryFiles.length > 0) {
                const icon = categoryIcons[category];
                const label = categoryLabels[category];
                const showThumbnails = category === 'images';
                
                categorySections.push(`
                    <div class="file-category mb-4">
                        <div class="category-header flex items-center mb-2 pb-1 border-b border-gray-200 dark:border-gray-600">
                            <span class="material-icons text-gray-600 dark:text-gray-400 mr-2 text-sm">${icon}</span>
                            <h4 class="font-medium text-gray-800 dark:text-gray-200">${label}</h4>
                            <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">(${categoryFiles.length})</span>
                        </div>
                        <div class="space-y-1">
                            ${createFileList(categoryFiles, showThumbnails)}
                        </div>
                    </div>
                `);
            }
        });

        if (categorySections.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                    <span class="material-icons text-4xl mb-4 opacity-50">folder_open</span>
                    <p>No files in Drive folder</p>
                    <a href="${data.folderUrl}" target="_blank" class="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-flex items-center">
                        <span class="material-icons text-sm mr-1">open_in_new</span>
                        Open in Drive
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="drive-browser max-h-96 overflow-y-auto">
                ${categorySections.join('')}
            </div>
        `;
    }


    editProject() {
        // Navigate to edit modal or page
        window.location.href = `index.html?edit=${this.projectUid}`;
    }


    // Utility functions
    formatCurrency(amount) {
        if (!amount) return 'TBD';
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    }

    formatStatus(status) {
        const statusMap = {
            'op100': 'OP100',
            'op90': 'OP90',
            'submitted': 'Submitted',
            'declined': 'Declined',
            'awarded': 'Awarded'
        };
        return statusMap[status.toLowerCase()] || status;
    }

    formatDate(dateString, includeTime = true) {
        if (!dateString) return 'Not set';
        
        const date = new Date(dateString);
        
        // Check if date is invalid
        if (isNaN(date.getTime())) {
            return 'Not set';
        }
        
        if (includeTime) {
            return date.toLocaleString();
        } else {
            return date.toLocaleDateString();
        }
    }

    formatEntryType(type) {
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatStoryContent(content) {
        if (!content) return '';
        // Basic HTML escape and newline handling
        return content.replace(/\n/g, '<br>').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    getTimeAgo(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        
        // Check if date is invalid
        if (isNaN(date.getTime())) {
            return '';
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    getFileIcon(mimeType) {
        if (!mimeType) return 'description';
        
        if (mimeType.includes('image/')) return 'image';
        if (mimeType.includes('video/')) return 'video_file';
        if (mimeType.includes('audio/')) return 'audio_file';
        if (mimeType.includes('pdf')) return 'picture_as_pdf';
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'table_chart';
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'slideshow';
        if (mimeType.includes('document') || mimeType.includes('word')) return 'description';
        if (mimeType.includes('folder')) return 'folder';
        
        return 'description';
    }

    showError(message) {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="min-h-screen flex items-center justify-center">
                    <div class="text-center">
                        <span class="material-icons text-6xl text-red-500 mb-4">error</span>
                        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Error</h1>
                        <p class="text-gray-600 dark:text-gray-400">${message}</p>
                        <button onclick="window.location.href='index.html'" 
                                class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            `;
        }
    }

    initializeInlineStoryFeature() {
        console.log('[ProjectDetail] Initializing inline story feature for project:', this.projectUid);
        
        // Wait for ProposalStoryManager class to be available, then create our own instance
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds total
        
        const initStoryWhenReady = () => {
            attempts++;
            console.log(`[ProjectDetail] Attempt ${attempts}: Checking for ProposalStoryManager class...`);
            console.log('[ProjectDetail] Current state:', {
                ProposalStoryManagerType: typeof window.ProposalStoryManager,
                DOMContentLoaded: document.readyState
            });
            
            // Check if ProposalStoryManager class is available
            if (typeof window.ProposalStoryManager !== 'undefined') {
                console.log('[ProjectDetail] ProposalStoryManager class available, creating instance');
                try {
                    this.storyManager = new window.ProposalStoryManager();
                    console.log('[ProjectDetail] Story manager instance created');
                    this.loadInlineStoryData();
                    this.setupStoryEventListeners();
                    return;
                } catch (error) {
                    console.error('[ProjectDetail] Error creating story manager:', error);
                    this.showStoryError('Failed to create story manager');
                    return;
                }
            }
            
            if (attempts >= maxAttempts) {
                console.error('[ProjectDetail] Timeout waiting for ProposalStoryManager class');
                this.showStoryError('Failed to initialize proposal story system');
                return;
            }
            
            console.log('[ProjectDetail] Waiting for ProposalStoryManager class...');
            setTimeout(initStoryWhenReady, 100);
        };
        
        // Start immediately since scripts should be loaded by now
        setTimeout(initStoryWhenReady, 100);
    }

    async loadInlineStoryData() {
        if (!this.projectUid || !this.storyManager) return;
        
        console.log('[ProjectDetail] Loading story data for project:', this.projectUid);
        
        // Set the current project in our story manager instance
        this.storyManager.currentOpportunityUid = this.projectUid;
        this.storyManager.currentOpportunityData = this.projectData;
        
        // Load the story data
        await this.storyManager.loadStoryData();
    }

    setupStoryEventListeners() {
        // The ProposalStoryManager already sets up event listeners in its bindEventListeners method
        // We just need to make sure the mention system is initialized for our textarea
        const textarea = document.getElementById('storyEntryContent');
        if (textarea && window.MentionSystem && !textarea.hasAttribute('data-mention-attached')) {
            window.MentionSystem.initializeOn('#storyEntryContent');
        }
        
        console.log('[ProjectDetail] Story event listeners configured');
    }

    showAddStoryForm() {
        const addSection = document.getElementById('addStorySection');
        if (addSection) {
            addSection.classList.remove('hidden');
            // Focus on the textarea
            setTimeout(() => {
                const textarea = document.getElementById('storyEntryContent');
                if (textarea) textarea.focus();
            }, 100);
        }
    }

    hideAddStoryForm() {
        const addSection = document.getElementById('addStorySection');
        if (addSection) {
            addSection.classList.add('hidden');
            // Clear the form
            this.clearStoryForm();
        }
    }

    clearStoryForm() {
        const typeSelect = document.getElementById('storyEntryType');
        const titleInput = document.getElementById('storyEntryTitle');
        const contentTextarea = document.getElementById('storyEntryContent');
        const titleSection = document.getElementById('storyTitleSection');

        if (typeSelect) typeSelect.value = 'comment';
        if (titleInput) titleInput.value = '';
        if (contentTextarea) contentTextarea.value = '';
        if (titleSection) titleSection.classList.add('hidden');
    }

    showStoryError(message) {
        const container = document.getElementById('storyTimelineContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <span class="material-icons text-4xl mb-2">error</span>
                    <p class="font-medium">${message}</p>
                    <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        Reload Page
                    </button>
                </div>
            `;
        }
    }

    hideLoadingScreen() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('appContent').classList.remove('hidden');
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProjectDetailPage();
});