import { supabase } from './supabase';

/**
 * Daily Verse: posts come from Sow's content bank (Supabase table sp_posts).
 * Read with the public (anon) client on purpose: row-level security only returns posts whose
 * date + time (Nigeria time) has arrived and that are marked for the site, so nothing leaks early.
 */
export const SITE_URL = 'https://olaoluwamichael.vercel.app';

export type DailyVerse = {
  id: string; post_date: string; post_time: string; title: string; verse: string | null; reference: string | null;
  caption: string; hashtags: string; media_url: string | null; og_url: string | null; thumb_url: string | null; captions: Record<string, string> | null;
};

/** Current date and time in Lagos (WAT, UTC+1, no daylight saving). */
export function lagosNow() {
  const d = new Date(Date.now() + 3600e3).toISOString();
  return { date: d.slice(0, 10), time: d.slice(11, 16) };
}

const isLive = (p: DailyVerse) => {
  const n = lagosNow();
  return p.post_date < n.date || (p.post_date === n.date && String(p.post_time).slice(0, 5) <= n.time);
};

const COLS = 'id,post_date,post_time,title,verse,reference,caption,hashtags,media_url,og_url,thumb_url,captions';

export async function liveVerses(limit = 120): Promise<DailyVerse[]> {
  const { data, error } = await supabase.from('sp_posts').select(COLS).order('post_date', { ascending: false }).order('position').limit(limit);
  if (error || !data) return [];
  return (data as DailyVerse[]).filter(isLive);
}

export async function verseOn(date: string): Promise<DailyVerse | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const { data } = await supabase.from('sp_posts').select(COLS).eq('post_date', date).order('position').limit(1);
  const p = (data as DailyVerse[] | null)?.[0];
  return p && isLive(p) ? p : null;
}

export function longDate(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export function shortDate(date: string) {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
export const verseUrl = (p: { post_date: string }) => `${SITE_URL}/daily-verse/${p.post_date}`;
export const shareText = (p: DailyVerse) => `${p.title}: “${p.verse ?? p.caption}” ${p.reference ? '— ' + p.reference : ''}`.trim();
