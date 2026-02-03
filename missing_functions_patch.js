// === CREATE AND UPLOAD MODAL FUNCTIONS ===

function showCreateOpportunityModal() {
    try {
        console.log('[SHOW-CREATE-OPPORTUNITY-MODAL] Opening create opportunity modal');
        
        // Set create mode
        isCreateMode = true;
        currentEditRowIndex = -1;
        
        // Clear the form
        clearModalForm();
        
        // Show the modal (reuse existing opportunity modal)
        showOpportunityModal();
        
        console.log('[SHOW-CREATE-OPPORTUNITY-MODAL] Create opportunity modal opened successfully');
        
    } catch (error) {
        console.error('[SHOW-CREATE-OPPORTUNITY-MODAL] Error showing create opportunity modal:', error);
    }
}

function showExcelUploadModal() {
    try {
        console.log('[SHOW-EXCEL-UPLOAD-MODAL] Opening Excel upload modal');
        
        const modal = document.getElementById('excelUploadModal');
        const overlay = document.getElementById('excelUploadModalOverlay');
        
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
        
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        
        // If modal doesn't exist, create a simple file input trigger
        if (!modal) {
            console.log('[SHOW-EXCEL-UPLOAD-MODAL] Modal not found, triggering file input directly');
            const fileInput = document.getElementById('fileInput');
            if (fileInput) {
                fileInput.click();
            } else {
                // Create temporary file input
                const tempInput = document.createElement('input');
                tempInput.type = 'file';
                tempInput.accept = '.xlsx,.xls,.csv';
                tempInput.addEventListener('change', handleFileImport);
                tempInput.click();
            }
        }
        
        console.log('[SHOW-EXCEL-UPLOAD-MODAL] Excel upload modal opened successfully');
        
    } catch (error) {
        console.error('[SHOW-EXCEL-UPLOAD-MODAL] Error showing Excel upload modal:', error);
    }
}

function hideExcelUploadModal() {
    try {
        console.log('[HIDE-EXCEL-UPLOAD-MODAL] Hiding Excel upload modal');
        
        const modal = document.getElementById('excelUploadModal');
        const overlay = document.getElementById('excelUploadModalOverlay');
        
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        
        if (overlay) {
            overlay.classList.add('hidden');
        }
        
        console.log('[HIDE-EXCEL-UPLOAD-MODAL] Excel upload modal hidden successfully');
        
    } catch (error) {
        console.error('[HIDE-EXCEL-UPLOAD-MODAL] Error hiding Excel upload modal:', error);
    }
}
