import crypto from 'node:crypto';
import { supabaseServer } from './supabase';
import { getBookCoverUrl } from './book-downloads';
import { sendEmails, mailConfigProblem, type SendResult } from './mailer';
import {
  DEFAULT_SITE_URL,
  UNSUBSCRIBE_PLACEHOLDER,
  FIRST_NAME_PLACEHOLDER,
  escapeHtml,
  generateBookAnnouncement,
  generateDigest,
  generateStoryAnnouncement,
  type DigestItem,
} from './newsletter-templates';

/**
 * Automatic newsletter.
 *
 * dispatchPending() finds content that was published recently and has never been
 * announced, claims it in the `newsletter_dispatches` table (so nothing is ever
 * sent twice, even if the cron and the database webhook fire together), emails
 * every subscriber with marketing consent, and records the result.
 *
 * Triggers (both call /api/newsletter/dispatch):
 *   - a Supabase database webhook on journal_posts / books  -> instant
 *   - a daily Vercel cron (vercel.json)                     -> safety net
 */

const env = (key: string) => String((import.meta.env as Record<string, unknown>)[key] ?? '').trim();

export const siteUrl = () => (env('PUBLIC_SITE_URL') || DEFAULT_SITE_URL).replace(/\/$/, '');

const secret = () => env('NEWSLETTER_SECRET') || env('SUPABASE_SERVICE_ROLE_KEY');

export function hasServerAccess() {
  return Boolean(env('SUPABASE_SERVICE_ROLE_KEY'));
}

/** Constant-time check of a shared secret from a header or body. */
export function secretMatches(candidate: string | null | undefined, ...expected: string[]) {
  const given = String(candidate ?? '');
  if (!given) return false;
  return expected.filter(Boolean).some((value) => {
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(value).digest();
    return crypto.timingSafeEqual(a, b);
  });
}

export function unsubscribeToken(email: string) {
  return crypto.createHmac('sha256', secret() || 'unset').update(email.trim().toLowerCase()).digest('hex').slice(0, 32);
}

export function unsubscribeUrl(email: string) {
  const e = email.trim().toLowerCase();
  return `${siteUrl()}/api/newsletter/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubscribeToken(e)}`;
}

export function verifyUnsubscribe(email: string, token: string) {
  return Boolean(secret()) && secretMatches(token, unsubscribeToken(email));
}

type Subscriber = { email: string; full_name: string | null };

export async function getSubscribers(): Promise<Subscriber[]> {
  const all: Subscriber[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseServer
      .from('newsletter_subscribers')
      .select('email, full_name')
      .eq('marketing_consent', true)
      .order('email')
      .range(from, from + 999);
    if (error) throw new Error(`Could not read subscribers: ${error.message}`);
    all.push(...((data ?? []) as Subscriber[]));
    if (!data || data.length < 1000) break;
  }
  const seen = new Set<string>();
  return all.filter((s) => {
    const e = String(s.email || '').trim().toLowerCase();
    if (!e || seen.has(e)) return false;
    seen.add(e);
    return true;
  });
}

