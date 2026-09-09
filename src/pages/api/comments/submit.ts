import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { article_id, author_name, author_email, content, website_url_honeypot } = await request.json();
    if (website_url_honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cleanArticleId = String(article_id || '').trim();
    const cleanName = String(author_name || '').replace(/<[^>]*>?/gm, '').trim();
    const cleanEmail = String(author_email || '').trim().toLowerCase();
    const cleanBody = String(content || '').replace(/<[^>]*>?/gm, '').trim();

    if (!cleanArticleId || !cleanName || !cleanEmail || !cleanBody) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: inserted, error } = await supabase
      .from('comments')
      .insert({
        article_id: cleanArticleId,
        author_name: cleanName,
        author_email: cleanEmail,
        content: cleanBody,
        status: 'PUBLISHED',
      })
      .select('id, article_id, author_name, content, status, created_at')
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const commentData = {
      id: inserted?.id || crypto.randomUUID(),
      article_id: cleanArticleId,
      name: cleanName,
      body: cleanBody,
      created_at: inserted?.created_at || new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, comment: commentData }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};