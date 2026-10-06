// Google OAuth redirect for YouTube uploads: stores the refresh token, then back to the app.
import { unsign, APP } from './_lib.js';
import { ytExchange } from './_connectors.js';
export default async function handler(req, res) {
  const q = req.query || {};
  let msg = 'youtube=connected';
  try {
    if (q.error) throw new Error(q.error);
    if (!unsign(q.state)) throw new Error('link expired, try again');
    await ytExchange(q.code, APP + '/api/yt-callback');
  } catch (e) { msg = 'youtube_error=' + encodeURIComponent(e.message); }
  res.statusCode = 302; res.setHeader('Location', APP + '/#connect?' + msg); res.end();
}
