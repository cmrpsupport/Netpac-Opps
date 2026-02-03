# Top Navigation and Sidebar Documentation

## Overview

The CMRP Opportunities Management system features a comprehensive navigation system consisting of a top navigation bar and an expandable sidebar. This documentation covers all components, functionality, and implementation details.

## Top Navigation Bar

### Components

#### 1. Logo and Title Section
- **Location**: Left side of the top bar
- **Components**:
  - CMRP logo (theme-aware, changes between light/dark variants)
  - Application title: "2025 Opportunities Management"
  - Logo is clickable and redirects to home page (`index.html`)

#### 2. User Information Display
- **Location**: Right side of the top bar, left of online users indicator
- **Components**:
  - Account circle icon (Material Icons: `account_circle`)
  - Current user's name
  - User's role(s) or account type
- **Features**:
  - Extracts user info from JWT token
  - Shows primary role or account type (Admin, User, etc.)
  - Professional styling with hover effects
  - Responsive design (hides details on mobile)

#### 3. Online Users Indicator
- **Location**: Far right of the top bar
- **Components**:
  - Animated green pulse indicator
  - User count display
  - Hover dropdown with detailed user list
- **Features**:
  - Real-time user presence tracking
  - Cross-browser synchronization
  - Google Sheets-style collaborative awareness
  - Server-side heartbeat mechanism
  - LocalStorage fallback for offline scenarios

#### 4. Theme Toggle
- **Location**: Between user info and online users
- **Features**:
  - Sun icon for both light and dark modes (per user preference)
  - Blue color (#2563eb) when active
  - Smooth transition animations
  - Persistent theme selection

### Implementation Details

#### HTML Structure
```html
<div class="top-bar">
    <div class="top-bar-content">
        <!-- Logo and Title -->
        <a href="index.html">
            <img id="cmrpLogo" src="Logo/CMRP Logo Light.svg" alt="CMRP Logo" class="top-bar-logo" />
        </a>
        <span class="top-bar-title">2025 Opportunities Management</span>
        
        <!-- User Info and Controls Section -->
        <div class="top-bar-user-section">
            <!-- User Info Display -->
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
            <button id="themeToggle" class="theme-toggle" title="Toggle theme">
                <span class="material-icons">wb_sunny</span>
            </button>
            
            <!-- Online Users Indicator -->
            <div class="online-users-container">
                <div class="online-users-display" id="onlineUsersDisplay" title="Users currently online">
                    <div class="online-pulse"></div>
                    <span class="material-icons">people</span>
                    <span class="online-count" id="onlineCount">1</span>
                    
                    <!-- Hover Dropdown -->
                    <div class="online-users-list" id="onlineUsersList">
                        <!-- Dynamically populated -->
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

#### CSS Styling
- **Borderless design**: No outside border lines (per user preference)
- **Theme-aware**: Supports both light and dark modes
- **Responsive**: Mobile-optimized with hidden elements on small screens
- **Professional appearance**: Clean, modern styling with subtle shadows
- **Smooth transitions**: Hover effects and theme switching animations

#### JavaScript Functionality

##### User Info System
```javascript
// Initialize user info from JWT token
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
    }
}
```

##### Online Users Tracking
```javascript
// Server-side heartbeat every 30 seconds
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
    // Handle response and update UI
}
```

## Sidebar Navigation

### Components

#### 1. Gmail-Style Hover Expansion
- **Default State**: Collapsed with icons only
- **Hover State**: Expands to show full labels
- **Features**:
  - Smooth expansion animations
  - Maintains position context
  - Mobile-responsive design

#### 2. Navigation Items
- **Dashboard**: Main opportunities overview
- **Forecasting**: Revenue forecasting tools
- **Proposal Workbench**: Proposal management interface
- **Settings**: Application preferences
- **Logout**: Secure session termination

#### 3. Mobile Support
- **Mobile Toggle Button**: Hamburger menu for small screens
- **Overlay System**: Sidebar overlays content on mobile
- **Touch-Friendly**: Larger touch targets for mobile devices

### Implementation Details

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
            <a href="forecast_dashboard.html" class="sidebar-item" data-tooltip="Forecasting">
                <span class="material-icons">trending_up</span>
                <span class="sidebar-label">Forecasting</span>
            </a>
            <!-- Additional items -->
        </nav>
    </div>
</div>
```

#### CSS Features
- **Hover Expansion**: Width transitions from 60px to 200px
- **Icon Positioning**: Icons remain fixed during expansion
- **Label Animation**: Text fades in during expansion
- **Z-Index Management**: Proper layering for dropdown interactions

#### JavaScript Functionality
```javascript
// Gmail-style hover expansion
function initializeGmailStyleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarItems = sidebar.querySelectorAll('.sidebar-item');
    
    sidebar.addEventListener('mouseenter', () => {
        sidebar.classList.add('expanded');
    });
    
    sidebar.addEventListener('mouseleave', () => {
        sidebar.classList.remove('expanded');
    });
}
```

## Online Users Feature Details

### Server-Side Implementation

