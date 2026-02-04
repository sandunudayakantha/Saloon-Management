-- ============================================
-- ADD SHOP_ID TO SERVICES
-- ============================================
-- This migration adds shop_id column to services table
-- to ensure all services are scoped to a specific shop
-- ============================================

-- Add shop_id to services table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_services_shop_id ON public.services(shop_id);

-- Add NOT NULL constraint after backfilling data (optional - uncomment if you want to enforce it)
-- First, you'll need to assign existing services to a shop
-- For example, if you have a default shop:
-- UPDATE public.services SET shop_id = (SELECT id FROM public.shops LIMIT 1) WHERE shop_id IS NULL;
-- ALTER TABLE public.services ALTER COLUMN shop_id SET NOT NULL;


