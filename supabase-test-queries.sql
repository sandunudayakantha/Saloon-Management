-- ============================================
-- SALON BOOKING SYSTEM - TEST QUERIES
-- ============================================
-- This file contains useful queries for testing and verifying
-- the database setup and functionality.

-- ============================================
-- DATA VERIFICATION QUERIES
-- ============================================

-- 1. Count all records in each table
SELECT 'Shops' as table_name, COUNT(*) as count FROM shops
UNION ALL
SELECT 'Employment Statuses', COUNT(*) FROM employment_statuses
UNION ALL
SELECT 'Services', COUNT(*) FROM services
UNION ALL
SELECT 'Clients', COUNT(*) FROM clients
UNION ALL
SELECT 'Team Members', COUNT(*) FROM team_members
UNION ALL
SELECT 'Team Member Services', COUNT(*) FROM team_member_services
UNION ALL
SELECT 'Team Member Shops', COUNT(*) FROM team_member_shops
UNION ALL
SELECT 'Appointments', COUNT(*) FROM appointments
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Offers', COUNT(*) FROM offers
UNION ALL
SELECT 'Discounts', COUNT(*) FROM discounts;

-- 2. View all team members with their employment status
SELECT 
    tm.id,
    tm.name,
    tm.email,
    tm.role,
    es.status_name as employment_status,
    tm.working_days,
    COUNT(DISTINCT tms.service_id) as services_count,
    COUNT(DISTINCT tmsh.shop_id) as shops_count
FROM team_members tm
LEFT JOIN employment_statuses es ON tm.employment_status_id = es.id
LEFT JOIN team_member_services tms ON tm.id = tms.team_member_id
LEFT JOIN team_member_shops tmsh ON tm.id = tmsh.team_member_id
GROUP BY tm.id, tm.name, tm.email, tm.role, es.status_name, tm.working_days
ORDER BY tm.name;

-- 3. View all services with their details
SELECT 
    id,
    name,
    duration,
    price,
    created_at
FROM services
ORDER BY name;

-- 4. View all clients
SELECT 
    id,
    name,
    email,
    phone,
    address,
    created_at
FROM clients
ORDER BY name;

-- 5. View all shops
SELECT 
    id,
    name,
    address,
    phone,
    email,
    created_at
FROM shops
ORDER BY name;

-- 6. View team members with their assigned services
SELECT 
    tm.name as team_member,
    s.name as service,
    s.duration,
    s.price
FROM team_members tm
JOIN team_member_services tms ON tm.id = tms.team_member_id
JOIN services s ON tms.service_id = s.id
ORDER BY tm.name, s.name;

-- 7. View team members assigned to shops
SELECT 
    tm.name as team_member,
    s.name as shop,
    s.address
FROM team_members tm
JOIN team_member_shops tmsh ON tm.id = tmsh.team_member_id
JOIN shops s ON tmsh.shop_id = s.id
ORDER BY s.name, tm.name;

-- 8. View appointments with full details
SELECT 
    a.id,
    a.start_time,
    a.end_time,
    a.type,
    tm.name as team_member,
    s.name as shop,
    c.name as client,
    sv.name as service,
    a.price,
    a.reason
FROM appointments a
LEFT JOIN team_members tm ON a.team_member_id = tm.id
LEFT JOIN shops s ON a.shop_id = s.id
LEFT JOIN clients c ON a.client_id = c.id
LEFT JOIN services sv ON a.service_id = sv.id
ORDER BY a.start_time DESC;

-- 9. View appointments for today
SELECT 
    a.start_time,
    a.end_time,
    tm.name as team_member,
    c.name as client,
    sv.name as service,
    a.type
FROM appointments a
LEFT JOIN team_members tm ON a.team_member_id = tm.id
LEFT JOIN clients c ON a.client_id = c.id
LEFT JOIN services sv ON a.service_id = sv.id
WHERE DATE(a.start_time) = CURRENT_DATE
ORDER BY a.start_time;

