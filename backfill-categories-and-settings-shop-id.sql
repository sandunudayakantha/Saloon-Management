-- ============================================
-- BACKFILL SERVICE_CATEGORIES AND SYSTEM_SETTINGS WITH SHOP_ID
-- ============================================
-- IMPORTANT: Run add-shop-id-to-categories-and-settings.sql FIRST!
-- This script randomly assigns existing categories and settings to shops
-- ============================================

-- Check if shop_id column exists, if not, exit with error message
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'service_categories' 
        AND column_name = 'shop_id'
    ) THEN
        RAISE EXCEPTION 'shop_id column does not exist in service_categories. Please run add-shop-id-to-categories-and-settings.sql first!';
    END IF;
END $$;

-- Backfill service_categories
UPDATE public.service_categories
SET shop_id = (
    SELECT id 
    FROM public.shops 
    ORDER BY RANDOM() 
    LIMIT 1
)
WHERE shop_id IS NULL;

-- Backfill system_settings (hourly_rate)
UPDATE public.system_settings
SET shop_id = (
    SELECT id 
    FROM public.shops 
    ORDER BY RANDOM() 
    LIMIT 1
)
WHERE shop_id IS NULL;

-- Verify the distribution
SELECT 
    'Categories' AS table_name,
    s.name AS shop_name,
    COUNT(sc.id) AS record_count
FROM public.shops s
LEFT JOIN public.service_categories sc ON sc.shop_id = s.id
GROUP BY s.id, s.name

UNION ALL

SELECT 
    'Settings' AS table_name,
    s.name AS shop_name,
    COUNT(ss.id) AS record_count
FROM public.shops s
LEFT JOIN public.system_settings ss ON ss.shop_id = s.id
GROUP BY s.id, s.name

ORDER BY table_name, shop_name;

