-- ============================================
-- FIX MULTI-SHOP MEMBERSHIP (23505)
-- ============================================

-- PROBLEM:
-- The error "duplicate key value violates unique constraint idx_team_members_auth_user_id_unique"
-- indicates that there is a GLOBAL unique constraint on auth_user_id.
-- This prevents a user from being in more than one shop.

-- SOLUTION:
-- 1. DROP the global constraint `idx_team_members_auth_user_id_unique`.
-- 2. Maintain the partial unique index on (shop_id, auth_user_id) created in the previous step.

-- 1. Drop the restricting global index
DROP INDEX IF EXISTS public.idx_team_members_auth_user_id_unique;

-- 2. Also drop the constraint if it was created as a CONSTRAINT (not just an index)
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_auth_user_id_key;

-- 3. Ensure the CORRECT composite index exists (Redundant but safe to ensure state)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_shop_auth_v2
ON public.team_members(shop_id, auth_user_id) 
WHERE shop_id IS NOT NULL AND auth_user_id IS NOT NULL;

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload config';
