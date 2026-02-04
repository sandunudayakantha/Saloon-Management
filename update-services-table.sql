-- ============================================
-- COMPLETE SERVICES TABLE UPDATE
-- ============================================
-- This script updates the services table with all new columns
-- Use this if you want to ensure your services table has all the latest fields
--
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: ADD ALL NEW COLUMNS
-- ============================================

-- Add description, fine_print, distribution (if not already added)
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS fine_print TEXT,
ADD COLUMN IF NOT EXISTS distribution TEXT;

-- Add category and subcategory (if not already added)
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- ============================================
-- STEP 2: ADD COLUMN COMMENTS
-- ============================================

DO $$ 
BEGIN
    -- Add comments if they don't exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'description') THEN
        COMMENT ON COLUMN services.description IS 'Detailed description of the service';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'fine_print') THEN
        COMMENT ON COLUMN services.fine_print IS 'Terms and conditions or fine print for the service';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'distribution') THEN
        COMMENT ON COLUMN services.distribution IS 'Distribution or availability information for the service';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'category') THEN
        COMMENT ON COLUMN services.category IS 'Main category of the service (e.g., Hair, Nails, Facial)';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'subcategory') THEN
        COMMENT ON COLUMN services.subcategory IS 'Subcategory within the main category (e.g., Full Hair Cut, Manicure)';
    END IF;
END $$;

-- ============================================
-- STEP 3: CREATE INDEXES
-- ============================================

-- Index on category for better query performance
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- ============================================
-- STEP 4: VERIFICATION QUERY
-- ============================================
-- Run this query to see all columns in the services table:

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'services'
ORDER BY ordinal_position;

-- ============================================
-- EXPECTED COLUMNS (in order)
-- ============================================
-- id (uuid)
-- name (text, NOT NULL)
-- category (text, nullable) ✨ NEW
-- subcategory (text, nullable) ✨ NEW
-- duration (integer, NOT NULL)
-- price (numeric, default 0.00)
-- description (text, nullable) ✨ NEW
-- fine_print (text, nullable) ✨ NEW
-- distribution (text, nullable) ✨ NEW
-- created_at (timestamp with time zone)
-- updated_at (timestamp with time zone)

-- ============================================
-- NOTES
-- ============================================
-- - All new columns are optional (nullable)
-- - Safe to run this script multiple times
-- - Existing data will not be affected
-- - New columns will be NULL for existing services until you update them

