import { createClient } from '@supabase/supabase-js';
export const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: process.env.APP_TZ || 'Africa/Lagos' });
