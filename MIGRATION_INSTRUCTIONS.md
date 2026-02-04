# Migration Instructions: Add shop_id to Categories and Settings

## Quick Start

**Run this SQL script in Supabase SQL Editor:**

👉 **File: `add-and-backfill-categories-settings.sql`**

## Step-by-Step Instructions

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Copy and Paste the Script**
   - Open `add-and-backfill-categories-settings.sql`
   - Copy the entire contents (Ctrl+A, Ctrl+C / Cmd+A, Cmd+C)
   - Paste into the SQL Editor

4. **Run the Script**
   - Click **Run** button (or press Ctrl+Enter / Cmd+Enter)
   - Wait for execution to complete

5. **Verify Results**
   - Check the output at the bottom
   - You should see a table showing how many categories and settings are assigned to each shop

## What This Script Does

✅ Adds `shop_id` column to `service_categories` table  
✅ Adds `shop_id` column to `system_settings` table  
✅ Creates indexes for better performance  
✅ Updates unique constraints to allow same category/setting names in different shops  
✅ **Automatically assigns existing categories to shops (random distribution)**  
✅ **Automatically assigns existing settings to shops (random distribution)**  
✅ Shows verification results

## Expected Output

After running, you should see a table like:

```
table_name | shop_name              | record_count
-----------|------------------------|-------------
Categories | Thai Quater Bushey    | 5
Categories | Thai Quater Stanmore  | 3
Categories | tets                  | 2
Settings   | Thai Quater Bushey    | 1
Settings   | Thai Quater Stanmore  | 1
Settings   | tets                  | 1
```

## Troubleshooting

### Error: "column shop_id already exists"
✅ **This is OK!** The script uses `IF NOT EXISTS`, so it's safe to run multiple times.

### Error: "relation shops does not exist"
❌ **Problem**: Shops table hasn't been created yet.  
✅ **Solution**: Make sure you've created the shops table first.

### No shops in the database
❌ **Problem**: The backfill needs at least one shop to assign data to.  
✅ **Solution**: Create at least one shop in the Shop Management page first.

## After Migration

1. ✅ Refresh your application
2. ✅ Go to Service Management page
3. ✅ Select a shop from the dropdown
4. ✅ Verify you see only that shop's categories and hourly rate
5. ✅ Try creating a new category - it should be assigned to the selected shop

## Files

- `add-and-backfill-categories-settings.sql` - ⭐ **Use this one!** (Combines migration + backfill)
- `add-shop-id-to-categories-and-settings.sql` - Migration only (adds columns)
- `backfill-categories-and-settings-shop-id.sql` - Backfill only (assigns existing data)


