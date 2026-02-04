-- ============================================
-- ADD SHOP_ID TO TEAM_MEMBERS
-- ============================================
-- The frontend (TeamManagement.jsx) expects a shop_id column on team_members.
-- This script adds it and backfills data.

-- 1. Add column
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_shop_id ON public.team_members(shop_id);

-- 2. Backfill from existing relationships (team_member_shops)
UPDATE public.team_members tm
SET shop_id = tms.shop_id
FROM public.team_member_shops tms
WHERE tm.id = tms.team_member_id
AND tm.shop_id IS NULL;

-- 3. Backfill any remaining orphans (assign to a random shop)
DO $$
DECLARE
    first_shop_id UUID;
BEGIN
    SELECT id INTO first_shop_id FROM public.shops LIMIT 1;
    
    IF first_shop_id IS NOT NULL THEN
        UPDATE public.team_members
        SET shop_id = first_shop_id
        WHERE shop_id IS NULL;
    END IF;
END $$;

-- 4. Verify we caught everyone (Optional: populate team_member_shops for consistency)
-- If we assigned a shop_id but there is no link in team_member_shops, create it
INSERT INTO public.team_member_shops (team_member_id, shop_id, created_at)
SELECT id, shop_id, NOW()
FROM public.team_members
WHERE shop_id IS NOT NULL
ON CONFLICT (team_member_id, shop_id) DO NOTHING;
