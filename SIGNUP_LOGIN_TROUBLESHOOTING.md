# Signup & Login Troubleshooting Guide

## Common Issues and Solutions

### Issue: Can't Login After Signup

#### Problem 1: Email Confirmation Required
**Symptom**: User signs up successfully but can't log in with their credentials.

**Solution**: 
1. Check Supabase Dashboard → Authentication → Settings
2. Look for "Enable email confirmations" setting
3. **Option A**: Disable email confirmations (for development/testing)
   - Go to Authentication → Settings
   - Toggle OFF "Enable email confirmations"
   - Users can log in immediately after signup
4. **Option B**: Keep email confirmations enabled (recommended for production)
   - Users must click the confirmation link in their email
   - Check spam/junk folder if email not received
   - Resend confirmation email from Supabase Dashboard if needed

#### Problem 2: Email Case Sensitivity
**Symptom**: Login fails even with correct credentials.

**Solution**: 
- The app now normalizes emails (converts to lowercase)
- Make sure you're using the same email format as signup
- Try using all lowercase email

#### Problem 3: User Not Created in team_members Table
**Symptom**: User can log in but has no role/permissions.

**Solution**:
1. Run the `setup-signup.sql` script to create the trigger
2. Or manually create team_member entry:
   ```sql
   INSERT INTO team_members (
     auth_user_id,
     email,
     name,
     role
   )
   VALUES (
     (SELECT id FROM auth.users WHERE email = 'user@example.com'),
     'user@example.com',
     'User Name',
     'staff'
   );
   ```

### Issue: "Invalid login credentials" Error

**Possible Causes**:
1. Wrong email or password
2. Email not confirmed (if email confirmation is enabled)
3. User account doesn't exist in Supabase Auth

**Solutions**:
1. Double-check email and password
2. Try resetting password: Go to Supabase Dashboard → Authentication → Users → Reset Password
3. Verify user exists: Check Supabase Dashboard → Authentication → Users
4. Check email confirmation status in Supabase Dashboard

### Issue: User Can Login But Can't Access Dashboard

**Possible Causes**:
1. No team_member record exists
2. User has no role assigned
3. User not assigned to any shop

**Solutions**:
1. Check if team_member exists:
   ```sql
   SELECT * FROM team_members WHERE email = 'user@example.com';
   ```
2. If missing, create one (see Problem 3 above)
3. Assign role via AdminDashboard or run:
   ```sql
   UPDATE team_members 
   SET role = 'staff' 
   WHERE email = 'user@example.com';
   ```
4. Assign to shop via TeamManagement page

## Quick Fixes

### Disable Email Confirmation (Development)
1. Go to Supabase Dashboard
2. Authentication → Settings
3. Toggle OFF "Enable email confirmations"
4. Save changes

### Manually Confirm User Email
1. Go to Supabase Dashboard
2. Authentication → Users
3. Find the user
4. Click "..." menu → "Send confirmation email"
5. Or manually set email_confirmed to true in database

### Reset User Password
1. Go to Supabase Dashboard
2. Authentication → Users
3. Find the user
4. Click "..." menu → "Reset password"
5. User will receive password reset email

## Testing Signup/Login Flow

1. **Signup**:
   - Go to `/signup`
   - Enter email and password
   - Click "Sign Up"
   - Check for success message

2. **Check Email** (if confirmation enabled):
   - Check inbox for confirmation email
   - Click confirmation link
   - Should redirect to login page

3. **Login**:
   - Go to `/login`
   - Enter same email and password
   - Click "Log In"
   - Should redirect to `/calendar`

4. **Verify Access**:
   - Should see calendar page
   - Check browser console for errors
   - Verify user role in Supabase Dashboard

## Database Verification Queries

```sql
-- Check if user exists in auth
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'user@example.com';

-- Check if team_member exists
SELECT id, email, name, role, auth_user_id 
FROM team_members 
WHERE email = 'user@example.com';

-- Link auth user to team_member
SELECT 
  u.id as auth_id,
  u.email as auth_email,
  u.email_confirmed_at,
  tm.id as team_member_id,
  tm.name,
  tm.role
FROM auth.users u
LEFT JOIN team_members tm ON u.id = tm.auth_user_id OR u.email = tm.email
WHERE u.email = 'user@example.com';
```

## Configuration Checklist

- [ ] Email confirmations disabled (for development) or enabled (for production)
- [ ] `setup-signup.sql` script has been run
- [ ] Trigger `on_auth_user_created` exists and is active
- [ ] RLS policies allow users to read their own team_member
- [ ] Team members table has `auth_user_id` column
- [ ] Email normalization is working (lowercase)

## Support

If issues persist:
1. Check browser console for errors
2. Check Supabase Dashboard → Logs for API errors
3. Verify Supabase project settings
4. Check network tab for failed requests

