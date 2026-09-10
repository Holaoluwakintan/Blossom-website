import type { APIRoute } from 'astro';
import { supabase, supabaseServer } from '../../../lib/supabase';

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

    // Try inserting or upserting with supabaseServer (service role client if configured, else public)
    const subscriberRecord = {
      email,
      full_name: fullName,
      source: 'website',
      marketing_consent: true,
      updated_at: new Date().toISOString(),
    };

    // Primary attempt using supabaseServer
    let { error } = await supabaseServer
      .from('newsletter_subscribers')
      .upsert(subscriberRecord, { onConflict: 'email' });

    // If upsert threw RLS error and we have fallback
    if (error) {
      // Try simple insert (which has an explicit INSERT policy on Postgres)
      const insertResult = await supabaseServer
        .from('newsletter_subscribers')
        .insert({
          email,
          full_name: fullName,
          source: 'website',
          marketing_consent: true,
        });

      // If Postgres unique violation (already subscribed), consider it a success!
      if (insertResult.error?.code === '23505' || String(insertResult.error?.message).includes('duplicate')) {
        return json({ ok: true, alreadySubscribed: true });
      }

      // If insert worked
      if (!insertResult.error) {
        error = null;
      }
    }

    // Final fallback with public anon client insert if needed
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
        return json({ ok: true });
      }

      console.error('Newsletter subscription failed:', error.message);
      return json({ error: 'Subscription is temporarily unavailable. Please try again soon.' }, 500);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('Newsletter request failed:', error);
    return json({ error: 'Please try again with a valid email address.' }, 400);
  }
};
