-- ============================================
-- REMOVE TEST DATA FROM DATABASE
-- ============================================
-- This script removes all test data from the database
-- Run this in Supabase SQL Editor to clean up test data
--
-- WARNING: This will delete all test data including:
-- - Test services
-- - Test clients
-- - Test team members
-- - Test appointments
-- - Test products, offers, discounts
--
-- It will NOT delete:
-- - Table structures
-- - Employment statuses (kept as they're reference data)
-- - Shops (kept as they're needed for the app)
-- - Your actual user data (if you've added any)

-- ============================================
-- DELETE TEST DATA
-- ============================================

-- Delete test appointments first (due to foreign key constraints)
DELETE FROM appointments;

-- Delete team member services relationships
DELETE FROM team_member_services;

-- Delete team member shops relationships
DELETE FROM team_member_shops;

-- Delete test team members
DELETE FROM team_members;

-- Delete test services
DELETE FROM services;

-- Delete test clients
DELETE FROM clients;

-- Delete test products
DELETE FROM products;

-- Delete test offers
DELETE FROM offers;

-- Delete test discounts
DELETE FROM discounts;

-- ============================================
-- VERIFY DELETION
-- ============================================
-- Run these queries to verify data has been removed:

-- SELECT 'Services' as table_name, COUNT(*) as count FROM services
-- UNION ALL
-- SELECT 'Clients', COUNT(*) FROM clients
-- UNION ALL
-- SELECT 'Team Members', COUNT(*) FROM team_members
-- UNION ALL
-- SELECT 'Appointments', COUNT(*) FROM appointments
-- UNION ALL
-- SELECT 'Products', COUNT(*) FROM products
-- UNION ALL
-- SELECT 'Offers', COUNT(*) FROM offers
-- UNION ALL
-- SELECT 'Discounts', COUNT(*) FROM discounts;

-- All counts should be 0 after running this script

-- ============================================
-- NOTE
-- ============================================
-- After running this script:
-- 1. You'll have a clean database with no test data
-- 2. You can start adding your own services, clients, etc. through the app
-- 3. Employment statuses and shops are kept (you may want to customize these)
-- 4. Make sure you've created at least one shop before using the app
-- 5. Make sure you've created at least one employment status before adding team members

