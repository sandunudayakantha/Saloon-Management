-- ============================================
-- ADD OPENING/CLOSING TIME TO SHOPS
-- ============================================

-- This script adds opening_time and closing_time columns to the shops table.
-- These columns are required for correct Calendar time slot generation.

-- 1. Add columns
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '20:00:00';

-- 2. Update existing shops with default values if they are null
UPDATE public.shops 
SET opening_time = '09:00:00'
WHERE opening_time IS NULL;

UPDATE public.shops 
SET closing_time = '20:00:00'
WHERE closing_time IS NULL;

-- 3. Reload schema cache
NOTIFY pgrst, 'reload config';
