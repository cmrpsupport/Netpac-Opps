// Temporary validation bypass for testing
// This file can be used to temporarily disable form validation to test if the issue is with validation logic

function getCurrentUserName() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn('[getCurrentUserName] No token found');
            return 'Unknown User';
        }
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.name || payload.username || payload.email || 'Unknown User';
    } catch (error) {
        console.error('[getCurrentUserName] Error parsing token:', error);
        return 'Unknown User';
    }
}

function bypassValidation() {
    // Find the form submit handler and modify it to skip validation
    const form = document.getElementById('editRowForm');
    if (form) {
        // Remove existing event listeners
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Add new submit handler that skips validation
        newForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            console.log('[BYPASS] Validation bypassed - submitting form directly');
            
            // Get form data
            const formData = new FormData(e.target);
            const opportunityData = {};
            
            // Convert FormData to a regular object
            for (const [key, value] of formData.entries()) {
                opportunityData[key] = value;
            }
            
            // Add metadata
            opportunityData.changed_by = getCurrentUserName();
            
            // Skip validation entirely and proceed to submission
            console.log('[BYPASS] Submitting data:', opportunityData);
            
            try {
                // Determine if we're creating or updating
                const isCreate = typeof currentEditRowIndex === 'undefined' || currentEditRowIndex === -1;
                
                let response;
                if (isCreate) {
                    // Creating new opportunity
                    response = await fetch('/api/opportunities', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                        },
                        body: JSON.stringify(opportunityData)
                    });
                } else {
                    // Updating existing opportunity
                    const uid = opportunities[currentEditRowIndex]?.uid;
                    if (!uid) {
                        throw new Error('No UID found for update operation');
                    }
                    
                    response = await fetch(`/api/opportunities/${uid}`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                        },
                        body: JSON.stringify(opportunityData)
                    });
                }
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to save opportunity');
                }
                
                const result = await response.json();
                console.log('[BYPASS] Success:', result);
                
                // Close modal and refresh data
                document.getElementById('editRowModalOverlay').classList.add('hidden');
                
                // Refresh the table data
                if (typeof initializeApp === 'function') {
                    await initializeApp();
                } else if (typeof loadData === 'function') {
                    await loadData();
                }
                
                alert('Opportunity saved successfully!');
                
            } catch (error) {
                console.error('[BYPASS] Error saving opportunity:', error);
                alert(`Error saving opportunity: ${error.message}`);
            }
        });
        
        console.log('[BYPASS] Validation bypass installed');
        return true;
    }
    
    console.error('[BYPASS] Could not find edit form');
    return false;
}

// Auto-install bypass when this script loads
document.addEventListener('DOMContentLoaded', function() {
    // Wait for the main app to load first
    setTimeout(() => {
        if (bypassValidation()) {
            console.log('[BYPASS] ✅ Form validation bypass is active');
            console.log('[BYPASS] The edit form will submit without validation checks');
        }
    }, 2000);
});

// Make bypass function available globally for manual activation
window.bypassValidation = bypassValidation;
