# Google Calendar OAuth Setup Guide

This guide explains how to set up Google Calendar OAuth integration for one-way sync from Google Calendar to your CMRP Opportunities Management system.

## 🔧 Google Cloud Console Setup

### 1. Access Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your existing project (the one used for Google Drive integration)

### 2. Enable Google Calendar API
1. Navigate to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click on it and press **Enable**

### 3. Configure OAuth Consent Screen (if not already done)
1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** (unless you have Google Workspace)
3. Fill in required fields:
   - App name: "CMRP Opportunities Management"
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

### 4. Create OAuth 2.0 Credentials
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client IDs**
3. Choose **Web application**
4. Configure:
   - Name: "CMRP Calendar OAuth Client"
   - Authorized JavaScript origins: 
     - `http://localhost:3000` (development)
     - Your production domain (if applicable)
   - Authorized redirect URIs:
     - `http://localhost:3000/auth/google/calendar/callback` (development)
     - Your production domain + `/auth/google/calendar/callback` (production)

### 5. Download Credentials
1. After creating, click the download button
2. Save the JSON file securely
3. Note the `client_id` and `client_secret` values

## 🔐 Environment Variables Setup

Add these variables to your `.env` file:

```bash
# Google Calendar OAuth Configuration
GOOGLE_OAUTH_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/auth/google/calendar/callback

# For production, update the redirect URI:
# GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/auth/google/calendar/callback
```

## 📊 Database Migration

Run the database migration to create the required tables:

```bash
# Connect to your PostgreSQL database
psql -h localhost -U cmrp_user -d cmrp_opps_db

# Run the migration
\i migrations/009_add_google_calendar_oauth.sql

# Verify tables were created
\dt user_calendar_tokens
\dt calendar_events
```

## 🚀 How It Works

### User Flow
1. **Connect Calendar**: User clicks "Calendar" button in top navigation
2. **OAuth Authorization**: User is redirected to Google to authorize calendar access
3. **Store Tokens**: System stores OAuth tokens for ongoing access
4. **Sync Events**: System fetches calendar events and stores them locally
5. **Display Schedule**: Calendar events appear alongside proposal schedule

### API Endpoints
- `GET /auth/google/calendar` - Start OAuth flow
- `GET /auth/google/calendar/callback` - Handle OAuth callback
- `GET /api/calendar/status` - Check connection status
- `POST /api/calendar/sync` - Manual sync trigger
- `DELETE /api/calendar/connection` - Disconnect calendar
- `GET /api/schedule/combined` - Get schedule with calendar events

## 🔄 Sync Behavior

### Automatic Sync
- Currently manual sync only
- Can be extended to auto-sync on schedule page load
- Sync token support for incremental updates

### Event Mapping
- Calendar events are stored separately from proposal schedule
- Combined view shows both proposal tasks and calendar events
- Time zone handling for accurate display

### Data Storage
- OAuth tokens stored in `user_calendar_tokens` table
- Calendar events stored in `calendar_events` table
- One calendar connection per user
- Soft delete for removed events

## 🛡️ Security Notes

### Token Security
- Refresh tokens stored securely in database
- Access tokens automatically refreshed when expired
- No sensitive data logged to console

### User Privacy
- Each user authorizes their own calendar access
- Users can disconnect anytime
- Only read access to calendar (no modifications)

### Permissions
- `calendar.readonly` - Read calendar events only
- `userinfo.email` - Get user's Google email
- `userinfo.profile` - Get basic profile info

## 🔧 Testing

### Manual Testing Steps
1. Set up OAuth credentials as described above
2. Add environment variables to `.env`
3. Run database migration
4. Start your server: `npm start`
5. Login to your application
6. Click "Calendar" button in top navigation
7. Click "Connect Google Calendar"
8. Authorize access in Google popup
9. Verify connection shows email address
10. Click "Sync Now" to test sync
11. Check database for synced events

### Troubleshooting
- **"OAuth client not initialized"**: Check environment variables
- **"Failed to start OAuth flow"**: Verify Google Cloud API is enabled
- **"Authorization denied"**: User cancelled OAuth flow
- **"Token refresh failed"**: User may need to reconnect

## 📈 Future Enhancements

### Potential Improvements
1. **Auto-sync**: Sync on page load and periodic intervals
2. **Multiple Calendars**: Support secondary calendars
3. **Event Filtering**: Filter by event type, attendees, etc.
4. **Two-way Sync**: Create calendar events from proposals
5. **Smart Scheduling**: Suggest meeting times based on calendar availability

### Integration with Existing Features
- Combine with proposal scheduling system
- Show calendar events in weekly view
- Alert for scheduling conflicts
- Export combined schedule to different formats

## 🎯 Benefits

### User Experience
- Single view of all work commitments
- No manual calendar checking
- Automatic event updates
- Personal calendar privacy maintained

### Business Value
- Better resource planning
- Avoid scheduling conflicts
- Improved project timeline accuracy
- Enhanced team coordination