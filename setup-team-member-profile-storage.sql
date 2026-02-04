-- ============================================
-- SETUP STORAGE POLICIES FOR TeamMemberProfile BUCKET
-- ============================================
-- IMPORTANT: Run this in Supabase SQL Editor
-- Make sure the bucket "TeamMemberProfile" exists first!
-- ============================================

-- Step 1: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to upload to TeamMemberProfile" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read from TeamMemberProfile" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update TeamMemberProfile files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete from TeamMemberProfile" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to TeamMemberProfile" ON storage.objects;

-- Step 2: Create policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload to TeamMemberProfile"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'TeamMemberProfile'
);

-- Step 3: Create policy to allow authenticated users to read/view files
CREATE POLICY "Allow authenticated users to read from TeamMemberProfile"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'TeamMemberProfile');

-- Step 4: Create policy to allow authenticated users to update files
CREATE POLICY "Allow authenticated users to update TeamMemberProfile files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'TeamMemberProfile')
WITH CHECK (bucket_id = 'TeamMemberProfile');

-- Step 5: Create policy to allow authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete from TeamMemberProfile"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'TeamMemberProfile');

-- Step 6: (Optional) Allow public read access - uncomment if needed
-- CREATE POLICY "Allow public read access to TeamMemberProfile"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'TeamMemberProfile');

-- ============================================
-- VERIFY POLICIES WERE CREATED
-- ============================================
SELECT 
    policyname,
    cmd as operation,
    roles,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%TeamMemberProfile%'
ORDER BY policyname;

-- ============================================
-- CHECK IF BUCKET EXISTS
-- ============================================
SELECT name, id, public, created_at
FROM storage.buckets
WHERE name = 'TeamMemberProfile';
