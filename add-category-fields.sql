-- ============================================
-- ADD CATEGORY AND SUBCATEGORY FIELDS TO SERVICES
-- ============================================
-- This script adds category and subcategory fields
-- to the services table.
-- Run this in Supabase SQL Editor

-- Add new columns to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- Add comments for documentation
COMMENT ON COLUMN services.category IS 'Main category of the service (e.g., Hair, Nails, Facial)';
COMMENT ON COLUMN services.subcategory IS 'Subcategory within the main category (e.g., Full Hair Cut, Manicure, Deep Cleansing)';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- Verify the columns were added
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'services' 
-- ORDER BY ordinal_position;

