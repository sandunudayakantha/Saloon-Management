-- ============================================
-- FIX CONSOLE ERRORS
-- ============================================
-- This script fixes the missing columns and tables reported in console errors.
-- Run this in Supabase SQL Editor.
-- ============================================

-- 1. FIX: "column services.shop_id does not exist"
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_services_shop_id ON public.services(shop_id);

-- 2. FIX: "column services_1.buffer_time does not exist"
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS buffer_time INTEGER DEFAULT 0;

COMMENT ON COLUMN services.buffer_time IS 'Buffer time in minutes to add between appointments. Default is 0.';

-- Update existing rows to have default 0 if null
UPDATE public.services SET buffer_time = 0 WHERE buffer_time IS NULL;

-- 3. FIX: "column team_members.auth_user_id does not exist"
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_auth_user_id_unique ON public.team_members(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 4. FIX: "Could not find the 'commission_percentage' column of 'team_members'"
-- Also adds job_title, description, default_hourly_rate
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 2);

-- 5. FIX: "Could not find the table 'public.team_member_service_pricing'"
CREATE TABLE IF NOT EXISTS public.team_member_service_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    custom_price DECIMAL(10, 2),
    commission_percentage DECIMAL(5, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_member_id, service_id)
);

-- Enable RLS for the new table
ALTER TABLE public.team_member_service_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for team_member_service_pricing" 
ON public.team_member_service_pricing 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_member_service_pricing_member 
ON public.team_member_service_pricing(team_member_id);

CREATE INDEX IF NOT EXISTS idx_team_member_service_pricing_service 
ON public.team_member_service_pricing(service_id);

-- Add updated_at trigger
-- (Assumes update_updated_at_column function already exists from previous scripts)
DROP TRIGGER IF EXISTS update_team_member_service_pricing_updated_at ON public.team_member_service_pricing;
CREATE TRIGGER update_team_member_service_pricing_updated_at 
BEFORE UPDATE ON public.team_member_service_pricing 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'services.buffer_time' as check, count(*) FROM information_schema.columns WHERE table_name='services' AND column_name='buffer_time'
UNION ALL
SELECT 'services.shop_id', count(*) FROM information_schema.columns WHERE table_name='services' AND column_name='shop_id'
UNION ALL
SELECT 'team_members.commission_percentage', count(*) FROM information_schema.columns WHERE table_name='team_members' AND column_name='commission_percentage'
UNION ALL
SELECT 'table.team_member_service_pricing', count(*) FROM information_schema.tables WHERE table_name='team_member_service_pricing';
