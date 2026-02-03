// Proposal Story Timeline JavaScript
// Handles the proposal story modal, timeline rendering, and story management

class ProposalStoryManager {
    constructor() {
        this.currentOpportunityUid = null;
        this.currentOpportunityData = null;
        this.storyData = [];
        this.isLoading = false;
        
        this.init();
    }
    
    init() {
        this.bindEventListeners();
        this.setupEntryTypeHandling();
    }
    
    bindEventListeners() {
        // Modal close handlers
        const closeButtons = document.querySelectorAll('#proposalStoryModal .modal-close-x, #closeStoryModalButton');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => this.closeModal());
        });
        
        // Modal overlay click to close
        const overlay = document.getElementById('proposalStoryModalOverlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeModal();
            });
        }
        
        // Add story entry button
        const addStoryBtn = document.getElementById('addStoryEntryBtn');
        if (addStoryBtn) {
            addStoryBtn.addEventListener('click', () => this.addStoryEntry());
        }
        
        // Entry type change handler
        const entryTypeSelect = document.getElementById('storyEntryType');
        if (entryTypeSelect) {
            entryTypeSelect.addEventListener('change', () => this.handleEntryTypeChange());
        }
        
        // Auto-resize textarea
        const textarea = document.getElementById('storyEntryContent');
        if (textarea) {
            textarea.addEventListener('input', (e) => this.autoResizeTextarea(e.target));
        }
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('proposalStoryModalOverlay').classList.contains('hidden')) {
                this.closeModal();
            }
        });
    }
    
    setupEntryTypeHandling() {
        const entryTypes = {
            'comment': { requiresTitle: false, icon: 'comment', color: 'blue' },
            'client_feedback': { requiresTitle: false, icon: 'feedback', color: 'purple' },
            'status_update': { requiresTitle: false, icon: 'update', color: 'indigo' },
            'issue': { requiresTitle: true, icon: 'warning', color: 'red' },
            'resolution': { requiresTitle: false, icon: 'check_circle', color: 'green' }
        };
        
        this.entryTypes = entryTypes;
        this.handleEntryTypeChange();
    }
    
    handleEntryTypeChange() {
        const entryTypeSelect = document.getElementById('storyEntryType');
        const titleSection = document.getElementById('storyTitleSection');
        const titleInput = document.getElementById('storyEntryTitle');
        
        if (!entryTypeSelect || !titleSection) return;
        
        const selectedType = entryTypeSelect.value;
        const typeConfig = this.entryTypes[selectedType];
        
        if (typeConfig && typeConfig.requiresTitle) {
            titleSection.classList.remove('hidden');
            titleInput.required = true;
        } else {
            titleSection.classList.add('hidden');
            titleInput.required = false;
            titleInput.value = '';
        }
    }
    
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(80, textarea.scrollHeight) + 'px';
    }
    
    // Main method to open the story modal
    async openStoryModal(opportunityUid, opportunityData = null) {
        console.log('[ProposalStory] Opening story modal for:', opportunityUid);
        
        this.currentOpportunityUid = opportunityUid;
        this.currentOpportunityData = opportunityData;
        
        // Show modal
        const overlay = document.getElementById('proposalStoryModalOverlay');
        const modal = document.getElementById('proposalStoryModal');
        
        if (overlay && modal) {
            overlay.classList.remove('hidden');
            modal.classList.remove('hidden');
            
            // Set subtitle
            this.updateModalSubtitle();
            
            // Load story data
            await this.loadStoryData();
            
            // Focus on textarea for immediate input
            const textarea = document.getElementById('storyEntryContent');
            if (textarea) {
                setTimeout(() => textarea.focus(), 100);
            }
            
            // Initialize mention system for the textarea
            if (window.MentionSystem && textarea && !textarea.hasAttribute('data-mention-attached')) {
                window.MentionSystem.initializeOn('#storyEntryContent');
            }
            
            // Dispatch custom event for other systems
            document.dispatchEvent(new CustomEvent('modalOpened', { detail: { modalType: 'proposalStory' } }));
        } else {
            console.error('[ProposalStory] Modal elements not found');
        }
    }
    
    updateModalSubtitle() {
        const subtitle = document.getElementById('proposalStorySubtitle');
        if (subtitle && this.currentOpportunityData) {
            const projectName = this.currentOpportunityData.project_name || this.currentOpportunityData.opp_name || 'Unknown Project';
            const client = this.currentOpportunityData.client || 'Unknown Client';
            subtitle.textContent = `${projectName} - ${client}`;
        }
    }
    
    closeModal() {
        const overlay = document.getElementById('proposalStoryModalOverlay');
        const modal = document.getElementById('proposalStoryModal');
        
        if (overlay && modal) {
            overlay.classList.add('hidden');
            modal.classList.add('hidden');
            
            // Reset form
            this.resetForm();
            
            // Clear data
            this.currentOpportunityUid = null;
            this.currentOpportunityData = null;
            this.storyData = [];
        }
    }
    
    resetForm() {
        const entryType = document.getElementById('storyEntryType');
        const title = document.getElementById('storyEntryTitle');
        const content = document.getElementById('storyEntryContent');
        const titleSection = document.getElementById('storyTitleSection');
        
        if (entryType) entryType.value = 'comment';
        if (title) title.value = '';
        if (content) {
            content.value = '';
            content.style.height = 'auto';
        }
        if (titleSection) titleSection.classList.add('hidden');
    }
    
    // Load story data from both revision history and manual entries
    async loadStoryData() {
        if (!this.currentOpportunityUid) return;
        
        this.showLoading();
        
        try {
            console.log('[ProposalStory] Loading story data for:', this.currentOpportunityUid);
            
            // Fetch story data from API
            const response = await fetch(`${getApiUrl(`/api/proposal-story/${this.currentOpportunityUid}`)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[ProposalStory] Server error (${response.status}):`, errorText);
                
                // If it's a 404, it likely means no story data exists yet - show empty state
                if (response.status === 404) {
                    console.log('[ProposalStory] No story data found, showing empty state');
                    this.storyData = [];
                    this.renderTimeline();
                    this.updateStoryStats();
                    return;
                }
                
                throw new Error(`Failed to load story data: ${response.status}`);
            }
            
            const data = await response.json();
            this.storyData = data.story || [];
            
            console.log('[ProposalStory] Loaded story entries:', this.storyData.length);
            
            // Render timeline
            this.renderTimeline();
            
            // Update stats
            this.updateStoryStats();
            
        } catch (error) {
            console.error('[ProposalStory] Error loading story data:', error);
            
            // For connection errors or cases where the API isn't available, 
            // show empty state instead of error to provide better UX
            if (error.message.includes('Failed to fetch') || 
                error.message.includes('NetworkError') ||
                error.message.includes('404')) {
                console.log('[ProposalStory] Showing empty state due to connection/API issues');
                this.storyData = [];
                this.renderTimeline();
                this.updateStoryStats();
            } else {
                this.showError('Failed to load proposal story. Please try again.');
            }
        } finally {
            this.hideLoading();
        }
    }
    
    showLoading() {
        const loading = document.getElementById('storyTimelineLoading');
        const timeline = document.getElementById('storyTimeline');
        const empty = document.getElementById('storyTimelineEmpty');
        
        if (loading) loading.classList.remove('hidden');
        if (timeline) timeline.classList.add('hidden');
        if (empty) empty.classList.add('hidden');
    }
    
    hideLoading() {
        const loading = document.getElementById('storyTimelineLoading');
        if (loading) loading.classList.add('hidden');
    }
    
    showError(message) {
        const container = document.getElementById('storyTimelineContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <span class="material-icons text-4xl mb-2">error</span>
                    <p class="font-medium">${message}</p>
                    <button onclick="proposalStoryManager.loadStoryData()" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
    
    renderTimeline() {
        const timeline = document.getElementById('storyTimeline');
        const empty = document.getElementById('storyTimelineEmpty');
        
        if (!timeline) return;
        
        if (!this.storyData || this.storyData.length === 0) {
            timeline.classList.add('hidden');
            if (empty) empty.classList.remove('hidden');
            return;
        }
        
        // Sort story data by date (newest first)
        const sortedData = [...this.storyData].sort((a, b) => 
            new Date(b.timeline_date) - new Date(a.timeline_date)
        );
        
        // Generate timeline HTML
        const timelineHTML = `
            <div class="story-timeline">
                ${sortedData.map(entry => this.renderStoryCard(entry)).join('')}
            </div>
        `;
        
        timeline.innerHTML = timelineHTML;
        timeline.classList.remove('hidden');
        if (empty) empty.classList.add('hidden');
        
        // Add animation delays for smooth appearance
        const cards = timeline.querySelectorAll('.story-card');
        cards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.1}s`;
        });
    }
    
    renderStoryCard(entry) {
        const isManual = entry.is_manual;
        const entryType = entry.story_subtype || 'comment';
        const cardClasses = this.getCardClasses(isManual, entryType);
        
        return `
            <div class="story-card ${cardClasses}" data-entry-id="${entry.reference_id}" data-source="${entry.source_type}">
                <div class="story-card-header">
                    <div class="story-card-author">
                        <div class="story-card-avatar">
                            ${this.getAuthorInitials(entry.author)}
                        </div>
                        <div class="story-card-author-info">
                            <h4>${this.sanitizeText(entry.author)}</h4>
                            <p>${entry.author_role || 'User'}</p>
                        </div>
                    </div>
                    <div class="story-card-meta">
                        <div class="story-card-timestamp" title="${this.formatFullDateTime(entry.timeline_date)}">
                            ${this.formatRelativeTime(entry.timeline_date)}
                        </div>
                        <span class="story-card-type-badge badge-${entryType}">
                            ${this.getTypeIcon(entryType)} ${this.getTypeDisplayName(entryType)}
                        </span>
                        ${isManual ? `
                        <div class="story-card-actions">
                            <button class="story-action-btn edit-story-btn" onclick="proposalStoryManager.editStoryEntry('${entry.reference_id}')" title="Edit entry">
                                <span class="material-icons" style="font-size: 14px;">edit</span>
                            </button>
                            <button class="story-action-btn delete-story-btn" onclick="proposalStoryManager.deleteStoryEntry('${entry.reference_id}')" title="Delete entry">
                                <span class="material-icons" style="font-size: 14px;">delete</span>
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                
                <div class="story-card-content">
                    ${this.formatStoryContent(entry.story_content)}
                </div>
                
                ${this.renderChangedFields(entry)}
                
                ${this.renderCardFooter(entry)}
            </div>
        `;
    }
    
    getCardClasses(isManual, entryType) {
        let classes = [];
        
        if (isManual) {
            classes.push('manual-entry');
        } else {
            classes.push('system-entry');
        }
        
        classes.push(entryType);
        return classes.join(' ');
    }
    
    getAuthorInitials(author) {
        if (!author) return 'U';
        return author.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
    }
    
    getTypeIcon(entryType) {
        const typeConfig = this.entryTypes[entryType];
        if (typeConfig && typeConfig.icon) {
            return `<span class="material-icons" style="font-size: 10px;">${typeConfig.icon}</span>`;
        }
        return '';
    }
    
    getTypeDisplayName(entryType) {
        const displayNames = {
            'comment': 'Comment',
            'client_feedback': 'Client Feedback',
            'status_update': 'Status Update',
            'issue': 'Issue',
            'resolution': 'Resolution',
            'system_change': 'System Update'
        };
        return displayNames[entryType] || 'Update';
    }
    
    sanitizeText(text) {
        if (!text) return '';
        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    formatStoryContent(content) {
        let formattedContent = this.sanitizeText(content);
        
        // Convert line breaks to paragraphs
        formattedContent = formattedContent.split('\n')
            .filter(line => line.trim())
            .map(line => `<p>${line}</p>`)
            .join('');
        
        return formattedContent || '<p class="text-gray-500 italic">No content</p>';
    }
    
    renderChangedFields(entry) {
        if (!entry.story_metadata || entry.source_type !== 'revision') {
            return '';
        }
        
        try {
            const changedFields = typeof entry.story_metadata === 'string' 
                ? JSON.parse(entry.story_metadata) 
                : entry.story_metadata;
            
            if (!changedFields || Object.keys(changedFields).length === 0) {
                return '';
            }
            
            const fieldsHTML = Object.entries(changedFields).map(([field, values]) => {
                const fieldName = this.humanizeFieldName(field);
                let oldValue = values.old || '-';
                let newValue = values.new || '-';
                
                // Truncate long values
                if (oldValue.length > 50) oldValue = oldValue.substring(0, 50) + '...';
                if (newValue.length > 50) newValue = newValue.substring(0, 50) + '...';
                
                return `
                    <div class="changed-field">
                        <span class="changed-field-name">${fieldName}</span>
                        <div class="changed-field-values">
                            <span class="field-value-old">${this.sanitizeText(oldValue)}</span>
                            <span class="material-icons" style="font-size: 12px;">arrow_forward</span>
                            <span class="field-value-new">${this.sanitizeText(newValue)}</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="changed-fields">
                    <h5>Field Changes</h5>
                    <div class="changed-fields-list">
                        ${fieldsHTML}
                    </div>
                </div>
            `;
        } catch (error) {
            console.warn('[ProposalStory] Error parsing changed fields:', error);
            return '';
        }
    }
    
    humanizeFieldName(fieldName) {
        const fieldMap = {
            'project_name': 'Project Name',
            'client': 'Client',
            'final_amt': 'Final Amount',
            'opp_status': 'Status',
            'account_mgr': 'Account Manager',
            'solutions': 'Solution',
            'margin': 'Margin',
            'submitted_date': 'Submitted Date',
            'forecast_date': 'Forecast Date',
            'decision': 'Decision',
            'pic': 'PIC',
            'bom': 'BOM'
        };
        
        return fieldMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    renderCardFooter(entry) {
        const tags = [];
        
        // Add priority/impact tag for system entries
        if (!entry.is_manual && entry.story_priority) {
            const priorityColors = {
                'low': 'bg-gray-200 text-gray-800',
                'medium': 'bg-blue-200 text-blue-800',
                'high': 'bg-orange-200 text-orange-800',
                'critical': 'bg-red-200 text-red-800'
            };
            const colorClass = priorityColors[entry.story_priority] || 'bg-gray-200 text-gray-800';
            tags.push(`<span class="story-card-tag ${colorClass}">${entry.story_priority} impact</span>`);
        }
        
        if (tags.length === 0) return '';
        
        return `
            <div class="story-card-footer">
                <div class="story-card-tags">
                    ${tags.join('')}
                </div>
            </div>
        `;
    }
    
    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }
    
    formatFullDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }
    
    updateStoryStats() {
        const statsText = document.getElementById('storyStatsText');
        if (!statsText) return;
        
        const totalEntries = this.storyData.length;
        const manualEntries = this.storyData.filter(entry => entry.is_manual).length;
        const systemEntries = totalEntries - manualEntries;
        
        statsText.textContent = `${totalEntries} total entries • ${manualEntries} manual • ${systemEntries} system updates`;
    }
    
    // Add new story entry
    async addStoryEntry() {
        if (this.isLoading) return;
        
        const entryType = document.getElementById('storyEntryType').value;
        const title = document.getElementById('storyEntryTitle').value.trim();
        const content = document.getElementById('storyEntryContent').value.trim();
        
        // Validation
        if (!content) {
            this.showFormError('Please enter story content');
            return;
        }
        
        const typeConfig = this.entryTypes[entryType];
        if (typeConfig && typeConfig.requiresTitle && !title) {
            this.showFormError('Please enter a title for this entry type');
            return;
        }
        
        this.isLoading = true;
        const addButton = document.getElementById('addStoryEntryBtn');
        const originalText = addButton.innerHTML;
        addButton.innerHTML = '<span class="material-icons animate-spin" style="font-size: 16px;">sync</span> Adding...';
        addButton.disabled = true;
        
        try {
            const payload = {
                opportunity_uid: this.currentOpportunityUid,
                entry_type: entryType,
                title: title || null,
                content: content,
                metadata: {}
            };
            
            console.log('[ProposalStory] Adding story entry:', payload);
            
            const response = await fetch(`${getApiUrl('/api/proposal-story')}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to add story entry: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[ProposalStory] Story entry added successfully:', result);
            
            // Reset form
            this.resetForm();
            
            // Reload timeline
            await this.loadStoryData();
            
            // Show success message
            this.showFormSuccess('Story entry added successfully!');
            
        } catch (error) {
            console.error('[ProposalStory] Error adding story entry:', error);
            this.showFormError('Failed to add story entry. Please try again.');
        } finally {
            this.isLoading = false;
            addButton.innerHTML = originalText;
            addButton.disabled = false;
        }
    }
    
    // Edit existing story entry
    async editStoryEntry(referenceId) {
        const entry = this.storyData.find(e => e.reference_id === referenceId);
        if (!entry || !entry.is_manual) {
            console.error('[ProposalStory] Cannot edit non-manual entry or entry not found');
            return;
        }
        
        // Find the story card and replace with edit form
        const cardElement = document.querySelector(`[data-entry-id="${referenceId}"]`);
        if (!cardElement) return;
        
        const originalHTML = cardElement.innerHTML;
        cardElement.innerHTML = `
            <div class="story-card-edit-form">
                <div class="edit-form-header">
                    <h4>Edit Story Entry</h4>
                    <div class="edit-form-actions">
                        <button class="story-action-btn" onclick="proposalStoryManager.cancelEdit('${referenceId}')" title="Cancel">
                            <span class="material-icons" style="font-size: 14px;">close</span>
                        </button>
                    </div>
                </div>
                
                <div class="edit-form-body">
                    <div class="form-group">
                        <label for="editEntryType_${referenceId}">Entry Type</label>
                        <select id="editEntryType_${referenceId}" class="form-control">
                            <option value="comment" ${entry.story_subtype === 'comment' ? 'selected' : ''}>Comment</option>
                            <option value="client_feedback" ${entry.story_subtype === 'client_feedback' ? 'selected' : ''}>Client Feedback</option>
                            <option value="status_update" ${entry.story_subtype === 'status_update' ? 'selected' : ''}>Status Update</option>
                            <option value="issue" ${entry.story_subtype === 'issue' ? 'selected' : ''}>Issue</option>
                            <option value="resolution" ${entry.story_subtype === 'resolution' ? 'selected' : ''}>Resolution</option>
                        </select>
                    </div>
                    
                    <div class="form-group ${!entry.story_title ? 'hidden' : ''}" id="editTitleSection_${referenceId}">
                        <label for="editEntryTitle_${referenceId}">Title</label>
                        <input type="text" id="editEntryTitle_${referenceId}" class="form-control" value="${entry.story_title || ''}" placeholder="Entry title">
                    </div>
                    
                    <div class="form-group">
                        <label for="editEntryContent_${referenceId}">Content</label>
                        <textarea id="editEntryContent_${referenceId}" class="form-control" rows="4" placeholder="Enter story content">${entry.story_content || ''}</textarea>
                    </div>
                    
                    <div class="edit-form-buttons">
                        <button class="btn btn-primary" onclick="proposalStoryManager.updateStoryEntry('${referenceId}')">Save Changes</button>
                        <button class="btn btn-secondary" onclick="proposalStoryManager.cancelEdit('${referenceId}')">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        // Store original HTML for cancel
        cardElement.setAttribute('data-original-html', originalHTML);
        
        // Focus on content textarea
        setTimeout(() => {
            const textarea = document.getElementById(`editEntryContent_${referenceId}`);
            if (textarea) textarea.focus();
        }, 100);
    }
    
    // Cancel edit and restore original card
    cancelEdit(referenceId) {
        const cardElement = document.querySelector(`[data-entry-id="${referenceId}"]`);
        if (!cardElement) return;
        
        const originalHTML = cardElement.getAttribute('data-original-html');
        if (originalHTML) {
            cardElement.innerHTML = originalHTML;
            cardElement.removeAttribute('data-original-html');
        }
    }
    
    // Update story entry
    async updateStoryEntry(referenceId) {
        const entryType = document.getElementById(`editEntryType_${referenceId}`).value;
        const title = document.getElementById(`editEntryTitle_${referenceId}`).value.trim();
        const content = document.getElementById(`editEntryContent_${referenceId}`).value.trim();
        
        if (!content) {
            alert('Please enter story content');
            return;
        }
        
        try {
            const payload = {
                entry_type: entryType,
                title: title || null,
                content: content
            };
            
            const response = await fetch(`${getApiUrl(`/api/proposal-story/${referenceId}`)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update story entry: ${response.status}`);
            }
            
            // Reload timeline to show updated entry
            await this.loadStoryData();
            
        } catch (error) {
            console.error('[ProposalStory] Error updating story entry:', error);
            alert('Failed to update story entry. Please try again.');
        }
    }
    
    // Delete story entry
    async deleteStoryEntry(referenceId) {
        if (!confirm('Are you sure you want to delete this story entry?')) {
            return;
        }
        
        try {
            const response = await fetch(`${getApiUrl(`/api/proposal-story/${referenceId}`)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to delete story entry: ${response.status}`);
            }
            
            // Reload timeline to remove deleted entry
            await this.loadStoryData();
            
        } catch (error) {
            console.error('[ProposalStory] Error deleting story entry:', error);
            alert('Failed to delete story entry. Please try again.');
        }
    }
    
    showFormError(message) {
        this.showFormMessage(message, 'error');
    }
    
    showFormSuccess(message) {
        this.showFormMessage(message, 'success');
    }
    
    showFormMessage(message, type) {
        // Remove any existing message
        const existingMessage = document.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        const addSection = document.getElementById('addStorySection');
        if (!addSection) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `form-message text-sm px-3 py-2 rounded-lg mb-3 ${
            type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 
            'bg-green-100 text-green-700 border border-green-200'
        }`;
        messageEl.textContent = message;
        
        addSection.appendChild(messageEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }
}

// Make the class available globally
window.ProposalStoryManager = ProposalStoryManager;

// Global instance
let proposalStoryManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    proposalStoryManager = new ProposalStoryManager();
    // Make it available globally
    window.proposalStoryManager = proposalStoryManager;
    console.log('[ProposalStory] Manager initialized and available globally');
});

// Global function to open story modal (called from table buttons)
function showProposalStory(opportunityUid, opportunityData = null) {
    if (proposalStoryManager) {
        proposalStoryManager.openStoryModal(opportunityUid, opportunityData);
    } else {
        console.error('[ProposalStory] Manager not initialized');
    }
}

// Ensure function is available globally
window.showProposalStory = showProposalStory;

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProposalStoryManager, showProposalStory };
}