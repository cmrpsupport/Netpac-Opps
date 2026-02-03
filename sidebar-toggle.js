/**
 * Sidebar Toggle Functionality
 * Handles sidebar collapsing/expanding for proposal workbench
 */

function initializeSidebarToggle() {
    // Skip initialization for executive dashboard
    if (window.location.pathname.includes('executive_dashboard')) {
        console.log('Skipping sidebar toggle initialization for executive dashboard');
        return true;
    }

    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.sidebar-toggle-btn');
    
    console.log('Sidebar toggle setup:', {
        sidebar: sidebar,
        toggleBtn: toggleBtn
    });
    
    if (sidebar) {
        // Set initial state to collapsed
        sidebar.classList.add('collapsed');
        
        // Toggle function
        function toggleSidebar() {
            console.log('Toggle clicked');
            sidebar.classList.toggle('collapsed');
            
            // Save state
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sidebarCollapsed', isCollapsed);
            
            console.log('Sidebar state:', isCollapsed ? 'collapsed' : 'expanded');
        }
        
        // Add click event
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleSidebar);
            console.log('Click event added to toggle button');
        } else {
            console.log('Toggle button not found - may not be needed for this page');
        }
        
        // Load saved state
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'false') {
            sidebar.classList.remove('collapsed');
        }
        
        return true;
    } else {
        console.log('Sidebar not found - waiting for navigation to load');
        return false;
    }
}

// Listen for navigation loaded event
document.addEventListener('navigationLoaded', function() {
    console.log('Navigation loaded, initializing sidebar toggle...');
    setTimeout(initializeSidebarToggle, 100);
});

// Fallback - try multiple times if navigation event doesn't fire
document.addEventListener('DOMContentLoaded', function() {
    let attempts = 0;
    const maxAttempts = 10;
    
    function tryInitialize() {
        attempts++;
        if (initializeSidebarToggle() || attempts >= maxAttempts) {
            console.log(`Sidebar toggle initialized after ${attempts} attempts`);
            return;
        }
        
        // Try again after delay
        setTimeout(tryInitialize, 500);
    }
    
    // Start trying after a delay
    setTimeout(tryInitialize, 1000);
}); 