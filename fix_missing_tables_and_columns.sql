-- ============================================
-- FIX MISSING TABLES AND COLUMNS
-- ============================================

-- PROBLEM 1: system_settings table not found (PGRST205)
-- PROBLEM 2: service_categories.is_active column missing (42703)

-- ============================================
-- 1. FIX SYSTEM SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, setting_key)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create Policies (Strict Isolation)
-- View: Shop members can view settings
DROP POLICY IF EXISTS "Settings Visible to Shop Members" ON public.system_settings;
CREATE POLICY "Settings Visible to Shop Members" ON public.system_settings
FOR SELECT USING (
    public.is_shop_member(shop_id, auth.uid())
);

-- Manage: Only Owners/Managers? For now, let's allow authenticated shop members to easier management
DROP POLICY IF EXISTS "Settings Manageable by Shop Members" ON public.system_settings;
CREATE POLICY "Settings Manageable by Shop Members" ON public.system_settings
FOR ALL USING (
    public.is_shop_member(shop_id, auth.uid())
);

-- Grant Permissions
GRANT ALL ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

-- ============================================
-- 2. FIX SERVICE CATEGORIES
-- ============================================

-- Add missing is_active column
ALTER TABLE public.service_categories 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure RLS is enabled (redundant but safe)
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Ensure Policies exist (in case previous script failed or wasn't run)
DROP POLICY IF EXISTS "Strict View Service Categories" ON public.service_categories;
CREATE POLICY "Strict View Service Categories" ON public.service_categories
FOR SELECT USING (
    public.is_shop_member(shop_id, auth.uid())
);

DROP POLICY IF EXISTS "Shop Members Manage Categories" ON public.service_categories;
CREATE POLICY "Shop Members Manage Categories" ON public.service_categories
FOR ALL USING (
    public.is_shop_member(shop_id, auth.uid())
);

GRANT ALL ON public.service_categories TO authenticated;
GRANT ALL ON public.service_categories TO service_role;

-- ============================================
-- 3. RELOAD SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload config';
