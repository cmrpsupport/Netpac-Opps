# 🧭 CMRP Navigation System Documentation

## Overview
The CMRP Opportunities Management system features a comprehensive navigation system with a top bar and expandable sidebar, including real-time user presence tracking with enhanced glassmorphism UI effects.

---

## 🔝 Top Navigation Bar

### Components

#### 1. Logo & Title
- **Location**: Left side
- **Features**: 
  - CMRP logo (theme-aware)
  - "2025 Opportunities Management" title
  - Clickable logo → home page

#### 2. User Information Display ✨ *NEW*
- **Location**: Right side, before online users
- **Components**:
  - Account circle icon
  - User name
  - User role/account type
- **Features**:
  - JWT token-based user info
  - Professional styling
  - Responsive design

#### 3. Online Users Indicator ✨ *ENHANCED*
- **Location**: Far right
- **Components**:
  - Animated green pulse indicator
  - User count display
  - Glass-effect hover dropdown with user list
- **Features**:
  - Google Sheets-style collaboration
  - Cross-browser synchronization
  - 30-second heartbeat intervals
  - LocalStorage fallback
  - **NEW**: Glassmorphism UI with blur effects
  - **NEW**: Enhanced readability in both themes
  - **NEW**: Improved dark mode contrast

#### 4. Theme Toggle
- **Features**:
  - Sun icon (both modes)
  - Blue active color (#2563eb)
  - Persistent selection

---

## 🎨 Enhanced Glassmorphism UI

### Online Users Dropdown Styling

#### Light Mode
```css
.online-users-list {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
}

.online-user-name {
    color: #1f2937; /* Dark text for readability */
}
```

#### Dark Mode
```css
html.dark .online-users-list {
    background: rgba(17, 24, 39, 0.75);
    border-color: rgba(55, 65, 81, 0.5);
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}

html.dark .online-user-name {
    color: #f3f4f6; /* Light text for contrast */
}
```

### Key Features
- **Glass Effect**: Subtle transparency with backdrop blur
- **Theme-Aware**: Optimized colors for both light and dark modes
- **Readable Text**: High contrast text colors for accessibility
- **Smooth Transitions**: 0.2s ease animations
- **Hover States**: Interactive feedback with subtle highlights

---

## 🏗️ Implementation

### HTML Structure
```html
<div class="top-bar">
    <div class="top-bar-content">
        <!-- Logo -->
        <a href="index.html">
            <img id="cmrpLogo" src="Logo/CMRP Logo Light.svg" />
        </a>
        <span class="top-bar-title">2025 Opportunities Management</span>
        
        <!-- User Section -->
        <div class="top-bar-user-section">
            <!-- User Info -->
            <div class="user-info-display" id="userInfoDisplay">
                <span class="material-icons">account_circle</span>
                <div class="user-details">
                    <span id="currentUserName">Loading...</span>
                    <span id="currentUserRole">Loading...</span>
                </div>
            </div>
            
            <!-- Theme Toggle -->
            <button id="themeToggle" class="theme-toggle">
                <span class="material-icons">wb_sunny</span>
            </button>
            
            <!-- Online Users with Glass Effect -->
            <div class="online-users-display" id="onlineUsersDisplay">
                <span class="material-icons online-indicator">radio_button_checked</span>
                <span id="onlineCount">1</span>
                
                <div class="online-users-list" id="onlineUsersList">
                    <!-- Dynamic glass-effect dropdown -->
                </div>
            </div>
        </div>
    </div>
</div>
```

### JavaScript Functions

#### User Info Initialization
```javascript
function initializeUserInfoSystem() {
    const token = localStorage.getItem('authToken');
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUserInfo = {
        id: payload.id,
        name: payload.name || payload.username,
        roles: payload.roles || [],
        accountType: payload.accountType
    };
    updateUserInfoDisplay();
    startHeartbeat();
}
```

#### Online Users Heartbeat
```javascript
async function sendHeartbeat() {
    const response = await fetch('/api/heartbeat', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            page: window.location.pathname,
            timestamp: Date.now()
        })
    });
    
    const data = await response.json();
    updateOnlineUsersFromServer(data.onlineUsers);
}
```

#### Enhanced UI Update Function
```javascript
function updateOnlineUsersDisplay() {
    const onlineUsers = Array.from(onlineUsersData.values())
        .filter(user => user.status === 'online')
        .sort((a, b) => {
            if (a.id === currentUserId) return -1;
            if (b.id === currentUserId) return 1;
            return a.name.localeCompare(b.name);
        });
    
    onlineCountElement.textContent = onlineUsers.length;
    
    onlineUsersListElement.innerHTML = '';
    onlineUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'online-user-item';
        
        const isCurrentUser = user.id === currentUserId;
        const displayName = isCurrentUser ? 'You' : user.name;
        
        userItem.innerHTML = `
            <span class="material-icons">${isCurrentUser ? 'account_circle' : 'person'}</span>
            <span class="online-user-name">${displayName}</span>
            ${user.page && user.page !== window.location.pathname ? 
                `<span class="material-icons online-user-page" title="Currently on: ${user.page}">open_in_browser</span>` : ''}
        `;
        
        onlineUsersListElement.appendChild(userItem);
    });
}
```

---

## 📱 Sidebar Navigation

### Features
- **Gmail-style hover expansion**
- **Default**: 60px width (icons only)
- **Hover**: 200px width (with labels)
- **Mobile**: Overlay with toggle button

### Navigation Items
- Dashboard
- Forecasting
- Proposal Workbench
- Settings
- Logout

### Implementation
```javascript
function initializeGmailStyleSidebar() {
    const sidebar = document.getElementById('sidebar');
    
    sidebar.addEventListener('mouseenter', () => {
        sidebar.classList.add('expanded');
    });
    
    sidebar.addEventListener('mouseleave', () => {
        sidebar.classList.remove('expanded');
    });
}
```

---

## 🔧 Server-Side (Online Users)

### Enhanced Heartbeat Endpoint
```javascript
app.post('/api/heartbeat', authenticateToken, async (req, res) => {
    try {
        const userInfo = {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            roles: req.user.roles,
            lastSeen: Date.now(),
            page: (req.body && req.body.page) || 'unknown',
            status: 'online'
        };
        
        onlineUsers.set(req.user.id, userInfo);
        
        // Cleanup inactive users (2+ minutes)
        const cutoffTime = Date.now() - (2 * 60 * 1000);
        for (const [id, user] of onlineUsers.entries()) {
            if (user.lastSeen < cutoffTime) {
                onlineUsers.delete(id);
            }
        }
        
        console.log(`[HEARTBEAT] User ${req.user.name} active on ${userInfo.page}`);
        
        res.json({ 
            success: true, 
            onlineUsers: Array.from(onlineUsers.values()),
            totalOnline: onlineUsers.size
        });
    } catch (error) {
        console.error('[HEARTBEAT] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

## 🎨 Design Guidelines

### User Preferences (Memory)
- **Simple design**: No gradients
- **Sun icon**: Both light/dark modes
- **Blue accent**: #2563eb for active states
- **Borderless**: No outside border lines
- **Glass effect**: Subtle transparency with blur
- **High contrast**: Readable text in all themes

### Visual Indicators
- **Current user**: Blue dot + account_circle + "You"
- **Other users**: Green dot + person icon + name
- **Different page**: Browser icon (`open_in_browser`)
- **Animated pulse**: Green pulsing for activity
- **Glass dropdown**: Glassmorphism effect with backdrop blur

### Color Scheme
#### Light Mode
- Background: `rgba(255, 255, 255, 0.6)`
- Text: `#1f2937` (dark gray)
- Icons: `#1f2937`
- Hover: `rgba(255, 255, 255, 0.3)`

#### Dark Mode
- Background: `rgba(17, 24, 39, 0.75)`
- Text: `#f3f4f6` (light gray)
- Icons: `#d1d5db`
- Hover: `rgba(55, 65, 81, 0.5)`

---

## 📱 Responsive Design

### Mobile Breakpoint (<768px)
```css
@media (max-width: 768px) {
    .user-details {
        display: none; /* Hide text, show icon only */
    }
    
    .online-users-list {
        right: -1rem;
        min-width: 180px;
    }
    
    .sidebar {
        /* Becomes overlay */
    }
}
```

---

## 🔒 Security & Performance

### Security
- JWT token verification
- Server-side authentication
- CORS protection
- Minimal data exposure
- Safe error handling

### Performance
- 30-second heartbeat intervals
- Automatic cleanup of inactive users
- LocalStorage fallback
- Debounced UI updates
- CSS hardware acceleration
- Optimized backdrop-filter usage

---

## 🐛 Troubleshooting

### Common Issues
1. **Online users not updating**
   - Check `/api/heartbeat` endpoint
   - Verify JWT token validity
   - Check network connectivity
   - Look for console errors

2. **User info not displaying**
   - Verify localStorage has `authToken`
   - Check token format and expiration
   - Inspect JWT payload

3. **Sidebar not expanding**
   - Check CSS transitions
   - Verify JavaScript event listeners
   - Test hover events

4. **Glass effect not showing**
   - Check browser support for `backdrop-filter`
   - Verify CSS custom properties
   - Test in different browsers

### Debug Tools
- Browser console logs (`[HEARTBEAT]`, `[ONLINE-USERS]`)
- Network tab for API requests
- Test page: `test_cross_browser_users.html`
- Debug page: `debug_online_users.html`

---

## 📊 API Reference

### POST /api/heartbeat
**Auth**: Required (JWT Bearer token)

**Request Body**:
```json
{
    "page": "/current-page-path",
    "timestamp": 1234567890
}
```

**Response**:
```json
{
    "success": true,
    "onlineUsers": [
        {
            "id": "user-id",
            "name": "User Name",
            "email": "user@example.com",
            "roles": ["DS"],
            "accountType": "Admin",
            "lastSeen": 1234567890,
            "page": "/dashboard",
            "status": "online"
        }
    ],
    "totalOnline": 2
}
```

---

## 🚀 Recent Updates & Enhancements

### Version 2.1 - Glassmorphism UI
- Enhanced dropdown with glass effect
- Improved readability in both themes
- Better contrast ratios for accessibility
- Optimized blur effects and animations
- Cross-browser compatibility improvements

### Version 2.0 - Online Users Feature
- Real-time presence tracking
- Google Sheets-style collaboration
- Cross-browser synchronization
- Server-side heartbeat system
- LocalStorage fallback mechanism

### Version 1.0 - Base Navigation
- Top bar with logo and user info
- Gmail-style expandable sidebar
- Theme toggle functionality
- Responsive mobile design

---

## 🚀 Future Enhancements

- Real-time messaging integration
- User status indicators (away/busy)
- Page-specific activity tracking
- Mobile app presence sync
- Enhanced collaboration features
- Voice/video call integration
- Screen sharing capabilities

---

This navigation system provides professional, efficient team collaboration with Google Sheets-style real-time presence awareness and modern glassmorphism UI effects, enhancing both functionality and aesthetics in the CMRP Opportunities Management system. 