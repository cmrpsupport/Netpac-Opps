/**
 * PowerPoint Export Functionality
 * Handles the frontend PowerPoint generation and export
 */

class PowerPointExporter {
    constructor() {
        this.currentUser = null;
        this.isExporting = false;
        this.init();
    }

    init() {
        // Set up export button event listener
        const exportButton = document.getElementById('exportPowerPointButton');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.showExportDialog());
        }

        // Get current user info
        this.getCurrentUser();
    }

    getCurrentUser() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                this.currentUser = payload;
            } catch (error) {
                console.error('Error parsing token:', error);
            }
        }
    }

    async testPresentationAPI() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/presentation/test', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Presentation API test successful:', data);
            } else {
                const errorText = await response.text();
                console.error('❌ Presentation API test failed:', response.status, errorText);
            }
        } catch (error) {
            console.error('❌ Presentation API test error:', error);
        }
    }

    showExportDialog() {
        if (this.isExporting) {
            return;
        }

        // Debug token check - try multiple possible token keys
        let token = localStorage.getItem('token') || 
                   localStorage.getItem('authToken') || 
                   localStorage.getItem('jwtToken') ||
                   sessionStorage.getItem('token');
        
        console.log('PowerPoint Export Debug:', {
            tokenExists: !!token,
            tokenLength: token ? token.length : 0,
            tokenStart: token ? token.substring(0, 20) + '...' : 'No token',
            localStorageKeys: Object.keys(localStorage),
            sessionStorageKeys: Object.keys(sessionStorage)
        });

        if (!token) {
            // More detailed error message
            console.error('No token found in localStorage or sessionStorage');
            console.log('Available localStorage keys:', Object.keys(localStorage));
            console.log('Available sessionStorage keys:', Object.keys(sessionStorage));
            
            // Check if user is actually logged in by looking for other auth indicators
            const userInfo = localStorage.getItem('userInfo') || localStorage.getItem('user');
            if (userInfo) {
                console.log('User info found but no token:', userInfo);
                alert('Authentication session found but token missing. Please refresh the page and try again.');
            } else {
                alert('Not logged in. Please log in first and then try again.');
            }
            return;
        }

        // Check token validity
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('Token payload:', payload);
            this.currentUser = payload;
        } catch (error) {
            console.error('Invalid token format:', error);
            alert('Invalid authentication token. Please log in again.');
            return;
        }

        console.log('PowerPoint Export: Authentication verified, proceeding...');

        // Store token for async operations
        this.currentToken = token;

        // Create and show modal dialog immediately (remove slow API test)
        const modal = this.createExportModal();
        document.body.appendChild(modal);
        
        // Show modal
        modal.style.display = 'flex';
        
        // Focus on first input and load data
        const accountManagerSelect = modal.querySelector('#exportAccountManager');
        if (accountManagerSelect) {
            // Load account managers asynchronously to avoid blocking UI
            setTimeout(() => this.loadAccountManagers(accountManagerSelect, token), 100);
            accountManagerSelect.focus();
        }
    }

    createExportModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.id = 'powerpointExportModal';
        
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                        Generate Weekly Presentation
                    </h3>
                    <button type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onclick="this.closest('#powerpointExportModal').remove()">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                
                <form id="exportForm" class="space-y-4">
                    <div>
                        <label for="exportAccountManager" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Account Manager *
                        </label>
                        <select id="exportAccountManager" required class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="">Loading account managers...</option>
                        </select>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Select any account manager to generate their weekly report</p>
                    </div>
                    
                    <div>
                        <label for="exportMeetingDate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Meeting Date
                        </label>
                        <input type="date" id="exportMeetingDate" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave blank for next Wednesday</p>
                    </div>
                    
                    <div>
                        <label for="exportTemplate" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Template
                        </label>
                        <select id="exportTemplate" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                            <option value="">Loading templates...</option>
                        </select>
                    </div>
                    
                    <div class="pt-4 flex items-center justify-between">
                        <button type="button" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200" onclick="this.closest('#powerpointExportModal').remove()">
                            Cancel
                        </button>
                        <button type="submit" id="exportSubmitBtn" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                            <span class="material-icons" id="exportIcon">slideshow</span>
                            <span id="exportText">Generate Presentation</span>
                        </button>
                    </div>
                </form>
                
                <div id="exportProgress" class="hidden mt-4">
                    <div class="flex items-center gap-3">
                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span class="text-sm text-gray-600 dark:text-gray-400" id="progressText">Generating presentation...</span>
                    </div>
                    <div class="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div id="progressBar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Set up form submission
        const form = modal.querySelector('#exportForm');
        form.addEventListener('submit', (e) => this.handleExport(e, modal));
        
        // Set default date to next Wednesday
        const meetingDateInput = modal.querySelector('#exportMeetingDate');
        meetingDateInput.value = this.getNextWednesday();
        
        // Load templates asynchronously (token will be passed from showExportDialog)
        setTimeout(() => this.loadTemplates(modal.querySelector('#exportTemplate'), this.currentToken), 200);
        
        return modal;
    }

    async loadAccountManagers(selectElement, token = null) {
        try {
            // Use passed token or fallback to stored token
            const authToken = token || this.currentToken || localStorage.getItem('token');
            if (!authToken) {
                throw new Error('No authentication token found');
            }
            
            console.log('Loading account managers with token:', authToken ? 'Present' : 'Missing');
            
            const response = await fetch('/api/presentation/account-managers', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Account managers API error:', response.status, errorData);
                throw new Error(`Failed to load account managers: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            selectElement.innerHTML = '<option value="">Select Account Manager</option>';
            
            data.accountManagers.forEach(manager => {
                const option = document.createElement('option');
                option.value = manager.name;
                option.textContent = `${manager.name} (${manager.opportunity_count} opportunities)`;
                selectElement.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading account managers:', error);
            selectElement.innerHTML = '<option value="">Error loading account managers</option>';
        }
    }

    async loadTemplates(selectElement, token = null) {
        try {
            // Use passed token or fallback to stored token
            const authToken = token || this.currentToken || localStorage.getItem('token');
            if (!authToken) {
                throw new Error('No authentication token found');
            }
            
            const response = await fetch('/api/presentation/templates', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.text();
                console.error('Templates API error:', response.status, errorData);
                throw new Error(`Failed to load templates: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            selectElement.innerHTML = '<option value="">Standard Weekly Report</option>';
            
            data.templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.template_name;
                selectElement.appendChild(option);
            });
            
        } catch (error) {
            console.error('Error loading templates:', error);
            selectElement.innerHTML = '<option value="">Standard Weekly Report</option>';
        }
    }

    async handleExport(event, modal) {
        event.preventDefault();
        
        if (this.isExporting) {
            return;
        }
        
        const formData = new FormData(event.target);
        const accountManager = modal.querySelector('#exportAccountManager').value;
        const meetingDate = modal.querySelector('#exportMeetingDate').value;
        const templateId = modal.querySelector('#exportTemplate').value;
        
        if (!accountManager) {
            this.showError('Please select an account manager', modal);
            return;
        }
        
        this.isExporting = true;
        this.showProgress(modal, 'Generating presentation...', 10);
        
        try {
            // Generate highlights first
            await this.generateHighlights(accountManager, meetingDate, modal);
            
            // Generate PowerPoint
            await this.generatePowerPoint(accountManager, meetingDate, templateId, modal);
            
        } catch (error) {
            console.error('Export error:', error);
            this.showError(error.message, modal);
        } finally {
            this.isExporting = false;
            this.hideProgress(modal);
        }
    }

    async generateHighlights(accountManager, meetingDate, modal) {
        this.showProgress(modal, 'Generating highlights...', 30);
        
        const token = this.currentToken || localStorage.getItem('token');
        const response = await fetch(`/api/presentation/generate-highlights/${encodeURIComponent(accountManager)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ meetingDate })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate highlights');
        }
        
        const data = await response.json();
        console.log(`Generated ${data.summary.generated} highlights for ${accountManager}`);
    }

    async generatePowerPoint(accountManager, meetingDate, templateId, modal) {
        this.showProgress(modal, 'Creating PowerPoint file...', 70);
        
        const token = this.currentToken || localStorage.getItem('token');
        const response = await fetch('/api/presentation/export-powerpoint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                accountManager,
                meetingDate,
                templateId: templateId || 'standard'
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate PowerPoint');
        }
        
        this.showProgress(modal, 'Downloading file...', 90);
        
        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Get filename from response headers or generate one
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `${accountManager.replace(/\s+/g, '_')}_Weekly_Report.pptx`;
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.showProgress(modal, 'Complete!', 100);
        
        // Show success message
        setTimeout(() => {
            this.showSuccess('PowerPoint presentation generated successfully!', modal);
            setTimeout(() => modal.remove(), 2000);
        }, 500);
    }

    showProgress(modal, text, percentage) {
        const progressContainer = modal.querySelector('#exportProgress');
        const progressText = modal.querySelector('#progressText');
        const progressBar = modal.querySelector('#progressBar');
        const submitBtn = modal.querySelector('#exportSubmitBtn');
        const form = modal.querySelector('#exportForm');
        
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (form) form.classList.add('opacity-50', 'pointer-events-none');
        if (submitBtn) submitBtn.disabled = true;
        
        if (progressText) progressText.textContent = text;
        if (progressBar) progressBar.style.width = `${percentage}%`;
    }

    hideProgress(modal) {
        const progressContainer = modal.querySelector('#exportProgress');
        const submitBtn = modal.querySelector('#exportSubmitBtn');
        const form = modal.querySelector('#exportForm');
        
        if (progressContainer) progressContainer.classList.add('hidden');
        if (form) form.classList.remove('opacity-50', 'pointer-events-none');
        if (submitBtn) submitBtn.disabled = false;
    }

    showError(message, modal) {
        const progressContainer = modal.querySelector('#exportProgress');
        progressContainer.innerHTML = `
            <div class="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span class="material-icons text-red-600 dark:text-red-400">error</span>
                <span class="text-sm text-red-800 dark:text-red-200">${message}</span>
            </div>
        `;
        progressContainer.classList.remove('hidden');
        
        setTimeout(() => this.hideProgress(modal), 5000);
    }

    showSuccess(message, modal) {
        const progressContainer = modal.querySelector('#exportProgress');
        progressContainer.innerHTML = `
            <div class="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span class="material-icons text-green-600 dark:text-green-400">check_circle</span>
                <span class="text-sm text-green-800 dark:text-green-200">${message}</span>
            </div>
        `;
    }

    getNextWednesday() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilWednesday = (3 - dayOfWeek + 7) % 7;
        const nextWednesday = new Date(today);
        
        // If today is Wednesday, get next Wednesday
        if (daysUntilWednesday === 0) {
            nextWednesday.setDate(today.getDate() + 7);
        } else {
            nextWednesday.setDate(today.getDate() + daysUntilWednesday);
        }
        
        return nextWednesday.toISOString().split('T')[0];
    }

    // Static method to show presentation data preview
    static async showPresentationPreview(accountManager, meetingDate) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/presentation/weekly-data/${encodeURIComponent(accountManager)}?meetingDate=${meetingDate}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load presentation data');
            }
            
            const data = await response.json();
            
            // Create preview modal
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                            Weekly Report Preview - ${accountManager}
                        </h3>
                        <button type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onclick="this.parentElement.parentElement.parentElement.remove()">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">${data.summary.totalOpportunities}</div>
                                <div class="text-sm text-gray-600 dark:text-gray-400">Total Opportunities</div>
                            </div>
                            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                <div class="text-2xl font-bold text-green-600 dark:text-green-400">${data.summary.newSubmissions}</div>
                                <div class="text-sm text-gray-600 dark:text-gray-400">New Submissions</div>
                            </div>
                            <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                                <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${data.summary.highPriorityItems}</div>
                                <div class="text-sm text-gray-600 dark:text-gray-400">High Priority Items</div>
                            </div>
                            <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                                <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">$${(data.summary.totalPipelineValue / 1000000).toFixed(1)}M</div>
                                <div class="text-sm text-gray-600 dark:text-gray-400">Pipeline Value</div>
                            </div>
                        </div>
                        
                        <div>
                            <h4 class="text-md font-semibold text-gray-900 dark:text-white mb-2">Top Highlights</h4>
                            <div class="space-y-2">
                                ${data.highlights.slice(0, 5).map(h => `
                                    <div class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                        <span class="material-icons text-sm mt-0.5 ${h.highlight_priority === 'HIGH' ? 'text-red-500' : h.highlight_priority === 'MEDIUM' ? 'text-yellow-500' : 'text-green-500'}">
                                            ${h.highlight_priority === 'HIGH' ? 'priority_high' : h.highlight_priority === 'MEDIUM' ? 'remove' : 'check'}
                                        </span>
                                        <div class="flex-1">
                                            <div class="text-sm font-medium text-gray-900 dark:text-white">${h.highlight_type.replace('_', ' ')}</div>
                                            <div class="text-sm text-gray-600 dark:text-gray-400">${h.presentation_notes}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('Error showing preview:', error);
            alert('Failed to load presentation preview');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PowerPointExporter();
});

// Export for use in other modules
window.PowerPointExporter = PowerPointExporter;