-- 10. View upcoming appointments (next 7 days)
SELECT 
    a.start_time,
    a.end_time,
    tm.name as team_member,
    s.name as shop,
    c.name as client,
    sv.name as service,
    a.price
FROM appointments a
LEFT JOIN team_members tm ON a.team_member_id = tm.id
LEFT JOIN shops s ON a.shop_id = s.id
LEFT JOIN clients c ON a.client_id = c.id
LEFT JOIN services sv ON a.service_id = sv.id
WHERE a.start_time >= CURRENT_DATE
    AND a.start_time <= CURRENT_DATE + INTERVAL '7 days'
    AND a.type = 'appointment'
ORDER BY a.start_time;

-- ============================================
-- TESTING QUERIES
-- ============================================

-- 11. Test: Find available team members for a specific service
SELECT 
    tm.id,
    tm.name,
    tm.email,
    COUNT(DISTINCT tmsh.shop_id) as shops_assigned
FROM team_members tm
JOIN team_member_services tms ON tm.id = tms.team_member_id
JOIN services s ON tms.service_id = s.id
LEFT JOIN team_member_shops tmsh ON tm.id = tmsh.team_member_id
WHERE s.name = 'Haircut'
GROUP BY tm.id, tm.name, tm.email;

-- 12. Test: Check appointments for a specific team member today
SELECT 
    a.start_time,
    a.end_time,
    c.name as client,
    sv.name as service,
    a.type
FROM appointments a
LEFT JOIN clients c ON a.client_id = c.id
LEFT JOIN services sv ON a.service_id = sv.id
JOIN team_members tm ON a.team_member_id = tm.id
WHERE tm.name = 'Sarah Connor'
    AND DATE(a.start_time) = CURRENT_DATE
ORDER BY a.start_time;

-- 13. Test: Calculate revenue for a specific shop (current month)
SELECT 
    s.name as shop,
    COUNT(a.id) as total_appointments,
    COALESCE(SUM(a.price), 0) as total_revenue
FROM shops s
LEFT JOIN appointments a ON s.id = a.shop_id
    AND a.start_time >= DATE_TRUNC('month', CURRENT_DATE)
    AND a.start_time < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    AND a.type = 'appointment'
WHERE s.name = 'Downtown Salon'
GROUP BY s.id, s.name;

-- 14. Test: Find team members by role
SELECT 
    tm.name,
    tm.email,
    tm.role,
    es.status_name as employment_status
FROM team_members tm
LEFT JOIN employment_statuses es ON tm.employment_status_id = es.id
WHERE tm.role = 'staff'
ORDER BY tm.name;

-- 15. Test: View all blocked time slots
SELECT 
    a.start_time,
    a.end_time,
    tm.name as team_member,
    s.name as shop,
    a.reason
FROM appointments a
JOIN team_members tm ON a.team_member_id = tm.id
JOIN shops s ON a.shop_id = s.id
WHERE a.type = 'blocked'
ORDER BY a.start_time DESC;

-- 16. Test: Check active offers
SELECT 
    title,
    description,
    start_date,
    end_date,
    CASE 
        WHEN CURRENT_TIMESTAMP BETWEEN start_date AND end_date THEN 'Active'
        WHEN CURRENT_TIMESTAMP < start_date THEN 'Upcoming'
        ELSE 'Expired'
    END as status
FROM offers
ORDER BY start_date DESC;

-- 17. Test: Check valid discount codes
SELECT 
    code,
    percentage,
    valid_until,
    CASE 
        WHEN valid_until IS NULL THEN 'No Expiry'
        WHEN valid_until > CURRENT_TIMESTAMP THEN 'Valid'
        ELSE 'Expired'
    END as status
FROM discounts
ORDER BY valid_until DESC NULLS LAST;

-- 18. Test: View products with prices
SELECT 
    name,
    description,
    price,
    CASE 
        WHEN image_url IS NULL THEN 'No Image'
        ELSE 'Has Image'
    END as image_status
FROM products
ORDER BY price DESC;

-- ============================================
-- DATA MANIPULATION TEST QUERIES
-- ============================================

