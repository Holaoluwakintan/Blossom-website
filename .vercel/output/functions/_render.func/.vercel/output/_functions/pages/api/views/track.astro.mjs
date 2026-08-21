import { s as supabase } from '../../../chunks/supabase_D5z8xYEZ.mjs';
export { renderers } from '../../../renderers.mjs';

const POST = async ({ request }) => {
  try {
    const { articleId, viewerHash } = await request.json();
    if (!articleId || !viewerHash) return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
    const { data: views, error } = await supabase.rpc("track_article_view", {
      p_article_id: articleId,
      p_viewer_hash: String(viewerHash).substring(0, 64)
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify({ success: true, views }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
