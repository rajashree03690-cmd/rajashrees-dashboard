/**
 * Returns the correct Supabase base URL for fetch() calls.
 * - Client-side: uses /supabase-proxy (routed through Vercel rewrites)
 * - Server-side: uses the direct Supabase URL
 * 
 * This avoids ERR_CONNECTION_TIMED_OUT for users whose networks block *.supabase.co
 */
export function getSupabaseBaseUrl(): string {
    const isServer = typeof window === 'undefined';
    if (isServer) {
        return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    }
    return `${window.location.origin}/supabase-proxy`;
}

export function getSupabaseAnonKey(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

/**
 * Rewrites a Supabase Storage URL to go through the Vercel proxy.
 * Converts: https://xxx.supabase.co/storage/v1/object/public/bucket/file.jpg
 * To:       https://yourdomain.com/supabase-proxy/storage/v1/object/public/bucket/file.jpg
 * 
 * This is needed because image_url values stored in the database point
 * directly to *.supabase.co, which is blocked on some networks.
 * On server-side, returns the original URL unchanged.
 */
export function proxyImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    const isServer = typeof window === 'undefined';
    if (isServer) return url;

    // Match any *.supabase.co URL and rewrite to proxy
    const supabaseUrlPattern = /^https?:\/\/[^/]+\.supabase\.co\//;
    if (supabaseUrlPattern.test(url)) {
        // Extract the path after the domain (e.g., /storage/v1/object/public/banners/file.jpg)
        const pathStart = url.indexOf('.supabase.co/') + '.supabase.co'.length;
        const path = url.substring(pathStart);
        return `${window.location.origin}/supabase-proxy${path}`;
    }

    return url;
}
