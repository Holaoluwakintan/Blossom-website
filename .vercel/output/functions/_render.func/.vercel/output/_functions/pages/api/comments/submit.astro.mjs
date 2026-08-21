import { s as supabase } from '../../../chunks/supabase_D5z8xYEZ.mjs';
export { renderers } from '../../../renderers.mjs';

const POST = async ({ request }) => {
  try {
    const { article_id, author_name, author_email, content, website_url_honeypot } = await request.json();
    if (website_url_honeypot) return new Response(JSON.stringify({ success: true }), { status: 200 });
    if (!article_id || !author_name || !author_email || !content) return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    const { error } = await supabase.from("comments").insert({
      article_id,
      author_name: String(author_name).replace(/<[^>]*>?/gm, "").trim(),
      author_email: author_email.trim().toLowerCase(),
      content: String(content).replace(/<[^>]*>?/gm, "").trim(),
      status: "PENDING"
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify({ success: true }), { status: 201 });
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
