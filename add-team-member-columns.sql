-- ============================================
-- Add New Columns to team_members Table
-- Run this in Supabase SQL Editor
-- ============================================

-- Add Public Profile columns
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add Pricing columns
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 2);

-- ============================================
-- Create Service-Specific Pricing Table
-- ============================================

CREATE TABLE IF NOT EXISTS team_member_service_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    custom_price DECIMAL(10, 2), -- Custom price for this member for this service
    commission_percentage DECIMAL(5, 2), -- Commission percentage for this specific service
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_member_id, service_id)
);

-- ============================================
-- Create Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_team_member_service_pricing_member 
ON team_member_service_pricing(team_member_id);

CREATE INDEX IF NOT EXISTS idx_team_member_service_pricing_service 
ON team_member_service_pricing(service_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE team_member_service_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for team_member_service_pricing" 
ON team_member_service_pricing 
FOR ALL 
USING (auth.role() = 'authenticated');

-- ============================================
-- Trigger for updated_at
-- ============================================

CREATE TRIGGER update_team_member_service_pricing_updated_at 
BEFORE UPDATE ON team_member_service_pricing 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Verification Query
-- ============================================
-- Uncomment to verify columns were added:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'team_members'
-- AND column_name IN ('job_title', 'description', 'default_hourly_rate', 'commission_percentage')
-- ORDER BY column_name;
