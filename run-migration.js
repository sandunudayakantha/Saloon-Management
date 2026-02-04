#!/usr/bin/env node

/**
 * Migration Script Runner
 * 
 * This script executes the SQL migration to add shop_id columns
 * to service_categories and system_settings tables.
 * 
 * IMPORTANT: This requires the Supabase service role key.
 * DO NOT commit the service role key to version control!
 * 
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node run-migration.js
 * 
 * Or run the SQL directly in Supabase SQL Editor (recommended):
 *   1. Open Supabase Dashboard > SQL Editor
 *   2. Copy contents of add-and-backfill-categories-settings.sql
 *   3. Paste and click Run
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://lxcfecdvehnfzrbgduap.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('\nUsage:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_key node run-migration.js');
  console.error('\nOr run the SQL directly in Supabase SQL Editor (recommended):');
  console.error('  1. Open Supabase Dashboard > SQL Editor');
  console.error('  2. Copy contents of add-and-backfill-categories-settings.sql');
  console.error('  3. Paste and click Run');
  process.exit(1);
}

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('📄 Reading migration script...');
    const sqlFile = join(__dirname, 'add-and-backfill-categories-settings.sql');
    const sql = readFileSync(sqlFile, 'utf-8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`\n🔄 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip SELECT statements (verification queries)
      if (statement.trim().toUpperCase().startsWith('SELECT')) {
        console.log(`⏭️  Skipping verification query ${i + 1}...`);
        continue;
      }

      console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        // Use RPC to execute SQL (requires a function to be created)
        // For now, we'll use the REST API directly
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`
          },
          body: JSON.stringify({ sql: statement })
        });

        if (!response.ok) {
          // Try alternative: direct SQL execution via PostgREST
          // Note: This may not work for all SQL statements
          console.log(`   ⚠️  Direct execution not available. Please run in Supabase SQL Editor.`);
        } else {
          console.log(`   ✅ Statement ${i + 1} executed successfully`);
        }
      } catch (error) {
        console.log(`   ⚠️  Could not execute via API: ${error.message}`);
        console.log(`   💡 Please run this SQL directly in Supabase SQL Editor`);
      }
    }

    console.log('\n✅ Migration script processed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Open Supabase Dashboard > SQL Editor');
    console.log('   2. Copy the contents of add-and-backfill-categories-settings.sql');
    console.log('   3. Paste and click Run');
    console.log('   4. Verify the results in the output');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Recommendation: Run the SQL directly in Supabase SQL Editor');
    process.exit(1);
  }
}

runMigration();


