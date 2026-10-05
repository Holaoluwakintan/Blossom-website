import type { APIRoute } from 'astro';
import { dispatchPending, secretMatches } from '../../../lib/newsletter';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const env = (key: string) => String((import.meta.env as Record<string, unknown>)[key] ?? '').trim();

/**
 * Accepted callers:
 *   - Vercel Cron: sends "Authorization: Bearer <CRON_SECRET>" automatically.
 *   - Supabase database webhook / manual: header "x-newsletter-secret: <NEWSLETTER_SECRET>"
 *     (or "Authorization: Bearer <NEWSLETTER_SECRET>").
 */
function authorized(request: Request) {
  const cronSecret = env('CRON_SECRET');
  const newsletterSecret = env('NEWSLETTER_SECRET');
  if (!cronSecret && !newsletterSecret) return false;
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return secretMatches(bearer, cronSecret, newsletterSecret) || secretMatches(request.headers.get('x-newsletter-secret'), newsletterSecret);
}

async function handle(request: Request) {
  if (!env('CRON_SECRET') && !env('NEWSLETTER_SECRET')) {
    return json({ ok: false, error: 'Newsletter automation is not configured: set NEWSLETTER_SECRET (and CRON_SECRET) in Vercel.' }, 503);
  }
  if (!authorized(request)) return json({ ok: false, error: 'Unauthorized' }, 401);
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';
  try {
    const result = await dispatchPending({ dryRun });
    if (!result.ok) console.error('[newsletter dispatch]', JSON.stringify(result));
    return json(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dispatch failed';
    console.error('[newsletter dispatch]', message);
    return json({ ok: false, error: message }, 500);
  }
}

export const GET: APIRoute = ({ request }) => handle(request);
export const POST: APIRoute = ({ request }) => handle(request);
