// OAuth redirect for LinkedIn and Threads (redirect URI: https://sow-ng.vercel.app/api/oauth). Stores the login, then back to the app.
import { unsign, APP } from './_lib.js';
import { liExchange, thExchange } from './_connectors.js';
export default async function handler(req, res) {
  const q = req.query || {};
  const st = unsign(q.state);
  const p = st && st.p === 'linkedin' ? 'linkedin' : st && st.p === 'threads' ? 'threads' : 'app';
  let msg = p + '=connected';
  try {
    if (q.error) throw new Error(q.error_description || q.error);
    if (!st) throw new Error('link expired, try again');
    if (p === 'linkedin') await liExchange(q.code);
    else if (p === 'threads') await thExchange(String(q.code || '').replace(/#_$/, ''));
    else throw new Error('unknown login');
  } catch (e) { msg = p + '_error=' + encodeURIComponent(e.message); }
  res.statusCode = 302; res.setHeader('Location', APP + '/#connect?' + msg); res.end();
}
