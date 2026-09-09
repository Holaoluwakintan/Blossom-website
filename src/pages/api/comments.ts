import type { APIRoute } from 'astro';
import { supabase, supabaseServer } from '../../lib/supabase';

const clean = (value: unknown, maxLength: number) =>
  String(value ?? '')
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .slice(0, maxLength);

export const GET: APIRoute = async ({ url }) => {
  try {
    let articleId = url.searchParams.get('articleId')?.trim() || url.searchParams.get('postId')?.trim();

    // If articleId is a slug, resolve to post UUID
    if (articleId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(articleId)) {
      const { data: postRow } = await supabaseServer
        .from('journal_posts')
        .select('id')
        .eq('slug', articleId)
        .maybeSingle();
      if (postRow?.id) {
        articleId = postRow.id;
      }
    }

    let query = supabaseServer
      .from('comments')
      .select('id, article_id, author_name, content, status, created_at')
      .order('created_at', { ascending: false });

    if (articleId) {
      query = query.eq('article_id', articleId);
    }

    const { data: rows, error } = await query;
    if (error) {
      // Fallback with anon client in case of permission differences
      const fallback = await supabase
        .from('comments')
        .select('id, article_id, author_name, content, status, created_at')
        .order('created_at', { ascending: false });
      if (fallback.error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, comments: fallback.data || [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const comments = (rows ?? [])
      .filter((c: any) => {
        const s = String(c.status ?? '').trim().toUpperCase();
        return s === 'PUBLISHED' || s === 'APPROVED' || s === 'ACTIVE' || !s;
      })
      .map((c: any) => ({
        id: c.id,
        article_id: c.article_id,
        name: c.author_name ?? 'Reader',
        body: c.content ?? '',
        created_at: c.created_at,
      }));

    return new Response(JSON.stringify({ success: true, comments }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Could not fetch comments.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.json();
    if (payload.website_url_honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let articleId = clean(payload.post_id ?? payload.article_id, 80);
    const authorName = clean(payload.name ?? payload.author_name, 80);
    const authorEmail = clean(payload.email ?? payload.author_email, 160).toLowerCase();
    const content = clean(payload.body ?? payload.content, 2000);

    if (!articleId || !authorName || !authorEmail || !content) {
      return new Response(JSON.stringify({ error: 'Name, email, and comment are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Resolve slug to UUID if needed
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(articleId)) {
      const { data: postRow } = await supabaseServer
        .from('journal_posts')
        .select('id')
        .eq('slug', articleId)
        .maybeSingle();
      if (postRow?.id) {
        articleId = postRow.id;
      }
    }

    const insertPayload = {
      article_id: articleId,
      author_name: authorName,
      author_email: authorEmail || null,
      content,
      status: 'PUBLISHED',
    };

    // Use supabaseServer (service role key if available) to bypass RLS
    let insertedResult = await supabaseServer
      .from('comments')
      .insert(insertPayload)
      .select('id, article_id, author_name, content, status, created_at')
      .maybeSingle();

    // If supabaseServer had an error and differs from supabase, try anon fallback
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
      article_id: articleId,
      name: authorName,
      body: content,
      created_at: insertedResult.data?.created_at || new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, comment: commentData }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Comment could not be submitted.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

