import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://rlbrhpjljjgpqpqjrpkc.supabase.co';
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const publicAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const emailPattern = /^\S+@\S+\.\S+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const clean = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const email = clean(body?.email, 254).toLowerCase();
    const bookId = clean(body?.bookId, 80);
    const fullName = clean(body?.name ?? body?.fullName, 120) || null;
    const marketingOptIn = body?.marketingOptIn !== false;

    if (!emailPattern.test(email) || email.length > 254) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }

    if (!uuidPattern.test(bookId)) {
      return json({ error: 'This book could not be identified.' }, 400);
    }

    // Tracking is helpful but must never prevent a free book download.
    // Vercel deployments may not have the private service-role key configured.
    let record: { download_count?: number | string; download_counter_started_at?: string } | null = null;
    if (serviceRoleKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await supabaseAdmin.rpc('track_book_download', {
        p_book_id: bookId,
        p_email: email,
        p_full_name: fullName,
        p_marketing_opt_in: marketingOptIn,
      });
      if (error) console.error('Book download tracking failed:', error.message);
      record = (Array.isArray(data) ? data[0] : data) ?? null;
    }

    // The counter itself remains available even when optional email capture is
    // not configured in Vercel. The RPC is security-definer and only receives
    // a validated book UUID from this form.
    if (!record?.download_count && publicAnonKey) {
      const supabasePublic = createClient(supabaseUrl, publicAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: count, error } = await supabasePublic.rpc('increment_book_download', {
        p_book_id: bookId,
      });
      if (error) console.error('Book counter increment failed:', error.message);
      if (!error && count != null) record = { download_count: count };
    }

    return json({
      success: true,
      downloadCount: record?.download_count == null ? null : Number(record.download_count),
      downloadCounterStartedAt: record?.download_counter_started_at || '2026-08-31',
    }, 201);
  } catch (error) {
    console.error('Invalid book download request:', error);
    return json({ error: 'Invalid download request.' }, 400);
  }
};
