-- ============================================
-- ADD SHOP_ID TO SERVICE_CATEGORIES AND SYSTEM_SETTINGS
-- ============================================
-- This migration adds shop_id column to service_categories and system_settings tables
-- to ensure categories and hourly rates are scoped to specific shops
-- ============================================

-- Add shop_id to service_categories table
ALTER TABLE public.service_categories 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- Add shop_id to system_settings table
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_categories_shop_id ON public.service_categories(shop_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_shop_id ON public.system_settings(shop_id);

-- Update unique constraint on service_categories to include shop_id
-- First, drop the old unique constraint if it exists
ALTER TABLE public.service_categories 
DROP CONSTRAINT IF EXISTS service_categories_name_key;

-- Add new unique constraint that includes shop_id (allows same category name in different shops)
CREATE UNIQUE INDEX IF NOT EXISTS service_categories_name_shop_unique 
ON public.service_categories(name, shop_id) 
WHERE shop_id IS NOT NULL;

-- Update unique constraint on system_settings to include shop_id for setting_key
-- First, drop the old unique constraint if it exists
ALTER TABLE public.system_settings 
DROP CONSTRAINT IF EXISTS system_settings_setting_key_key;

-- Add new unique constraint that includes shop_id (allows same setting_key in different shops)
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_key_shop_unique 
ON public.system_settings(setting_key, shop_id) 
WHERE shop_id IS NOT NULL;

-- Add NOT NULL constraint after backfilling data (optional - uncomment if you want to enforce it)
-- First, you'll need to assign existing records to shops
-- For example, if you have a default shop:
-- UPDATE public.service_categories SET shop_id = (SELECT id FROM public.shops LIMIT 1) WHERE shop_id IS NULL;
-- UPDATE public.system_settings SET shop_id = (SELECT id FROM public.shops LIMIT 1) WHERE shop_id IS NULL;
-- ALTER TABLE public.service_categories ALTER COLUMN shop_id SET NOT NULL;
-- ALTER TABLE public.system_settings ALTER COLUMN shop_id SET NOT NULL;


