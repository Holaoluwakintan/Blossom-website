import type { APIRoute } from 'astro';
import { supabaseServer } from '../../../lib/supabase';
import { siteUrl, verifyUnsubscribe } from '../../../lib/newsletter';

export const prerender = false;

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} | BLOSSOM</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#02050B;color:#F6F3EC;font-family:system-ui,sans-serif;padding:24px}main{max-width:460px;text-align:center}h1{font-family:Georgia,serif}p{color:#94a3b8;line-height:1.7}a{color:#E8C868}</style></head>
<body><main><h1>${title}</h1><p>${body}</p><p><a href="${siteUrl()}">Back to BLOSSOM</a></p></main></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );

async function unsubscribe(url: URL) {
  const email = String(url.searchParams.get('e') || '').trim().toLowerCase();
  const token = String(url.searchParams.get('t') || '');
  if (!email || !verifyUnsubscribe(email, token)) return { ok: false as const };
  const { error } = await supabaseServer
    .from('newsletter_subscribers')
    .update({ marketing_consent: false, updated_at: new Date().toISOString() })
    .eq('email', email);
  return { ok: !error, email };
}

export const GET: APIRoute = async ({ url }) => {
  const result = await unsubscribe(url);
  if (!result.ok) return page('Link not valid', 'This unsubscribe link is invalid or expired. Reply to any newsletter email and we will remove you by hand.', 400);
  return page('You are unsubscribed', 'You will not receive BLOSSOM newsletter emails any more. You can subscribe again on the website at any time.');
};

// One-click unsubscribe from Gmail / Apple Mail (RFC 8058).
export const POST: APIRoute = async ({ url }) => {
  const result = await unsubscribe(url);
  return new Response(null, { status: result.ok ? 200 : 400 });
};
