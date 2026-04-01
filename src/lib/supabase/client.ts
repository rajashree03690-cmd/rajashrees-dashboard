// Re-export from the main supabase module to avoid duplicate client instances
// This fixes the "Multiple GoTrueClient instances detected" warning
export { supabase, supabase as default } from '@/lib/supabase';

// createClient returns the singleton supabase instance (for backward compatibility)
// Some services call createClient() as a function, so we export a factory wrapper
import { supabase as _supabase } from '@/lib/supabase';
export function createClient() {
    return _supabase;
}
