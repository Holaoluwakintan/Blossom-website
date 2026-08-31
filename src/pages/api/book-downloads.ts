import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Download service is not configured.' }, 503);
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const bookId = typeof body.bookId === 'string' ? body.bookId.trim() : '';

    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookId)) {
      return json({ error: 'This book could not be identified.' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error: subscriberError } = await supabaseAdmin
      .from('book_subscribers')
      .upsert({ email, marketing_consent: true }, { onConflict: 'email' });

    if (subscriberError) return json({ error: 'Your access could not be saved. Please try again.' }, 500);

    const { error: downloadError } = await supabaseAdmin
      .from('book_downloads')
      .insert({ email, book_id: bookId });

    if (downloadError) return json({ error: 'Your download could not be recorded. Please try again.' }, 500);

    return json({ success: true }, 201);
  } catch {
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};
