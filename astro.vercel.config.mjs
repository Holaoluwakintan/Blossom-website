import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    maxDuration: 60,
    // Vercel resizes the large Supabase images on the fly (see src/lib/image.ts).
    imagesConfig: {
      sizes: [320, 480, 640, 960, 1280],
      domains: [],
      remotePatterns: [{ protocol: 'https', hostname: 'rlbrhpjljjgpqpqjrpkc.supabase.co' }],
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 2678400,
    },
  }),
});
