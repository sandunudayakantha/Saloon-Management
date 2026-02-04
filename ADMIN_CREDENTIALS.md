# Admin Dashboard Login Credentials

## Quick Setup Guide

To access the Admin Dashboard, you need to:
1. Create a user in Supabase Authentication
2. Add that user to the `team_members` table with `admin` or `owner` role

## Recommended Admin Credentials

### Option 1: Admin User
- **Email**: `admin@salon.com`
- **Password**: `Admin123!@#`
- **Role**: `admin` (can access AdminDashboard)

### Option 2: Owner User
- **Email**: `owner@salon.com`
- **Password**: `Owner123!@#`
- **Role**: `owner` (full access, highest privilege)

## Step-by-Step Setup

### Step 1: Create User in Supabase Auth

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Users**
3. Click **Add User** > **Create New User**
4. Enter:
   - **Email**: `admin@salon.com` (or your preferred email)
   - **Password**: `Admin123!@#` (or your preferred password)
   - **Auto Confirm User**: ✅ Check this box (so you don't need email verification)
5. Click **Create User**

### Step 2: Add User to Database

Run the SQL script `create-admin-user.sql` in your Supabase SQL Editor:

1. Go to **SQL Editor** in Supabase
2. Open or create a new query
3. Copy the contents of `create-admin-user.sql`
4. **IMPORTANT**: Update the email in the SQL script to match the email you used in Step 1
5. Run the script

### Step 3: Login to Your App

1. Open your application
2. Navigate to the login page
3. Enter:
   - **Email**: `admin@salon.com` (or the email you created)
   - **Password**: `Admin123!@#` (or the password you set)
4. Click **Log In**
5. Navigate to `/settings/admin` to access the Admin Dashboard

## Alternative: Use Existing Test User

If you already ran `supabase-schema.sql`, you can use the existing test user:

1. Create a Supabase Auth user with email: `sarah.connor@salon.com`
2. The user already exists in `team_members` with `role = 'owner'`
3. You just need to create the Auth user with matching email

## Verify Admin Access

After logging in, you can verify admin access by:

1. Check the browser console - you should see the user role
2. Navigate to `/settings/admin` - you should see the Admin Dashboard
3. If you see a redirect, the user role is not set correctly

## Troubleshooting

### "Cannot access Admin Dashboard"
- **Solution**: Make sure the user's email in Supabase Auth matches the email in `team_members` table
- **Solution**: Verify the `role` field in `team_members` is set to `'admin'` or `'owner'`

### "User not found in team_members"
- **Solution**: Run the `create-admin-user.sql` script
- **Solution**: Make sure the email in the SQL script matches your Auth user email

### "Invalid login credentials"
- **Solution**: Check that you created the user in Supabase Auth first
- **Solution**: Verify the email and password are correct

## Quick SQL Check

Run this query to verify your admin user exists:

```sql
SELECT 
    name,
    email,
    role,
    employment_statuses.status_name
FROM team_members
LEFT JOIN employment_statuses ON team_members.employment_status_id = employment_statuses.id
WHERE role IN ('admin', 'owner');
```

You should see your admin/owner user in the results.

## Security Note

⚠️ **Important**: Change the default passwords in production! These are test credentials only.

