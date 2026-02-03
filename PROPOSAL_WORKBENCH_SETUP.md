# Proposal Engineer's Workbench - Setup Guide

## Overview

The Proposal Engineer's Workbench is a specialized tool designed for Proposal Engineers (users with DS and SE roles) to manage their assigned proposals using a Kanban board and weekly scheduler. This tool helps engineers track proposal status, update key details, and plan their work week effectively.

## Features

1. **Kanban Board**
   - Visual board with four status columns: Not Yet Started, On-going, For Approval, and Submitted
   - Drag and drop proposals between columns to update status
   - Click on cards to edit proposal details

2. **Weekly Schedule**
   - Plan your week by assigning proposals to specific days
   - Drag and drop proposals from the Kanban board to schedule them
   - Remove scheduled tasks as needed

3. **Proposal Editing**
   - Update key proposal details:
     - Revision number
     - Margin percentage
     - Final amount
     - Submitted date
     - Status

4. **Auto-Assignment**
   - Proposals assigned to the engineer in the main system automatically appear in their workbench

## Setup Instructions

### 1. Database Migration

Run the migration script to add the necessary database tables:

```bash
psql -U your_username -d your_database -f migrations/003_add_proposal_workbench.sql
```

This will:
- Add a `proposal_status` column to the `opps_monitoring` table
- Create a `proposal_schedule` table for the weekly schedule
- Add a `revision` column to the `opps_monitoring` table if it doesn't exist
- Set default values for existing data

### 2. Backend Integration

The backend routes are already integrated in the `server.js` file. Make sure the server is restarted after deployment to load the new routes.

### 3. Access Control

Only users with the following roles can access the Proposal Engineer's Workbench:
- `DS` (Design)
- `SE` (Sales Engineer)

Users without these roles will see an "Access Denied" message.

## Usage Guide

### Accessing the Workbench

1. Log in to the CMRP Opportunities Management system
2. Click on the "Proposal Workbench" icon in the navigation bar (assignment icon)

### Managing Proposals on the Kanban Board

1. **View Proposals**: All proposals assigned to you appear in the appropriate status columns
2. **Update Status**: Drag and drop proposals between columns to update their status
   - Moving a card to "Submitted" automatically sets the submitted date if not already set
3. **Edit Details**: Click on a proposal card to open the edit modal
   - Update revision number, margin percentage, final amount, etc.
   - Click "Save Changes" to update the proposal

### Planning Your Week

1. **Schedule Tasks**: Drag proposals from the Kanban board to a day in the weekly schedule
2. **Remove Tasks**: Click the "Remove" button on a scheduled task to remove it from your schedule
3. **View Weekly Plan**: The schedule shows all your planned work for the current week

### Filtering

Use the "Filter by Client" dropdown to focus on proposals for a specific client.

## Technical Details

### API Endpoints

- `GET /api/proposals/assigned` - Get proposals assigned to the current user
- `PUT /api/proposals/:id/status` - Update proposal status
- `PUT /api/proposals/:id` - Update proposal details
- `GET /api/schedule` - Get the user's weekly schedule
- `POST /api/schedule` - Add a proposal to the schedule
- `DELETE /api/schedule` - Remove a proposal from the schedule

### Database Schema

**opps_monitoring table** (existing table with new columns):
- `proposal_status` - VARCHAR(20) - Status of the proposal (not_started, ongoing, for_approval, submitted)
- `revision` - VARCHAR(20) - Revision number of the proposal

**proposal_schedule table** (new table):
- `id` - SERIAL PRIMARY KEY
- `user_id` - INTEGER NOT NULL - ID of the user
- `proposal_id` - VARCHAR(36) NOT NULL - UID of the proposal
- `day_index` - INTEGER NOT NULL - Day of the week (1-5, Monday to Friday)
- `created_at` - TIMESTAMP WITH TIME ZONE - Creation timestamp
- `updated_at` - TIMESTAMP WITH TIME ZONE - Last update timestamp

## Troubleshooting

### Common Issues

1. **Proposals not showing up**:
   - Verify that you have the correct role (DS or SE)
   - Check that proposals are assigned to you as PIC in the main system
   - Check browser console for any JavaScript errors

2. **Cannot drag and drop**:
   - Ensure you're using a modern browser that supports HTML5 drag and drop
   - Check browser console for any JavaScript errors

3. **API errors**:
   - Verify your authentication token is valid
   - Check server logs for detailed error messages

### Support

For additional help or to report issues, please contact the system administrator. 