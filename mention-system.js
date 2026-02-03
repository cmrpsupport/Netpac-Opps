// Mention System for Proposal Stories
// Provides @mention autocomplete, highlighting, and user suggestions

class MentionSystem {
    constructor() {
        this.users = [];
        this.activeTextarea = null;
        this.dropdown = null;
        this.isDropdownOpen = false;
        this.selectedIndex = -1;
        this.currentMentionStart = -1;
        this.currentMentionText = '';
        
        this.init();
    }
    
    async init() {
        this.createDropdown();
        this.bindGlobalEvents();
        // Don't load users during init - load them when needed
    }
    
    async loadUsers() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.log('[MentionSystem] No auth token found, using fallback users');
                this.useFallbackUsers();
                return;
            }
            
            // Load users from the mentions API (public endpoint)
            const response = await fetch(`${getApiUrl('/api/users/mentions')}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.users = data; // Data is already in the correct format from the API
                console.log('[MentionSystem] Loaded users from API:', this.users.length);
            } else {
                console.warn('[MentionSystem] API request failed:', response.status, response.statusText);
                this.useFallbackUsers();
            }
        } catch (error) {
            console.error('[MentionSystem] Error loading users for mentions:', error);
            this.useFallbackUsers();
        }
    }
    
    useFallbackUsers() {
        this.users = [
            { id: '1', name: 'RJR', email: 'reuel.rivera@cmrpautomation.com', displayName: 'RJR', searchText: 'rjr reuel.rivera@cmrpautomation.com' },
            { id: '2', name: 'JMO', email: 'juan.ortiz@cmrpautomation.com', displayName: 'JMO', searchText: 'jmo juan.ortiz@cmrpautomation.com' },
            { id: '3', name: 'CBD', email: 'crisostomo.diaz@cmrpautomation.com', displayName: 'CBD', searchText: 'cbd crisostomo.diaz@cmrpautomation.com' },
            { id: '4', name: 'NSG', email: 'neil.gomez@cmrpautomation.com', displayName: 'NSG', searchText: 'nsg neil.gomez@cmrpautomation.com' },
            { id: '5', name: 'ISP', email: 'ivy.pico@cmrpautomation.com', displayName: 'ISP', searchText: 'isp ivy.pico@cmrpautomation.com' },
            { id: '6', name: 'ASB', email: 'arvin.bacolod@cmrpautomation.com', displayName: 'ASB', searchText: 'asb arvin.bacolod@cmrpautomation.com' }
        ];
        console.log('[MentionSystem] Using fallback users:', this.users.length);
    }
    
    createDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'mention-dropdown hidden';
        this.dropdown.innerHTML = `
            <div class="mention-dropdown-header">
                <span class="material-icons">alternate_email</span>
                <span>Mention someone</span>
            </div>
            <div class="mention-dropdown-list"></div>
        `;
        document.body.appendChild(this.dropdown);
    }
    
    bindGlobalEvents() {
        // Close dropdown on escape or click outside
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDropdownOpen) {
                this.hideDropdown();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (this.isDropdownOpen && !this.dropdown.contains(e.target) && e.target !== this.activeTextarea) {
                this.hideDropdown();
            }
        });
    }
    
    attachToTextarea(textarea) {
        if (!textarea) return;
        
        // Remove existing listeners if any
        this.detachFromTextarea(textarea);
        
        // Add event listeners
        textarea.addEventListener('input', (e) => this.handleInput(e));
        textarea.addEventListener('keydown', (e) => this.handleKeydown(e));
        textarea.addEventListener('blur', (e) => this.handleBlur(e));
        textarea.addEventListener('click', (e) => this.handleClick(e));
        
        // Mark as attached
        textarea.setAttribute('data-mention-attached', 'true');
        
        // Apply initial highlighting
        this.highlightMentions(textarea);
    }
    
    detachFromTextarea(textarea) {
        if (!textarea) return;
        
        // Remove the attached flag
        textarea.removeAttribute('data-mention-attached');
        
        // Note: We don't remove event listeners here as they're bound with arrow functions
        // In a production app, you'd want to store references to the bound functions
    }
    
    async handleInput(e) {
        const textarea = e.target;
        this.activeTextarea = textarea;
        
        const cursorPosition = textarea.selectionStart;
        const text = textarea.value;
        
        // Find @ symbol before cursor
        const beforeCursor = text.substring(0, cursorPosition);
        const mentionMatch = beforeCursor.match(/@(\w*)$/);
        
        if (mentionMatch) {
            const mentionText = mentionMatch[1];
            this.currentMentionStart = cursorPosition - mentionText.length - 1; // -1 for @
            this.currentMentionText = mentionText;
            await this.showDropdown(textarea, mentionText);
        } else {
            this.hideDropdown();
        }
        
        // Apply highlighting with debounce
        clearTimeout(this.highlightTimeout);
        this.highlightTimeout = setTimeout(() => {
            this.highlightMentions(textarea);
        }, 100);
    }
    
    handleKeydown(e) {
        if (!this.isDropdownOpen) return;
        
        const list = this.dropdown.querySelector('.mention-dropdown-list');
        const items = list.querySelectorAll('.mention-item');
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.updateSelection(items);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection(items);
                break;
                
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
                    this.selectUser(items[this.selectedIndex].dataset.userId);
                }
                break;
                
            case 'Escape':
                this.hideDropdown();
                break;
        }
    }
    
    handleBlur(e) {
        // Delay hiding dropdown to allow for clicks
        setTimeout(() => {
            if (!this.dropdown.matches(':hover')) {
                this.hideDropdown();
            }
        }, 150);
    }
    
    handleClick(e) {
        // Reset mention state when clicking elsewhere in textarea
        if (this.isDropdownOpen) {
            this.handleInput(e);
        }
    }
    
    async showDropdown(textarea, searchText = '') {
        // Load users if not already loaded
        if (this.users.length === 0) {
            await this.loadUsers();
        }
        
        const filteredUsers = this.filterUsers(searchText);
        
        if (filteredUsers.length === 0) {
            this.hideDropdown();
            return;
        }
        
        this.renderDropdown(filteredUsers);
        this.positionDropdown(textarea);
        this.dropdown.classList.remove('hidden');
        this.isDropdownOpen = true;
        this.selectedIndex = -1;
    }
    
    hideDropdown() {
        this.dropdown.classList.add('hidden');
        this.isDropdownOpen = false;
        this.selectedIndex = -1;
        this.currentMentionStart = -1;
        this.currentMentionText = '';
        this.activeTextarea = null;
    }
    
    filterUsers(searchText) {
        if (!searchText) return this.users.slice(0, 8); // Show first 8 users
        
        const search = searchText.toLowerCase();
        return this.users.filter(user => 
            user.searchText.includes(search)
        ).slice(0, 8);
    }
    
    renderDropdown(users) {
        const list = this.dropdown.querySelector('.mention-dropdown-list');
        list.innerHTML = users.map(user => `
            <div class="mention-item" data-user-id="${user.id}" data-user-name="${user.name}">
                <div class="mention-avatar">
                    <span class="material-icons">person</span>
                </div>
                <div class="mention-info">
                    <div class="mention-name">${this.escapeHtml(user.displayName)}</div>
                    <div class="mention-email">${this.escapeHtml(user.email)}</div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        list.querySelectorAll('.mention-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectUser(item.dataset.userId);
            });
        });
    }
    
    updateSelection(items) {
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.selectedIndex);
        });
        
        // Scroll selected item into view
        if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
            items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    selectUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user || !this.activeTextarea) return;
        
        const textarea = this.activeTextarea;
        const text = textarea.value;
        const beforeMention = text.substring(0, this.currentMentionStart);
        const afterMention = text.substring(textarea.selectionStart);
        
        // Insert the mention
        const mention = `@${user.name}`;
        const newText = beforeMention + mention + ' ' + afterMention;
        const newCursorPosition = beforeMention.length + mention.length + 1;
        
        textarea.value = newText;
        textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        
        // Trigger input event to update highlighting
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        this.hideDropdown();
        textarea.focus();
    }
    
    positionDropdown(textarea) {
        if (!textarea) return;
        
        const rect = textarea.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Position dropdown below the textarea
        this.dropdown.style.position = 'absolute';
        this.dropdown.style.left = `${rect.left + scrollLeft}px`;
        this.dropdown.style.top = `${rect.bottom + scrollTop + 5}px`;
        this.dropdown.style.width = `${Math.max(300, rect.width)}px`;
        this.dropdown.style.zIndex = '10000';
    }
    
    highlightMentions(textarea) {
        if (!textarea || !textarea.value) return;
        
        // Create or update the highlight overlay
        let overlay = textarea.parentNode.querySelector('.mention-highlight-overlay');
        if (!overlay) {
            overlay = this.createHighlightOverlay(textarea);
        }
        
        // Parse mentions and create highlighted text
        const highlightedHTML = this.createHighlightedHTML(textarea.value);
        overlay.innerHTML = highlightedHTML;
        
        // Sync scroll position
        overlay.scrollTop = textarea.scrollTop;
        overlay.scrollLeft = textarea.scrollLeft;
    }
    
    createHighlightOverlay(textarea) {
        // Make textarea container position relative
        const container = textarea.parentNode;
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'mention-highlight-overlay';
        
        // Copy textarea styles
        const computedStyle = getComputedStyle(textarea);
        overlay.style.position = 'absolute';
        overlay.style.top = textarea.offsetTop + 'px';
        overlay.style.left = textarea.offsetLeft + 'px';
        overlay.style.width = textarea.offsetWidth + 'px';
        overlay.style.height = textarea.offsetHeight + 'px';
        overlay.style.padding = computedStyle.padding;
        overlay.style.border = computedStyle.border;
        overlay.style.borderColor = 'transparent';
        overlay.style.fontFamily = computedStyle.fontFamily;
        overlay.style.fontSize = computedStyle.fontSize;
        overlay.style.lineHeight = computedStyle.lineHeight;
        overlay.style.whiteSpace = 'pre-wrap';
        overlay.style.wordWrap = 'break-word';
        overlay.style.overflow = 'hidden';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1';
        overlay.style.color = 'transparent';
        
        container.appendChild(overlay);
        
        // Make textarea background transparent and increase z-index
        textarea.style.background = 'transparent';
        textarea.style.position = 'relative';
        textarea.style.zIndex = '2';
        
        // Sync scroll events
        textarea.addEventListener('scroll', () => {
            overlay.scrollTop = textarea.scrollTop;
            overlay.scrollLeft = textarea.scrollLeft;
        });
        
        return overlay;
    }
    
    createHighlightedHTML(text) {
        // Replace mentions with highlighted spans
        return text.replace(/@(\w+)/g, '<span class="mention-highlight">@$1</span>');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Public method to initialize mention system on a textarea
    static initializeOn(textareaSelector) {
        const textarea = document.querySelector(textareaSelector);
        if (!textarea) {
            console.warn('Textarea not found:', textareaSelector);
            return null;
        }
        
        // Create or get existing mention system
        if (!window.mentionSystem) {
            window.mentionSystem = new MentionSystem();
        }
        
        window.mentionSystem.attachToTextarea(textarea);
        return window.mentionSystem;
    }
}

// Make MentionSystem available globally
window.MentionSystem = MentionSystem;

// Auto-initialize for story entry textarea when available
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if user is authenticated
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    // Wait a bit for other scripts to load
    setTimeout(() => {
        const storyTextarea = document.getElementById('storyEntryContent');
        if (storyTextarea) {
            MentionSystem.initializeOn('#storyEntryContent');
        }
    }, 1000);
});

// Re-initialize when modals are opened (for dynamically loaded content)
document.addEventListener('modalOpened', () => {
    setTimeout(() => {
        const storyTextarea = document.getElementById('storyEntryContent');
        if (storyTextarea && !storyTextarea.hasAttribute('data-mention-attached')) {
            MentionSystem.initializeOn('#storyEntryContent');
        }
    }, 100);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MentionSystem;
}