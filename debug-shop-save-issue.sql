-- ============================================
-- DEBUG SHOP SAVE ISSUE
-- ============================================
-- Run these queries in Supabase SQL Editor to diagnose why shops aren't saving
-- ============================================

-- 1. Check if shops table exists and has correct structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'shops' 
ORDER BY ordinal_position;

-- 2. Check RLS policies on shops table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'shops';

-- 3. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'shops';

-- 4. Test if you can insert a shop (run this as the authenticated user)
-- Replace 'Test Shop' with your shop name
INSERT INTO shops (name, address, phone, email) 
VALUES ('Test Shop', '123 Test St', '555-1234', 'test@example.com')
RETURNING *;

-- 5. Check current user role
SELECT auth.role();

-- 6. Check if you're authenticated
SELECT auth.uid();

-- 7. View all shops (to see if any were actually saved)
SELECT * FROM shops ORDER BY created_at DESC;

-- 8. If RLS is blocking, you can temporarily disable it for testing (NOT RECOMMENDED FOR PRODUCTION)
-- ALTER TABLE shops DISABLE ROW LEVEL SECURITY;

-- 9. If you need to recreate the RLS policy, use this:
-- DROP POLICY IF EXISTS "Allow all for shops" ON shops;
-- CREATE POLICY "Allow all for shops" ON shops FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- COMMON ISSUES AND SOLUTIONS:
-- ============================================
-- Issue 1: RLS policy not working
-- Solution: Make sure you're authenticated and the policy allows INSERT
-- 
-- Issue 2: Empty strings vs NULL
-- Solution: The code now converts empty strings to NULL
--
-- Issue 3: Missing required fields
-- Solution: Make sure 'name' field is always provided
--
-- Issue 4: Permission denied
-- Solution: Check that your Supabase user has INSERT permissions on shops table
-- ============================================


