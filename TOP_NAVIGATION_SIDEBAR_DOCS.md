# 🧭 Top Navigation and Sidebar Documentation

## 📋 Overview

The CMRP Opportunities Management system features a comprehensive navigation system with a top navigation bar and expandable sidebar. This documentation covers all components, functionality, and implementation details.

---

## 🔝 Top Navigation Bar

### 🎯 Key Components

#### 1. **Logo and Title Section**
- **Location**: Left side of the top bar
- **Components**:
  - CMRP logo (theme-aware, switches between light/dark variants)
  - Application title: "2025 Opportunities Management"
  - Clickable logo redirects to home page (`index.html`)

#### 2. **User Information Display** ✨ *NEW FEATURE*
- **Location**: Right side, left of online users indicator
- **Components**:
  - Account circle icon (`account_circle`)
  - Current user's name
  - User's role(s) or account type
- **Features**:
  - Extracts user info from JWT token
  - Shows primary role or account type (Admin, User, etc.)
  - Professional styling with hover effects
  - Responsive (hides details on mobile)

#### 3. **Online Users Indicator** ✨ *NEW FEATURE*
- **Location**: Far right of the top bar
- **Components**:
  - Animated green pulse indicator
  - Real-time user count
  - Hover dropdown with detailed user list
- **Features**:
  - Google Sheets-style collaborative awareness
  - Cross-browser synchronization
  - Server-side heartbeat mechanism (30-second intervals)
  - LocalStorage fallback for offline scenarios

#### 4. **Theme Toggle**
- **Location**: Between user info and online users
- **Features**:
  - Sun icon for both modes (per user preference)
  - Blue color (#2563eb) when active
  - Smooth transition animations
  - Persistent theme selection

---

## 🏗️ Implementation Details

### HTML Structure
```html
<div class="top-bar">
    <div class="top-bar-content">
        <!-- Logo and Title -->
        <a href="index.html">
            <img id="cmrpLogo" src="Logo/CMRP Logo Light.svg" alt="CMRP Logo" />
        </a>
        <span class="top-bar-title">2025 Opportunities Management</span>
        
        <!-- User Section -->
        <div class="top-bar-user-section">
            <!-- User Info -->
            <div class="user-info-container">
                <div class="user-info-display" id="userInfoDisplay">
                    <span class="material-icons">account_circle</span>
                    <div class="user-details">
                        <span class="user-name" id="currentUserName">Loading...</span>
                        <span class="user-role" id="currentUserRole">Loading...</span>
                    </div>
                </div>
            </div>
            
            <!-- Theme Toggle -->
            <button id="themeToggle" class="theme-toggle">
                <span class="material-icons">wb_sunny</span>
            </button>
            
            <!-- Online Users -->
            <div class="online-users-container">
                <div class="online-users-display" id="onlineUsersDisplay">
                    <div class="online-pulse"></div>
                    <span class="material-icons">people</span>
                    <span class="online-count" id="onlineCount">1</span>
                    
                    <div class="online-users-list" id="onlineUsersList">
                        <!-- Dynamically populated -->
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

### 🎨 CSS Features
- **Borderless design**: No outside borders (per user preference)
- **Theme-aware**: Full light/dark mode support
- **Responsive**: Mobile-optimized with hidden elements
- **Professional**: Clean, modern styling with subtle shadows
- **Smooth animations**: Hover effects and transitions

### ⚙️ JavaScript Functionality

#### User Info System
```javascript
function initializeUserInfoSystem() {
    const token = localStorage.getItem('authToken');
    if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUserId = payload.id;
        currentUserInfo = {
            id: payload.id,
            name: payload.name || payload.username || payload.email,
            email: payload.email,
            roles: payload.roles || [],
            accountType: payload.accountType || 'User'
        };
        updateUserInfoDisplay();
        startHeartbeat();
    }
}
```

#### Online Users Heartbeat
```javascript
async function sendHeartbeat() {
    const response = await fetch('/api/heartbeat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            page: window.location.pathname,
            timestamp: Date.now()
        })
    });
    
    if (response.ok) {
        const data = await response.json();
        updateOnlineUsersFromServer(data.onlineUsers);
    }
}
```

---

## 📱 Sidebar Navigation

### 🎯 Components

#### 1. **Gmail-Style Hover Expansion**
- **Default**: Collapsed with icons only (60px width)
- **Hover**: Expands to show labels (200px width)
- **Features**:
  - Smooth expansion animations
  - Position context maintained
  - Mobile-responsive overlay

#### 2. **Navigation Items**
- **Dashboard**: Main opportunities overview
- **Forecasting**: Revenue forecasting tools
- **Proposal Workbench**: Proposal management
- **Settings**: Application preferences
- **Logout**: Secure session termination

#### 3. **Mobile Support**
- **Toggle Button**: Hamburger menu for small screens
- **Overlay System**: Sidebar overlays content on mobile
- **Touch-Friendly**: Larger touch targets

### 🏗️ Sidebar Implementation

#### HTML Structure
```html
<!-- Mobile Toggle -->
<button id="mobileSidebarToggle" class="mobile-sidebar-toggle">
    <span class="material-icons">menu</span>
