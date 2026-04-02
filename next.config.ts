import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      // Proxy Supabase REST API calls
      {
        source: '/supabase-proxy/rest/:path*',
        destination: `${supabaseUrl}/rest/:path*`,
      },
      // Proxy Supabase Edge Functions
      {
        source: '/supabase-proxy/functions/:path*',
        destination: `${supabaseUrl}/functions/:path*`,
      },
      // Proxy Supabase Storage
      {
        source: '/supabase-proxy/storage/:path*',
        destination: `${supabaseUrl}/storage/:path*`,
      },
      // Proxy Supabase Auth
      {
        source: '/supabase-proxy/auth/:path*',
        destination: `${supabaseUrl}/auth/:path*`,
      },
      // Proxy Supabase Realtime
      {
        source: '/supabase-proxy/realtime/:path*',
        destination: `${supabaseUrl}/realtime/:path*`,
      },
    ];
  },
};

export default nextConfig;
