// Filter Dropdown Label Theme Fix - JavaScript Override
// This script applies theme-aware styling to filter dropdown labels
// It runs after page load to ensure it overrides Tailwind CSS

(function() {
    'use strict';
    
    console.log('🎨 Filter Dropdown Label Theme Fix - Loading...');
    
    function applyFilterLabelStyles() {
        const labels = document.querySelectorAll('label.text-sm.font-medium.mr-1, span.text-sm.font-medium.mr-1');
        const isDark = document.body.classList.contains('dark');
        
        console.log(`📋 Found ${labels.length} filter labels`);
        console.log(`🌙 Current theme: ${isDark ? 'dark' : 'light'}`);
        
        labels.forEach((label, index) => {
            if (isDark) {
                // Dark theme: light text
                label.style.color = '#e0e0e0';
                label.style.setProperty('color', '#e0e0e0', 'important');
            } else {
                // Light theme: dark text
                label.style.color = '#202124';
                label.style.setProperty('color', '#202124', 'important');
            }
            
            console.log(`✅ Applied ${isDark ? 'dark' : 'light'} theme to label ${index + 1}: "${label.textContent.trim()}"`);
        });
        
        return labels.length;
    }
    
    function observeThemeChanges() {
        const body = document.body;
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    console.log('🔄 Theme change detected, reapplying label styles...');
                    setTimeout(applyFilterLabelStyles, 50); // Small delay to ensure DOM is updated
                }
            });
        });
        
        observer.observe(body, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        console.log('👀 Theme change observer activated');
        return observer;
    }
    
    function init() {
        console.log('🚀 Initializing filter label theme fix...');
        
        // Apply styles immediately
        const labelCount = applyFilterLabelStyles();
        
        // Set up theme change observer
        const observer = observeThemeChanges();
        
        // Also apply styles on any dynamic content changes
        const contentObserver = new MutationObserver((mutations) => {
            let shouldReapply = false;
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            const hasFilterLabels = node.querySelectorAll && 
                                node.querySelectorAll('label.text-sm.font-medium.mr-1, span.text-sm.font-medium.mr-1').length > 0;
                            if (hasFilterLabels) {
                                shouldReapply = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldReapply) {
                console.log('📝 New filter labels detected, reapplying styles...');
                setTimeout(applyFilterLabelStyles, 100);
            }
        });
        
        contentObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log(`✅ Filter label theme fix initialized successfully (${labelCount} labels processed)`);
        
        // Make functions available globally for debugging
        window.debugFilterLabels = {
            applyStyles: applyFilterLabelStyles,
            getLabels: () => document.querySelectorAll('label.text-sm.font-medium.mr-1, span.text-sm.font-medium.mr-1'),
            getCurrentTheme: () => document.body.classList.contains('dark') ? 'dark' : 'light'
        };
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM is already ready
        init();
    }
    
    // Also initialize on window load as backup
    window.addEventListener('load', () => {
        setTimeout(applyFilterLabelStyles, 200); // Delay to ensure all CSS is loaded
    });
    
})();
