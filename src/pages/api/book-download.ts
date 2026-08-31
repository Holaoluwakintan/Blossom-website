import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getBookDownloadUrl } from '../../lib/book-downloads';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://rlbrhpjljjgpqpqjrpkc.supabase.co';
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const safeFilename = (title: string) =>
  `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'blossom-book'}.pdf`;

export const GET: APIRoute = async ({ url }) => {
  try {
    if (!serviceRoleKey) return json({ error: 'Download service is not configured.' }, 503);

    const bookId = url.searchParams.get('bookId')?.trim() || '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookId)) {
      return json({ error: 'This book could not be identified.' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: book, error } = await supabaseAdmin
      .from('books')
      .select('id, title, slug, download_url')
      .eq('id', bookId)
      .maybeSingle();

    if (error || !book) return json({ error: 'Book not found.' }, 404);

    const downloadUrl = getBookDownloadUrl(book);
    if (!downloadUrl) return json({ error: 'This book is not available for download yet.' }, 404);

    const pdf = await fetch(downloadUrl, { redirect: 'follow' });
    if (!pdf.ok || !pdf.body) return json({ error: 'The book file is temporarily unavailable.' }, 502);

    return new Response(pdf.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename(book.title)}"`,
        ...(pdf.headers.get('content-length') ? { 'Content-Length': pdf.headers.get('content-length') as string } : {}),
        'Cache-Control': 'private, no-store'
      }
    });
  } catch {
    return json({ error: 'The download could not be completed. Please try again.' }, 500);
  }
};
