// POST /api/rewrite  {post_id}  (owner only) -> AI captions per platform, saved on the post.
// Uses Michael's free Gemini key server-side; Flash-Lite first to save his ~20/day full-Flash quota.
import { json, readBody, requireOwner, db } from './_lib.js';

const MODELS = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

async function gemini(prompt) {
  let last = '';
  for (const m of MODELS) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } }),
    });
    if (r.ok) {
      const j = await r.json();
      const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      try { return { model: m, out: JSON.parse(t) }; } catch { last = 'bad json from ' + m; continue; }
    }
    last = m + ' ' + r.status;
    if (![429, 404, 500, 503].includes(r.status)) break;
  }
  throw new Error('AI is busy right now (' + last + '). Try again in a minute.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const user = await requireOwner(req, res); if (!user) return;
  const body = await readBody(req);
  let post = body.post || null;
  if (body.post_id) post = (await db('sp_posts?select=*&id=eq.' + encodeURIComponent(body.post_id)))[0];
  if (!post) return json(res, 404, { error: 'post not found' });
  const link = post.link_url || '';
  const prompt = `You write social posts for Olaoluwa Michael, a Nigerian Christian author and creator (Blossom). Voice: warm, hopeful, simple English, encouraging, never preachy, no clichés like "Let that sink in". Quote scripture exactly as given (KJV), never change it.

Post:
Title: ${post.title}
Verse: ${post.verse || '(none)'}
Reference: ${post.reference || ''}
Caption idea: ${post.caption}
Hashtags: ${post.hashtags || ''}
${body.note ? 'Extra instruction from Michael: ' + body.note : ''}

Return JSON with exactly these keys:
"facebook": 80-150 words for his Facebook profile: a short hook line, 2-3 short paragraphs, the verse with reference, then a gentle question that invites comments, then the hashtags. Line breaks between paragraphs. A few emojis at most.
"whatsapp": for WhatsApp Status/Channel: bold title with *asterisks*, 1-2 short lines, the verse and reference. Under 60 words.
"x": one post under ${link ? 230 : 270} characters (do not include any link): punchy line + reference + 1-2 hashtags.
"youtube_title": under 90 characters, ends with " #shorts".
"youtube_desc": 2 short paragraphs + the verse${link ? ' + "' + link + '"' : ' (no links)'} + 3-5 hashtags including #shorts.`;
  try {
    const { model, out } = await gemini(prompt);
    const captions = {};
    for (const k of ['facebook', 'whatsapp', 'x', 'youtube_title', 'youtube_desc']) if (typeof out[k] === 'string') captions[k] = out[k].trim();
    if (captions.x) { captions.x = captions.x.replace(/https?:\/\/\S+/g, '').trim(); const max = link ? 255 : 280; if (captions.x.length > max) captions.x = captions.x.slice(0, max - 1) + '…'; if (link) captions.x += '\n' + link; }
    if (post.id) await db('sp_posts?id=eq.' + post.id, { method: 'PATCH', body: { captions: Object.assign({}, post.captions || {}, captions) } });
    return json(res, 200, { ok: true, model, captions });
  } catch (e) {
    return json(res, 503, { error: String(e.message || e) });
  }
}
