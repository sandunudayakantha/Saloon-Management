-- ============================================
-- FIX SHOP CREATION FLOW (23503)
-- ============================================

-- PROBLEM:
-- The error "insert or update on table team_members violates foreign key constraint team_members_shop_id_fkey"
-- happens because we are trying to insert a team member in a "BEFORE INSERT" trigger on shops.
-- At that point, the Shop ID technically doesn't exist yet in the database constraints.

-- SOLUTION:
-- Split the logic into two separate triggers:
-- 1. "BEFORE INSERT": Set the owner_id (modifies the incoming row).
-- 2. "AFTER INSERT": Add the owner as a team member (safe to reference the new Shop ID).

-- ---------------------------------------------------------
-- PART 1: BEFORE INSERT TRIGGER (Set Owner ID)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_shop_owner_before()
RETURNS TRIGGER AS $$
BEGIN
    -- Just ensure owner_id is set
    IF NEW.owner_id IS NULL THEN
        NEW.owner_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old combined trigger
DROP TRIGGER IF EXISTS on_shop_created ON public.shops;

-- Create the new BEFORE trigger
DROP TRIGGER IF EXISTS tr_shops_set_owner_before ON public.shops;
CREATE TRIGGER tr_shops_set_owner_before
BEFORE INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.set_shop_owner_before();


-- ---------------------------------------------------------
-- PART 2: AFTER INSERT TRIGGER (Add Team Member)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_shop_creator_as_member_after()
RETURNS TRIGGER AS $$
BEGIN
    -- Now it is safe to insert into team_members because the shop row exists
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
    -- Use the correct ON CONFLICT target (from our V2 fix)
    ON CONFLICT (shop_id, auth_user_id) 
    WHERE shop_id IS NOT NULL AND auth_user_id IS NOT NULL
    DO UPDATE 
    SET role = 'owner';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the new AFTER trigger
DROP TRIGGER IF EXISTS tr_shops_add_member_after ON public.shops;
CREATE TRIGGER tr_shops_add_member_after
AFTER INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.add_shop_creator_as_member_after();

-- 3. Reload Schema Cache
NOTIFY pgrst, 'reload config';
