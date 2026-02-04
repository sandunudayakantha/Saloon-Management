# Supabase Database Setup Guide

This guide will help you set up and test the Salon Booking System database on Supabase.

## Files Included

1. **`supabase-schema.sql`** - Complete database schema with tables, indexes, RLS policies, triggers, and test data
2. **`supabase-test-queries.sql`** - Useful queries for testing and verifying the database

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Access to your Supabase project's SQL Editor

## Setup Instructions

### Step 1: Access Supabase SQL Editor

1. Log in to your Supabase dashboard
2. Select your project (or create a new one)
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Schema Script

1. Open the `supabase-schema.sql` file
2. Copy the entire contents
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

This will create:
- All necessary tables
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for automatic timestamp updates
- Sample test data

### Step 3: Verify the Setup

Run these queries in the SQL Editor to verify everything was created correctly:

```sql
-- Check table counts
SELECT 'Shops' as table_name, COUNT(*) as count FROM shops
UNION ALL
SELECT 'Team Members', COUNT(*) FROM team_members
UNION ALL
SELECT 'Services', COUNT(*) FROM services
UNION ALL
SELECT 'Clients', COUNT(*) FROM clients
UNION ALL
SELECT 'Appointments', COUNT(*) FROM appointments;
```

You should see counts for each table.

### Step 4: Test Your Application

1. Make sure your application's Supabase credentials are configured in `src/lib/customSupabaseClient.js`
2. Start your application
3. Try logging in (you'll need to create a user via Supabase Auth first)
4. Navigate through the different pages to test database operations

## Database Schema Overview

### Core Tables

- **shops** - Salon locations
- **employment_statuses** - Employment types (Full-time, Part-time, etc.)
- **services** - Services offered (Haircut, Manicure, etc.)
- **clients** - Customer information
- **team_members** - Staff members
- **appointments** - Bookings and blocked time slots
- **products** - Products for sale
- **offers** - Marketing offers
- **discounts** - Discount codes

### Junction Tables

- **team_member_services** - Links team members to services they can perform
- **team_member_shops** - Links team members to shops they work at

## Row Level Security (RLS)

All tables have RLS enabled with policies that allow authenticated users to perform all operations. You may want to customize these policies based on your security requirements.

To modify RLS policies:
1. Go to **Authentication** > **Policies** in Supabase
2. Select the table you want to modify
3. Create or edit policies as needed

## Test Data Included

The schema script includes sample data:

- **2 Shops**: Downtown Salon, Uptown Beauty
- **4 Employment Statuses**: Full-time, Part-time, Contractor, Intern
- **8 Services**: Haircut, Hair Color, Manicure, Pedicure, Facial, Massage, etc.
- **5 Clients**: John Doe, Jane Smith, Bob Johnson, etc.
- **5 Team Members**: Sarah Connor (owner), Mike Johnson (admin), Emily Davis, David Wilson, Lisa Anderson
- **Sample Appointments**: A few appointments for testing
- **4 Products**: Premium Shampoo, Hair Serum, etc.
- **2 Offers**: Summer Special, New Client Discount
- **3 Discount Codes**: SUMMER20, NEWCLIENT15, WELCOME10

## Using Test Queries

The `supabase-test-queries.sql` file contains useful queries for:

- **Data Verification**: Check counts, view relationships
- **Testing**: Test specific scenarios
- **Analytics**: Revenue reports, performance metrics
- **Data Manipulation**: Examples of INSERT, UPDATE, DELETE operations

To use:
1. Open the file
2. Copy the query you want to run
3. Paste into Supabase SQL Editor
4. Run the query

## Creating Your First User

To test authentication:

1. Go to **Authentication** > **Users** in Supabase
2. Click **Add User** > **Create New User**
3. Enter an email and password
4. After creating the user, you need to add them to the `team_members` table:

```sql
INSERT INTO team_members (name, email, role, employment_status_id)
VALUES (
    'Your Name',
    'your-email@example.com',
    'owner',  -- or 'admin', 'staff'
    (SELECT id FROM employment_statuses WHERE status_name = 'Full-time')
);
```

## Common Issues & Solutions

### Issue: "relation does not exist"
**Solution**: Make sure you ran the entire `supabase-schema.sql` script. Some tables depend on others being created first.

### Issue: "permission denied"
**Solution**: Check your RLS policies. You may need to adjust them or ensure you're authenticated.

### Issue: "duplicate key value violates unique constraint"
**Solution**: The script uses `ON CONFLICT DO NOTHING` for test data. If you see this error, the data already exists, which is fine.

### Issue: App can't connect to database
**Solution**: 
1. Check your Supabase URL and anon key in `src/lib/customSupabaseClient.js`
2. Verify your Supabase project is active
3. Check that RLS policies allow your operations

## Next Steps

1. **Customize Test Data**: Modify the test data in `supabase-schema.sql` to match your needs
2. **Set Up Authentication**: Configure email templates and authentication settings in Supabase
3. **Configure Storage**: If using image uploads, set up Supabase Storage buckets
4. **Review Security**: Customize RLS policies based on your security requirements
5. **Backup**: Set up regular backups in Supabase dashboard

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## Support

If you encounter issues:
1. Check the Supabase dashboard logs
2. Review the SQL Editor error messages
3. Verify your table structure matches the schema
4. Check that all foreign key relationships are correct

