-- ============================================
-- DISABLE AUTO-OWNER TEAM MEMBER ADDITION
-- ============================================

-- PROBLEM:
-- When a user creates a shop, the system automatically adds them to the 'team_members' table with role 'owner'.
-- The user requested to STOP this behavior ("don't adding automatically").

-- SOLUTION:
-- Drop the trigger `tr_shops_add_member_after` and its function.

-- 1. Drop the AFTER INSERT trigger
DROP TRIGGER IF EXISTS tr_shops_add_member_after ON public.shops;

-- 2. Drop the function responsible for adding the member
DROP FUNCTION IF EXISTS public.add_shop_creator_as_member_after();

-- NOTE: The "BEFORE INSERT" trigger `tr_shops_set_owner_before` (which sets owner_id) IS KEPT.
-- This is essential for RLS and ownership, even if they aren't in the team list.

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload config';
