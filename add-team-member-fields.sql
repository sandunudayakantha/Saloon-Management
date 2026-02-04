-- Add new fields to team_members table for enhanced member management

-- Public Profile fields
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Pricing fields (service-specific pricing will be in a separate table)
ALTER TABLE team_members 
ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS commission_percentage DECIMAL(5, 2);

-- Create table for service-specific pricing per team member
CREATE TABLE IF NOT EXISTS team_member_service_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    custom_price DECIMAL(10, 2), -- Custom price for this member for this service (overrides service default)
    commission_percentage DECIMAL(5, 2), -- Commission percentage for this specific service
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_member_id, service_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_team_member_service_pricing_member ON team_member_service_pricing(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_member_service_pricing_service ON team_member_service_pricing(service_id);

-- Enable RLS
ALTER TABLE team_member_service_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for team_member_service_pricing" ON team_member_service_pricing FOR ALL USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_team_member_service_pricing_updated_at 
BEFORE UPDATE ON team_member_service_pricing 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

