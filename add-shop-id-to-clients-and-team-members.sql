-- ============================================
-- ADD SHOP_ID TO CLIENTS AND TEAM_MEMBERS
-- ============================================
-- This migration adds shop_id column to clients and team_members tables
-- to ensure all records are scoped to a specific shop
-- ============================================

-- Add shop_id to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- Add shop_id to team_members table
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_shop_id ON public.clients(shop_id);
CREATE INDEX IF NOT EXISTS idx_team_members_shop_id ON public.team_members(shop_id);

-- Add NOT NULL constraint after backfilling data (optional - uncomment if you want to enforce it)
-- First, you'll need to assign existing records to a shop
-- For example, if you have a default shop:
-- UPDATE public.clients SET shop_id = (SELECT id FROM public.shops LIMIT 1) WHERE shop_id IS NULL;
-- UPDATE public.team_members SET shop_id = (SELECT id FROM public.shops LIMIT 1) WHERE shop_id IS NULL;
-- ALTER TABLE public.clients ALTER COLUMN shop_id SET NOT NULL;
-- ALTER TABLE public.team_members ALTER COLUMN shop_id SET NOT NULL;


