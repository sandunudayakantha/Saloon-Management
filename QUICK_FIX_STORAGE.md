# 🚀 QUICK FIX: Storage Upload Error

## The Error
```
StorageApiError: new row violates row-level security policy
statusCode: 403
```

## ⚡ Quick Fix (2 Steps)

### Step 1: Create Bucket in Supabase Dashboard
1. Open: https://supabase.com/dashboard
2. Select your project
3. Go to **Storage** → Click **"New bucket"**
4. Name: `TeamMemberProfile` (exact spelling, case-sensitive)
5. Toggle **"Public bucket"** to ON
6. Click **"Create bucket"**

### Step 2: Run SQL in Supabase SQL Editor
1. Go to **SQL Editor** in Supabase Dashboard
2. Click **"New query"**
3. Copy and paste this SQL:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to upload to TeamMemberProfile" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read from TeamMemberProfile" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update TeamMemberProfile files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete from TeamMemberProfile" ON storage.objects;

-- Create upload policy
CREATE POLICY "Allow authenticated users to upload to TeamMemberProfile"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'TeamMemberProfile');

-- Create read policy
CREATE POLICY "Allow authenticated users to read from TeamMemberProfile"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'TeamMemberProfile');

-- Create update policy
CREATE POLICY "Allow authenticated users to update TeamMemberProfile files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'TeamMemberProfile')
WITH CHECK (bucket_id = 'TeamMemberProfile');

-- Create delete policy
CREATE POLICY "Allow authenticated users to delete from TeamMemberProfile"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'TeamMemberProfile');
```

4. Click **"Run"** button
5. You should see "Success. No rows returned" or a table with 4 policies

### Step 3: Test Upload
1. Refresh your application
2. Try uploading an image again
3. It should work now! ✅

## 🔍 Verify It Worked
After running the SQL, check:
1. Go to **Storage** → **Policies** tab
2. You should see 4 policies for "TeamMemberProfile"
3. All should show "authenticated" as the role

## ❌ Still Not Working?
- Make sure you're **logged in** to your app (authenticated user)
- Check the bucket name is exactly `TeamMemberProfile` (no spaces, correct case)
- Verify the bucket exists in Storage → Buckets
- Check browser console for any other errors

