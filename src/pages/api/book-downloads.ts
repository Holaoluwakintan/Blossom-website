import type { APIRoute } from 'astro';
import { supabase, supabaseServer } from '../../lib/supabase';

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
    const body = await request.json().catch(() => ({}));
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

    let record: { download_count?: number | string; download_counter_started_at?: string } | null = null;

    // 1. Primary attempt: track_book_download RPC via server client
    const { data: rpcData, error: rpcError } = await supabaseServer.rpc('track_book_download', {
      p_book_id: bookId,
      p_email: email,
      p_full_name: fullName,
      p_marketing_opt_in: marketingOptIn,
    });

    if (!rpcError && rpcData) {
      record = (Array.isArray(rpcData) ? rpcData[0] : rpcData) ?? null;
    }

    // 2. Secondary attempt: track_book_download RPC via anon client if server client differs
    if (!record && supabaseServer !== supabase) {
      const { data: publicData, error: publicError } = await supabase.rpc('track_book_download', {
        p_book_id: bookId,
        p_email: email,
        p_full_name: fullName,
        p_marketing_opt_in: marketingOptIn,
      });

      if (!publicError && publicData) {
        record = (Array.isArray(publicData) ? publicData[0] : publicData) ?? null;
      }
    }

    // 3. Fallback attempt: direct table inserts into newsletter_subscribers & book_downloads
    if (!record) {
      // Direct insert into newsletter_subscribers
      await supabaseServer
        .from('newsletter_subscribers')
        .upsert(
          {
            email,
            full_name: fullName,
            source: 'book-download',
            marketing_consent: marketingOptIn,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        );

      // Direct insert into book_downloads
      await supabaseServer
        .from('book_downloads')
        .insert({
          book_id: bookId,
          email,
          full_name: fullName,
          marketing_consent: marketingOptIn,
        });

      // Increment counter
      const { data: count } = await supabaseServer.rpc('increment_book_download', {
        p_book_id: bookId,
      });

      record = { download_count: count ?? null };
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
