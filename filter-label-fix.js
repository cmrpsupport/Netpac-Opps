// filter-label-fix.js - Comprehensive filter label color fix for all dashboards

// --- COMPREHENSIVE FILTER LABEL COLOR FIX ---
function forceFilterLabelColors() {
    // More comprehensive selectors including all possible variations
    const labelSelectors = [
        'label.text-sm.font-medium',
        'span.text-sm.font-medium.mr-2', 
        'span.text-sm.font-medium',
        '.comparison-label.text-sm.font-medium',
        'label.comparison-label',
        '.flex.items-center.gap-2 label'
    ];
    
    const labels = document.querySelectorAll(labelSelectors.join(', '));
    const selects = document.querySelectorAll('select.filter-dropdown, select');
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    
    labels.forEach((label, index) => {
        const color = isDark ? '#f3f4f6' : '#374151';
        
        // Apply multiple CSS properties to override any conflicting styles
        label.style.setProperty('color', color, 'important');
        label.style.setProperty('text-color', color, 'important'); // Tailwind utility
        label.style.removeProperty('color'); // Remove any existing color
        label.style.setProperty('color', color, 'important'); // Re-apply
        
        // Also apply to parent if needed
        if (label.parentElement && label.parentElement.classList.contains('flex')) {
            label.parentElement.style.setProperty('color', color, 'important');
        }
    });
    
    selects.forEach((select, index) => {
        if (isDark) {
            // Use CSS variables to match executive dashboard
            select.style.setProperty('background-color', 'var(--bg-control)', 'important');
            select.style.setProperty('color', 'var(--text-control)', 'important');
            select.style.setProperty('border-color', 'var(--border-control)', 'important');
            
            // Also style the options
            const options = select.querySelectorAll('option');
            options.forEach(option => {
                option.style.setProperty('background-color', 'var(--bg-control)', 'important');
                option.style.setProperty('color', 'var(--text-control)', 'important');
            });
        } else {
            select.style.setProperty('background-color', '#ffffff', 'important');
            select.style.setProperty('color', '#374151', 'important');
            select.style.setProperty('border-color', '#d1d5db', 'important');
            
            // Also style the options for light mode
            const options = select.querySelectorAll('option');
            options.forEach(option => {
                option.style.setProperty('background-color', '#ffffff', 'important');
                option.style.setProperty('color', '#374151', 'important');
            });
        }
    });
}

// --- CHANGE PASSWORD BUTTON FUNCTIONALITY ---
function setupChangePasswordButtonWithVisibility() {
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (!changePasswordBtn) return;
    
    // Set up click handler
    changePasswordBtn.addEventListener('click', function() {
        window.location.href = 'update_password.html';
    });
    
    // Hide/show button based on authentication
    function updateVisibility() {
        const token = localStorage.getItem('authToken');
        changePasswordBtn.style.display = token ? '' : 'none';
    }
    
    // Initial visibility check
    updateVisibility();
    
    // Watch for auth changes
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken' || e.key === 'authEvent') {
            updateVisibility();
        }
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {
    // Initialize comprehensive filter label color fix
    forceFilterLabelColors();
    setTimeout(forceFilterLabelColors, 100); // Delayed application
    
    // Setup change password button functionality
    setupChangePasswordButtonWithVisibility();
    
    // Watch for theme changes on both HTML and body elements
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                setTimeout(forceFilterLabelColors, 10);
            }
        });
    });
    
    // Watch both HTML and body elements for class changes
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
    });
    
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });
}); 