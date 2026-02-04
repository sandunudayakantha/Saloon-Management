-- ============================================
-- ADD SHOP_ID AND SERVICE_ID TO OFFERS
-- ============================================

-- 1. Add shop_id column
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_offers_shop_id ON public.offers(shop_id);

-- 2. Add service_id column
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_offers_service_id ON public.offers(service_id);

-- 3. Add discount_percentage column (optional utility)
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5, 2);

-- 4. Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- 5. Add Policies (if not already present)
DROP POLICY IF EXISTS "Allow all for offers" ON public.offers;
CREATE POLICY "Allow all for offers" ON public.offers FOR ALL USING (auth.role() = 'authenticated');
