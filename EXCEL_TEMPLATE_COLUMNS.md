# Excel Template - Column Structure

## Template Columns (in order)

The Excel template includes the following columns:

| Column # | Column Name | Type | Required | Description |
|----------|-------------|------|----------|-------------|
| 1 | **name** | Text | ✅ Yes | Service name (e.g., "Full Hair Cut") |
| 2 | **category** | Text | ❌ No | Main category - Use one of: Hair, Nails, Facial, Massage, Waxing, Makeup, Brows & Lashes, Body Treatment, Other |
| 3 | **subcategory** | Text | ❌ No | Subcategory - Type your own (e.g., "Full Hair Cut", "Classic Manicure") |
| 4 | **duration** | Number | ✅ Yes | Duration in minutes (e.g., 60) |
| 5 | **price** | Number | ❌ No | Price in dollars (e.g., 75.00) |
| 6 | **description** | Text | ❌ No | Detailed service description |
| 7 | **fine_print** | Text | ❌ No | Terms and conditions |
| 8 | **distribution** | Text | ❌ No | Availability/distribution information |

## Example Data

The template includes 2 example rows:

### Row 1: Hair Service
- **name**: Full Hair Cut
- **category**: Hair
- **subcategory**: Full Hair Cut
- **duration**: 60
- **price**: 75.00
- **description**: Professional haircut service with styling consultation...
- **fine_print**: Cancellation must be made 24 hours in advance...
- **distribution**: Available at all locations...

### Row 2: Nails Service
- **name**: Classic Manicure
- **category**: Nails
- **subcategory**: Classic Manicure
- **duration**: 45
- **price**: 35.00
- **description**: Complete nail care including shaping...
- **fine_print**: No refunds after service completion...
- **distribution**: Available at all locations...

## Category Options

When filling the **category** column, use one of these values:

- `Hair`
- `Nails`
- `Facial`
- `Massage`
- `Waxing`
- `Makeup`
- `Brows & Lashes`
- `Body Treatment`
- `Other`

## Subcategory Examples

The **subcategory** column is free text. Here are some examples:

**For Hair category:**
- Full Hair Cut
- Trim
- Hair Color
- Highlights
- Perm

**For Nails category:**
- Classic Manicure
- Gel Manicure
- Classic Pedicure
- Spa Pedicure

**For Facial category:**
- Deep Cleansing Facial
- Anti-Aging Facial
- Acne Treatment

## Column Widths

The template has optimized column widths:
- name: 25 characters
- category: 15 characters
- subcategory: 25 characters
- duration: 12 characters
- price: 12 characters
- description: 60 characters
- fine_print: 60 characters
- distribution: 60 characters

## How to Use

1. **Download Template**: Click "Template" button in Services page
2. **Fill Data**: 
   - Required: name, duration
   - Optional: category, subcategory, price, description, fine_print, distribution
3. **Upload**: Click "Upload" button and select your filled Excel file
4. **Verify**: Check that services appear in the list

## Notes

- Category should match the predefined options (case-sensitive)
- Subcategory can be any text you want
- Empty cells are allowed for optional fields
- The upload function will trim whitespace automatically
- Invalid duration values will be skipped

