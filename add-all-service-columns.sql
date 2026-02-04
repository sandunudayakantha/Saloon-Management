-- ============================================
-- ADD ALL NEW COLUMNS TO SERVICES TABLE
-- ============================================
-- This script adds all new columns to the services table:
-- - description
-- - fine_print
-- - distribution
-- - category
-- - subcategory
--
-- Run this in Supabase SQL Editor if you need to add all columns at once
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ============================================
-- ADD COLUMNS
-- ============================================

-- Add description, fine_print, and distribution columns
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS fine_print TEXT,
ADD COLUMN IF NOT EXISTS distribution TEXT;

-- Add category and subcategory columns
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- ============================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN services.description IS 'Detailed description of the service';
COMMENT ON COLUMN services.fine_print IS 'Terms and conditions or fine print for the service';
COMMENT ON COLUMN services.distribution IS 'Distribution or availability information for the service';
COMMENT ON COLUMN services.category IS 'Main category of the service (e.g., Hair, Nails, Facial)';
COMMENT ON COLUMN services.subcategory IS 'Subcategory within the main category (e.g., Full Hair Cut, Manicure)';

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Index on category for faster filtering and queries
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- ============================================
-- VERIFY THE COLUMNS WERE ADDED
-- ============================================
-- Uncomment the query below to verify all columns exist:

-- SELECT 
--     column_name, 
--     data_type, 
--     is_nullable,
--     column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'services' 
--     AND column_name IN ('description', 'fine_print', 'distribution', 'category', 'subcategory')
-- ORDER BY ordinal_position;

-- ============================================
-- EXPECTED RESULT
-- ============================================
-- You should see 5 rows returned:
-- - description (text, nullable)
-- - fine_print (text, nullable)
-- - distribution (text, nullable)
-- - category (text, nullable)
-- - subcategory (text, nullable)

