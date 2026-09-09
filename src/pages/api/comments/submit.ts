import type { APIRoute } from 'astro';
import { supabase, supabaseServer } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { article_id, post_id, author_name, name, author_email, email, content, body, website_url_honeypot } = await request.json();
    if (website_url_honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let cleanArticleId = String(article_id ?? post_id ?? '').trim();
    const cleanName = String(author_name ?? name ?? '').replace(/<[^>]*>?/gm, '').trim();
    const cleanEmail = String(author_email ?? email ?? '').trim().toLowerCase();
    const cleanBody = String(content ?? body ?? '').replace(/<[^>]*>?/gm, '').trim();

    if (!cleanArticleId || !cleanName || !cleanEmail || !cleanBody) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Resolve slug to UUID if needed
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanArticleId)) {
      const { data: postRow } = await supabaseServer
        .from('journal_posts')
        .select('id')
        .eq('slug', cleanArticleId)
        .maybeSingle();
      if (postRow?.id) {
        cleanArticleId = postRow.id;
      }
    }

    const insertPayload = {
      article_id: cleanArticleId,
      author_name: cleanName,
      author_email: cleanEmail,
      content: cleanBody,
      status: 'PUBLISHED',
    };

    let insertedResult = await supabaseServer
      .from('comments')
      .insert(insertPayload)
      .select('id, article_id, author_name, content, status, created_at')
      .maybeSingle();

    if (insertedResult.error && supabaseServer !== supabase) {
      insertedResult = await supabase
        .from('comments')
        .insert(insertPayload)
        .select('id, article_id, author_name, content, status, created_at')
        .maybeSingle();
    }

    if (insertedResult.error) {
      return new Response(JSON.stringify({ error: insertedResult.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const commentData = {
      id: insertedResult.data?.id || crypto.randomUUID(),
      article_id: cleanArticleId,
      name: cleanName,
      body: cleanBody,
      created_at: insertedResult.data?.created_at || new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, comment: commentData }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};