import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { articleId } = await request.json();
    if (typeof articleId !== 'string' || !uuidPattern.test(articleId)) {
      return new Response(JSON.stringify({ error: 'Invalid article.' }), { status: 400 });
    }

    const { data: clicks, error } = await supabase.rpc('increment_article_click', {
      p_article_id: articleId,
    });

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify({ success: true, clicks }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Click could not be recorded.' }), { status: 400 });
  }
};
