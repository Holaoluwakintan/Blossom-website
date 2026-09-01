const publicSupabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://rlbrhpjljjgpqpqjrpkc.supabase.co';

// Twisted is already present in the public Books bucket, but its database row
// currently has no download_url/file_url/public_url value.
const fallbackDownloadUrls: Record<string, string> = {
  twisted: `${publicSupabaseUrl}/storage/v1/object/public/Books/TWISTED.pdf`,
  golgotha: `${publicSupabaseUrl}/storage/v1/object/public/Books/GOLGOTHA-Land-Of-Zombies-GOLGOTHA-Land-Of-Zombiespdf%20(2).pdf`,
  // Keep the final book downloadable even when its database row has not yet
  // been updated with download_url/download_path.
  'crack-the-algorithm': `${publicSupabaseUrl}/storage/v1/object/public/Books/CRACK%20THE%20ALGORITHM.pdf`,
};

const fallbackCoverUrls: Record<string, string> = {
  golgotha: `${publicSupabaseUrl}/storage/v1/object/public/book-covers/golgotha-land-of-zombies-selar.com-6a854a299d475.png`,
  'crack-the-algorithm': `${publicSupabaseUrl}/storage/v1/object/public/book-covers/crack-the-algorithm-master-cover-redesign%20(2).png`,
};

const toPublicDigitalBookUrl = (value: string) => {
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.replace(/^\/+/, '').replace(/^digital-books\//i, '');
  return `${publicSupabaseUrl}/storage/v1/object/public/digital-books/${path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
};

export function getBookCoverUrl(book: Record<string, unknown> | null | undefined) {
  if (!book) return null;
  if (typeof book.slug === 'string' && fallbackCoverUrls[book.slug]) {
    return fallbackCoverUrls[book.slug];
  }
  if (typeof book.cover_image_url !== 'string' || !book.cover_image_url.trim()) return null;
  return book.cover_image_url.trim().replace('/storage/v1/object/public/Books/', '/storage/v1/object/public/book-covers/');
}

export function getBookDownloadUrl(book: Record<string, unknown> | null | undefined) {
  if (!book) return null;

  // Prefer verified canonical files over stale values left in the database.
  // This prevents a previous typo in download_url from breaking the live download.
  if (typeof book.slug === 'string' && fallbackDownloadUrls[book.slug]) {
    return fallbackDownloadUrls[book.slug];
  }

  const configuredSource = [book.download_url, book.file_url, book.public_url, book.download_path]
    .find((value) => typeof value === 'string' && value.trim()) as string | undefined;

  return configuredSource ? toPublicDigitalBookUrl(configuredSource.trim()) : null;
}
