-- ============================================
-- FIX OFFERS - SERVICES RELATIONSHIP
-- ============================================

-- This script fixes the "Could not find a relationship between 'offers' and 'services'" error (PGRST200).
-- It ensures the foreign key constraint exists and is named correctly for PostgREST detection.

DO $$ 
BEGIN
    -- 1. Ensure the service_id column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'offers' AND column_name = 'service_id') THEN
        ALTER TABLE public.offers ADD COLUMN service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;
    END IF;

    -- 2. Drop potential existing constraints to ensure clean state
    -- Try to drop common names for this constraint
    BEGIN
        ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_service_id_fkey;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    -- 3. Re-create the constraint explicitly
    -- Using the standard naming convention "content_column_fkey" helps PostgREST detection
    ALTER TABLE public.offers 
    ADD CONSTRAINT offers_service_id_fkey 
    FOREIGN KEY (service_id) 
    REFERENCES public.services(id) 
    ON DELETE SET NULL;

    -- 4. Reload Schema Cache (standard PostgREST notify channel)
    PERFORM pg_notify('pgrst', 'reload config');
END $$;
