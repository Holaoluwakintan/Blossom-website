export type BookLike = Record<string, any>;

export const getBookDownloadSource = (book: BookLike | null | undefined) => {
  if (!book) return null;
  return [book.download_url, book.file_url, book.public_url, book.download_path]
    .find((value) => typeof value === 'string' && value.trim())
    ?.trim() ?? null;
};

export const getBookDownloadHref = (slug: string) => `/download/${encodeURIComponent(slug)}`;

export const DOWNLOAD_COUNTER_START_DATE = 'August 29, 2026';

export const formatDownloadCount = (value: number | string | null | undefined) => {
  const count = Math.max(0, Number(value ?? 0) || 0);
  return `${count.toLocaleString('en-NG')} ${count === 1 ? 'download' : 'downloads'}`;
};

export const normalizeArtworkCategory = (value: string | null | undefined) => {
  const category = value?.trim() ?? '';
  return category.toLowerCase() === 'faith stiring' ? 'Faith Stirring' : category;
};

export const normalizeArtworkText = (value: string | null | undefined) =>
  value?.trim()
    .replace(/Release\.God/gi, 'Release. God')
    .replace(/\s+/g, ' ') ?? '';

export const getContentDate = (item: Record<string, any>) =>
  item.updated_at ?? item.published_at ?? item.created_at ?? null;

export const formatDate = (value: string | null | undefined) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
};

export const formatRelativeFreshness = (value: string | null | undefined) => {
  if (!value) return 'Freshly published';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Freshly published';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return 'Published today';
  if (days === 1) return 'Published yesterday';
  if (days < 7) return `Published ${days} days ago`;
  return `Published ${formatDate(value)}`;
};
