// POST /api/tg : Telegram webhook for the clip bank channel.
// Telegram sends every new or edited post in "Michael's Work"; videos become clip-bank rows (see _clips.js for the caption format).
// Auth: Telegram's X-Telegram-Bot-Api-Secret-Token header must equal TELEGRAM_WEBHOOK_SECRET; only TELEGRAM_CHAT_ID is accepted.
import { json, readBody, safeEq } from './_lib.js';
import { fromMessage, upsertClip, saveThumb, putClip, getClip } from './_clips.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || !safeEq(req.headers['x-telegram-bot-api-secret-token'], process.env.TELEGRAM_WEBHOOK_SECRET)) return json(res, 401, { error: 'bad secret' });
  const u = await readBody(req);
  const msg = u.channel_post || u.edited_channel_post;
  const chat = String(process.env.TELEGRAM_CHAT_ID || '');
  if (!msg || String(msg.chat && msg.chat.id) !== chat) return json(res, 200, { ok: true, ignored: 'not the clip channel' });
  // Our own silent forward (used by "Add by link") is not a new clip.
  const fo = msg.forward_origin || {}, ff = msg.forward_from_chat || {};
  if (String((fo.chat && fo.chat.id) || ff.id || '') === chat) return json(res, 200, { ok: true, ignored: 'own forward' });
  const rec = fromMessage(msg);
  if (!rec) {
    // a caption edit can turn a video post into something else only by deleting it; plain text posts are ignored
    return json(res, 200, { ok: true, ignored: 'no video' });
  }
  try {
    const existed = !!(await getClip(rec.id));
    const c = await upsertClip(rec);
    if (!c.thumb_url) { await saveThumb(c); await putClip(c); }
    return json(res, 200, { ok: true, clip: c.id, mood: c.mood, problem: c.problem || null, updated: existed });
  } catch (e) {
    return json(res, 500, { error: e.message });   // Telegram retries on errors
  }
}
