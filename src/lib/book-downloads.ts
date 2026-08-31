const publicSupabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://rlbrhpjljjgpqpqjrpkc.supabase.co';

// Twisted is already present in the public Books bucket, but its database row
// currently has no download_url/file_url/public_url value.
const fallbackDownloadUrls: Record<string, string> = {
  twisted: `${publicSupabaseUrl}/storage/v1/object/public/Books/TWISTED.pdf`,
  golgotha: `${publicSupabaseUrl}/storage/v1/object/public/Books/GOLGOTHA-Land-Of-Zombies-GOLGOTHA-Land-Of-Zombiespdf%20(2).pdf`,
};

const fallbackCoverUrls: Record<string, string> = {
  'crack-the-algorithm': `${publicSupabaseUrl}/storage/v1/object/public/book-covers/crack-the-algorithm-master-cover-redesign%20(2).png`,
};

export function getBookCoverUrl(book: Record<string, unknown> | null | undefined) {
  if (!book) return null;
  if (typeof book.slug === 'string' && fallbackCoverUrls[book.slug]) {
    return fallbackCoverUrls[book.slug];
  }
  return typeof book.cover_image_url === 'string' && book.cover_image_url.trim()
    ? book.cover_image_url.trim()
    : null;
}

export function getBookDownloadUrl(book: Record<string, unknown> | null | undefined) {
  if (!book) return null;

  // Prefer verified canonical files over stale values left in the database.
  // This prevents a previous typo in download_url from breaking the live download.
  if (typeof book.slug === 'string' && fallbackDownloadUrls[book.slug]) {
    return fallbackDownloadUrls[book.slug];
  }

  const configuredUrl = [book.download_url, book.file_url, book.public_url]
    .find((value) => typeof value === 'string' && value.trim()) as string | undefined;

  return configuredUrl?.trim() ?? null;
}
