import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    const honeypot = String(payload?.website_url ?? '').trim();
    if (honeypot) return json({ ok: true });

    const email = String(payload?.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert({ email, source: 'website', updated_at: new Date().toISOString() }, { onConflict: 'email' });

    if (error) {
      console.error('Newsletter subscription failed:', error.message);
      return json({ error: 'Subscription is temporarily unavailable. Please try again soon.' }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Newsletter request failed:', error);
    return json({ error: 'Please try again with a valid email address.' }, 400);
  }
};
