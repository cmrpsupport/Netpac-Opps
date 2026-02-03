// Fix for proposal workbench board headers and labels
(function() {
    // Create a style element
    const style = document.createElement('style');
    
    // Add CSS rules
    style.textContent = `
        /* Fix board headers - make much thinner with smaller text */
        #notStartedColumn .kanban-column-header,
        #ongoingColumn .kanban-column-header,
        #forApprovalColumn .kanban-column-header,
        #submittedColumn .kanban-column-header {
            border-top: 1px solid transparent !important;
            border-bottom: 1px solid transparent !important;
            padding: 0.5rem 1rem !important;
            font-size: 0.75rem !important;
            font-weight: 500 !important;
            color: white !important;
        }

        #notStartedColumn .kanban-column-header { background: #64748b !important; }
        #ongoingColumn .kanban-column-header { background: #f59e0b !important; }
        #forApprovalColumn .kanban-column-header { background: #3b82f6 !important; }
        #submittedColumn .kanban-column-header { background: #10b981 !important; }
        
        /* Fix kanban cards for light theme - use white background */
        html:not(.dark) .kanban-card,
        body:not(.dark) .kanban-card {
            background-color: #ffffff !important;
            color: #111827 !important;
            border: 1px solid #e5e7eb !important;
        }
        
        html:not(.dark) .kanban-card-title,
        body:not(.dark) .kanban-card-title {
            color: #111827 !important;
        }
        
        html:not(.dark) .kanban-card-client,
        html:not(.dark) .kanban-card-details,
        html:not(.dark) .kanban-card-comment,
        body:not(.dark) .kanban-card-client,
        body:not(.dark) .kanban-card-details,
        body:not(.dark) .kanban-card-comment {
            color: #6b7280 !important;
        }
        
        /* Fix kanban cards for dark theme */
        html.dark .kanban-card,
        .dark .kanban-card {
            background-color: #1f2937 !important;
            color: #f3f4f6 !important;
            border-color: #374151 !important;
        }
        
        html.dark .kanban-card-title,
        .dark .kanban-card-title {
            color: #ffffff !important;
        }
        
        html.dark .kanban-card-client,
        html.dark .kanban-card-details,
        html.dark .kanban-card-comment,
        .dark .kanban-card-client,
        .dark .kanban-card-details,
        .dark .kanban-card-comment {
            color: #d1d5db !important;
        }
        
        /* Fix filter labels in dark mode */
        .flex.items-center.gap-2 label {
            color: #f3f4f6 !important;
            font-size: 0.875rem !important;
            font-weight: 500 !important;
        }
    `;
    
    // Add the style element to the document head
    document.head.appendChild(style);
    
    // Directly update the theme toggle icon to be sure
    setTimeout(() => {
        const themeToggle = document.querySelector('#themeToggle .material-icons');
        if (themeToggle) {
            themeToggle.textContent = 'wb_sunny';
        }
    }, 100);
    
    console.log('CMRP Workbench fixes applied!');
})(); 