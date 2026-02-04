import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://enqghdbndotdhtvmbode.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVucWdoZGJuZG90ZGh0dm1ib2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MzE2MzgsImV4cCI6MjA4NTUwNzYzOH0.-Xj0MLUEFSuAvg78jPd7jLNAACdOdhuPUNIST5z3ABQ';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
};
