-- ============================================
-- ADD BUFFER TIME COLUMN TO SERVICES TABLE
-- ============================================
-- This SQL script adds a buffer_time column to the services table
-- Buffer time is the additional time needed between appointments
-- ============================================

-- Add buffer_time column to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS buffer_time INTEGER DEFAULT 0;

-- Add comment to the column
COMMENT ON COLUMN services.buffer_time IS 'Buffer time in minutes to add between appointments for this service. Default is 0.';

-- Update existing services to have buffer_time = 0 if NULL
UPDATE services 
SET buffer_time = 0 
WHERE buffer_time IS NULL;

-- Make buffer_time NOT NULL with default 0
ALTER TABLE services 
ALTER COLUMN buffer_time SET DEFAULT 0,
ALTER COLUMN buffer_time SET NOT NULL;

-- ============================================
-- VERIFICATION
-- ============================================
-- Check if the column was added successfully
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'services' 
AND column_name = 'buffer_time';

-- ============================================
-- NOTES
-- ============================================
-- 1. Buffer time is in minutes (same as duration)
-- 2. Default value is 0 (no buffer time)
-- 3. Total appointment time = duration + buffer_time
-- 4. Buffer time helps prevent back-to-back appointments
--    and allows time for cleanup/preparation between services

