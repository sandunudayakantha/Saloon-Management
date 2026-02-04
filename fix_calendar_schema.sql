-- ============================================
-- FIX CALENDAR SCHEMA ERRORS
-- ============================================
-- This script specifically addresses missing columns causing 42703 errors
-- in the Calendar and Appointments sections.

-- 1. Add missing columns to 'services' table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS buffer_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 0, 
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- 2. Add missing columns to 'team_members' table
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Add missing columns to 'service_categories' table (if needed)
ALTER TABLE public.service_categories 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- 4. Add missing columns to 'system_settings' table (if needed)
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

-- 5. Fix unique constraint on service_categories to avoid "shop_id does not exist" issues in indexes
-- We drop the old constraint if it exists and create a partial unique index
DO $$ 
BEGIN
    -- Only try to drop constraint if table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_categories') THEN
        ALTER TABLE public.service_categories DROP CONSTRAINT IF EXISTS service_categories_name_key;
        CREATE UNIQUE INDEX IF NOT EXISTS service_categories_name_shop_unique ON public.service_categories(name, shop_id) WHERE shop_id IS NOT NULL;
    END IF;
END $$;
