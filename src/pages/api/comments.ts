import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

const clean = (value: unknown, maxLength: number) =>
  String(value ?? '')
    .replace(/<[^>]*>?/gm, '')
    .trim()
    .slice(0, maxLength);

export const GET: APIRoute = async ({ url }) => {
  try {
    const articleId = url.searchParams.get('articleId')?.trim() || url.searchParams.get('postId')?.trim();

    let query = supabase
      .from('comments')
      .select('id, article_id, post_id, author_name, content, status, created_at')
      .order('created_at', { ascending: false });

    if (articleId) {
      query = query.or(`article_id.eq.${articleId},post_id.eq.${articleId}`);
    }

    const { data: rows, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const comments = (rows ?? [])
      .filter((c: any) => {
        const s = String(c.status ?? '').trim().toUpperCase();
        return s === 'PUBLISHED' || s === 'APPROVED' || !s;
      })
      .map((c: any) => ({
        id: c.id,
        article_id: c.article_id ?? c.post_id,
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

    const articleId = clean(payload.post_id ?? payload.article_id, 80);
    const authorName = clean(payload.name ?? payload.author_name, 80);
    const authorEmail = clean(payload.email ?? payload.author_email, 160).toLowerCase();
    const content = clean(payload.body ?? payload.content, 2000);

    if (!articleId || !authorName || !authorEmail || !content) {
      return new Response(JSON.stringify({ error: 'Name, email, and comment are required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const insertPayload = {
      article_id: articleId,
      author_name: authorName,
      author_email: authorEmail || null,
      content,
      status: 'PUBLISHED',
    };

    const { data: inserted, error } = await supabase
      .from('comments')
      .insert(insertPayload)
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
      article_id: articleId,
      name: authorName,
      body: content,
      created_at: inserted?.created_at || new Date().toISOString(),
    };

    return new Response(JSON.stringify({ success: true, comment: commentData }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Comment could not be submitted.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