/** "ADEOLA" / "adeola" / "Adeola Grace" -> "Adeola". Anything that does not look like a name -> null. */
export function firstNameOf(fullName: string | null | undefined) {
  const word = String(fullName ?? '').trim().split(/\s+/)[0] ?? '';
  if (!word || word.length < 2 || word.length > 24 || /[@\d_<>&"]/.test(word)) return null;
  const clean = word.replace(/[.,;:!]+$/, '');
  if (!clean) return null;
  const mixed = clean !== clean.toLowerCase() && clean !== clean.toUpperCase();
  return mixed ? clean : clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

export type SendOptions = {
  /** Send only to these addresses, and only if they are consenting subscribers (a batch of a broadcast). */
  emails?: string[];
  /** Word used where FIRST_NAME_PLACEHOLDER appears and the subscriber has no usable name. */
  nameFallback?: string;
};

export async function sendToSubscribers(
  message: { subject: string; html: string; text?: string },
  onlyEmail?: string,
  options: SendOptions = {},
) {
  let subscribers: Subscriber[];
  if (onlyEmail) {
    const e = onlyEmail.trim().toLowerCase();
    const { data } = await supabaseServer.from('newsletter_subscribers').select('email, full_name').ilike('email', e).limit(1);
    subscribers = [{ email: e, full_name: (data?.[0] as Subscriber | undefined)?.full_name ?? null }];
  } else {
    subscribers = await getSubscribers();
    if (options.emails) {
      const wanted = new Set(options.emails.map((e) => String(e).trim().toLowerCase()));
      subscribers = subscribers.filter((s) => wanted.has(s.email.trim().toLowerCase()));
    }
  }
  const fallback = options.nameFallback ?? 'friend';
  const fill = (value: string, link: string, name: string, htmlSafe: boolean) =>
    value
      .split(UNSUBSCRIBE_PLACEHOLDER).join(link)
      .split(FIRST_NAME_PLACEHOLDER).join(htmlSafe ? escapeHtml(name) : name);
  const result = await sendEmails(
    subscribers.map((s) => {
      const to = s.email.trim().toLowerCase();
      const link = unsubscribeUrl(to);
      const name = firstNameOf(s.full_name) ?? fallback;
      return {
        to,
        name: s.full_name,
        subject: message.subject.split(FIRST_NAME_PLACEHOLDER).join(name),
        html: fill(message.html, link, name, true),
        text: message.text === undefined ? undefined : fill(message.text, link, name, false),
        unsubscribeUrl: link,
      };
    }),
  );
  return { recipients: subscribers.length, ...result };
}

type Pending = {
  content_type: 'journal' | 'book';
  content_id: string;
  slug: string;
  title: string;
  item: DigestItem;
  single: () => { emailSubject: string; emailHtml: string; emailPlainText: string };
};

const lookbackDays = () => Math.max(1, Number(env('NEWSLETTER_LOOKBACK_DAYS')) || 7);
const enabledKinds = () => (env('NEWSLETTER_CONTENT') || 'journal,books').toLowerCase();

async function findCandidates(): Promise<Pending[]> {
  const since = new Date(Date.now() - lookbackDays() * 86_400_000).toISOString();
  const out: Pending[] = [];
  const base = siteUrl();

  if (enabledKinds().includes('journal')) {
    const { data, error } = await supabaseServer
      .from('journal_posts')
      .select('id, title, slug, excerpt, reading_time_minutes, author, published, status, published_at, created_at')
      .gte('published_at', since)
      .order('published_at', { ascending: true });
    if (error) throw new Error(`Could not read journal posts: ${error.message}`);
    for (const post of data ?? []) {
      const status = String(post.status ?? '').toUpperCase();
      const live = post.published === true && (!status || status === 'PUBLISHED');
      if (!live || !post.slug || !post.title) continue;
      if (post.published_at && new Date(post.published_at).getTime() > Date.now()) continue; // scheduled for later
      const slug = String(post.slug).trim();
      out.push({
        content_type: 'journal',
        content_id: post.id,
        slug,
        title: post.title,
        item: { kind: 'journal', title: post.title, url: `${base}/journal/${encodeURIComponent(slug)}`, blurb: post.excerpt ?? '' },
        single: () =>
          generateStoryAnnouncement(
            { title: post.title, slug, excerpt: post.excerpt ?? '', readingTimeMinutes: post.reading_time_minutes ?? undefined, author: post.author ?? undefined },
            base,
          ),
      });
    }
  }

  if (enabledKinds().includes('book')) {
    const { data, error } = await supabaseServer
      .from('books')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Could not read books: ${error.message}`);
    for (const book of data ?? []) {
      if (!book.slug || !book.title) continue;
      const availability = String(book.availability_status ?? '').toLowerCase();
      if (availability.includes('draft') || availability.includes('hidden')) continue;
      const slug = String(book.slug).trim();
      const free = String(book.access_type ?? '').includes('free');
      out.push({
        content_type: 'book',
        content_id: book.id,
        slug,
        title: book.title,
        item: { kind: 'book', title: book.title, url: `${base}/books/${encodeURIComponent(slug)}`, blurb: book.synopsis ?? '' },
        single: () =>
          generateBookAnnouncement(
            { title: book.title, slug, synopsis: book.synopsis ?? '', author: book.author ?? undefined, coverUrl: getBookCoverUrl(book) ?? undefined, free },
            base,
          ),
      });
    }
  }
  return out;
}

/** Claim items atomically. Returns only the ones this run now owns. */
async function claim(items: Pending[]) {
  if (!items.length) return [];
  const { data: existing, error } = await supabaseServer
    .from('newsletter_dispatches')
    .select('id, content_type, content_id, status, attempts')
    .in('content_id', items.map((i) => i.content_id));
  if (error) throw new Error(`newsletter_dispatches table is missing or unreadable (run supabase/2026-10-05-newsletter-automation.sql): ${error.message}`);

  const owned: Pending[] = [];
  for (const item of items) {
    const row = (existing ?? []).find((r) => r.content_id === item.content_id && r.content_type === item.content_type);
    if (!row) {
      const { error: insertError } = await supabaseServer.from('newsletter_dispatches').insert({
        content_type: item.content_type,
        content_id: item.content_id,
        content_slug: item.slug,
        title: item.title,
        status: 'sending',
        attempts: 1,
      });
      if (!insertError) owned.push(item); // a unique-violation means another run got it first
    } else if (row.status === 'failed' && Number(row.attempts ?? 0) < 3) {
      const { data: updated } = await supabaseServer
        .from('newsletter_dispatches')
        .update({ status: 'sending', attempts: Number(row.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'failed')
        .select('id');
      if (updated?.length) owned.push(item);
    }
  }
  return owned;
}

async function record(items: Pending[], status: string, result: Partial<SendResult> & { recipients?: number }) {
  if (!items.length) return;
  await supabaseServer
    .from('newsletter_dispatches')
    .update({
      status,
      recipients: result.recipients ?? 0,
      sent_count: result.sent ?? 0,
      provider: result.provider ?? null,
      error: result.errors?.length ? result.errors.join(' | ').slice(0, 1000) : null,
      sent_at: status === 'sent' || status === 'partial' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .in('content_id', items.map((i) => i.content_id));
}

export async function dispatchPending(options: { dryRun?: boolean } = {}) {
  if (!hasServerAccess()) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.' };
  const configProblem = mailConfigProblem();
  const candidates = await findCandidates();

  if (options.dryRun) {
    const { data: existing } = await supabaseServer
      .from('newsletter_dispatches')
      .select('content_id, status')
      .in('content_id', candidates.length ? candidates.map((c) => c.content_id) : ['00000000-0000-0000-0000-000000000000']);
    const done = new Set((existing ?? []).filter((r) => r.status !== 'failed').map((r) => r.content_id));
    const subscribers = await getSubscribers();
    return {
      ok: true,
      dryRun: true,
      mailConfigProblem: configProblem,
      subscribers: subscribers.length,
      wouldAnnounce: candidates.filter((c) => !done.has(c.content_id)).map((c) => `${c.content_type}: ${c.title}`),
    };
  }

  // Don't burn claims while email isn't configured; the items stay pending.
  if (configProblem) return { ok: false, error: configProblem, pending: candidates.length };

  const owned = await claim(candidates);
  if (!owned.length) return { ok: true, announced: [], note: 'Nothing new to announce.' };

  const message =
    owned.length === 1
      ? owned[0].single()
      : generateDigest(owned.map((o) => o.item), siteUrl());

  try {
    const result = await sendToSubscribers({ subject: message.emailSubject, html: message.emailHtml, text: message.emailPlainText });
    const status = result.failed === 0 ? 'sent' : result.sent > 0 ? 'partial' : 'failed';
    await record(owned, status, result);
    return { ok: status !== 'failed', status, announced: owned.map((o) => `${o.content_type}: ${o.title}`), recipients: result.recipients, sent: result.sent, failed: result.failed, errors: result.errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await record(owned, 'failed', { errors: [message] });
    return { ok: false, status: 'failed', error: message };
  }
}
