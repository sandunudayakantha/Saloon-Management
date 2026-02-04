# Category & Subcategory Feature ✅

## New Features Added

### 1. ✅ Category Field (Select Dropdown)
- **Type**: Select dropdown with predefined options
- **Options Available**:
  - Hair
  - Nails
  - Facial
  - Massage
  - Waxing
  - Makeup
  - Brows & Lashes
  - Body Treatment
  - Other
- **Required**: No (optional field)
- **Location**: Service & Pricing tab

### 2. ✅ Subcategory Field (Text Input)
- **Type**: Free text input (user can type anything)
- **Purpose**: More specific classification within the category
- **Examples**:
  - Category: "Hair" → Subcategory: "Full Hair Cut"
  - Category: "Nails" → Subcategory: "Classic Manicure"
  - Category: "Facial" → Subcategory: "Deep Cleansing Facial"
- **Required**: No (optional field)
- **Location**: Service & Pricing tab

## Database Schema Updates

### New Columns Added to `services` table:
- `category` (TEXT) - Main category (from dropdown)
- `subcategory` (TEXT) - Subcategory (free text)

### Migration Script:
- `add-category-fields.sql` - Run this in Supabase SQL Editor to add the new columns
- Also creates an index on category for better query performance

## UI Updates

### Service & Pricing Tab
- **Category**: Select dropdown with predefined options
- **Subcategory**: Text input field for custom typing
- Both fields are placed in a 2-column grid layout
- Positioned above Duration and Price fields

### Service Cards Display
- Shows category as a badge (purple background)
- Shows subcategory next to category with a bullet separator
- Example: `[Hair] • Full Hair Cut`

## Excel Template Updates

### New Columns Added:
1. **category** - Should match one of the predefined options
2. **subcategory** - Free text, can be anything

### Template Example:
| name | category | subcategory | duration | price | description | fine_print | distribution |
|------|----------|-------------|----------|-------|-------------|------------|--------------|
| Full Hair Cut | Hair | Full Hair Cut | 60 | 75.00 | ... | ... | ... |

## How to Use

### Adding a Service with Category/Subcategory

1. Click **"Add Service"** button
2. In **Service & Pricing** tab:
   - Enter Service Name
   - **Select Category** from dropdown (e.g., "Hair")
   - **Type Subcategory** in text field (e.g., "Full Hair Cut")
   - Enter Duration and Price
3. Fill other tabs as needed
4. Click **"Add Service"**

### Editing Category/Subcategory

1. Click **"Edit"** on any service card
2. Navigate to **Service & Pricing** tab
3. Change category from dropdown
4. Update subcategory text
5. Click **"Update Service"**

## Files Modified

1. ✅ `supabase-schema.sql` - Added category and subcategory columns
2. ✅ `src/pages/ServiceManagement.jsx` - Added UI fields and functionality
3. ✅ `add-category-fields.sql` - Migration script for existing databases

## Database Setup

### For New Installations:
- Run `supabase-schema.sql` - Includes category/subcategory from start

### For Existing Databases:
- Run `add-category-fields.sql` - Adds the new columns

## Example Usage

**Service Example:**
- **Name**: "Full Hair Cut"
- **Category**: "Hair" (selected from dropdown)
- **Subcategory**: "Full Hair Cut" (typed by user)
- **Duration**: 60 minutes
- **Price**: $75.00

**Display on Card:**
```
Full Hair Cut
[Hair] • Full Hair Cut
⏱ 60 minutes
$75.00
```

## Benefits

1. **Better Organization**: Services can be grouped by category
2. **Flexible Classification**: Subcategory allows custom typing
3. **Easy Filtering**: Can filter services by category
4. **Professional Display**: Category badges make services easy to identify

