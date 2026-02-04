-- ============================================
-- ADD SHOP_ID AND BACKFILL IN ONE SCRIPT
-- ============================================
-- This script adds shop_id columns and immediately backfills existing data
-- ============================================

-- Step 1: Add shop_id to service_categories table
ALTER TABLE public.service_categories 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- Step 2: Add shop_id to system_settings table
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_categories_shop_id ON public.service_categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_shop_id ON public.system_settings(shop_id);

-- Step 4: Update unique constraints
-- Drop old unique constraint on service_categories if it exists
ALTER TABLE public.service_categories 
DROP CONSTRAINT IF EXISTS service_categories_name_key;

-- Add new unique constraint that includes shop_id
CREATE UNIQUE INDEX IF NOT EXISTS service_categories_name_shop_unique 
ON public.service_categories(name, shop_id) 
WHERE shop_id IS NOT NULL;

-- Drop old unique constraint on system_settings if it exists
ALTER TABLE public.system_settings 
DROP CONSTRAINT IF EXISTS system_settings_setting_key_key;

-- Add new unique constraint that includes shop_id
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_key_shop_unique 
ON public.system_settings(setting_key, shop_id) 
WHERE shop_id IS NOT NULL;

-- Step 5: Backfill service_categories
UPDATE public.service_categories
SET shop_id = (
    SELECT id 
    FROM public.shops 
    ORDER BY RANDOM() 
    LIMIT 1
)
WHERE shop_id IS NULL;

-- Step 6: Backfill system_settings
UPDATE public.system_settings
SET shop_id = (
    SELECT id 
    FROM public.shops 
    ORDER BY RANDOM() 
    LIMIT 1
)
WHERE shop_id IS NULL;

-- Step 7: Verify the distribution
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


