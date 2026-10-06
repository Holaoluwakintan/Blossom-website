import type { APIRoute } from 'astro';
import { getSubscribers, hasServerAccess, secretMatches, sendToSubscribers } from '../../../lib/newsletter';
import { mailConfigProblem } from '../../../lib/mailer';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const env = (key: string) => String((import.meta.env as Record<string, unknown>)[key] ?? '').trim();
const isEmail = (v: unknown) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const MAX_PER_CALL = 100;

/**
 * Manual broadcast of a ready-made email to newsletter subscribers.
 *
 * Auth: header "x-broadcast-secret: <BROADCAST_SECRET>". Always required.
 * Body: {
 *   subject, html, text?,          // may contain %%FIRST_NAME%% and %%UNSUBSCRIBE_URL%%
 *   testEmail?,                    // send only to this one address
 *   emails?: string[],             // send only to these subscribers (max 100 per call; non-subscribers are skipped)
 *   all?: true,                    // send to every consenting subscriber (only when the list fits in one call)
 *   dryRun?: true                  // count recipients, send nothing
 * }
 * One of testEmail / emails / all is required, so nothing goes to the whole list by accident.
 * The response lists exactly who was sent to (sentTo) and who failed (failedTo).
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const broadcastSecret = env('BROADCAST_SECRET');
    if (!broadcastSecret) return json({ error: 'BROADCAST_SECRET is not configured.' }, 503);
    if (!secretMatches(request.headers.get('x-broadcast-secret'), broadcastSecret)) return json({ error: 'Unauthorized' }, 401);
    if (!hasServerAccess()) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.' }, 503);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'JSON body required' }, 400);
    const { subject, html, text, testEmail, emails, all, dryRun } = body as Record<string, unknown>;
    if (typeof subject !== 'string' || !subject.trim() || typeof html !== 'string' || !html.trim()) {
      return json({ error: 'subject and html are required' }, 400);
    }
    if (text !== undefined && typeof text !== 'string') return json({ error: 'text must be a string' }, 400);

    let only: string | undefined;
    let batch: string[] | undefined;
    if (testEmail !== undefined) {
      if (!isEmail(testEmail)) return json({ error: 'testEmail is not a valid address' }, 400);
      only = String(testEmail).trim().toLowerCase();
    } else if (emails !== undefined) {
      if (!Array.isArray(emails) || !emails.length || !emails.every(isEmail)) return json({ error: 'emails must be a non-empty list of addresses' }, 400);
      if (emails.length > MAX_PER_CALL) return json({ error: `At most ${MAX_PER_CALL} emails per call` }, 400);
      batch = emails.map((e) => String(e).trim().toLowerCase());
    } else if (all !== true) {
      return json({ error: 'Say who to send to: testEmail, emails[], or all: true' }, 400);
    }

    if (!only) {
      const subscribers = await getSubscribers();
      const wanted = batch ? new Set(batch) : null;
      const recipients = wanted ? subscribers.filter((s) => wanted.has(s.email.trim().toLowerCase())).length : subscribers.length;
      if (!batch && recipients > MAX_PER_CALL && !dryRun) {
        return json({ error: `The list has ${recipients} subscribers; send it in batches with emails[] (max ${MAX_PER_CALL} per call).` }, 400);
      }
      if (dryRun) return json({ dryRun: true, subscribers: subscribers.length, recipients, mailConfigProblem: mailConfigProblem() });
    } else if (dryRun) {
      return json({ dryRun: true, recipients: 1, mailConfigProblem: mailConfigProblem() });
    }

    const problem = mailConfigProblem();
    if (problem) return json({ error: problem }, 503);

    const result = await sendToSubscribers({ subject: subject.trim(), html, text: text as string | undefined }, only, { emails: batch });
    return json({
      success: result.failed === 0,
      status: result.failed === 0 ? 'sent' : result.sent > 0 ? 'partial' : 'failed',
      provider: result.provider,
      recipients: result.recipients,
      sent: result.sent,
      failed: result.failed,
      sentTo: result.sentTo ?? [],
      failedTo: result.failedTo ?? [],
      skipped: batch ? batch.filter((e) => !(result.sentTo ?? []).includes(e) && !(result.failedTo ?? []).includes(e)) : [],
      errors: result.errors,
    });
  } catch (err: any) {
    return json({ error: err?.message || 'Broadcast failed' }, 500);
  }
};
