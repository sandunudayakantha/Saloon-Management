-- ============================================
-- FIX OFFERS SCHEMA - MISSING COLUMNS
-- ============================================

-- This script addresses the "column offers.shop_id does not exist" error.
-- It ensures all required columns for the Marketing feature exist in the 'offers' table.

-- 1. Add shop_id column
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- 2. Add service_id column (fixing potential missing reference)
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- 3. Add discount_percentage column
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5, 2);

-- 4. Ensure Indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_offers_shop_id ON public.offers(shop_id);
CREATE INDEX IF NOT EXISTS idx_offers_service_id ON public.offers(service_id);

-- 5. Force schema cache reload to ensure API picks up the new columns
NOTIFY pgrst, 'reload config';
