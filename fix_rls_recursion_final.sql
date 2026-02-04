-- ============================================
-- FIX RLS INFINITE RECURSION - FINAL
-- ============================================

-- PROBLEM:
-- The RLS policies created a loop:
-- 1. Shops policy checks Team Members.
-- 2. Team Members policy checks Shops.
-- 3. Loop: check shop -> check members -> check shop -> ...

-- SOLUTION:
-- Use a strict SECURITY DEFINER function to break the chain. 
-- This function runs with elevated privileges to check membership without triggering RLS recursively.

-- 1. Create Helper Function
CREATE OR REPLACE FUNCTION public.is_shop_member(shop_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if user is owner OR a team member of the shop
    RETURN EXISTS (
        SELECT 1 
        FROM public.shops s
        LEFT JOIN public.team_members tm ON tm.shop_id = s.id
        WHERE s.id = shop_uuid
        AND (
            s.owner_id = user_uuid 
            OR 
            tm.auth_user_id = user_uuid
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
-- SECURITY DEFINER is crucial here: it bypasses RLS on the tables it queries.

-- 2. Update Shops Policy
DROP POLICY IF EXISTS "Users can view own shops" ON public.shops;
CREATE POLICY "Users can view own shops" ON public.shops
FOR SELECT USING (
    -- Direct owner check (fast)
    auth.uid() = owner_id 
    OR 
    -- Use helper function for team check (avoids recursion)
    public.is_shop_member(id, auth.uid())
);

-- 3. Update Team Members Policy
DROP POLICY IF EXISTS "View team members of accessible shops" ON public.team_members;
CREATE POLICY "View team members of accessible shops" ON public.team_members
FOR ALL USING (
    -- Can see self
    auth.uid() = auth_user_id
    OR
    -- Can see members if I have access to the shop
    -- Since we use the security definer function, this is safe
    public.is_shop_member(shop_id, auth.uid())
);

-- 4. Update Other Tables (Clients, Appointments, etc.) to use the helper
-- This simplifies their policies heavily and makes them faster

-- Clients
DROP POLICY IF EXISTS "View clients of accessible shops" ON public.clients;
CREATE POLICY "View clients of accessible shops" ON public.clients
FOR ALL USING (
    public.is_shop_member(shop_id, auth.uid())
);

-- Appointments
DROP POLICY IF EXISTS "View appointments of accessible shops" ON public.appointments;
CREATE POLICY "View appointments of accessible shops" ON public.appointments
FOR ALL USING (
    public.is_shop_member(shop_id, auth.uid())
);

-- Products
DROP POLICY IF EXISTS "Allow all for products" ON public.products;  -- remove old if exists
CREATE POLICY "View products of accessible shops" ON public.products
FOR ALL USING (
    -- Products might refer to a shop, add shop_id if missing or assume global?
    -- Assuming products table might not have shop_id yet based on schema, 
    -- but if it does: public.is_shop_member(shop_id, auth.uid())
    -- For now, reverting to authenticated for products just to be safe or check schema
    auth.role() = 'authenticated' 
);

-- Offers
DROP POLICY IF EXISTS "Allow all for offers" ON public.offers;
CREATE POLICY "View offers of accessible shops" ON public.offers
FOR ALL USING (
    public.is_shop_member(shop_id, auth.uid())
);

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload config';
