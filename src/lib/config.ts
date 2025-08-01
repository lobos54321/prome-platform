/**
 * Server-side configuration for backend API routes
 */

// Dify API Configuration
export const DIFY_API_URL = process.env.VITE_DIFY_API_URL || process.env.DIFY_API_URL || '';
export const DIFY_API_KEY = process.env.VITE_DIFY_API_KEY || process.env.DIFY_API_KEY || '';
export const DIFY_APP_ID = process.env.VITE_DIFY_APP_ID || process.env.DIFY_APP_ID || '';

// Supabase Configuration
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Validate critical configuration
if (!DIFY_API_URL || !DIFY_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ Missing critical environment variables for backend configuration');
}