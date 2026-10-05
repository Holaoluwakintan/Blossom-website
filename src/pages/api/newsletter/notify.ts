import type { APIRoute } from 'astro';
import { generateStoryAnnouncement } from '../../../lib/newsletter-templates';
import { secretMatches, sendToSubscribers, siteUrl } from '../../../lib/newsletter';

export const prerender = false;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const env = (key: string) => String((import.meta.env as Record<string, unknown>)[key] ?? '').trim();

/**
 * Manual announcement of one journal post (the automatic path is /api/newsletter/dispatch).
 * Body: { title, slug, excerpt?, readingTimeMinutes?, testEmail? }
 * Auth: header "x-newsletter-secret: <NEWSLETTER_SECRET>". Always required.
 * With testEmail set, the email goes only to that one address (use it to preview).
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const newsletterSecret = env('NEWSLETTER_SECRET');
    if (!newsletterSecret) return json({ error: 'NEWSLETTER_SECRET is not configured.' }, 503);
    const body = await request.json().catch(() => ({}));
    const given = request.headers.get('x-newsletter-secret') || body?.secretKey;
    if (!secretMatches(given, newsletterSecret)) return json({ error: 'Unauthorized' }, 401);

    const { title, slug, excerpt, readingTimeMinutes, testEmail } = body ?? {};
    if (!title || !slug) return json({ error: 'Title and slug are required' }, 400);

    const announcement = generateStoryAnnouncement({ title, slug, excerpt, readingTimeMinutes }, siteUrl());
    const only = typeof testEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail) ? testEmail.trim().toLowerCase() : undefined;
    const result = await sendToSubscribers(
      { subject: announcement.emailSubject, html: announcement.emailHtml, text: announcement.emailPlainText },
      only,
    );
    return json({
      success: result.failed === 0,
      dispatchStatus: result.failed === 0 ? 'sent' : result.sent > 0 ? 'partial' : 'failed',
      recipientCount: result.recipients,
      emailsSent: result.sent,
      errors: result.errors,
      whatsAppBroadcastText: announcement.whatsAppBroadcastText,
    });
  } catch (err: any) {
    return json({ error: err?.message || 'Notification failed' }, 500);
  }
};
