# Storage RLS Setup Guide for TeamMemberProfile Bucket

## ⚠️ Problem
You're seeing this error when uploading images:
```
StorageApiError: new row violates row-level security policy
statusCode: 403
```

This means the Supabase Storage bucket `TeamMemberProfile` doesn't have the proper Row Level Security (RLS) policies configured.

## ✅ Solution - Follow These Steps EXACTLY

### Step 1: Create the Bucket (MUST DO THIS FIRST!)
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **"New bucket"** or **"Create bucket"** button
5. Set the bucket name to exactly: `TeamMemberProfile` (case-sensitive!)
6. Make it **Public** (toggle ON) - this allows public read access
7. Click **"Create bucket"**
8. **VERIFY**: You should see "TeamMemberProfile" in your buckets list

### Step 2: Set Up RLS Policies (MUST DO THIS SECOND!)
1. Go to **SQL Editor** in Supabase Dashboard (left sidebar)
2. Click **"New query"**
3. Copy the **ENTIRE** contents of `setup-team-member-profile-storage.sql`
4. Paste it into the SQL Editor
5. Click **"Run"** button (or press Ctrl+Enter / Cmd+Enter)
6. **VERIFY**: You should see a success message and a table showing 4 policies created

This will create policies that allow:
- ✅ Authenticated users to upload files (INSERT)
- ✅ Authenticated users to read/view files (SELECT)
- ✅ Authenticated users to update files (UPDATE)
- ✅ Authenticated users to delete files (DELETE)

### Step 3: Verify Policies
After running the SQL, you can verify the policies were created:

1. Go to **Storage** → **Policies** tab
2. Look for policies with "TeamMemberProfile" in the name
3. You should see 4 policies:
   - Allow authenticated users to upload to TeamMemberProfile
   - Allow authenticated users to read from TeamMemberProfile
   - Allow authenticated users to update TeamMemberProfile files
   - Allow authenticated users to delete from TeamMemberProfile

### Alternative: Manual Policy Setup
If you prefer to set up policies manually:

1. Go to **Storage** → **Policies**
2. Select the `TeamMemberProfile` bucket
3. Click **"New Policy"**
4. For each operation (INSERT, SELECT, UPDATE, DELETE):
   - Policy name: `Allow authenticated users to [operation] TeamMemberProfile`
   - Allowed operation: [INSERT/SELECT/UPDATE/DELETE]
   - Target roles: `authenticated`
   - Policy definition: `bucket_id = 'TeamMemberProfile'`

### Step 4: Test Upload
After setting up the policies:
1. Go to your application
2. Try uploading a profile image in the "Add Team Member" dialog
3. The upload should now work without RLS errors

## Notes
- The policies only allow files starting with `profile_` prefix for uploads (security measure)
- Only authenticated (logged-in) users can upload/access files
- If you need public read access, uncomment the public policy in the SQL script

## Troubleshooting
If uploads still fail after setting up policies:
1. Check that you're logged in (authenticated)
2. Verify the bucket name is exactly `TeamMemberProfile` (case-sensitive)
3. Check the browser console for specific error messages
4. Verify policies are active in Storage → Policies

