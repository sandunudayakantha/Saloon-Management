# Supabase Storage Setup

## Create the Avatars Bucket

To enable image uploads, you need to create a storage bucket in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Configure the bucket:
   - **Name**: `avatars`
   - **Public bucket**: ✅ Check this (so images can be accessed publicly)
   - **File size limit**: 10 MB (or your preference)
   - **Allowed MIME types**: `image/*` (or specific: `image/jpeg,image/png,image/gif,image/webp`)
5. Click **Create bucket**

## Set Up Bucket Policies (Optional but Recommended)

After creating the bucket, set up RLS policies:

1. Go to **Storage** > **Policies** > **avatars**
2. Create a policy for authenticated users to upload:
   - **Policy name**: "Allow authenticated uploads"
   - **Allowed operation**: INSERT
   - **Policy definition**: 
     ```sql
     (bucket_id = 'avatars'::text) AND (auth.role() = 'authenticated'::text)
     ```
3. Create a policy for public read access:
   - **Policy name**: "Allow public reads"
   - **Allowed operation**: SELECT
   - **Policy definition**:
     ```sql
     (bucket_id = 'avatars'::text)
     ```

## Alternative: Use Data URLs (Current Fallback)

The ImageUploader component now has a fallback that uses data URLs when the storage bucket is not available. This works for testing but has limitations:
- Images are stored in the database as base64 strings (larger size)
- Not ideal for production use
- Better to set up the storage bucket for production

## Test the Setup

After creating the bucket, try uploading an image in:
- Team Management (team member profile pictures)
- Shop Management (shop images)
- Product Management (product images)

The upload should work without errors.

