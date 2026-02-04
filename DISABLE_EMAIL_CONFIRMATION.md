# How to Disable Email Confirmation (For Development)

## Quick Fix for "Email not confirmed" Error

If you're getting "Email not confirmed" errors when trying to log in after signup, you can disable email confirmation in Supabase:

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to your project: https://supabase.com/dashboard

2. **Open Authentication Settings**
   - Click on **Authentication** in the left sidebar
   - Click on **Settings** (gear icon)

3. **Disable Email Confirmation**
   - Scroll down to **"Email Auth"** section
   - Find **"Enable email confirmations"** toggle
   - **Toggle it OFF**
   - Click **Save**

4. **Test Login**
   - Users can now log in immediately after signup
   - No email confirmation required

### Alternative: Confirm Email Manually

If you want to keep email confirmation enabled but need to test:

1. Go to **Authentication** → **Users**
2. Find the user who signed up
3. Click the **"..."** menu next to the user
4. Select **"Send confirmation email"**
5. Or manually set `email_confirmed_at` in the database

### For Production

Keep email confirmation **ENABLED** in production for security. Only disable it during development/testing.

