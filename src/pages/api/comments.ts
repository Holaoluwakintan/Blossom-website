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

    const articleId = clean(payload.post_id, 80);
    const authorName = clean(payload.name, 80);
    const authorEmail = clean(payload.email, 160).toLowerCase();
    const content = clean(payload.body, 2000);

    if (!articleId || !authorName || !content) {
      return new Response(JSON.stringify({ error: 'Name and comment are required.' }), { status: 400 });
    }

    const { error } = await supabase.from('comments').insert({
      article_id: articleId,
      author_name: authorName,
      author_email: authorEmail || null,
      content,
      published: true,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch {
    return new Response(JSON.stringify({ error: 'Comment could not be submitted.' }), { status: 500 });
  }
};
