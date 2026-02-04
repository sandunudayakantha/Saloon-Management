-- ============================================
-- CREATE ADMIN USER FOR ADMIN DASHBOARD
-- ============================================
-- This script creates a team member with admin/owner role
-- 
-- IMPORTANT: You must first create the user in Supabase Auth
-- before running this script. See instructions below.

-- ============================================
-- STEP 1: Create User in Supabase Auth
-- ============================================
-- Go to Supabase Dashboard > Authentication > Users
-- Click "Add User" > "Create New User"
-- Use these credentials:
--   Email: admin@salon.com
--   Password: Admin123!@#
--   (Or use your preferred credentials and update the email below)

-- ============================================
-- STEP 2: Run this SQL script
-- ============================================

-- Option 1: Create Admin User (can access AdminDashboard)
INSERT INTO team_members (
    name,
    email,
    phone,
    role,
    employment_status_id,
    working_days
)
VALUES (
    'Admin User',
    'admin@salon.com',  -- UPDATE THIS to match your Supabase Auth email
    '555-0001',
    'admin',  -- Can be 'admin' or 'owner' (both can access AdminDashboard)
    (SELECT id FROM employment_statuses WHERE status_name = 'Full-time' LIMIT 1),
    ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
)
ON CONFLICT DO NOTHING;

-- Option 2: Create Owner User (full access)
INSERT INTO team_members (
    name,
    email,
    phone,
    role,
    employment_status_id,
    working_days
)
VALUES (
    'Owner User',
    'owner@salon.com',  -- UPDATE THIS to match your Supabase Auth email
    '555-0002',
    'owner',  -- Highest privilege level
    (SELECT id FROM employment_statuses WHERE status_name = 'Full-time' LIMIT 1),
    ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
)
ON CONFLICT DO NOTHING;

-- Assign admin/owner to all shops
INSERT INTO team_member_shops (team_member_id, shop_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN shops s
WHERE tm.email = 'admin@salon.com'  -- UPDATE THIS to match your email
ON CONFLICT DO NOTHING;

-- Assign owner to all shops
INSERT INTO team_member_shops (team_member_id, shop_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN shops s
WHERE tm.email = 'owner@salon.com'  -- UPDATE THIS to match your email
ON CONFLICT DO NOTHING;

-- Assign all services to admin/owner (optional)
INSERT INTO team_member_services (team_member_id, service_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN services s
WHERE tm.email = 'admin@salon.com'  -- UPDATE THIS to match your email
ON CONFLICT DO NOTHING;

INSERT INTO team_member_services (team_member_id, service_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN services s
WHERE tm.email = 'owner@salon.com'  -- UPDATE THIS to match your email
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFY THE USER WAS CREATED
-- ============================================
SELECT 
    tm.id,
    tm.name,
    tm.email,
    tm.role,
    es.status_name as employment_status,
    COUNT(DISTINCT tms.shop_id) as shops_assigned,
    COUNT(DISTINCT tmsv.service_id) as services_assigned
FROM team_members tm
LEFT JOIN employment_statuses es ON tm.employment_status_id = es.id
LEFT JOIN team_member_shops tms ON tm.id = tms.team_member_id
LEFT JOIN team_member_services tmsv ON tm.id = tmsv.team_member_id
WHERE tm.email IN ('admin@salon.com', 'owner@salon.com')
GROUP BY tm.id, tm.name, tm.email, tm.role, es.status_name;

