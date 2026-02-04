# Storage Configuration Information

## Your Supabase Storage Details

- **Project URL**: `https://lxcfecdvehnfzrbgduap.supabase.co`
- **Storage Endpoint**: `https://lxcfecdvehnfzrbgduap.storage.supabase.co/storage/v1/s3`
- **Region**: `ap-south-1` (Asia Pacific - Mumbai)
- **Bucket Name**: `TeamMemberProfile`

## Current Configuration

The Supabase client is configured in `src/lib/customSupabaseClient.js`:

```javascript
const supabaseUrl = 'https://lxcfecdvehnfzrbgduap.supabase.co';
const supabaseAnonKey = 'your-anon-key';
const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
```

## How It Works

The Supabase JavaScript client library **automatically** handles:
- ✅ Storage endpoint routing (derived from project URL)
- ✅ Region configuration (handled by Supabase backend)
- ✅ Authentication headers
- ✅ Request signing

**You don't need to manually configure the endpoint or region** - the client library does this automatically based on your project URL.

## Storage Operations

All storage operations use the bucket name directly:

```javascript
// Upload
await supabase.storage
  .from('TeamMemberProfile')
  .upload(filePath, file);

// Get Public URL
const { data } = supabase.storage
  .from('TeamMemberProfile')
  .getPublicUrl(filePath);
```

The client automatically routes these requests to:
`https://lxcfecdvehnfzrbgduap.storage.supabase.co/storage/v1/s3/TeamMemberProfile/...`

## Verification

To verify your storage is working:

1. **Check Bucket Exists**:
   - Go to Supabase Dashboard → Storage
   - Verify `TeamMemberProfile` bucket exists
   - Check it's set to "Public" if you want public read access

2. **Check RLS Policies**:
   - Go to Storage → Policies
   - Verify 4 policies exist for `TeamMemberProfile`:
     - INSERT (upload)
     - SELECT (read)
     - UPDATE (modify)
     - DELETE (remove)

3. **Test Upload**:
   - Try uploading an image in your app
   - Check browser Network tab to see requests going to:
     `https://lxcfecdvehnfzrbgduap.storage.supabase.co/...`

## Troubleshooting

If uploads fail:

1. **RLS Policy Error (403)**:
   - Run `setup-team-member-profile-storage.sql` in SQL Editor
   - See `QUICK_FIX_STORAGE.md` for step-by-step instructions

2. **Bucket Not Found (404)**:
   - Create the bucket in Supabase Dashboard → Storage
   - Name must be exactly: `TeamMemberProfile` (case-sensitive)

3. **Network/CORS Issues**:
   - The Supabase client handles CORS automatically
   - If issues persist, check Supabase Dashboard → Settings → API

## Notes

- The region (`ap-south-1`) is automatically handled by Supabase
- No manual endpoint configuration needed
- The client library abstracts all storage endpoint details
- All you need is the correct bucket name: `TeamMemberProfile`

