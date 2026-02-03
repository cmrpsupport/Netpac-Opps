document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('updatePasswordForm');
    const messageElement = document.getElementById('message');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        messageElement.textContent = ''; // Clear previous messages
        messageElement.className = 'mt-4 text-center text-sm'; // Reset class

        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (newPassword !== confirmNewPassword) {
            messageElement.textContent = 'New passwords do not match.';
            messageElement.className = 'mt-4 text-center text-sm text-red-600 dark:text-red-400';
            return;
        }

        // Client-side length check can remain as a quick feedback, 
        // but server-side validation is the source of truth.
        // if (newPassword.length < 8) { 
        //     messageElement.textContent = 'New password must be at least 8 characters long.';
        //     messageElement.className = 'mt-4 text-center text-sm text-red-600 dark:text-red-400';
        //     return;
        // }

        try {
            const response = await fetch('/api/update-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Include Authorization header if your endpoint is protected
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const result = await response.json();

            if (response.ok) {
                messageElement.textContent = result.message || 'Password updated successfully!';
                messageElement.className = 'mt-4 text-center text-sm text-green-600 dark:text-green-400';
                form.reset(); // Clear the form fields
            } else {
                // Handle specific validation errors from express-validator
                if (result.errors && Array.isArray(result.errors)) {
                    const errorMessages = result.errors.map(err => err.msg).join(' ');
                    messageElement.textContent = errorMessages;
                } else {
                    messageElement.textContent = result.message || 'Failed to update password.';
                }
                messageElement.className = 'mt-4 text-center text-sm text-red-600 dark:text-red-400';
            }
        } catch (error) {
            console.error('Error updating password:', error);
            messageElement.textContent = 'An error occurred. Please try again.';
            messageElement.className = 'mt-4 text-center text-sm text-red-600 dark:text-red-400';
        }
    });
});
