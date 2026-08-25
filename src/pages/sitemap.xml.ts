import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';

const siteUrl = 'https://olaoluwamichael.vercel.app';

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = async () => {
  const [{ data: books }, { data: artworks }, { data: posts }] = await Promise.all([
    supabase.from('books').select('slug, created_at').not('slug', 'is', null),
    supabase.from('artworks').select('slug, created_at').not('slug', 'is', null),
    supabase.from('journal_posts').select('slug, published_at, updated_at').eq('status', 'PUBLISHED').not('slug', 'is', null),
  ]);

  const urls = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/books', priority: '0.9', changefreq: 'weekly' },
    { path: '/imagination', priority: '0.8', changefreq: 'weekly' },
    { path: '/about', priority: '0.7', changefreq: 'monthly' },
    { path: '/journal', priority: '0.9', changefreq: 'weekly' },
    ...(books ?? []).map((book) => ({ path: `/books/${book.slug}`, priority: '0.8', changefreq: 'monthly', lastmod: book.created_at })),
    ...(artworks ?? []).map((artwork) => ({ path: `/imagination/${artwork.slug}`, priority: '0.6', changefreq: 'monthly', lastmod: artwork.created_at })),
    ...(posts ?? []).map((post) => ({ path: `/journal/${post.slug}`, priority: '0.8', changefreq: 'weekly', lastmod: post.updated_at || post.published_at })),
  ];

  const body = urls
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>` : '';
      return `  <url>\n    <loc>${escapeXml(`${siteUrl}${entry.path}`)}</loc>${lastmod}\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
    })
    .join('\n');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