</button>

<!-- Sidebar -->
<div id="sidebar" class="sidebar">
    <div class="sidebar-content">
        <nav class="sidebar-nav">
            <a href="index.html" class="sidebar-item" data-tooltip="Dashboard">
                <span class="material-icons">dashboard</span>
                <span class="sidebar-label">Dashboard</span>
            </a>
            <a href="forecast_dashboard.html" class="sidebar-item">
                <span class="material-icons">trending_up</span>
                <span class="sidebar-label">Forecasting</span>
            </a>
            <!-- More items... -->
        </nav>
    </div>
</div>
```

#### JavaScript Initialization
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

## 👥 Online Users Feature Deep Dive

### 🔧 Server-Side Implementation

#### Heartbeat Endpoint
```javascript
app.post('/api/heartbeat', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const userInfo = {
        id: userId,
        name: req.user.name || req.user.username || req.user.email,
        email: req.user.email,
        roles: req.user.roles || [],
        accountType: req.user.accountType,
        lastSeen: Date.now(),
        page: (req.body && req.body.page) || 'unknown'
    };
    
    onlineUsers.set(userId, userInfo);
    
    // Auto cleanup (2+ minutes inactive)
    const cutoffTime = Date.now() - (2 * 60 * 1000);
    for (const [id, user] of onlineUsers.entries()) {
        if (user.lastSeen < cutoffTime) {
            onlineUsers.delete(id);
        }
    }
    
    const activeUsers = Array.from(onlineUsers.values());
    res.json({ 
        success: true, 
        onlineUsers: activeUsers,
        totalOnline: activeUsers.length
    });
});
```

#### Data Management
- **Storage**: In-memory Map for active users
- **Cleanup**: Automatic removal of inactive users (2+ minutes)
- **Real-Time**: Updates all connected clients

### 🎨 Client-Side Features

#### Visual Indicators
- **Current User**: Blue dot + account_circle icon + "You" label
- **Other Users**: Green dot + person icon + name
- **Different Page**: Browser icon (`open_in_browser`) when user is on different page
- **Animated Pulse**: Green pulsing indicator for active status

#### User Item Display
```javascript
userDiv.innerHTML = `
    <span class="material-icons">${isCurrentUser ? 'account_circle' : 'person'}</span>
    <span class="online-user-name">${displayName}</span>
    ${user.page && user.page !== window.location.pathname ? 
        '<span class="material-icons online-user-page" title="Currently on: ${user.page}">open_in_browser</span>' : ''}
`;
```

---

## 📱 Responsive Design

### 📏 Breakpoints
- **Desktop (>768px)**: Full functionality, all components visible
- **Tablet (768px)**: Reduced padding, maintained functionality
- **Mobile (<768px)**:
  - User details hidden (icon only)
  - Sidebar becomes overlay with toggle
  - Smaller online users dropdown
  - Touch-optimized interactions

### 📱 Mobile CSS
```css
@media (max-width: 768px) {
    .top-bar-user-section {
        gap: 0.5rem;
    }
    
    .user-details {
        display: none;
    }
    
    .online-users-list {
        right: -1rem;
        min-width: 180px;
    }
}
```

---

## 🔒 Security Features

### 🛡️ Authentication
- **JWT Verification**: All user info from verified tokens
- **Server Validation**: Heartbeat requires authentication
- **Secure Logout**: Proper cleanup and token removal
- **CORS Protection**: Origin validation

### 🔐 Privacy
- **Minimal Exposure**: Only necessary user information
- **Auto Cleanup**: Inactive user data removed
- **No Sensitive Data**: Presence doesn't include sensitive info

---

## 🎨 Design Guidelines

### 🎯 Design Principles
- **Borderless UI**: No outside borders (user preference)
- **Simple Aesthetics**: Clean, no gradients
- **Blue Accent**: #2563eb for active states
- **Professional**: Business-appropriate appearance
- **Material Icons**: Consistent iconography

### 🌓 Theme Support
- **Light Theme**: Clean whites/grays with blue accents
- **Dark Theme**: Dark grays/blacks with blue accents
- **Auto Detection**: Respects system preferences
- **Persistent**: Remembers user choice
- **Smooth Transitions**: Animated switching

---

## ⚡ Performance & Optimization

### 🚀 Performance Features
- **Debounced Updates**: Prevents excessive DOM manipulation
- **Efficient Cleanup**: Regular inactive user removal
- **Minimal Network**: 30-second heartbeat balances real-time with efficiency
- **Fallback Mechanisms**: LocalStorage for network issues
- **Memory Management**: Cleanup on page unload

### 📊 Monitoring
- **Debug Logging**: Comprehensive console logging
- **Error Handling**: Graceful degradation
- **Performance Metrics**: Success/failure tracking

---

## 🌐 Browser Compatibility

### ✅ Supported Browsers
- **Chrome**: Full support
- **Firefox**: Full support  
- **Safari**: Full support
- **Edge**: Full support

### 🔄 Fallbacks
- **No JavaScript**: Basic navigation functional
- **Network Issues**: LocalStorage fallback
- **Older Browsers**: Graceful degradation

---

## 🔧 Troubleshooting

### 🐛 Common Issues

#### Online Users Not Updating
- Check server heartbeat endpoint
- Verify network connectivity
- Check JWT token validity

#### Theme Not Persisting
- Verify localStorage functionality
- Check for JavaScript errors

#### Sidebar Not Expanding
- Check CSS transitions
- Verify JavaScript event listeners

### 🛠️ Debug Tools
- **Browser Console**: Error messages and debug logs
- **Network Tab**: Monitor heartbeat requests
- **Test Pages**: `test_cross_browser_users.html` for isolated testing
- **Server Logs**: Monitor heartbeat processing

---

## 🚀 Future Enhancements

### 🔮 Potential Features
- **Real-Time Messaging**: Chat integration
- **User Status**: Away/busy indicators
- **Page Actions**: Show what users are doing
- **Mobile App**: Extend presence to mobile
- **Notifications**: User join/leave notifications

---

## 📝 API Reference

### Endpoints

#### `POST /api/heartbeat`
**Purpose**: Update user presence
**Auth**: Required (JWT)
**Body**: 
```json
{
    "page": "/current-page",
    "timestamp": 1234567890
}
```
**Response**:
```json
{
    "success": true,
    "onlineUsers": [...],
    "totalOnline": 2
}
```

#### `GET /api/online-users`
**Purpose**: Get current online users
**Auth**: Required (JWT)
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
            "page": "/dashboard"
        }
    ],
    "totalOnline": 1
}
```

---

## 📊 Memory Information

Based on the conversation, here are the key user preferences and implementation details stored in memory:

**User Preferences** [[memory:5531327957685834946]]:
- Simple look with no gradient effects
- Sun icon for theme toggle in both modes
- Blue color (#2563eb) for active elements
- No outside border lines (borderless UI)

**Implementation Details** [[memory:3572927727640736705]]:
- User login information display in top navigation
- Google Sheets-style online users indicator
- Real-time presence tracking with heartbeat
- JWT token-based identification
- Server-side /api/heartbeat endpoint
- LocalStorage fallback mechanism
- Cross-browser synchronization
- Professional styling with Material Icons

This comprehensive navigation system provides a professional, efficient, and collaborative interface that enhances team coordination and productivity in the CMRP Opportunities Management system. 