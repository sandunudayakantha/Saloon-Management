-- ============================================
-- SETUP SIGNUP FUNCTIONALITY
-- ============================================
-- This script sets up the database structure and functions
-- to handle user signup and link Supabase Auth users to team_members table
--
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: ENSURE TEAM_MEMBERS TABLE STRUCTURE
-- ============================================
-- Make sure team_members table has all required columns
-- (This should already exist from your schema, but adding for safety)

-- Add auth_user_id column to link to Supabase Auth users (optional but recommended)
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_email_unique 
ON team_members(email) 
WHERE email IS NOT NULL;

-- Add unique constraint on auth_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_auth_user_id_unique 
ON team_members(auth_user_id) 
WHERE auth_user_id IS NOT NULL;

-- ============================================
-- STEP 2: CREATE FUNCTION TO AUTO-CREATE TEAM MEMBER ON SIGNUP
-- ============================================
-- This function automatically creates a team_member entry
-- when a user signs up in Supabase Auth

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new team_member record when a new user signs up
  INSERT INTO public.team_members (
    auth_user_id,
    email,
    name,
    role,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)), -- Use name from metadata or email prefix
    'staff', -- Default role for new signups
    NOW()
  )
  ON CONFLICT (auth_user_id) DO NOTHING; -- Prevent duplicate if trigger fires twice
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 3: CREATE TRIGGER FOR AUTO-SIGNUP
-- ============================================
-- This trigger automatically creates a team_member when a user signs up

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 4: UPDATE RLS POLICIES FOR SIGNUP
-- ============================================

-- Allow authenticated users to read their own team_member record
DROP POLICY IF EXISTS "Users can read own team_member" ON team_members;
CREATE POLICY "Users can read own team_member" 
ON team_members 
FOR SELECT 
USING (
  auth_user_id = auth.uid() 
  OR 
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Allow authenticated users to update their own team_member record (limited fields)
DROP POLICY IF EXISTS "Users can update own team_member" ON team_members;
CREATE POLICY "Users can update own team_member" 
ON team_members 
FOR UPDATE 
USING (
  auth_user_id = auth.uid() 
  OR 
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  auth_user_id = auth.uid() 
  OR 
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Allow system to insert new team_members (for the trigger)
-- This is handled by SECURITY DEFINER in the function

-- ============================================
-- STEP 5: MANUAL SIGNUP FUNCTION (Alternative)
-- ============================================
-- If you prefer to manually create team_member after signup,
-- use this function instead of the trigger

CREATE OR REPLACE FUNCTION public.create_team_member_from_auth(
  p_auth_user_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'staff'
)
RETURNS UUID AS $$
DECLARE
  v_team_member_id UUID;
BEGIN
  -- Insert team member
  INSERT INTO public.team_members (
    auth_user_id,
    email,
    name,
    role,
    created_at
  )
  VALUES (
    p_auth_user_id,
    LOWER(TRIM(p_email)),
    COALESCE(p_name, SPLIT_PART(p_email, '@', 1)),
    p_role,
    NOW()
  )
  ON CONFLICT (auth_user_id) 
  DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, team_members.name),
    updated_at = NOW()
  RETURNING id INTO v_team_member_id;
  
  RETURN v_team_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_member_from_auth(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================
-- STEP 7: VERIFICATION QUERIES
-- ============================================
-- Uncomment these to verify the setup:

-- Check if trigger exists
-- SELECT 
--   trigger_name, 
--   event_manipulation, 
--   event_object_table, 
--   action_statement
-- FROM information_schema.triggers 
-- WHERE trigger_name = 'on_auth_user_created';

-- Check if function exists
-- SELECT 
--   routine_name, 
--   routine_type
-- FROM information_schema.routines 
-- WHERE routine_name IN ('handle_new_user', 'create_team_member_from_auth');

-- Check team_members with auth_user_id
-- SELECT 
--   id,
--   name,
--   email,
--   auth_user_id,
--   role,
--   created_at
-- FROM team_members
-- WHERE auth_user_id IS NOT NULL
-- ORDER BY created_at DESC
-- LIMIT 10;

-- ============================================
-- USAGE INSTRUCTIONS
-- ============================================
-- 
-- OPTION 1: Automatic Signup (Recommended)
-- -----------------------------------------
-- The trigger will automatically create a team_member entry
-- when a user signs up via Supabase Auth.
-- 
-- When a user signs up:
-- 1. User is created in auth.users (handled by Supabase Auth)
-- 2. Trigger fires and creates team_member with:
--    - auth_user_id: linked to auth.users.id
--    - email: from auth.users.email
--    - name: from metadata or email prefix
--    - role: 'staff' (default)
--
-- OPTION 2: Manual Signup
-- -----------------------------------------
-- If you prefer manual control, disable the trigger and call
-- the function from your application after signup:
--
-- SELECT public.create_team_member_from_auth(
--   auth.uid(),  -- Current user's auth ID
--   'user@example.com',
--   'User Name',
--   'staff'
-- );
--
-- OPTION 3: Application-Level Signup
-- -----------------------------------------
-- After successful signup in your app, insert directly:
--
-- INSERT INTO team_members (
--   auth_user_id,
--   email,
--   name,
--   role
-- )
-- VALUES (
--   auth.uid(),
--   'user@example.com',
--   'User Name',
--   'staff'
-- );
--
-- ============================================
-- NOTES
-- ============================================
-- 
-- 1. The trigger uses SECURITY DEFINER to bypass RLS
--    when creating team_member entries
--
-- 2. Default role is 'staff' - admins can change this
--    via AdminDashboard or TeamManagement
--
-- 3. New users won't have shop assignments or services
--    - Assign these via TeamManagement page
--
-- 4. Email confirmation is handled by Supabase Auth settings
--    - Check Authentication > Settings in Supabase Dashboard
--
-- 5. To disable automatic signup, drop the trigger:
--    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--
-- ============================================

