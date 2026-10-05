import type { APIRoute } from 'astro';
import { supabase, supabaseServer } from '../../../lib/supabase';
import { generateWelcomeEmail } from '../../../lib/newsletter-templates';
import { sendToSubscribers } from '../../../lib/newsletter';
import { mailConfigProblem } from '../../../lib/mailer';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json().catch(() => ({}));
    const honeypot = String(payload?.website_url ?? '').trim();
    if (honeypot) return json({ ok: true });

    const email = String(payload?.email ?? '').trim().toLowerCase();
    const fullName = String(payload?.full_name ?? payload?.name ?? '').trim() || null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }

    const subscriberRecord = {
      email,
      full_name: fullName,
      source: 'website',
      marketing_consent: true,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabaseServer
      .from('newsletter_subscribers')
      .upsert(subscriberRecord, { onConflict: 'email' });

    if (error) {
      const insertResult = await supabaseServer
        .from('newsletter_subscribers')
        .insert({
          email,
          full_name: fullName,
          source: 'website',
          marketing_consent: true,
        });

      if (!insertResult.error || insertResult.error?.code === '23505') {
        error = null;
      }
    }

    if (error && supabaseServer !== supabase) {
      const anonResult = await supabase
        .from('newsletter_subscribers')
        .insert({
          email,
          full_name: fullName,
          source: 'website',
          marketing_consent: true,
        });

      if (!anonResult.error || anonResult.error?.code === '23505') {
        error = null;
      }
    }

    if (error) {
      console.error('Newsletter subscribe could not be saved:', error.message);
      return json({ error: 'We could not save your subscription right now. Please try again in a moment.' }, 500);
    }

    // Welcome email. Awaited: on Vercel a request that has already returned is frozen,
    // so a fire-and-forget fetch never reliably leaves the server.
    if (!mailConfigProblem()) {
      const welcome = generateWelcomeEmail(fullName);
      const sent = await Promise.race([
        sendToSubscribers({ subject: welcome.emailSubject, html: welcome.emailHtml, text: welcome.emailPlainText }, email),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]).catch((err) => {
        console.error('Welcome email dispatch error:', err);
        return null;
      });
      if (sent && sent.failed) console.error('Welcome email failed:', sent.errors.join(' | '));
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Newsletter request failed:', error);
    return json({ error: 'Please try again with a valid email address.' }, 400);
  }
};
