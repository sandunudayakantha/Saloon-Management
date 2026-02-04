-- ============================================
-- CREATE SYSTEM SETTINGS TABLE
-- ============================================
-- This script creates a system_settings table to store
-- system-wide configuration like hourly rate
--
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ============================================
-- CREATE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADD INDEX FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- ============================================
-- INSERT DEFAULT HOURLY RATE SETTING
-- ============================================

INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('hourly_rate', '0.00', 'System-wide hourly rate for automatic price calculation')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings
CREATE POLICY "Allow read for authenticated users" 
ON system_settings FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to update settings
CREATE POLICY "Allow update for authenticated users" 
ON system_settings FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert settings
CREATE POLICY "Allow insert for authenticated users" 
ON system_settings FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- TRIGGER FOR updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_system_settings_updated_at 
BEFORE UPDATE ON system_settings 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFY THE TABLE WAS CREATED
-- ============================================
-- Uncomment the query below to verify:

-- SELECT * FROM system_settings;


