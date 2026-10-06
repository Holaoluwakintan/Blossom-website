# Sow · daily posting app by Olaoluwa Michael

**Live:** https://sow-ng.vercel.app (installable PWA: open in Chrome on Android → ⋮ → Add to Home screen).
**Site channel:** https://olaoluwamichael.vercel.app/daily-verse (code lives in `main` of Blossom-website: `src/pages/daily-verse/`).

Sow is a mini Buffer built around how Facebook actually works for a creator with a personal profile:

- **Auto** where an official API allows it: your website (on now), Facebook Page, YouTube Shorts, X (each switches on when connected).
- **One tap** where Meta allows no app at all (Facebook profile, groups, WhatsApp Status and Channel): Sow copies the caption, then opens Android's share menu with the picture file already attached. No robot logins, no ban risk.
- **Content bank**: every post is a row (date, time, title, caption, verse, reference, hashtags, image, video, platforms, status, per-platform posted times). Import from Excel/CSV/Google Sheets with column matching and preview.
- **AI captions** per platform (Facebook, WhatsApp, X ≤280, YouTube title + description, website note) on Michael's free Gemini key, server-side, Flash-Lite first.
- The 30 morning verse posts are preloaded, Oct 7 → Nov 5 2026 at 6:00 AM WAT, each with a 12 s 1080×1920 Short.

## Stack
No build step. `public/` is plain HTML/CSS/JS with a vendored supabase-js; `api/` are Vercel Node functions (no npm deps).

| path | what |
|---|---|
| `api/rewrite.js` | owner-only AI captions (Gemini: flash-lite-latest → 3.1-flash-lite → flash-latest) |
| `api/today.js` | today's / next post for the WhatsApp bot (header `x-sow-key`), and `POST ?action=mark` |
| `api/cron.js` | called every 30 min by Supabase pg_cron (`sow-autopost`); marks the site live and auto-posts to connected platforms; idempotent |
| `api/connect.js` | connector status, YouTube consent link, "post now", saving a Page token |
| `api/yt-callback.js` | Google OAuth redirect for YouTube uploads (refresh token stored in `sp_secrets`) |
| `api/sheet.js` | reads a Google Sheet (shared "anyone with link") as CSV for import |
| `api/img.js` | CORS proxy for Drive/known image hosts so shared pictures attach as files |
| `api/_connectors.js` | Facebook Page (Graph `/{page}/photos`), YouTube resumable upload, X v2 tweet (OAuth 1.0a) |
| `supabase/schema.sql` | tables `sp_posts`, `sp_owners`, `sp_config`, `sp_log`, `sp_secrets` (RLS on all), storage policy, cron job |
| `tools/render_short.py` | the Ken Burns Short renderer (PIL frames → ffmpeg, ~16 s per video, ~1.3 MB) |
| `test/e2e.mjs` | phone walk (360×800 @2x) on the live app, 23 checks |

Sign-in: anonymous Supabase session + owner passcode (bcrypt in `sp_config`, 5 wrong tries = 10 min lock). Owners are rows in `sp_owners`; RLS lets only owners read/write the bank. The public (site) can only read posts marked `site` whose date+time in Lagos has arrived.

Env (Vercel project `sow-ng`): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY, GEMINI_API_KEY, SOW_API_KEY, CRON_SECRET, SITE_URL, APP_URL; later GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (YouTube), X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (X), optional YT_PRIVACY. The Facebook Page id/token are saved in `sp_secrets` (`fb_page_id`, `fb_page_token`) via `POST /api/connect {action:'fb_set'}`.

Deploy: Vercel REST upload of this folder (framework none, output `public`).

## Switching on auto-posting
- **Facebook Page:** a Page access token with `pages_manage_posts` + `pages_read_engagement` for Michael's Page → `fb_set`. The Connect button stays "coming soon" until that's done.
- **YouTube:** in Google Cloud (project of OAuth client 177805466721-…): enable *YouTube Data API v3*; OAuth consent screen → add scope `youtube.upload`, publish the app "In production" (otherwise tokens die after 7 days); add redirect URI `https://sow-ng.vercel.app/api/yt-callback`; put GOOGLE_CLIENT_ID/SECRET in Vercel env; then Connect YouTube in the app. Until Google audits the app, API uploads are forced private.
- **X:** free developer account at developer.x.com → app with Read and Write → API key/secret + access token/secret (generated after setting Read and Write) → Vercel env.

## Next
- WhatsApp bot: call `GET https://sow-ng.vercel.app/api/today` (`x-sow-key`) for "today's post" / `?which=next`.
- Instagram (business account linked to the Page) via the same Graph token.
- Music bed for Shorts.

by Olaoluwa Michael
