-- ============================================
-- FIX SHOPS SCHEMA - FINAL
-- ============================================

-- This script fixes the "Could not find the 'closing_time' column" error.
-- It ensures the shops table has the required time columns.

-- 1. Add opening_time column
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00:00';

-- 2. Add closing_time column
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '20:00:00';

-- 3. Set default values for existing rows where they might be null
UPDATE public.shops 
SET opening_time = '09:00:00' 
WHERE opening_time IS NULL;

UPDATE public.shops 
SET closing_time = '20:00:00' 
WHERE closing_time IS NULL;

-- 4. Force Schema Cache Reload (Vital for Supabase to see the new columns)
NOTIFY pgrst, 'reload config';
