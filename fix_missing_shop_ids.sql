-- ============================================
-- FIX MISSING SHOP_ID COLUMNS
-- ============================================

-- 1. Add shop_id to CLIENTS table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_shop_id ON public.clients(shop_id);

-- 2. Add shop_id to TEAM_MEMBERS table
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_shop_id ON public.team_members(shop_id);

-- 3. Ensure TEAM_MEMBER_SHOPS table exists
CREATE TABLE IF NOT EXISTS public.team_member_shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_member_id, shop_id)
);

-- Enable RLS for team_member_shops if not already enabled
ALTER TABLE public.team_member_shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for team_member_shops" ON public.team_member_shops;
CREATE POLICY "Allow all for team_member_shops" ON public.team_member_shops FOR ALL USING (auth.role() = 'authenticated');


-- 4. Backfill Data (Optional but recommended)

-- Backfill clients (assign to a random shop if null, just to prevent null pointer issues if strictly required)
-- Only run this if you want to assign all existing clients to the first available shop
DO $$
DECLARE
    first_shop_id UUID;
BEGIN
    SELECT id INTO first_shop_id FROM public.shops LIMIT 1;
    
    IF first_shop_id IS NOT NULL THEN
        UPDATE public.clients
        SET shop_id = first_shop_id
        WHERE shop_id IS NULL;
        
        UPDATE public.team_members
        SET shop_id = first_shop_id
        WHERE shop_id IS NULL;
    END IF;
END $$;
