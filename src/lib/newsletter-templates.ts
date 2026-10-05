/**
 * Email templates for the BLOSSOM newsletter.
 * Every newsletter email carries the placeholder UNSUBSCRIBE_PLACEHOLDER, which
 * the dispatcher replaces with each subscriber's personal unsubscribe link.
 */

export const UNSUBSCRIBE_PLACEHOLDER = '%%UNSUBSCRIBE_URL%%';
export const DEFAULT_SITE_URL = 'https://olaoluwamichael.vercel.app';

export interface StoryNotificationData {
  title: string;
  slug: string;
  excerpt?: string;
  readingTimeMinutes?: number;
  author?: string;
}

export interface BookNotificationData {
  title: string;
  slug: string;
  synopsis?: string;
  author?: string;
  coverUrl?: string;
  free?: boolean;
}

export type DigestItem = { kind: 'journal' | 'book'; title: string; url: string; blurb?: string };

export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clip = (value: string | undefined, max = 280) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
};

function shell(badge: string, inner: string, baseUrl: string, withUnsubscribe = true) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #02050B; color: #F6F3EC; margin: 0; padding: 32px 16px; }
    .container { max-width: 580px; margin: 0 auto; background-color: #080D16; border: 1px solid rgba(232, 200, 104, 0.25); border-radius: 24px; padding: 36px 28px; }
    .badge { display: inline-block; font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #E8C868; background-color: rgba(232, 200, 104, 0.1); padding: 4px 12px; border-radius: 100px; margin-bottom: 24px; }
    h1 { font-family: Georgia, serif; font-size: 28px; line-height: 1.25; color: #F6F3EC; margin: 0 0 16px; font-weight: bold; }
    h2 { font-family: Georgia, serif; font-size: 20px; line-height: 1.3; color: #F6F3EC; margin: 0 0 8px; }
    p { font-size: 16px; line-height: 1.75; color: #94a3b8; margin: 0 0 20px; }
    .excerpt { font-style: italic; color: #cbd5e1; border-left: 3px solid #E8C868; padding-left: 16px; margin: 24px 0; }
    .button { display: inline-block; background-color: #E8C868; color: #02050B !important; font-weight: bold; font-family: monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; padding: 16px 32px; border-radius: 100px; text-decoration: none; margin: 24px 0 12px; }
    .item { border-top: 1px solid rgba(255,255,255,0.08); padding: 20px 0; }
    .item a { color: #E8C868; }
    .footer { border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 24px; margin-top: 32px; font-size: 12px; color: #64748b; font-family: monospace; text-align: center; }
    .footer a { color: #E8C868; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">${badge}</div>
    ${inner}
    <div class="footer">
      <p>© ${new Date().getFullYear()} Olaoluwa Michael · BLOSSOM</p>
      <p><a href="${baseUrl}">Visit the BLOSSOM website</a></p>
      ${withUnsubscribe ? `<p>You are receiving this because you subscribed on the BLOSSOM website.<br><a href="${UNSUBSCRIBE_PLACEHOLDER}">Unsubscribe</a></p>` : ''}
    </div>
  </div>
</body>
</html>`;
}

const plainFooter = (baseUrl: string) => `\n\n—\nOlaoluwa Michael · BLOSSOM\n${baseUrl}\nUnsubscribe: ${UNSUBSCRIBE_PLACEHOLDER}\n`;

export function generateStoryAnnouncement(data: StoryNotificationData, baseUrl = DEFAULT_SITE_URL) {
  const storyUrl = `${baseUrl}/journal/${encodeURIComponent(data.slug)}`;
  const authorName = data.author || 'Olaoluwa Michael';
  const readTime = data.readingTimeMinutes ? `${data.readingTimeMinutes} min read` : 'A short reflection';
  const excerpt = clip(data.excerpt);

  const emailSubject = `New on BLOSSOM: "${data.title}" ✦`;
  const emailPlainText = `Hello friend,

A new reflection has just been published on the BLOSSOM Journal:

"${data.title}"
(${readTime})

${excerpt ? `"${excerpt}"\n\n` : ''}Take a quiet pause in your day to read, think, and be encouraged:
${storyUrl}

May this reflection leave you refreshed and closer to Jesus.

Warmly,
${authorName}${plainFooter(baseUrl)}`;

  const emailHtml = shell(
    '✨ New Journal Reflection',
    `<h1>${escapeHtml(data.title)}</h1>
    <p style="color: #E8C868; font-family: monospace; font-size: 12px;">${escapeHtml(readTime)} · By ${escapeHtml(authorName)}</p>
    ${excerpt ? `<div class="excerpt">“${escapeHtml(excerpt)}”</div>` : ''}
    <p>A quiet, thought-provoking piece written to inspire courage, challenge perspectives, and draw your heart closer to God in everyday life.</p>
    <div style="text-align: center;"><a href="${storyUrl}" class="button">Read The Full Story →</a></div>`,
    baseUrl,
  );

  const whatsAppBroadcastText = `📖 *NEW STORY DROPPED ON BLOSSOM*

*${data.title}*
_${readTime}_

${excerpt ? `> “${excerpt}”\n\n` : ''}Sometimes we need a quiet pause to reflect, recalibrate, and remember who is in control.

Read today's reflection here:
👇
${storyUrl}

_Feel free to leave a response and share with someone who needs this today._ ✨`;

  return { emailSubject, emailPlainText, emailHtml, whatsAppBroadcastText, storyUrl };
}

export function generateBookAnnouncement(data: BookNotificationData, baseUrl = DEFAULT_SITE_URL) {
  const bookUrl = `${baseUrl}/books/${encodeURIComponent(data.slug)}`;
  const authorName = data.author || 'Olaoluwa Michael';
  const synopsis = clip(data.synopsis, 320);
  const emailSubject = `New book on BLOSSOM: ${data.title} 📚`;
  const emailPlainText = `Hello friend,

A new book is now on the BLOSSOM shelf:

${data.title}, by ${authorName}

${synopsis ? `${synopsis}\n\n` : ''}${data.free ? 'It is free to download:' : 'See it here:'}
${bookUrl}${plainFooter(baseUrl)}`;
  const emailHtml = shell(
    '📚 New on the shelf',
    `${data.coverUrl ? `<div style="text-align:center;margin-bottom:24px;"><img src="${escapeHtml(data.coverUrl)}" alt="${escapeHtml(data.title)} cover" width="200" style="max-width:200px;border-radius:12px;"></div>` : ''}
    <h1>${escapeHtml(data.title)}</h1>
    <p style="color: #E8C868; font-family: monospace; font-size: 12px;">By ${escapeHtml(authorName)}</p>
    ${synopsis ? `<p>${escapeHtml(synopsis)}</p>` : ''}
    <div style="text-align: center;"><a href="${bookUrl}" class="button">${data.free ? 'Download It Free →' : 'See The Book →'}</a></div>`,
    baseUrl,
  );
  return { emailSubject, emailPlainText, emailHtml, bookUrl };
}

export function generateDigest(items: DigestItem[], baseUrl = DEFAULT_SITE_URL) {
  const emailSubject = `${items.length} new on BLOSSOM: ${items[0].title}${items.length > 1 ? ' and more' : ''} ✦`;
  const emailPlainText = `Hello friend,

Here is what is new on BLOSSOM:

${items.map((item) => `• ${item.kind === 'book' ? 'New book' : 'Journal'}: ${item.title}\n  ${item.url}`).join('\n\n')}${plainFooter(baseUrl)}`;
  const emailHtml = shell(
    '✨ New on BLOSSOM',
    `<h1>Fresh from the studio</h1>
    <p>Here is what is new since we last wrote.</p>
    ${items
      .map(
        (item) => `<div class="item">
      <p style="margin:0 0 6px;font-family:monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E8C868;">${item.kind === 'book' ? 'New book' : 'Journal'}</p>
      <h2>${escapeHtml(item.title)}</h2>
      ${item.blurb ? `<p style="margin:0 0 8px;">${escapeHtml(clip(item.blurb, 200))}</p>` : ''}
      <a href="${item.url}">${item.kind === 'book' ? 'See the book' : 'Read it'} →</a>
    </div>`,
      )
      .join('')}`,
    baseUrl,
  );
  return { emailSubject, emailPlainText, emailHtml };
}

export function generateWelcomeEmail(name?: string | null, baseUrl = DEFAULT_SITE_URL) {
  const greeting = name ? `Hello ${escapeHtml(name)},` : 'Hello friend,';
  const emailSubject = `Welcome to BLOSSOM ✦ Thank you for staying close`;
  const emailHtml = shell(
    '✨ Welcome to BLOSSOM',
    `<h1>Thank you for joining us.</h1>
    <p>${greeting}</p>
    <p>You are now connected to the BLOSSOM community. Whenever a new Christian book, stickman visual reflection, or story drops, you will be the first to receive it directly in your inbox.</p>
    <div style="text-align: center;"><a href="${baseUrl}/books" class="button">Explore All Books →</a></div>`,
    baseUrl,
  );
  const emailPlainText = `${name ? `Hello ${name},` : 'Hello friend,'}

Thank you for joining BLOSSOM. Whenever a new book or story drops, you will be the first to know.

Explore the books: ${baseUrl}/books${plainFooter(baseUrl)}`;
  return { emailSubject, emailHtml, emailPlainText };
}
