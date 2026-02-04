-- ============================================
-- FIX TRIGGER CONFLICT V2 (42P10)
-- ============================================

-- PROBLEM:
-- The previous fix failed with "no unique or exclusion constraint matching the ON CONFLICT specification".
-- This is because we created a PARTIAL index (with WHERE clause), but the INSERT statement
-- inside the trigger didn't specify the same WHERE clause in its ON CONFLICT target.

-- SOLUTION:
-- 1. Ensure the partial index exists.
-- 2. Update the trigger to explicitly target that partial index.

-- 1. Re-Verify Index (Idempotent)
-- We rename it to be sure we are targeting the right one
DROP INDEX IF EXISTS idx_team_members_shop_auth_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_shop_auth_v2
ON public.team_members(shop_id, auth_user_id) 
WHERE shop_id IS NOT NULL AND auth_user_id IS NOT NULL;

-- 2. Update the Trigger Function with Correct Syntax
CREATE OR REPLACE FUNCTION public.handle_new_shop()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Set owner_id if missing
    IF NEW.owner_id IS NULL THEN
        NEW.owner_id := auth.uid();
    END IF;
    
    -- 2. Add the owner as a "Team Member" of this shop
    INSERT INTO public.team_members (
        shop_id, 
        auth_user_id, 
        name, 
        email, 
        role, 
        employment_status_id
    )
    SELECT 
        NEW.id, 
        NEW.owner_id, 
        (SELECT COALESCE(raw_user_meta_data->>'name', email) FROM auth.users WHERE id = NEW.owner_id),
        (SELECT email FROM auth.users WHERE id = NEW.owner_id),
        'owner',
        (SELECT id FROM public.employment_statuses WHERE status_name = 'Full-time' LIMIT 1)
    -- VITAL FIX: The ON CONFLICT clause must exacty match the index definition
    ON CONFLICT (shop_id, auth_user_id) 
    WHERE shop_id IS NOT NULL AND auth_user_id IS NOT NULL
    DO UPDATE 
    SET role = 'owner';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload config';
