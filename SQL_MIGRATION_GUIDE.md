# SQL Migration Guide - Services Table Updates

## Overview

This guide provides SQL scripts to add new columns to the `services` table in your Supabase database.

## New Columns Added

The services table now includes these additional columns:

1. **description** (TEXT) - Detailed service description
2. **fine_print** (TEXT) - Terms and conditions
3. **distribution** (TEXT) - Availability information
4. **category** (TEXT) - Main category (e.g., Hair, Nails)
5. **subcategory** (TEXT) - Subcategory (e.g., Full Hair Cut)

## Migration Scripts Available

### 1. `add-all-service-columns.sql` ⭐ RECOMMENDED
**Use this if you need to add all columns at once**

- Adds all 5 new columns
- Creates indexes for performance
- Includes verification queries
- Safe to run multiple times

**How to use:**
1. Open Supabase SQL Editor
2. Copy and paste the entire script
3. Click Run
4. Verify columns were added using the verification query

### 2. `update-services-table.sql` ⭐ COMPREHENSIVE
**Use this for complete table update with verification**

- Adds all columns
- Adds column comments
- Creates indexes
- Includes detailed verification
- Shows expected column structure

**How to use:**
1. Open Supabase SQL Editor
2. Copy and paste the entire script
3. Click Run
4. Check the output to see all columns

### 3. `add-service-fields.sql` (Original)
**Adds only: description, fine_print, distribution**

- Use if you only need these 3 fields
- Run before adding category/subcategory

### 4. `add-category-fields.sql` (Original)
**Adds only: category, subcategory**

- Use if you only need category fields
- Run after description fields are added

## Quick Start

### For New Databases:
✅ Just run `supabase-schema.sql` - Everything is included!

### For Existing Databases:
1. **Option A (Recommended)**: Run `add-all-service-columns.sql`
   - Adds all columns in one go
   - Simplest approach

2. **Option B**: Run scripts separately
   - First: `add-service-fields.sql` (description, fine_print, distribution)
   - Then: `add-category-fields.sql` (category, subcategory)

## Step-by-Step Instructions

### Step 1: Access Supabase SQL Editor
1. Log in to Supabase Dashboard
2. Select your project
3. Go to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run Migration Script
1. Open `add-all-service-columns.sql`
2. Copy the entire contents
3. Paste into SQL Editor
4. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

### Step 3: Verify Columns Were Added
Run this query to check:

```sql
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'services'
    AND column_name IN ('description', 'fine_print', 'distribution', 'category', 'subcategory')
ORDER BY column_name;
```

**Expected Result:** 5 rows should be returned

### Step 4: Test in Application
1. Go to Services page in your app
2. Click "Add Service"
3. Verify you can see:
   - Category dropdown
   - Subcategory input field
   - Description, Fine Print, Distribution tabs

## Column Details

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| `description` | TEXT | Yes | NULL | Detailed service description |
| `fine_print` | TEXT | Yes | NULL | Terms and conditions |
| `distribution` | TEXT | Yes | NULL | Availability information |
| `category` | TEXT | Yes | NULL | Main category (dropdown) |
| `subcategory` | TEXT | Yes | NULL | Subcategory (free text) |

## Indexes Created

- `idx_services_category` - Index on category column for faster filtering

## Troubleshooting

### Error: "column already exists"
✅ **This is OK!** The script uses `IF NOT EXISTS`, so it's safe to run multiple times.

### Error: "relation services does not exist"
❌ **Problem**: Services table hasn't been created yet.
✅ **Solution**: Run `supabase-schema.sql` first to create all tables.

### Columns not showing in app
1. **Check database**: Verify columns exist using verification query
2. **Refresh browser**: Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
3. **Check console**: Look for any JavaScript errors
4. **Verify RLS**: Make sure Row Level Security allows reads

### Can't see category dropdown
1. Check that `category` column exists in database
2. Verify the component is importing Select components correctly
3. Check browser console for errors

## Verification Queries

### Check All Columns:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'services'
ORDER BY ordinal_position;
```

### Check Specific New Columns:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'services'
    AND column_name IN ('description', 'fine_print', 'distribution', 'category', 'subcategory');
```

### Check Indexes:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'services';
```

## After Migration

1. ✅ Verify columns exist
2. ✅ Test adding a service with all fields
3. ✅ Test editing an existing service
4. ✅ Update existing services with category/subcategory if needed
5. ✅ Test Excel upload/download with new columns

## Files Reference

- `add-all-service-columns.sql` - ⭐ All columns in one script
- `update-services-table.sql` - Comprehensive with verification
- `add-service-fields.sql` - Description fields only
- `add-category-fields.sql` - Category fields only
- `supabase-schema.sql` - Complete schema (for new databases)

