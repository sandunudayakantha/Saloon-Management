-- ============================================
-- SALON BOOKING SYSTEM - SUPABASE SCHEMA
-- ============================================
-- This SQL file creates all necessary tables, relationships, and test data
-- for the Salon Booking System application.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Shops table
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employment Statuses table
CREATE TABLE IF NOT EXISTS employment_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT, -- Main category (e.g., Hair, Nails, Facial, Massage)
    subcategory TEXT, -- Subcategory within the main category (e.g., Full Hair Cut, Manicure)
    duration INTEGER NOT NULL, -- duration in minutes
    price DECIMAL(10, 2) DEFAULT 0.00,
    description TEXT, -- Detailed description of the service
    fine_print TEXT, -- Terms and conditions or fine print for the service
    distribution TEXT, -- Distribution or availability information for the service
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    image_url TEXT,
    working_days TEXT[], -- Array of day names: ['Monday', 'Tuesday', ...]
    employment_status_id UUID REFERENCES employment_statuses(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'staff', -- 'owner', 'admin', 'staff'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Member Services junction table (many-to-many)
CREATE TABLE IF NOT EXISTS team_member_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_member_id, service_id)
);

-- Team Member Shops junction table (many-to-many)
CREATE TABLE IF NOT EXISTS team_member_shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_member_id, shop_id)
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'appointment', -- 'appointment' or 'blocked'
    reason TEXT, -- notes for blocked time or appointment notes
    client_name TEXT, -- denormalized for blocked time slots
    price DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Products table (for market/e-commerce)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Offers table (for marketing)
CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discounts table
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    percentage DECIMAL(5, 2) NOT NULL, -- e.g., 15.00 for 15%
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_shop_id ON appointments(shop_id);
CREATE INDEX IF NOT EXISTS idx_appointments_team_member_id ON appointments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_team_member_services_member ON team_member_services(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_member_services_service ON team_member_services(service_id);
CREATE INDEX IF NOT EXISTS idx_team_member_shops_member ON team_member_shops(team_member_id);
CREATE INDEX IF NOT EXISTS idx_team_member_shops_shop ON team_member_shops(shop_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE employment_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users
-- (You may want to customize these based on your security requirements)

-- Shops policies
CREATE POLICY "Allow all for shops" ON shops FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for employment_statuses" ON employment_statuses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for services" ON services FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for clients" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for team_members" ON team_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for team_member_services" ON team_member_services FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for team_member_shops" ON team_member_shops FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for appointments" ON appointments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for products" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for offers" ON offers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for discounts" ON discounts FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employment_statuses_updated_at BEFORE UPDATE ON employment_statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discounts_updated_at BEFORE UPDATE ON discounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TEST DATA
-- ============================================

-- Insert Employment Statuses
INSERT INTO employment_statuses (status_name) VALUES
    ('Full-time'),
    ('Part-time'),
    ('Contractor'),
    ('Intern')
ON CONFLICT (status_name) DO NOTHING;

-- Insert Shops
INSERT INTO shops (name, address, phone, email) VALUES
    ('Downtown Salon', '123 Main Street, Downtown', '555-0100', 'downtown@salon.com'),
    ('Uptown Beauty', '456 Park Avenue, Uptown', '555-0200', 'uptown@salon.com')
ON CONFLICT DO NOTHING;

-- Insert Services
INSERT INTO services (name, category, subcategory, duration, price, description, fine_print, distribution) VALUES
    ('Haircut', 'Hair', 'Full Hair Cut', 30, 25.00, 'Professional haircut service with styling consultation.', 'Cancellation must be made 24 hours in advance. No refunds for no-shows.', 'Available at all locations. Walk-ins welcome based on availability.'),
    ('Hair Color', 'Hair', 'Full Color Treatment', 120, 85.00, 'Full hair coloring service with color consultation and treatment.', 'Patch test required 48 hours before service. Results may vary based on hair condition.', 'Available at Downtown Salon and Uptown Beauty. Appointment required.'),
    ('Manicure', 'Nails', 'Classic Manicure', 45, 35.00, 'Complete nail care including shaping, cuticle care, and polish application.', 'No refunds after service completion. Please arrive with clean hands.', 'Available at all locations. Walk-ins accepted.'),
    ('Pedicure', 'Nails', 'Classic Pedicure', 60, 45.00, 'Relaxing foot care service with exfoliation, massage, and polish.', 'Please inform us of any foot conditions or allergies before service.', 'Available at all locations. Appointment recommended.'),
    ('Facial', 'Facial', 'Deep Cleansing Facial', 60, 75.00, 'Deep cleansing facial treatment customized for your skin type.', 'Skin consultation included. Please arrive makeup-free. Results may vary.', 'Available at Downtown Salon. Appointment required.'),
    ('Massage', 'Massage', 'Swedish Massage', 60, 80.00, 'Therapeutic massage service to relieve tension and promote relaxation.', 'Please inform therapist of any medical conditions or injuries. Cancellation policy applies.', 'Available at Uptown Beauty. Advance booking recommended.'),
    ('Eyebrow Threading', 'Brows & Lashes', 'Eyebrow Threading', 15, 20.00, 'Precise eyebrow shaping using traditional threading technique.', 'No refunds for completed services. Please arrive with clean face.', 'Available at all locations. Walk-ins welcome.'),
    ('Full Service Package', 'Other', 'Complete Package', 180, 200.00, 'Complete beauty package including haircut, color, manicure, and facial.', 'Package must be used within 90 days. Individual services cannot be substituted. Full payment required upfront.', 'Available at Downtown Salon only. Advance booking required (minimum 1 week notice).')
ON CONFLICT DO NOTHING;

-- Insert Clients
INSERT INTO clients (name, email, phone, address) VALUES
    ('John Doe', 'john.doe@email.com', '555-1001', '789 Oak Street'),
    ('Jane Smith', 'jane.smith@email.com', '555-1002', '321 Pine Avenue'),
    ('Bob Johnson', 'bob.johnson@email.com', '555-1003', '654 Elm Road'),
    ('Alice Williams', 'alice.williams@email.com', '555-1004', '321 Maple Street'),
    ('Charlie Brown', 'charlie.brown@email.com', '555-1005', '987 Cedar Lane')
ON CONFLICT DO NOTHING;

-- Insert Team Members
INSERT INTO team_members (name, email, phone, role, employment_status_id, working_days) VALUES
    ('Sarah Connor', 'sarah.connor@salon.com', '555-2001', 'owner', (SELECT id FROM employment_statuses WHERE status_name = 'Full-time'), ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    ('Mike Johnson', 'mike.johnson@salon.com', '555-2002', 'admin', (SELECT id FROM employment_statuses WHERE status_name = 'Full-time'), ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
    ('Emily Davis', 'emily.davis@salon.com', '555-2003', 'staff', (SELECT id FROM employment_statuses WHERE status_name = 'Full-time'), ARRAY['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
    ('David Wilson', 'david.wilson@salon.com', '555-2004', 'staff', (SELECT id FROM employment_statuses WHERE status_name = 'Part-time'), ARRAY['Monday', 'Wednesday', 'Friday']),
    ('Lisa Anderson', 'lisa.anderson@salon.com', '555-2005', 'staff', (SELECT id FROM employment_statuses WHERE status_name = 'Full-time'), ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
ON CONFLICT DO NOTHING;

-- Link Team Members to Shops
INSERT INTO team_member_shops (team_member_id, shop_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN shops s
WHERE tm.name IN ('Sarah Connor', 'Mike Johnson', 'Emily Davis', 'David Wilson', 'Lisa Anderson')
ON CONFLICT DO NOTHING;

-- Link Team Members to Services
INSERT INTO team_member_services (team_member_id, service_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN services s
WHERE tm.name = 'Sarah Connor' AND s.name IN ('Haircut', 'Hair Color', 'Full Service Package')
ON CONFLICT DO NOTHING;

INSERT INTO team_member_services (team_member_id, service_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN services s
WHERE tm.name = 'Emily Davis' AND s.name IN ('Manicure', 'Pedicure', 'Facial')
ON CONFLICT DO NOTHING;

INSERT INTO team_member_services (team_member_id, service_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN services s
WHERE tm.name = 'David Wilson' AND s.name IN ('Haircut', 'Massage')
ON CONFLICT DO NOTHING;

INSERT INTO team_member_services (team_member_id, service_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN services s
WHERE tm.name = 'Lisa Anderson' AND s.name IN ('Haircut', 'Hair Color', 'Manicure', 'Pedicure')
ON CONFLICT DO NOTHING;

-- Insert Sample Appointments (for today and tomorrow)
INSERT INTO appointments (start_time, end_time, team_member_id, shop_id, client_id, service_id, type, price)
SELECT 
    (CURRENT_DATE + INTERVAL '9 hours')::TIMESTAMPTZ as start_time,
    (CURRENT_DATE + INTERVAL '9 hours 30 minutes')::TIMESTAMPTZ as end_time,
    tm.id,
    s.id,
    c.id,
    sv.id,
    'appointment',
    sv.price
FROM team_members tm
CROSS JOIN shops s
CROSS JOIN clients c
CROSS JOIN services sv
WHERE tm.name = 'Sarah Connor' 
    AND s.name = 'Downtown Salon'
    AND c.name = 'John Doe'
    AND sv.name = 'Haircut'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO appointments (start_time, end_time, team_member_id, shop_id, client_id, service_id, type, price)
SELECT 
    (CURRENT_DATE + INTERVAL '10 hours')::TIMESTAMPTZ as start_time,
    (CURRENT_DATE + INTERVAL '12 hours')::TIMESTAMPTZ as end_time,
    tm.id,
    s.id,
    c.id,
    sv.id,
    'appointment',
    sv.price
FROM team_members tm
CROSS JOIN shops s
CROSS JOIN clients c
CROSS JOIN services sv
WHERE tm.name = 'Emily Davis'
    AND s.name = 'Downtown Salon'
    AND c.name = 'Jane Smith'
    AND sv.name = 'Hair Color'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Insert Sample Products
INSERT INTO products (name, description, price, image_url) VALUES
    ('Premium Shampoo', 'Professional grade shampoo for all hair types', 24.99, NULL),
    ('Hair Serum', 'Nourishing serum for smooth and shiny hair', 32.50, NULL),
    ('Nail Polish Set', 'Set of 12 premium nail polish colors', 45.00, NULL),
    ('Face Mask', 'Hydrating face mask with natural ingredients', 28.75, NULL)
ON CONFLICT DO NOTHING;

-- Insert Sample Offers
INSERT INTO offers (title, description, start_date, end_date) VALUES
    ('Summer Special', 'Get 20% off on all hair services', 
     CURRENT_DATE::TIMESTAMPTZ, 
     (CURRENT_DATE + INTERVAL '30 days')::TIMESTAMPTZ),
    ('New Client Discount', 'First-time clients get 15% off', 
     CURRENT_DATE::TIMESTAMPTZ, 
     (CURRENT_DATE + INTERVAL '60 days')::TIMESTAMPTZ)
ON CONFLICT DO NOTHING;

-- Insert Sample Discounts
INSERT INTO discounts (code, percentage, valid_until) VALUES
    ('SUMMER20', 20.00, (CURRENT_DATE + INTERVAL '30 days')::TIMESTAMPTZ),
    ('NEWCLIENT15', 15.00, (CURRENT_DATE + INTERVAL '60 days')::TIMESTAMPTZ),
    ('WELCOME10', 10.00, (CURRENT_DATE + INTERVAL '90 days')::TIMESTAMPTZ)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Uncomment these to verify the data after running the script:

-- SELECT 'Shops' as table_name, COUNT(*) as count FROM shops
-- UNION ALL
-- SELECT 'Employment Statuses', COUNT(*) FROM employment_statuses
-- UNION ALL
-- SELECT 'Services', COUNT(*) FROM services
-- UNION ALL
-- SELECT 'Clients', COUNT(*) FROM clients
-- UNION ALL
-- SELECT 'Team Members', COUNT(*) FROM team_members
-- UNION ALL
-- SELECT 'Team Member Services', COUNT(*) FROM team_member_services
-- UNION ALL
-- SELECT 'Team Member Shops', COUNT(*) FROM team_member_shops
-- UNION ALL
-- SELECT 'Appointments', COUNT(*) FROM appointments
-- UNION ALL
-- SELECT 'Products', COUNT(*) FROM products
-- UNION ALL
-- SELECT 'Offers', COUNT(*) FROM offers
-- UNION ALL
-- SELECT 'Discounts', COUNT(*) FROM discounts;

