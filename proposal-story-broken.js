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
            'milestone': { requiresTitle: true, icon: 'flag', color: 'amber' },
            'decision_point': { requiresTitle: true, icon: 'gavel', color: 'orange' },
            'client_feedback': { requiresTitle: false, icon: 'feedback', color: 'purple' },
            'status_update': { requiresTitle: false, icon: 'update', color: 'indigo' },
            'internal_note': { requiresTitle: false, icon: 'note', color: 'gray' },
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
        const visibility = document.getElementById('storyVisibility');
        const titleSection = document.getElementById('storyTitleSection');
        
        if (entryType) entryType.value = 'comment';
        if (title) title.value = '';
        if (content) {
            content.value = '';
            content.style.height = 'auto';
        }
        if (visibility) visibility.value = 'internal';
        if (titleSection) titleSection.classList.add('hidden');
    }
    
    // Load story data from both revision history and manual entries\n    async loadStoryData() {\n        if (!this.currentOpportunityUid) return;\n        \n        this.showLoading();\n        \n        try {\n            console.log('[ProposalStory] Loading story data for:', this.currentOpportunityUid);\n            \n            // Fetch story data from API\n            const response = await fetch(`${getApiUrl()}/api/proposal-story/${this.currentOpportunityUid}`, {\n                headers: {\n                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`\n                }\n            });\n            \n            if (!response.ok) {\n                throw new Error(`Failed to load story data: ${response.status}`);\n            }\n            \n            const data = await response.json();\n            this.storyData = data.story || [];\n            \n            console.log('[ProposalStory] Loaded story entries:', this.storyData.length);\n            \n            // Render timeline\n            this.renderTimeline();\n            \n            // Update stats\n            this.updateStoryStats();\n            \n        } catch (error) {\n            console.error('[ProposalStory] Error loading story data:', error);\n            this.showError('Failed to load proposal story. Please try again.');\n        } finally {\n            this.hideLoading();\n        }\n    }\n    \n    showLoading() {\n        const loading = document.getElementById('storyTimelineLoading');\n        const timeline = document.getElementById('storyTimeline');\n        const empty = document.getElementById('storyTimelineEmpty');\n        \n        if (loading) loading.classList.remove('hidden');\n        if (timeline) timeline.classList.add('hidden');\n        if (empty) empty.classList.add('hidden');\n    }\n    \n    hideLoading() {\n        const loading = document.getElementById('storyTimelineLoading');\n        if (loading) loading.classList.add('hidden');\n    }\n    \n    showError(message) {\n        const container = document.getElementById('storyTimelineContainer');\n        if (container) {\n            container.innerHTML = `\n                <div class=\"text-center py-8 text-red-500\">\n                    <span class=\"material-icons text-4xl mb-2\">error</span>\n                    <p class=\"font-medium\">${message}</p>\n                    <button onclick=\"proposalStoryManager.loadStoryData()\" class=\"mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors\">\n                        Try Again\n                    </button>\n                </div>\n            `;\n        }\n    }\n    \n    renderTimeline() {\n        const timeline = document.getElementById('storyTimeline');\n        const empty = document.getElementById('storyTimelineEmpty');\n        \n        if (!timeline) return;\n        \n        if (!this.storyData || this.storyData.length === 0) {\n            timeline.classList.add('hidden');\n            if (empty) empty.classList.remove('hidden');\n            return;\n        }\n        \n        // Sort story data by date (newest first)\n        const sortedData = [...this.storyData].sort((a, b) => \n            new Date(b.timeline_date) - new Date(a.timeline_date)\n        );\n        \n        // Generate timeline HTML\n        const timelineHTML = `\n            <div class=\"story-timeline\">\n                ${sortedData.map(entry => this.renderStoryCard(entry)).join('')}\n            </div>\n        `;\n        \n        timeline.innerHTML = timelineHTML;\n        timeline.classList.remove('hidden');\n        if (empty) empty.classList.add('hidden');\n        \n        // Add animation delays for smooth appearance\n        const cards = timeline.querySelectorAll('.story-card');\n        cards.forEach((card, index) => {\n            card.style.animationDelay = `${index * 0.1}s`;\n        });\n    }\n    \n    renderStoryCard(entry) {\n        const isManual = entry.is_manual;\n        const entryType = entry.story_subtype || 'comment';\n        const cardClasses = this.getCardClasses(isManual, entryType);\n        const typeConfig = this.entryTypes[entryType] || this.entryTypes['comment'];\n        \n        return `\n            <div class=\"story-card ${cardClasses}\" data-entry-id=\"${entry.reference_id}\" data-source=\"${entry.source_type}\">\n                <div class=\"story-card-header\">\n                    <div class=\"story-card-author\">\n                        <div class=\"story-card-avatar\">\n                            ${this.getAuthorInitials(entry.author)}\n                        </div>\n                        <div class=\"story-card-author-info\">\n                            <h4>${this.sanitizeText(entry.author)}</h4>\n                            <p>${entry.author_role || 'User'}</p>\n                        </div>\n                    </div>\n                    <div class=\"story-card-meta\">\n                        <div class=\"story-card-timestamp\" title=\"${this.formatFullDateTime(entry.timeline_date)}\">\n                            ${this.formatRelativeTime(entry.timeline_date)}\n                        </div>\n                        <span class=\"story-card-type-badge badge-${entryType}\">\n                            ${this.getTypeIcon(entryType)} ${this.getTypeDisplayName(entryType)}\n                        </span>\n                    </div>\n                </div>\n                \n                <div class=\"story-card-title\">\n                    ${this.sanitizeText(entry.story_title)}\n                </div>\n                \n                <div class=\"story-card-content\">\n                    ${this.formatStoryContent(entry.story_content, entry.story_metadata)}\n                </div>\n                \n                ${this.renderChangedFields(entry)}\n                \n                ${this.renderCardFooter(entry)}\n            </div>\n        `;\n    }\n    \n    getCardClasses(isManual, entryType) {\n        let classes = [];\n        \n        if (isManual) {\n            classes.push('manual-entry');\n        } else {\n            classes.push('system-entry');\n        }\n        \n        // Add type-specific class\n        classes.push(entryType);\n        \n        return classes.join(' ');\n    }\n    \n    getAuthorInitials(author) {\n        if (!author) return 'U';\n        return author.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();\n    }\n    \n    getTypeIcon(entryType) {\n        const typeConfig = this.entryTypes[entryType];\n        if (typeConfig && typeConfig.icon) {\n            return `<span class=\"material-icons\" style=\"font-size: 10px;\">${typeConfig.icon}</span>`;\n        }\n        return '';\n    }\n    \n    getTypeDisplayName(entryType) {\n        const displayNames = {\n            'comment': 'Comment',\n            'milestone': 'Milestone',\n            'decision_point': 'Decision',\n            'client_feedback': 'Client Feedback',\n            'status_update': 'Status Update',\n            'internal_note': 'Note',\n            'issue': 'Issue',\n            'resolution': 'Resolution'\n        };\n        return displayNames[entryType] || 'Update';\n    }\n    \n    sanitizeText(text) {\n        if (!text) return '';\n        return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');\n    }\n    \n    formatStoryContent(content, metadata) {\n        let formattedContent = this.sanitizeText(content);\n        \n        // Convert line breaks to paragraphs\n        formattedContent = formattedContent.split('\\n').filter(line => line.trim()).map(line => `<p>${line}</p>`).join('');\n        \n        return formattedContent || '<p class=\"text-gray-500 italic\">No content</p>';\n    }\n    \n    renderChangedFields(entry) {\n        if (!entry.story_metadata || entry.source_type !== 'revision') {\n            return '';\n        }\n        \n        try {\n            const changedFields = typeof entry.story_metadata === 'string' \n                ? JSON.parse(entry.story_metadata) \n                : entry.story_metadata;\n            \n            if (!changedFields || Object.keys(changedFields).length === 0) {\n                return '';\n            }\n            \n            const fieldsHTML = Object.entries(changedFields).map(([field, values]) => {\n                const fieldName = this.humanizeFieldName(field);\n                let oldValue = values.old || '-';\n                let newValue = values.new || '-';\n                \n                // Truncate long values\n                if (oldValue.length > 50) oldValue = oldValue.substring(0, 50) + '...';\n                if (newValue.length > 50) newValue = newValue.substring(0, 50) + '...';\n                \n                return `\n                    <div class=\"changed-field\">\n                        <span class=\"changed-field-name\">${fieldName}</span>\n                        <div class=\"changed-field-values\">\n                            <span class=\"field-value-old\">${this.sanitizeText(oldValue)}</span>\n                            <span class=\"material-icons\" style=\"font-size: 12px;\">arrow_forward</span>\n                            <span class=\"field-value-new\">${this.sanitizeText(newValue)}</span>\n                        </div>\n                    </div>\n                `;\n            }).join('');\n            \n            return `\n                <div class=\"changed-fields\">\n                    <h5>Field Changes</h5>\n                    <div class=\"changed-fields-list\">\n                        ${fieldsHTML}\n                    </div>\n                </div>\n            `;\n        } catch (error) {\n            console.warn('[ProposalStory] Error parsing changed fields:', error);\n            return '';\n        }\n    }\n    \n    humanizeFieldName(fieldName) {\n        const fieldMap = {\n            'project_name': 'Project Name',\n            'client': 'Client',\n            'final_amt': 'Final Amount',\n            'opp_status': 'Status',\n            'account_mgr': 'Account Manager',\n            'solutions': 'Solution',\n            'margin': 'Margin',\n            'submitted_date': 'Submitted Date',\n            'forecast_date': 'Forecast Date',\n            'decision': 'Decision',\n            'pic': 'PIC',\n            'bom': 'BOM'\n        };\n        \n        return fieldMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());\n    }\n    \n    renderCardFooter(entry) {\n        const tags = [];\n        \n        // Add visibility tag for manual entries\n        if (entry.is_manual && entry.story_metadata) {\n            try {\n                const metadata = typeof entry.story_metadata === 'string' \n                    ? JSON.parse(entry.story_metadata) \n                    : entry.story_metadata;\n                \n                if (metadata.visibility) {\n                    tags.push(`<span class=\"story-card-tag\">${metadata.visibility}</span>`);\n                }\n            } catch (error) {\n                // Ignore parsing errors\n            }\n        }\n        \n        // Add priority/impact tag for system entries\n        if (!entry.is_manual && entry.story_priority) {\n            const priorityColors = {\n                'low': 'bg-gray-200 text-gray-800',\n                'medium': 'bg-blue-200 text-blue-800',\n                'high': 'bg-orange-200 text-orange-800',\n                'critical': 'bg-red-200 text-red-800'\n            };\n            const colorClass = priorityColors[entry.story_priority] || 'bg-gray-200 text-gray-800';\n            tags.push(`<span class=\"story-card-tag ${colorClass}\">${entry.story_priority} impact</span>`);\n        }\n        \n        if (tags.length === 0) return '';\n        \n        return `\n            <div class=\"story-card-footer\">\n                <div class=\"story-card-tags\">\n                    ${tags.join('')}\n                </div>\n            </div>\n        `;\n    }\n    \n    formatRelativeTime(dateString) {\n        const date = new Date(dateString);\n        const now = new Date();\n        const diffMs = now - date;\n        const diffMins = Math.floor(diffMs / 60000);\n        const diffHours = Math.floor(diffMins / 60);\n        const diffDays = Math.floor(diffHours / 24);\n        \n        if (diffMins < 1) return 'Just now';\n        if (diffMins < 60) return `${diffMins}m ago`;\n        if (diffHours < 24) return `${diffHours}h ago`;\n        if (diffDays < 7) return `${diffDays}d ago`;\n        \n        return date.toLocaleDateString();\n    }\n    \n    formatFullDateTime(dateString) {\n        const date = new Date(dateString);\n        return date.toLocaleString();\n    }\n    \n    updateStoryStats() {\n        const statsText = document.getElementById('storyStatsText');\n        if (!statsText) return;\n        \n        const totalEntries = this.storyData.length;\n        const manualEntries = this.storyData.filter(entry => entry.is_manual).length;\n        const systemEntries = totalEntries - manualEntries;\n        \n        statsText.textContent = `${totalEntries} total entries • ${manualEntries} manual • ${systemEntries} system updates`;\n    }\n    \n    // Add new story entry\n    async addStoryEntry() {\n        if (this.isLoading) return;\n        \n        const entryType = document.getElementById('storyEntryType').value;\n        const title = document.getElementById('storyEntryTitle').value.trim();\n        const content = document.getElementById('storyEntryContent').value.trim();\n        const visibility = document.getElementById('storyVisibility').value;\n        \n        // Validation\n        if (!content) {\n            this.showFormError('Please enter story content');\n            return;\n        }\n        \n        const typeConfig = this.entryTypes[entryType];\n        if (typeConfig && typeConfig.requiresTitle && !title) {\n            this.showFormError('Please enter a title for this entry type');\n            return;\n        }\n        \n        this.isLoading = true;\n        const addButton = document.getElementById('addStoryEntryBtn');\n        const originalText = addButton.innerHTML;\n        addButton.innerHTML = '<span class=\"material-icons animate-spin\" style=\"font-size: 16px;\">sync</span> Adding...';\n        addButton.disabled = true;\n        \n        try {\n            const payload = {\n                opportunity_uid: this.currentOpportunityUid,\n                entry_type: entryType,\n                title: title || null,\n                content: content,\n                visibility: visibility,\n                metadata: {}\n            };\n            \n            console.log('[ProposalStory] Adding story entry:', payload);\n            \n            const response = await fetch(`${getApiUrl()}/api/proposal-story`, {\n                method: 'POST',\n                headers: {\n                    'Content-Type': 'application/json',\n                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`\n                },\n                body: JSON.stringify(payload)\n            });\n            \n            if (!response.ok) {\n                throw new Error(`Failed to add story entry: ${response.status}`);\n            }\n            \n            const result = await response.json();\n            console.log('[ProposalStory] Story entry added successfully:', result);\n            \n            // Reset form\n            this.resetForm();\n            \n            // Reload timeline\n            await this.loadStoryData();\n            \n            // Show success message\n            this.showFormSuccess('Story entry added successfully!');\n            \n        } catch (error) {\n            console.error('[ProposalStory] Error adding story entry:', error);\n            this.showFormError('Failed to add story entry. Please try again.');\n        } finally {\n            this.isLoading = false;\n            addButton.innerHTML = originalText;\n            addButton.disabled = false;\n        }\n    }\n    \n    showFormError(message) {\n        this.showFormMessage(message, 'error');\n    }\n    \n    showFormSuccess(message) {\n        this.showFormMessage(message, 'success');\n    }\n    \n    showFormMessage(message, type) {\n        // Remove any existing message\n        const existingMessage = document.querySelector('.form-message');\n        if (existingMessage) {\n            existingMessage.remove();\n        }\n        \n        const addSection = document.getElementById('addStorySection');\n        if (!addSection) return;\n        \n        const messageEl = document.createElement('div');\n        messageEl.className = `form-message text-sm px-3 py-2 rounded-lg mb-3 ${\n            type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : \n            'bg-green-100 text-green-700 border border-green-200'\n        }`;\n        messageEl.textContent = message;\n        \n        addSection.appendChild(messageEl);\n        \n        // Auto-remove after 5 seconds\n        setTimeout(() => {\n            if (messageEl.parentNode) {\n                messageEl.remove();\n            }\n        }, 5000);\n    }\n}\n\n// Global instance\nlet proposalStoryManager;\n\n// Initialize when DOM is ready\ndocument.addEventListener('DOMContentLoaded', () => {\n    proposalStoryManager = new ProposalStoryManager();\n    console.log('[ProposalStory] Manager initialized');\n});\n\n// Global function to open story modal (called from table buttons)\nfunction showProposalStory(opportunityUid, opportunityData = null) {\n    if (proposalStoryManager) {\n        proposalStoryManager.openStoryModal(opportunityUid, opportunityData);\n    } else {\n        console.error('[ProposalStory] Manager not initialized');\n    }\n}\n\n// Export for module usage if needed\nif (typeof module !== 'undefined' && module.exports) {\n    module.exports = { ProposalStoryManager, showProposalStory };\n}"