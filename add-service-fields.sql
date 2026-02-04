-- ============================================
-- ADD NEW FIELDS TO SERVICES TABLE
-- ============================================
-- This script adds description, fine_print, and distribution fields
-- to the services table.
-- Run this in Supabase SQL Editor

-- Add new columns to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS fine_print TEXT,
ADD COLUMN IF NOT EXISTS distribution TEXT;

-- Add comments for documentation
COMMENT ON COLUMN services.description IS 'Detailed description of the service';
COMMENT ON COLUMN services.fine_print IS 'Terms and conditions or fine print for the service';
COMMENT ON COLUMN services.distribution IS 'Distribution or availability information for the service';

-- Verify the columns were added
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'services' 
-- ORDER BY ordinal_position;

