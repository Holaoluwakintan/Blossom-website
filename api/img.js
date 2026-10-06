// GET /api/img?u=<image or video url>  -> same bytes with CORS, so the phone can attach them to the share sheet.
// Only known media hosts (Drive, Google user content, Supabase, Cloudinary, imgur); 15 MB cap.
const OK = /^(drive\.google\.com|[a-z0-9-]+\.googleusercontent\.com|rlbrhpjljjgpqpqjrpkc\.supabase\.co|res\.cloudinary\.com|i\.imgur\.com)$/;
export default async function handler(req, res) {
  let u; try { u = new URL(String((req.query || {}).u || '')); } catch { res.statusCode = 400; return res.end('bad url'); }
  if (u.protocol !== 'https:' || !OK.test(u.hostname)) { res.statusCode = 400; return res.end('host not allowed'); }
  const m = u.href.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=|thumbnail\?.*id=)([a-zA-Z0-9_-]{20,})/);
  const src = m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : u.href;
  const r = await fetch(src, { redirect: 'follow' });
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !/^(image|video)\//.test(type)) { res.statusCode = 502; return res.end('not an image (is the Drive file shared "Anyone with the link"?)'); }
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 15e6) { res.statusCode = 413; return res.end('too big'); }
  res.setHeader('Content-Type', type); res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cache-Control', 'public, max-age=86400');
  res.end(buf);
}
