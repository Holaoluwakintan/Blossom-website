export interface StoryNotificationData {
  title: string;
  slug: string;
  excerpt?: string;
  readingTimeMinutes?: number;
  author?: string;
}

export function generateStoryAnnouncement(data: StoryNotificationData, baseUrl = 'https://olaoluwamichael.vercel.app') {
  const storyUrl = `${baseUrl}/journal/${encodeURIComponent(data.slug)}`;
  const authorName = data.author || 'Olaoluwa Michael';
  const readTime = data.readingTimeMinutes ? `${data.readingTimeMinutes} min read` : 'A short reflection';

  // 1. Email Subject & Body
  const emailSubject = `New on BLOSSOM: "${data.title}" ✦`;
  
  const emailPlainText = `Hello friend,

A new reflection has just been published on the BLOSSOM Journal:

"${data.title}"
(${readTime})

${data.excerpt ? `"${data.excerpt}"\n\n` : ''}Take a quiet pause in your day to read, think, and be encouraged:
${storyUrl}

May this reflection leave you refreshed and closer to Jesus.

Warmly,
${authorName}
BLOSSOM Ecosystem
${baseUrl}
`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #02050B; color: #F6F3EC; margin: 0; padding: 40px 20px; }
    .container { max-width: 580px; margin: 0 auto; background-color: #080D16; border: 1px solid rgba(232, 200, 104, 0.25); border-radius: 24px; padding: 40px 32px; }
    .badge { display: inline-block; font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #E8C868; background-color: rgba(232, 200, 104, 0.1); padding: 4px 12px; border-radius: 100px; margin-bottom: 24px; }
    h1 { font-family: 'Georgia', serif; font-size: 28px; line-height: 1.25; color: #F6F3EC; margin: 0 0 16px; font-weight: bold; }
    p { font-size: 16px; line-height: 1.75; color: #94a3b8; margin: 0 0 20px; }
    .excerpt { font-style: italic; color: #cbd5e1; border-left: 3px solid #E8C868; padding-left: 16px; margin: 24px 0; }
    .button { display: inline-block; background-color: #E8C868; color: #02050B; font-weight: bold; font-family: monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; padding: 16px 32px; border-radius: 100px; text-decoration: none; margin: 24px 0 12px; }
    .footer { border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 24px; margin-top: 32px; font-size: 12px; color: #64748b; font-family: monospace; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">✨ New Journal Reflection</div>
    <h1>${data.title}</h1>
    <p style="color: #E8C868; font-family: monospace; font-size: 12px;">${readTime} · By ${authorName}</p>
    ${data.excerpt ? `<div class="excerpt">“${data.excerpt}”</div>` : ''}
    <p>A quiet, thought-provoking piece written to inspire courage, challenge perspectives, and draw your heart closer to God in everyday life.</p>
    <div style="text-align: center;">
      <a href="${storyUrl}" class="button">Read The Full Story →</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${authorName} · BLOSSOM Ecosystem</p>
      <p><a href="${baseUrl}" style="color: #E8C868; text-decoration: none;">Visit BLOSSOM Website</a></p>
    </div>
  </div>
</body>
</html>
`;

  // 2. WhatsApp Channel Broadcast Post (Compelling & Click-friendly)
  const whatsAppBroadcastText = `📖 *NEW STORY DROPPED ON BLOSSOM*

*${data.title}*
_${readTime}_

${data.excerpt ? `> “${data.excerpt}”\n\n` : ''}Sometimes we need a quiet pause to reflect, recalibrate, and remember who is in control.

Read today's reflection here:
👇
${storyUrl}

_Feel free to leave a response and share with someone who needs this today._ ✨`;

  return {
    emailSubject,
    emailPlainText,
    emailHtml,
    whatsAppBroadcastText,
    storyUrl,
  };
}

export function generateWelcomeEmail(name?: string | null, baseUrl = 'https://olaoluwamichael.vercel.app') {
  const greeting = name ? `Hello ${name},` : 'Hello friend,';
  const emailSubject = `Welcome to BLOSSOM ✦ Thank you for staying close`;
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #02050B; color: #F6F3EC; margin: 0; padding: 40px 20px; }
    .container { max-width: 580px; margin: 0 auto; background-color: #080D16; border: 1px solid rgba(232, 200, 104, 0.25); border-radius: 24px; padding: 40px 32px; }
    .badge { display: inline-block; font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #E8C868; background-color: rgba(232, 200, 104, 0.1); padding: 4px 12px; border-radius: 100px; margin-bottom: 24px; }
    h1 { font-family: 'Georgia', serif; font-size: 28px; line-height: 1.25; color: #F6F3EC; margin: 0 0 16px; font-weight: bold; }
    p { font-size: 16px; line-height: 1.75; color: #94a3b8; margin: 0 0 20px; }
    .button { display: inline-block; background-color: #E8C868; color: #02050B; font-weight: bold; font-family: monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; padding: 16px 32px; border-radius: 100px; text-decoration: none; margin: 24px 0 12px; }
    .footer { border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 24px; margin-top: 32px; font-size: 12px; color: #64748b; font-family: monospace; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">✨ Welcome to BLOSSOM</div>
    <h1>Thank you for joining us.</h1>
    <p>${greeting}</p>
    <p>You are now connected to the BLOSSOM community. Whenever a new Christian book, stickman visual reflection, or story drops, you will be the first to receive it directly in your inbox.</p>
    <div style="text-align: center;">
      <a href="${baseUrl}/books" class="button">Explore All Books →</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Olaoluwa Michael · BLOSSOM Ecosystem</p>
      <p><a href="${baseUrl}" style="color: #E8C868; text-decoration: none;">Visit BLOSSOM Website</a></p>
    </div>
  </div>
</body>
</html>
`;
  return { emailSubject, emailHtml };
}
