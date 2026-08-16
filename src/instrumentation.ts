/**
 * Next.js Instrumentation Hook
 * Supabase client initializes lazily on first request — no startup init needed.
 */
export async function register() {
  console.log('[Instrumentation] Agrishield server started — using Supabase cloud DB');
}
