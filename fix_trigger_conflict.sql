-- ============================================
-- FIX TRIGGER CONFLICT (42P10)
-- ============================================

-- PROBLEM:
-- The trigger `handle_new_shop` uses `ON CONFLICT (auth_user_id)` but `auth_user_id` is not unique across the table (users can be in multiple shops).
-- Additionally, removing the ON CONFLICT clause entirely might duplicate members if logic retries.

-- SOLUTION:
-- 1. Ensure `team_members` has a composite Unique Key on (shop_id, auth_user_id).
-- 2. Update the trigger to conflict on THIS composite key instead.

-- 1. Create Unique Index (safe if exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_shop_auth_unique 
ON public.team_members(shop_id, auth_user_id) 
WHERE shop_id IS NOT NULL AND auth_user_id IS NOT NULL;

-- 2. Update the Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_shop()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Set owner_id if missing
    IF NEW.owner_id IS NULL THEN
        NEW.owner_id := auth.uid();
    END IF;
    
    -- 2. Add the owner as a "Team Member" of this shop
    --    NOW uses the correct composite conflict target (shop_id, auth_user_id)
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
    -- This specific syntax "ON CONFLICT (shop_id, auth_user_id)" requires the unique index above
    ON CONFLICT (shop_id, auth_user_id) DO UPDATE 
    SET role = 'owner';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload config';
