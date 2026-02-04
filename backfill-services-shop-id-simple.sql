-- ============================================
-- BACKFILL SERVICES WITH SHOP_ID (SIMPLE VERSION)
-- ============================================
-- IMPORTANT: Run add-shop-id-to-services.sql FIRST!
-- This script randomly assigns existing services to shops
-- ============================================

-- Check if shop_id column exists, if not, exit with error message
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'services' 
        AND column_name = 'shop_id'
    ) THEN
        RAISE EXCEPTION 'shop_id column does not exist in services. Please run add-shop-id-to-services.sql first!';
    END IF;
END $$;

-- Method 1: Random assignment using RANDOM() and modulo
-- This distributes services evenly across all shops
UPDATE public.services
SET shop_id = (
    SELECT id 
    FROM public.shops 
    ORDER BY RANDOM() 
    LIMIT 1
)
WHERE shop_id IS NULL;

-- Method 2: Round-robin assignment (more even distribution)
-- Uncomment this if you prefer round-robin instead of random
/*
WITH numbered_services AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS row_num
    FROM public.services
    WHERE shop_id IS NULL
),
numbered_shops AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS row_num,
        COUNT(*) OVER () AS shop_count
    FROM public.shops
)
UPDATE public.services s
SET shop_id = ns.id
FROM numbered_services nsv
JOIN numbered_shops ns ON (nsv.row_num % ns.shop_count) = ns.row_num
WHERE s.id = nsv.id;
*/

-- Verify the distribution
SELECT 
    s.name AS shop_name,
    COUNT(sv.id) AS service_count
FROM public.shops s
LEFT JOIN public.services sv ON sv.shop_id = s.id
GROUP BY s.id, s.name
ORDER BY s.name;

-- Show services without shop_id (should be empty after running)
SELECT COUNT(*) AS services_without_shop
FROM public.services
WHERE shop_id IS NULL;

