-- ============================================
-- CREATE SERVICE CATEGORIES TABLE
-- ============================================
-- This script creates a service_categories table to store
-- system-defined service categories
--
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ============================================
-- CREATE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADD INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_service_categories_name ON service_categories(name);
CREATE INDEX IF NOT EXISTS idx_service_categories_active ON service_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_service_categories_order ON service_categories(display_order);

-- ============================================
-- INSERT DEFAULT CATEGORIES
-- ============================================

INSERT INTO service_categories (name, description, display_order) VALUES
    ('Hair', 'Hair services including cuts, styling, and treatments', 1),
    ('Nails', 'Nail services including manicures and pedicures', 2),
    ('Facial', 'Facial treatments and skincare services', 3),
    ('Massage', 'Massage therapy and body treatments', 4),
    ('Waxing', 'Hair removal and waxing services', 5),
    ('Makeup', 'Makeup application and beauty services', 6),
    ('Brows & Lashes', 'Eyebrow and eyelash services', 7),
    ('Body Treatment', 'Body treatments and spa services', 8),
    ('Other', 'Other services', 9)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read categories
CREATE POLICY "Allow read for authenticated users" 
ON service_categories FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert categories
CREATE POLICY "Allow insert for authenticated users" 
ON service_categories FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update categories
CREATE POLICY "Allow update for authenticated users" 
ON service_categories FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete categories
CREATE POLICY "Allow delete for authenticated users" 
ON service_categories FOR DELETE 
USING (auth.role() = 'authenticated');

-- ============================================
-- TRIGGER FOR updated_at
-- ============================================

-- Create function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_service_categories_updated_at 
BEFORE UPDATE ON service_categories 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFY THE TABLE WAS CREATED
-- ============================================
-- Uncomment the query below to verify:

-- SELECT * FROM service_categories ORDER BY display_order, name;


