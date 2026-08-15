/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * This file runs once when the Next.js server starts, before any routes
 * handle requests. We use it to await the sql.js database initialization
 * so that getDb() is guaranteed to be synchronously available in all handlers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureDbReady } = await import('./lib/db');
    await ensureDbReady();
    console.log('[Instrumentation] Database ready ✓');
  }
}
