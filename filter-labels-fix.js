// DARK MODE FILTER LABELS FIX - JavaScript solution for maximum reliability
function forceDarkModeFilterLabels() {
    const isDark = document.body.classList.contains('dark');
    const filterLabels = document.querySelectorAll('span.text-sm.font-medium.mr-2');
    
    filterLabels.forEach(label => {
        const text = label.textContent.trim();
        // Target only our filter labels by their text content
        if (text.includes('Show changes from:') || 
            text.includes('Solutions:') || 
            text.includes('Account Mgr:') || 
            text.includes('PIC:')) {
            
            if (isDark) {
                label.style.setProperty('color', '#e5e7eb', 'important');
            } else {
                label.style.setProperty('color', '#6b7280', 'important');
            }
        }
    });
}

// Apply on theme changes
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            forceDarkModeFilterLabels();
        }
    });
});

// Observe theme changes on body
observer.observe(document.body, { attributes: true });

// Apply immediately when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceDarkModeFilterLabels);
} else {
    forceDarkModeFilterLabels();
}

// Also apply after a brief delay to catch any late-loaded elements
setTimeout(forceDarkModeFilterLabels, 500);
