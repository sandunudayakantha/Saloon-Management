-- ============================================
-- ADD OPENING_TIME AND CLOSING_TIME TO SHOPS
-- ============================================
-- This migration adds opening_time and closing_time columns to shops table
-- These times will control the calendar view hours for each shop
-- ============================================

-- Add opening_time and closing_time columns to shops table
-- Using TIME type to store time values (e.g., '09:00:00', '18:00:00')
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00:00';

ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '20:00:00';

-- Create indexes for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_shops_opening_time ON public.shops(opening_time);
CREATE INDEX IF NOT EXISTS idx_shops_closing_time ON public.shops(closing_time);

-- Update existing shops to have default opening/closing times if they are NULL
UPDATE public.shops 
SET opening_time = '09:00:00' 
WHERE opening_time IS NULL;

UPDATE public.shops 
SET closing_time = '20:00:00' 
WHERE closing_time IS NULL;

-- ============================================
-- NOTES:
-- ============================================
-- - opening_time and closing_time are stored as TIME type (HH:MM:SS format)
-- - Default values are 09:00 (9 AM) and 20:00 (8 PM)
-- - These times will be used in the Calendar component to determine
--   the start and end hours displayed in the calendar grid
-- ============================================

