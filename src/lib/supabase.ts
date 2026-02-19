import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lecbaxzycoanshpyxwmi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlY2JheHp5Y29hbnNocHl4d21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mjg4MjUsImV4cCI6MjA4NzEwNDgyNX0.4QM48njhO8AwP8xpzxUt_FFeLib6sKthecriS_5lkp4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
