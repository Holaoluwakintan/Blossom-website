import type { APIRoute } from 'astro';
import { liveVerses, verseUrl, SITE_URL } from '../../lib/daily-verse';

export const prerender = false;
const x = (s: string) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string));

export const GET: APIRoute = async () => {
  const posts = await liveVerses(60);
  const items = posts.map((p) => `<item><title>${x(p.title)}${p.reference ? ' · ' + x(p.reference) : ''}</title><link>${verseUrl(p)}</link><guid isPermaLink="true">${verseUrl(p)}</guid><pubDate>${new Date(p.post_date + 'T' + String(p.post_time).slice(0, 5) + ':00+01:00').toUTCString()}</pubDate><description>${x((p.verse ? '“' + p.verse + '” — ' + p.reference + ' (KJV). ' : '') + p.caption)}</description>${p.media_url ? `<enclosure url="${x(p.media_url)}" type="image/jpeg" length="0"/>` : ''}</item>`).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Daily Verse · Olaoluwa Michael</title><link>${SITE_URL}/daily-verse</link><description>A Bible verse every morning from Olaoluwa Michael.</description><language>en-NG</language>${items}</channel></rss>`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=600' } });
};
