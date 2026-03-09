// --- Login Page Logic ---
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    const loginErrorText = document.getElementById('loginErrorText');
    const loginSuccess = document.getElementById('loginSuccess');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const loginRemember = document.getElementById('loginRemember');
    const loginHeading = document.getElementById('loginHeading');
    const signupForm = document.getElementById('signupForm');
    const signupName = document.getElementById('signupName');
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const signupPasswordConfirm = document.getElementById('signupPasswordConfirm');
    const signupError = document.getElementById('signupError');
    const signupErrorText = document.getElementById('signupErrorText');
    const signupSuccess = document.getElementById('signupSuccess');
    const signupSubmitBtn = document.getElementById('signupSubmitBtn');
    const showSignupBtn = document.getElementById('showSignupBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const loginSubtitle = document.getElementById('loginSubtitle');
    const themeToggle = document.getElementById('themeToggle');
    const themeToggleLabel = document.getElementById('themeToggleLabel');
    const htmlElement = document.documentElement;
    const loginLogo = document.getElementById('loginLogo');
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingLogo = document.getElementById('loadingLogo');
    const baseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || '';

    // Net Pacific only: single tenant code (must match server NETPACIFIC_TENANT_CODE)
    const NETPACIFIC_TENANT_CODE = 'default';

    function showLogin() {
        if (loginForm) loginForm.classList.remove('hidden');
        if (signupForm) signupForm.classList.add('hidden');
        if (loginHeading) loginHeading.textContent = 'Welcome Back';
        if (loginSubtitle) loginSubtitle.textContent = 'Net Pacific — sign in to access your dashboard.';
    }
    function showSignup() {
        if (loginForm) loginForm.classList.add('hidden');
        if (signupForm) signupForm.classList.remove('hidden');
        if (loginHeading) loginHeading.textContent = 'Create an account';
        if (loginSubtitle) loginSubtitle.textContent = 'Net Pacific — enter your details to get started.';
    }
    if (showSignupBtn) showSignupBtn.addEventListener('click', function() { showSignup(); });
    if (showLoginBtn) showLoginBtn.addEventListener('click', function() { showLogin(); });

    // Logo theme logic - Use dark logo in light theme, light logo in dark theme
    // (opposite of header since login container is white in light theme)
    function updateLogo(theme) {
        if (loginLogo) {
            if (theme === 'light') {
                loginLogo.src = 'assets/netpacific-logo.jpg';
            } else {
                loginLogo.src = 'assets/netpacific-logo.jpg';
            }
        }
        if (loadingLogo) {
            if (theme === 'light') {
                loadingLogo.src = 'assets/netpacific-logo.jpg';
            } else {
                loadingLogo.src = 'assets/netpacific-logo.jpg';
            }
        }
    }

    // Theme logic - Always show sun icon
    function updateThemeToggleIcon(theme) {
        const icon = themeToggle?.querySelector('.material-icons');
        if (icon) {
            icon.textContent = theme === 'dark' ? 'dark_mode' : 'wb_sunny';
        }
        if (themeToggleLabel) {
            themeToggleLabel.textContent = theme === 'dark' ? 'Light' : 'Dark';
        }
    }
    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        const theme = savedTheme || 'dark';
        if (savedTheme === null) {
            localStorage.setItem('theme', 'dark');
        }
        htmlElement.classList.toggle('dark', theme === 'dark');
        updateThemeToggleIcon(theme);
        updateLogo(theme);
    }
    function toggleTheme() {
        const currentTheme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        htmlElement.classList.toggle('dark', newTheme === 'dark');
        localStorage.setItem('theme', newTheme);
        updateThemeToggleIcon(newTheme);
        updateLogo(newTheme);
    }
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    initializeTheme();

    // Remember me: restore email if previously saved (Net Pacific only — no org field)
    (function () {
        try {
            var saved = localStorage.getItem('loginRemember');
            if (saved === 'true' && loginEmail) {
                var data = localStorage.getItem('loginRememberData');
                if (data) {
                    var obj = JSON.parse(data);
                    if (obj.email) loginEmail.value = obj.email;
                    if (loginRemember) loginRemember.checked = true;
                }
            }
        } catch (e) {}
    })();

    // Forgot password link
    var forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
        forgotLink.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'update_password.html';
        });
    }

    // Password visibility toggle
    var passwordToggle = document.getElementById('loginPasswordToggle');
    if (passwordToggle && loginPassword) {
        passwordToggle.addEventListener('click', function() {
            var type = loginPassword.getAttribute('type');
            var isPassword = type === 'password';
            loginPassword.setAttribute('type', isPassword ? 'text' : 'password');
            passwordToggle.querySelector('.material-icons').textContent = isPassword ? 'visibility_off' : 'visibility';
            passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
    }

    // Check server status on page load
    async function checkServerStatus() {
        try {
            loadingScreen.classList.add('visible');
            const response = await fetch((window.APP_CONFIG?.API_BASE_URL || '') + '/api/health');
            if (response.ok) {
                console.log('[SERVER] Server is ready');
                loadingScreen.classList.remove('visible');
            } else {
                console.log('[SERVER] Server returned error status');
                // Keep loading screen visible
            }
        } catch (error) {
            console.log('[SERVER] Server is not responding, might be cold starting:', error);
            // Keep loading screen visible
        }
    }

    // Call checkServerStatus immediately
    checkServerStatus();

    // Login logic
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            loginError.classList.add('hidden');
            loginSuccess.classList.add('hidden');
            loginSubmitBtn.disabled = true;
            const email = loginEmail.value.trim();
            const password = loginPassword.value;
            const tenantCode = NETPACIFIC_TENANT_CODE;
            if (!email || !password) {
                if (loginErrorText) loginErrorText.textContent = 'Email and password are required.';
                if (loginError) loginError.classList.remove('hidden');
                loginSubmitBtn.disabled = false;
                return;
            }
            if (loginRemember) {
                if (loginRemember.checked) {
                    localStorage.setItem('loginRemember', 'true');
                    localStorage.setItem('loginRememberData', JSON.stringify({ email: email }));
                } else {
                    localStorage.removeItem('loginRemember');
                    localStorage.removeItem('loginRememberData');
                }
            }
            try {
                if (loadingScreen) loadingScreen.classList.add('visible');
                const response = await fetch((window.APP_CONFIG?.API_BASE_URL || '') + '/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, tenantCode })
                });
                const data = await response.json();
                if (!response.ok || !data.token) {
                    throw new Error(data.error || 'Login failed');
                }
                localStorage.setItem('authToken', data.token);
                console.log('[LOGIN DEBUG] Token stored in localStorage');
                console.log('[LOGIN DEBUG] Token preview:', data.token.substring(0, 50) + '...');
                loginSuccess.classList.remove('hidden');
                
                // Decode token to check roles
                const payload = JSON.parse(atob(data.token.split('.')[1]));
                const userRoles = payload.roles || [];
                
                // Longer delay and ensure token is properly stored before redirect
                setTimeout(() => {
                    // Double-check token was stored successfully
                    const storedToken = localStorage.getItem('authToken');
                    console.log('[LOGIN DEBUG] Verifying stored token:', !!storedToken);
                    
                    if (storedToken) {
                        // Check if user has DS or SE role and redirect accordingly
                        if (userRoles.includes('DS') || userRoles.includes('SE')) {
                            console.log('[LOGIN DEBUG] DS/SE role detected, redirecting to proposal workbench');
                            window.location.href = 'proposal_workbench.html';
                        } else {
                            console.log('[LOGIN DEBUG] Standard role, redirecting to index.html');
                            window.location.href = 'index.html';
                        }
                    } else {
                        console.error('[LOGIN DEBUG] Token storage failed, retrying...');
                        localStorage.setItem('authToken', data.token);
                        setTimeout(() => {
                            // Check roles again in retry
                            if (userRoles.includes('DS') || userRoles.includes('SE')) {
                                console.log('[LOGIN DEBUG] DS/SE role detected (retry), redirecting to proposal workbench');
                                window.location.href = 'proposal_workbench.html';
                            } else {
                                console.log('[LOGIN DEBUG] Standard role (retry), redirecting to index.html');
                                window.location.href = 'index.html';
                            }
                        }, 200);
                    }
                }, 1500); // Increased delay to 1500ms
            } catch (err) {
                if (loadingScreen) loadingScreen.classList.remove('visible');
                if (loginErrorText) loginErrorText.textContent = err.message || 'Login failed.';
                if (loginError) loginError.classList.remove('hidden');
            } finally {
                loginSubmitBtn.disabled = false;
            }
        });
    }

    // Signup logic
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (signupError) signupError.classList.add('hidden');
            if (signupSuccess) signupSuccess.classList.add('hidden');
            if (signupSubmitBtn) signupSubmitBtn.disabled = true;

            const email = (signupEmail && signupEmail.value.trim()) || '';
            const password = signupPassword ? signupPassword.value : '';
            const passwordConfirm = signupPasswordConfirm ? signupPasswordConfirm.value : '';
            const name = (signupName && signupName.value.trim()) || '';
            const tenantCode = NETPACIFIC_TENANT_CODE;

            if (!email) {
                if (signupErrorText) signupErrorText.textContent = 'Email is required.';
                if (signupError) signupError.classList.remove('hidden');
                if (signupSubmitBtn) signupSubmitBtn.disabled = false;
                return;
            }
            if (password.length < 8) {
                if (signupErrorText) signupErrorText.textContent = 'Password must be at least 8 characters.';
                if (signupError) signupError.classList.remove('hidden');
                if (signupSubmitBtn) signupSubmitBtn.disabled = false;
                return;
            }
            if (password !== passwordConfirm) {
                if (signupErrorText) signupErrorText.textContent = 'Passwords do not match.';
                if (signupError) signupError.classList.remove('hidden');
                if (signupSubmitBtn) signupSubmitBtn.disabled = false;
                return;
            }

            try {
                if (loadingScreen) loadingScreen.classList.add('visible');
                const response = await fetch(baseUrl + '/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, name: name || undefined, tenantCode })
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Signup failed');
                }

                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                    if (signupSuccess) signupSuccess.classList.remove('hidden');
                    const payload = JSON.parse(atob(data.token.split('.')[1]));
                    const userRoles = payload.roles || [];
                    setTimeout(function() {
                        if (userRoles.includes('DS') || userRoles.includes('SE')) {
                            window.location.href = 'proposal_workbench.html';
                        } else {
                            window.location.href = 'index.html';
                        }
                    }, 1500);
                } else {
                    // No token: account is pending superadmin approval
                    var successText = signupSuccess && signupSuccess.querySelector('span:last-child');
                    if (successText) successText.textContent = data.message || 'Registration successful. Your account is pending approval by an administrator. You will be able to log in once approved.';
                    if (signupSuccess) signupSuccess.classList.remove('hidden');
                    setTimeout(function() { showLogin(); }, 3500);
                }
            } catch (err) {
                if (loadingScreen) loadingScreen.classList.remove('visible');
                if (signupErrorText) signupErrorText.textContent = err.message || 'Could not create account.';
                if (signupError) signupError.classList.remove('hidden');
            } finally {
                if (signupSubmitBtn) signupSubmitBtn.disabled = false;
            }
        });
    }
});
