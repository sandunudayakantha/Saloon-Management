-- ============================================
-- DISABLE AUTO-STAFF CREATION
-- ============================================

-- PROBLEM:
-- New users are automatically assigned the 'staff' role via a database trigger/function.
-- The user wants new accounts to start fresh (likely to become owners).

-- SOLUTION:
-- Drop the trigger and function responsible for this automation.

-- 1. Drop the trigger on auth.users (if it exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop the function handling the new user creation
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload config';
