import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { articleId, viewerHash } = await request.json();
    if (!articleId || !viewerHash) return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });

    const { data: views, error } = await supabase.rpc('track_article_view', {
      p_article_id: articleId,
      p_viewer_hash: String(viewerHash).substring(0, 64)
    });

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify({ success: true, views }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  }
};