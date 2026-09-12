import type { APIRoute } from 'astro';
import { supabase, supabaseServer } from '../../../lib/supabase';
import { generateWelcomeEmail } from '../../../lib/newsletter-templates';

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

      if (!insertResult.error) {
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

    // Send Welcome Email if Resend API Key is configured in Vercel
    const resendApiKey = import.meta.env.RESEND_API_KEY;
    if (resendApiKey) {
      const welcome = generateWelcomeEmail(fullName);
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Olaoluwa Michael <newsletter@olaoluwamichael.vercel.app>',
          to: email,
          subject: welcome.emailSubject,
          html: welcome.emailHtml,
        }),
      }).catch((err) => console.error('Welcome email dispatch error:', err));
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Newsletter request failed:', error);
    return json({ error: 'Please try again with a valid email address.' }, 400);
  }
};
