/**
 * Supabase Storage serves book covers and journal images at full size (often 2–3.5 MB each).
 * On Vercel we route them through Vercel's free image optimizer, which resizes and
 * converts them to WebP/AVIF and caches the result. Anywhere else the original URL is used.
 *
 * Allowed widths must match imagesConfig.sizes in astro.config.mjs.
 */
const SIZES = [320, 480, 640, 960, 1280];
const SUPABASE_HOST = 'rlbrhpjljjgpqpqjrpkc.supabase.co';

const onVercel = () => import.meta.env.PROD && Boolean(process.env.VERCEL);

const canOptimize = (src: string) => {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname === SUPABASE_HOST && !/\.(svg|gif)$/i.test(url.pathname);
  } catch {
    return false;
  }
};

export function optimizedImage(src: string | null | undefined, width = 640, quality = 70) {
  const value = String(src ?? '').trim();
  if (!value || !onVercel() || !canOptimize(value)) return value;
  const w = SIZES.find((size) => size >= width) ?? SIZES[SIZES.length - 1];
  return `/_vercel/image?url=${encodeURIComponent(value)}&w=${w}&q=${quality}`;
}

export function optimizedSrcset(src: string | null | undefined, widths: number[] = [320, 640, 960]) {
  const value = String(src ?? '').trim();
  if (!value || !onVercel() || !canOptimize(value)) return undefined;
  return widths.map((w) => `${optimizedImage(value, w)} ${w}w`).join(', ');
}
