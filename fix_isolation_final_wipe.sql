-- ============================================
-- FIX DATA LEAK - FINAL WIPE
-- ============================================

-- PROBLEM:
-- Users can still see all shops. This implies that older, permissive policies (like "Enable read access for all")
-- are still active on the 'shops' table, even though we added a strict one. RLS is "additive" (OR logic).

-- SOLUTION:
-- 1. Dynamically find and DROP ALL policies on 'shops' and 'team_members'.
-- 2. Re-create ONLY the strict policies defined in our previous fix.

-- ---------------------------------------------------------
-- PART 1: WIPE ALL POLICIES
-- ---------------------------------------------------------
DO $$ 
DECLARE 
    pol record;
BEGIN 
    -- 1. Wipe SHOPS policies
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'shops' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.shops', pol.policyname); 
    END LOOP;

    -- 2. Wipe TEAM_MEMBERS policies
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'team_members' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members', pol.policyname); 
    END LOOP;
    
    -- 3. Wipe CLIENTS policies (good measure)
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'clients' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.clients', pol.policyname); 
    END LOOP;

    -- 4. Wipe APPOINTMENTS policies (good measure)
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'appointments' LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.appointments', pol.policyname); 
    END LOOP;
END $$;

-- ---------------------------------------------------------
-- PART 2: RE-APPLY STRICT POLICIES
-- ---------------------------------------------------------

-- A. Helper Function (Ensure it exists)
CREATE OR REPLACE FUNCTION public.is_shop_member(shop_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
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

-- B. SHOPS Policies
-- 1. View: Only Owner or Team Member
CREATE POLICY "Strict View Own Shops" ON public.shops
FOR SELECT USING (
    auth.uid() = owner_id 
    OR 
    public.is_shop_member(id, auth.uid())
);

-- 2. Insert: Authenticated users can create shops
CREATE POLICY "Strict Create Shops" ON public.shops
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

-- 3. Update/Delete: Only Owner
CREATE POLICY "Strict Update Shops" ON public.shops
FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Strict Delete Shops" ON public.shops
FOR DELETE USING (auth.uid() = owner_id);

-- C. TEAM MEMBERS Policies
-- 1. View: Self or if member of same shop
CREATE POLICY "Strict View Team Members" ON public.team_members
FOR ALL USING (
    auth.uid() = auth_user_id
    OR
    public.is_shop_member(shop_id, auth.uid())
);

-- D. CLIENTS Policies
CREATE POLICY "Strict View Clients" ON public.clients
FOR ALL USING (
    public.is_shop_member(shop_id, auth.uid())
);

-- E. APPOINTMENTS Policies
CREATE POLICY "Strict View Appointments" ON public.appointments
FOR ALL USING (
    public.is_shop_member(shop_id, auth.uid())
);

-- ---------------------------------------------------------
-- PART 3: REFRESH CACHE
-- ---------------------------------------------------------
NOTIFY pgrst, 'reload config';
