-- ============================================
-- ADD OPENING/CLOSING TIMES TO SHOPS
-- ============================================
-- Run this in Supabase SQL Editor if you haven't already.

ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '20:00:00';

CREATE INDEX IF NOT EXISTS idx_shops_opening_time ON public.shops(opening_time);
CREATE INDEX IF NOT EXISTS idx_shops_closing_time ON public.shops(closing_time);

-- Update NULLs to defaults
UPDATE public.shops SET opening_time = '09:00:00' WHERE opening_time IS NULL;
UPDATE public.shops SET closing_time = '20:00:00' WHERE closing_time IS NULL;
