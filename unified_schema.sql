-- ============================================
-- UNIFIED SALON BOOKING SYSTEM SCHEMA
-- ============================================
-- This script consolidates all database setup, schema definitions, 
-- and migrations into a single file.
-- 
-- ORDER OF OPERATIONS:
-- 1. Core Schema (Tables, initial RLS)
-- 2. Additional Tables (Settings, Categories)
-- 3. Auth & Triggers Setup
-- 4. Schema Updates & Migrations (Columns, Shop IDs)
-- 5. Data Backfill & Test Data
-- 6. Storage Setup
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CORE SCHEMA
-- ============================================

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    image_url TEXT,
    opening_time TIME DEFAULT '09:00:00',
    closing_time TIME DEFAULT '20:00:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employment Statuses table
CREATE TABLE IF NOT EXISTS employment_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT, 
    subcategory TEXT, 
    duration INTEGER NOT NULL, 
    price DECIMAL(10, 2) DEFAULT 0.00,
    buffer_time INTEGER DEFAULT 0, -- Buffer time in minutes
    description TEXT, 
    fine_print TEXT, 
    distribution TEXT, 
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    image_url TEXT,
    working_days TEXT[], 
    employment_status_id UUID REFERENCES employment_statuses(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'staff',
    -- Public Profile
    job_title TEXT,
    description TEXT,
    -- Pricing
    default_hourly_rate DECIMAL(10, 2),
    commission_percentage DECIMAL(5, 2),
    -- Shop Link (Primary)
    shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Member Services junction table
CREATE TABLE IF NOT EXISTS team_member_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_member_id, service_id)
);

-- Team Member Shops junction table
CREATE TABLE IF NOT EXISTS team_member_shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_member_id, shop_id)
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'appointment',
    reason TEXT, 
    client_name TEXT, 
    price DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offers table
CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    discount_percentage DECIMAL(5, 2),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discounts table
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    percentage DECIMAL(5, 2) NOT NULL,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Member Service Pricing (Custom pricing/commission)
CREATE TABLE IF NOT EXISTS team_member_service_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    custom_price DECIMAL(10, 2),
    commission_percentage DECIMAL(5, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_member_id, service_id)
);

-- Index creation
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_shop_id ON team_members(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_shop_id ON appointments(shop_id);
-- (Add other indexes from schema as needed)

-- RLS Enablement
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Authenticated users can do everything - ADJUST FOR PRODUCTION)
CREATE POLICY "Allow all for shops" ON shops FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for employment_statuses" ON employment_statuses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for services" ON services FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for clients" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for team_members" ON team_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for team_member_services" ON team_member_services FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for team_member_shops" ON team_member_shops FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for appointments" ON appointments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for products" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for offers" ON offers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for discounts" ON discounts FOR ALL USING (auth.role() = 'authenticated');

-- Additional RLS
ALTER TABLE team_member_service_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for team_member_service_pricing" ON team_member_service_pricing FOR ALL USING (auth.role() = 'authenticated');

-- Updated_at Trigger Check
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- 2. ADDITIONAL TABLES
-- ============================================

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for system_settings" ON system_settings FOR ALL USING (auth.role() = 'authenticated');

-- Service Categories
CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service_categories" ON service_categories FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 3. AUTH INTEGRATION
-- ============================================

-- Add auth_user_id to team_members
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_email_unique ON team_members(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_auth_user_id_unique ON team_members(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.team_members (
    auth_user_id,
    email,
    name,
    role,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    'staff',
    NOW()
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 4. SCHEMA UPDATES & MIGRATIONS
-- ============================================

-- (Columns moved to CREATE TABLE definitions)

-- Robustness: Ensure columns exist even if tables were created by older scripts
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS buffer_time INTEGER DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS distribution TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS fine_print TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;

ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update unique constraints to include Shop ID
ALTER TABLE public.service_categories DROP CONSTRAINT IF EXISTS service_categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS service_categories_name_shop_unique ON public.service_categories(name, shop_id) WHERE shop_id IS NOT NULL;

ALTER TABLE public.system_settings DROP CONSTRAINT IF EXISTS system_settings_setting_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_key_shop_unique ON public.system_settings(setting_key, shop_id) WHERE shop_id IS NOT NULL;

-- ============================================
-- 5. DATA BACKFILL & SEEDING
-- ============================================

-- Seed core data (Employment Statuses)
INSERT INTO employment_statuses (status_name) VALUES
    ('Full-time'), ('Part-time'), ('Contractor'), ('Intern')
ON CONFLICT (status_name) DO NOTHING;

-- Seed Shops (if none exist)
INSERT INTO shops (name, address, phone, email) VALUES
    ('Downtown Salon', '123 Main Street', '555-0100', 'downtown@salon.com'),
    ('Uptown Beauty', '456 Park Ave', '555-0200', 'uptown@salon.com')
ON CONFLICT DO NOTHING;

-- Backfill Service Shop IDs (Random assignment for legacy data)
DO $$
DECLARE
    shop_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO shop_count FROM public.shops;
    IF shop_count > 0 THEN
        UPDATE public.services
        SET shop_id = (SELECT id FROM public.shops ORDER BY RANDOM() LIMIT 1)
        WHERE shop_id IS NULL;
        
        UPDATE public.service_categories
        SET shop_id = (SELECT id FROM public.shops ORDER BY RANDOM() LIMIT 1)
        WHERE shop_id IS NULL;

        UPDATE public.system_settings
        SET shop_id = (SELECT id FROM public.shops ORDER BY RANDOM() LIMIT 1)
        WHERE shop_id IS NULL;
    END IF;
END $$;

-- ============================================
-- 6. STORAGE SETUP
-- ============================================

-- Ensure bucket exists (This is a hacky way, might not work on all supabase instances if permissions deny. 
-- Best to create bucket via UI if this fails)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('TeamMemberProfile', 'TeamMemberProfile', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Allow authenticated users to upload to TeamMemberProfile" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload to TeamMemberProfile"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'TeamMemberProfile');

DROP POLICY IF EXISTS "Allow authenticated users to read from TeamMemberProfile" ON storage.objects;
CREATE POLICY "Allow authenticated users to read from TeamMemberProfile"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'TeamMemberProfile');

-- (Add other storage policies as needed)

