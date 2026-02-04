-- ============================================
-- FIX DATA ISOLATION & SECURITY
-- ============================================
-- This script enforces strict RLS so users only see their own data.

-- 1. Add owner_id to shops
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill owner_id for existing shops (Best Effort)
-- Try to find a team member with role 'admin' linked to this shop and use their auth_id
UPDATE public.shops s
SET owner_id = (
    SELECT tm.auth_user_id 
    FROM public.team_members tm
    WHERE tm.shop_id = s.id 
    AND tm.auth_user_id IS NOT NULL 
    LIMIT 1
)
WHERE owner_id IS NULL;

-- If still null, default to the current executing user (YOU) so you don't lose access to your own test data
UPDATE public.shops 
SET owner_id = auth.uid() 
WHERE owner_id IS NULL;

-- 3. Enable RLS (Ensure it is on)
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- 4. DROP OLD "ALLOW ALL" POLICIES
DROP POLICY IF EXISTS "Allow all for shops" ON public.shops;
DROP POLICY IF EXISTS "Allow all for team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow all for clients" ON public.clients;
DROP POLICY IF EXISTS "Allow all for appointments" ON public.appointments;

-- 5. CREATE STRICT POLICIES FOR SHOPS

-- A. VIEW: Owners can see their shops, Team Members can see shops they belong to
CREATE POLICY "Users can view own shops" ON public.shops
FOR SELECT USING (
    auth.uid() = owner_id 
    OR 
    EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.shop_id = public.shops.id
        AND tm.auth_user_id = auth.uid()
    )
);

-- B. INSERT: Any authenticated user can create a shop (and becomes owner)
CREATE POLICY "Users can create shops" ON public.shops
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

-- C. UPDATE: Only owners can update their shops
CREATE POLICY "Owners can update shops" ON public.shops
FOR UPDATE USING (
    auth.uid() = owner_id
);

-- D. DELETE: Only owners can delete their shops
CREATE POLICY "Owners can delete shops" ON public.shops
FOR DELETE USING (
    auth.uid() = owner_id
);

-- 6. Trigger to automatically set owner_id on insert AND add owner as Team Member
CREATE OR REPLACE FUNCTION public.handle_new_shop()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Set owner_id if missing
    IF NEW.owner_id IS NULL THEN
        NEW.owner_id := auth.uid();
    END IF;
    
    -- 2. Add the owner as a "Team Member" of this shop so they appear in lists/calendar
    --    We use ON CONFLICT DO NOTHING in case they are already added manually
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
    ON CONFLICT (auth_user_id) DO UPDATE 
    SET shop_id = NEW.id, role = 'owner'; -- Optional: Update existing orphan profile to this shop

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_shop_created ON public.shops;
CREATE TRIGGER on_shop_created
BEFORE INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.handle_new_shop();

-- 7. UPDATE OTHER TABLES TO RESPECT SHOP OWNERSHIP
-- Ensure data in other tables is only visible if user has access to the linked shop

-- Team Members
CREATE POLICY "View team members of accessible shops" ON public.team_members
FOR ALL USING (
    auth.uid() = auth_user_id -- Can see self
    OR
    EXISTS ( -- Can see members of shops I own or work at
        SELECT 1 FROM public.shops s
        WHERE s.id = public.team_members.shop_id
        AND (
            s.owner_id = auth.uid()
            OR 
            EXISTS (
                SELECT 1 FROM public.team_members my_tm 
                WHERE my_tm.shop_id = s.id 
                AND my_tm.auth_user_id = auth.uid()
            )
        )
    )
);

-- Clients
CREATE POLICY "View clients of accessible shops" ON public.clients
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id = public.clients.shop_id
        AND (
            s.owner_id = auth.uid()
            OR 
            EXISTS (
                SELECT 1 FROM public.team_members tm 
                WHERE tm.shop_id = s.id 
                AND tm.auth_user_id = auth.uid()
            )
        )
    )
);

-- Appointments
CREATE POLICY "View appointments of accessible shops" ON public.appointments
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.id = public.appointments.shop_id
        AND (
            s.owner_id = auth.uid()
            OR 
            EXISTS (
                SELECT 1 FROM public.team_members tm 
                WHERE tm.shop_id = s.id 
                AND tm.auth_user_id = auth.uid()
            )
        )
    )
);

-- 8. Refresh Schema Cache
NOTIFY pgrst, 'reload config';
