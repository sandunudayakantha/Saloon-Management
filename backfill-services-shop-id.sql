-- ============================================
-- BACKFILL SERVICES WITH SHOP_ID
-- ============================================
-- This script randomly assigns existing services to shops
-- Run this after adding the shop_id column to services table
-- ============================================

-- First, ensure shop_id column exists (run add-shop-id-to-services.sql first)
-- ALTER TABLE public.services ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- Get all shops into a temporary array
DO $$
DECLARE
    shop_ids UUID[];
    shop_count INTEGER;
    random_shop_id UUID;
    service_record RECORD;
BEGIN
    -- Get all shop IDs into an array
    SELECT ARRAY_AGG(id) INTO shop_ids FROM public.shops;
    
    -- Get count of shops
    SELECT COUNT(*) INTO shop_count FROM public.shops;
    
    -- If no shops exist, exit
    IF shop_count = 0 THEN
        RAISE NOTICE 'No shops found. Please create shops first.';
        RETURN;
    END IF;
    
    -- Loop through all services that don't have a shop_id
    FOR service_record IN 
        SELECT id FROM public.services WHERE shop_id IS NULL
    LOOP
        -- Randomly select a shop from the array
        random_shop_id := shop_ids[1 + floor(random() * shop_count)::int];
        
        -- Update the service with the randomly selected shop_id
        UPDATE public.services 
        SET shop_id = random_shop_id 
        WHERE id = service_record.id;
        
        RAISE NOTICE 'Assigned service % to shop %', service_record.id, random_shop_id;
    END LOOP;
    
    RAISE NOTICE 'Completed: All services have been randomly assigned to shops.';
END $$;

-- Verify the distribution
SELECT 
    s.name AS shop_name,
    COUNT(sv.id) AS service_count
FROM public.shops s
LEFT JOIN public.services sv ON sv.shop_id = s.id
GROUP BY s.id, s.name
ORDER BY s.name;


