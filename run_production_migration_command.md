# Production Database Migration Instructions

## For Production Database (Neon)

To fix the user management issue in production, run this command:

```bash
cd "/Users/reuelrivera/Documents/CMRP Opps Management/CMRP-Opps-Management"
node run_production_migration.js
```

This will:
1. Connect to your Neon production database
2. Add missing `roles`, `account_type`, and `last_login_at` columns
3. Set up admin users (first user or any user with "admin" in email)
4. Create necessary indexes
5. Show you the final users table

## Expected Output

You should see:
- ✅ Connected to production database
- ✅ Migration completed successfully!
- 📊 Table showing all users with their new roles and account types

## After Migration

Once this is done, your admin account should be able to:
- Access the user management page
- See all users in the table
- Manage user roles and permissions

## Troubleshooting

If you get an error about columns already existing, that's normal - the script uses `IF NOT EXISTS` clauses to safely add columns.

## Login Credentials

Use any of these admin accounts after migration:
- Any user with "admin" in their email address
- The first user created in the database (chronologically)

They will have:
- `account_type`: "Admin"  
- `roles`: ["Admin", "DS", "SE"]