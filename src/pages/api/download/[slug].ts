import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getBookDownloadSource } from '../../../lib/content';
import { verifyDownloadToken } from '../../../lib/download-token';

const allowedHosts = ['supabase.co', 'supabase.in'];

const resolveSource = (book: Record<string, any>) => {
  const source = getBookDownloadSource(book);
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return source;
  const base = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/digital-books/${source.replace(/^\//, '')}`;
};

export const GET: APIRoute = async ({ params, url, redirect }) => {
  const slug = params.slug?.trim();
  if (!slug) return redirect('/books', 302);

  const { data: book, error } = await supabase.from('books').select('*').eq('slug', slug).maybeSingle();
  if (error || !book) return redirect('/books', 302);

  // Require valid download token generated when user submits email form
  const token = url.searchParams.get('token')?.trim() || '';
  const isValidToken = verifyDownloadToken(book.id, token);
  if (!isValidToken) {
    return redirect(`/books/${book.slug}`, 302);
  }

  const source = resolveSource(book);
  if (!source) return new Response('This free download is not available yet.', { status: 404 });

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
    if (sourceUrl.protocol !== 'https:' || !allowedHosts.some((host) => sourceUrl.hostname === host || sourceUrl.hostname.endsWith(`.${host}`))) {
      return new Response('Download source is not configured safely.', { status: 500 });
    }
  } catch {
    return new Response('Download source is invalid.', { status: 500 });
  }

  const upstream = await fetch(sourceUrl, { headers: { Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8' } });
  if (!upstream.ok || !upstream.body) {
    return new Response('The free download is temporarily unavailable. Please try again soon.', { status: 502 });
  }

  const safeFilename = String(book.title || slug).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'blossom-book';
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