-- 19. Test: Create a new appointment (example)
/*
INSERT INTO appointments (start_time, end_time, team_member_id, shop_id, client_id, service_id, type, price)
SELECT 
    (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '14 hours')::TIMESTAMPTZ,
    (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '15 hours')::TIMESTAMPTZ,
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
    AND sv.name = 'Manicure'
LIMIT 1;
*/

-- 20. Test: Create a blocked time slot (example)
/*
INSERT INTO appointments (start_time, end_time, team_member_id, shop_id, type, reason, client_name)
SELECT 
    (CURRENT_DATE + INTERVAL '2 days' + INTERVAL '12 hours')::TIMESTAMPTZ,
    (CURRENT_DATE + INTERVAL '2 days' + INTERVAL '13 hours')::TIMESTAMPTZ,
    tm.id,
    s.id,
    'blocked',
    'Lunch break',
    'Blocked'
FROM team_members tm
CROSS JOIN shops s
WHERE tm.name = 'Sarah Connor'
    AND s.name = 'Downtown Salon'
LIMIT 1;
*/

-- 21. Test: Update a team member's role (example)
/*
UPDATE team_members
SET role = 'admin'
WHERE name = 'Mike Johnson';
*/

-- 22. Test: Add a service to a team member (example)
/*
INSERT INTO team_member_services (team_member_id, service_id)
SELECT tm.id, s.id
FROM team_members tm
CROSS JOIN services s
WHERE tm.name = 'David Wilson'
    AND s.name = 'Pedicure'
ON CONFLICT DO NOTHING;
*/

-- 23. Test: Delete an appointment (example)
/*
DELETE FROM appointments
WHERE id = (
    SELECT id FROM appointments
    WHERE type = 'appointment'
    ORDER BY created_at DESC
    LIMIT 1
);
*/

-- ============================================
-- ANALYTICS QUERIES
-- ============================================

-- 24. Revenue by service type
SELECT 
    sv.name as service,
    COUNT(a.id) as appointment_count,
    COALESCE(SUM(a.price), 0) as total_revenue,
    COALESCE(AVG(a.price), 0) as avg_price
FROM services sv
LEFT JOIN appointments a ON sv.id = a.service_id
    AND a.type = 'appointment'
    AND a.start_time >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY sv.id, sv.name
ORDER BY total_revenue DESC;

-- 25. Team member performance (appointments and revenue)
SELECT 
    tm.name as team_member,
    COUNT(a.id) as appointment_count,
    COALESCE(SUM(a.price), 0) as total_revenue,
    COALESCE(AVG(a.price), 0) as avg_appointment_value
FROM team_members tm
LEFT JOIN appointments a ON tm.id = a.team_member_id
    AND a.type = 'appointment'
    AND a.start_time >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY tm.id, tm.name
ORDER BY total_revenue DESC;

-- 26. Most popular services
SELECT 
    sv.name as service,
    COUNT(a.id) as booking_count,
    sv.duration,
    sv.price
FROM services sv
LEFT JOIN appointments a ON sv.id = a.service_id
    AND a.type = 'appointment'
GROUP BY sv.id, sv.name, sv.duration, sv.price
ORDER BY booking_count DESC;

-- 27. Client booking history
SELECT 
    c.name as client,
    COUNT(a.id) as total_bookings,
    COALESCE(SUM(a.price), 0) as total_spent,
    MAX(a.start_time) as last_booking
FROM clients c
LEFT JOIN appointments a ON c.id = a.client_id
    AND a.type = 'appointment'
GROUP BY c.id, c.name
ORDER BY total_spent DESC;

-- ============================================
-- CLEANUP QUERIES (Use with caution!)
-- ============================================

-- 28. Delete all test appointments (uncomment to use)
/*
DELETE FROM appointments
WHERE created_at > NOW() - INTERVAL '1 day';
*/

-- 29. Reset team member roles (uncomment to use)
/*
UPDATE team_members
SET role = 'staff'
WHERE role != 'owner';
*/

