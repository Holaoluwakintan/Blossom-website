import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

const clean = (value: unknown, maxLength: number) =>
  String(value ?? '')
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .slice(0, maxLength);

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    if (payload.website_url_honeypot) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const postId = clean(payload.post_id, 80);
    const name = clean(payload.name, 80);
    const email = clean(payload.email, 160).toLowerCase();
    const body = clean(payload.body, 2000);

    if (!postId || !name || !body) {
      return new Response(JSON.stringify({ error: 'Name and comment are required.' }), { status: 400 });
    }

    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      name,
      email: email || null,
      body,
      status: 'APPROVED',
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch {
    return new Response(JSON.stringify({ error: 'Comment could not be submitted.' }), { status: 500 });
  }
};