#### Heartbeat Endpoint
```javascript
// POST /api/heartbeat
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
    
    // Clean up inactive users (2+ minutes)
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

#### Data Storage
- **In-Memory Map**: `onlineUsers` Map for active user tracking
- **Automatic Cleanup**: Removes users inactive for 2+ minutes
- **Real-Time Sync**: Updates all connected clients

### Client-Side Implementation

#### Heartbeat System
- **Interval**: 30-second heartbeat intervals
- **Page Tracking**: Records which page each user is viewing
- **Fallback**: LocalStorage fallback for offline scenarios
- **Error Handling**: Graceful degradation when server unavailable

#### UI Components
- **Animated Pulse**: Green pulsing indicator for active status
- **User Count**: Real-time count of online users
- **Hover Dropdown**: Detailed list with user names and current pages
- **Visual Indicators**:
  - Blue dot + account_circle icon for current user ("You")
  - Green dot + person icon for other users
  - Browser icon for users on different pages

#### Display Features
```javascript
// User item in dropdown
userDiv.innerHTML = `
    <span class="material-icons">${isCurrentUser ? 'account_circle' : 'person'}</span>
    <span class="online-user-name">${displayName}</span>
    ${user.page && user.page !== window.location.pathname ? 
        '<span class="material-icons online-user-page" title="Currently on: ${user.page}">open_in_browser</span>' : ''}
`;
```

## Responsive Design

### Breakpoints
- **Desktop**: Full functionality with all components visible
- **Tablet**: Reduced padding, maintained functionality
- **Mobile (768px and below)**:
  - User details hidden, only icon shown
  - Sidebar becomes overlay with mobile toggle
  - Smaller online users dropdown
  - Touch-optimized interactions

### Mobile Optimizations
```css
@media (max-width: 768px) {
    .top-bar-user-section {
        gap: 0.5rem;
    }
    
    .user-details {
        display: none;
    }
    
    .user-info-display {
        padding: 0.5rem;
    }
    
    .online-users-list {
        right: -1rem;
        min-width: 180px;
    }
}
```

## Security Features

### Authentication Integration
- **JWT Token Verification**: All user info extracted from verified JWT tokens
- **Server-Side Validation**: Heartbeat endpoint requires valid authentication
- **Secure Logout**: Proper session cleanup and token removal
- **CORS Protection**: Proper origin validation for cross-site requests

### Privacy Considerations
- **Minimal Data Exposure**: Only displays necessary user information
- **Real-Time Cleanup**: Automatically removes inactive user data
- **No Sensitive Data**: User presence data doesn't include sensitive information

## Styling Guidelines

### Design Principles
- **Borderless UI**: No outside border lines (per user preference)
- **Simple Aesthetics**: Clean, minimalist design without gradients
- **Blue Accent Color**: #2563eb for active states and highlights
- **Professional Appearance**: Suitable for business environment
- **Consistent Icons**: Material Icons throughout for uniformity

### Theme Support
- **Light Theme**: Clean whites and grays with blue accents
- **Dark Theme**: Dark grays and blacks with blue accents
- **Automatic Detection**: Respects system preferences
- **Persistent Choice**: Remembers user's theme selection
- **Smooth Transitions**: Animated theme switching

## Performance Considerations

### Optimization Features
- **Debounced Updates**: Prevents excessive DOM manipulation
- **Efficient Cleanup**: Regular cleanup of inactive users
- **Minimal Network Usage**: 30-second heartbeat interval balances real-time updates with efficiency
- **Fallback Mechanisms**: LocalStorage ensures functionality during network issues
- **Memory Management**: Proper cleanup on page unload

### Monitoring
- **Debug Logging**: Comprehensive console logging for troubleshooting
- **Error Handling**: Graceful degradation when features fail
- **Performance Metrics**: Tracks heartbeat success/failure rates

## Browser Compatibility

### Supported Browsers
- **Chrome**: Full support with all features
- **Firefox**: Full support with all features
- **Safari**: Full support with all features
- **Edge**: Full support with all features

### Fallback Support
- **No JavaScript**: Basic navigation still functional
- **Network Issues**: LocalStorage fallback for online users
- **Older Browsers**: Graceful degradation of advanced features

## Maintenance and Updates

### Regular Maintenance
- **Server Logs**: Monitor heartbeat endpoint performance
- **User Feedback**: Track user experience with navigation features
- **Performance Monitoring**: Watch for memory leaks or performance issues

### Future Enhancements
- **Real-Time Messaging**: Potential integration with chat features
- **User Status**: Away/busy status indicators
- **Page-Specific Actions**: Show what users are doing on each page
- **Mobile App Integration**: Extend presence to mobile applications

## Troubleshooting

### Common Issues
1. **Online Users Not Updating**: Check server heartbeat endpoint and network connectivity
2. **Theme Not Persisting**: Verify localStorage functionality
3. **Sidebar Not Expanding**: Check CSS transitions and JavaScript event listeners
4. **User Info Not Loading**: Verify JWT token validity and format

### Debug Tools
- **Browser Console**: Check for error messages and debug logs
- **Network Tab**: Monitor heartbeat requests and responses
- **Test Pages**: Use provided debug pages for isolated testing
- **Server Logs**: Monitor server-side heartbeat processing

This comprehensive navigation system provides a professional, efficient, and user-friendly interface for the CMRP Opportunities Management system, with real-time collaborative features that enhance team coordination and productivity. 