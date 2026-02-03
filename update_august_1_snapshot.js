// Update August 1 snapshot with provided data
const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://cmrp-opps-backend.onrender.com' 
    : 'http://localhost:3000';

async function updateAugust1Snapshot() {
    try {
        // Convert currency strings to numbers (remove commas and peso sign)
        const parseAmount = (str) => {
            if (!str || str === '') return 0;
            return parseFloat(str.replace(/[₱,]/g, '')) || 0;
        };

        // August 1 snapshot data based on provided information
        const snapshotData = {
            snapshot_date: '2024-08-01',
            description: 'August 1 snapshot - Manual update',
            total_opportunities: 534,
            submitted_count: 333,
            submitted_amount: parseAmount('₱1,432,027,272.55'),
            op100_count: 67,
            op100_amount: parseAmount('₱67,327,016.64'),
            op90_count: 25,
            op90_amount: parseAmount('₱49,813,512.69'),
            op60_count: 42,
            op60_amount: parseAmount('₱137,709,494.36'),
            op30_count: 136,
            op30_amount: parseAmount('₱972,753,811.26'),
            lost_count: 42,
            lost_amount: parseAmount('₱116,913,075.78'),
            inactive_count: 27,
            // Note: No amount provided for inactive, ongoing, pending
            ongoing_count: 29,
            pending_count: 25,
            declined_count: 145,
            revised_count: 266
        };

        console.log('Creating/Updating August 1 snapshot with data:');
        console.log(JSON.stringify(snapshotData, null, 2));

        // You would need a valid auth token to make this request
        // This is just showing the structure - you'll need to run this from the browser console
        // or provide a valid token
        
        const response = await fetch(`${API_BASE_URL}/api/snapshots/custom`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': 'Bearer YOUR_AUTH_TOKEN_HERE'
            },
            body: JSON.stringify(snapshotData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to update snapshot: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const result = await response.json();
        console.log('Snapshot updated successfully:', result);
        
        return result;
    } catch (error) {
        console.error('Error updating August 1 snapshot:', error);
        throw error;
    }
}

// If running in Node.js environment
if (typeof window === 'undefined') {
    updateAugust1Snapshot().catch(console.error);
}

// Export for browser use
if (typeof window !== 'undefined') {
    window.updateAugust1Snapshot = updateAugust1Snapshot;
}