import { supabaseServer } from './supabase';

const botToken = () => String(import.meta.env.TELEGRAM_BOT_TOKEN || '');
const telegramApi = (method: string) => `https://api.telegram.org/bot${botToken()}/${method}`;
const telegramFileApi = () => `https://api.telegram.org/file/bot${botToken()}`;

export type TelegramUpdate = {
  message?: {
    message_id?: number;
    chat?: { id?: number | string };
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; file_size?: number }>;
  };
  callback_query?: {
    id: string;
    from?: { id?: number | string };
    data?: string;
    message?: { chat?: { id?: number | string }; message_id?: number };
  };
};

const text = (value: unknown) => String(value ?? '').replace(/<[^>]*>/g, '').trim();
const responseHeaders = { 'Content-Type': 'application/json' };

export function isAllowedChat(id: number | string | undefined) {
  const configured = text(import.meta.env.TELEGRAM_ADMIN_CHAT_ID);
  return Boolean(configured && id !== undefined && String(id) === configured);
}

export function hasWebhookSecret(request: Request) {
  const configured = text(import.meta.env.TELEGRAM_WEBHOOK_SECRET);
  return !configured || request.headers.get('x-telegram-bot-api-secret-token') === configured;
}

async function telegram<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const result = await fetch(telegramApi(method), {
    method: 'POST', headers: responseHeaders, body: JSON.stringify(body),
  });
  const payload = await result.json() as { ok?: boolean; result?: T; description?: string };
  if (!result.ok || !payload.ok) throw new Error(payload.description || `Telegram ${method} failed`);
  return payload.result as T;
}

export function sendMessage(chatId: number | string, message: string, replyMarkup?: unknown) {
  return telegram('sendMessage', {
    chat_id: chatId, text: message, parse_mode: 'HTML', ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'journal-post';
}

function instructions(caption: string) {
  const lines = caption.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const field = (name: string) => lines.find((line) => line.toLowerCase().startsWith(`${name}:`))?.slice(name.length + 1).trim() || '';
  return {
    title: field('title'),
    category: field('category') || 'Reflection',
    reference: field('bible reference') || field('reference'),
    verse: field('bible verse') || field('verse'),
    direction: field('direction') || field('instruction') || lines.filter((line) => !line.includes(':')).join(' '),
  };
}

function fallbackContent(caption: string, imageUrl: string) {
  const parsed = instructions(caption);
  const title = parsed.title || 'A Reflection for the Journey';
  const direction = parsed.direction || 'A quiet reminder to trust God in every season.';
  const content = `${direction}\n\nGod is present in the ordinary and difficult moments of life. This reflection invites us to pause, remember His faithfulness, and take the next step with hope.\n\nMay this truth draw you closer to Jesus and give you courage for today.`;
  return {
    title, slug: slugify(title), category: parsed.category, reference: parsed.reference || null, verse: parsed.verse || null,
    excerpt: content.split('\n\n')[0].slice(0, 220), content, imageUrl,
  };
}

async function downloadTelegramPhoto(fileId: string) {
  const file = await telegram<{ file_path?: string }>('getFile', { file_id: fileId });
  if (!file.file_path) throw new Error('Telegram did not return a file path');
  const result = await fetch(`${telegramFileApi()}/${file.file_path}`);
  if (!result.ok) throw new Error('Could not download the Telegram image');
  return { bytes: new Uint8Array(await result.arrayBuffer()), path: file.file_path };
}

export async function createDraft(update: TelegramUpdate) {
  const message = update.message;
  if (!message?.chat?.id || !message.photo?.length) throw new Error('Send a photo with instructions in its caption.');
  const photo = [...message.photo].sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
  const downloaded = await downloadTelegramPhoto(photo.file_id);
  const extension = downloaded.path.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const storagePath = `telegram/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabaseServer.storage.from('journal-covers').upload(storagePath, downloaded.bytes, {
    contentType: extension === 'png' ? 'image/png' : 'image/jpeg', upsert: false,
  });
  if (upload.error) throw new Error(`Image upload failed: ${upload.error.message}`);
  const imageUrl = supabaseServer.storage.from('journal-covers').getPublicUrl(storagePath).data.publicUrl;
  const draft = fallbackContent(message.caption || '', imageUrl);
  const minutes = Math.max(1, Math.ceil(draft.content.split(/\s+/).filter(Boolean).length / 200));
  const { data, error } = await supabaseServer.from('journal_posts').insert({
    title: draft.title, slug: `${draft.slug}-${Date.now().toString(36)}`, featured_image_url: imageUrl,
    excerpt: draft.excerpt, content_markdown: draft.content, author: 'Olaoluwa Michael',
    bible_reference: draft.reference, bible_verse: draft.verse, category: draft.category,
    featured: false, comments_enabled: true, reading_time_minutes: minutes, view_count: 0,
    status: 'DRAFT', published: false, published_at: null,
  }).select('id, title, slug, category, excerpt').single();
  if (error || !data) throw new Error(`Draft creation failed: ${error?.message || 'No row returned'}`);
  return data;
}

export async function publishDraft(id: string) {
  const { data, error } = await supabaseServer.from('journal_posts').update({
    status: 'PUBLISHED', published: true, published_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', id).eq('published', false).select('title, slug').single();
  if (error || !data) throw new Error(`Publishing failed: ${error?.message || 'Draft not found'}`);
  return data;
}

export async function rejectDraft(id: string) {
  const { data, error } = await supabaseServer.from('journal_posts').update({
    status: 'REJECTED', published: false, updated_at: new Date().toISOString(),
  }).eq('id', id).eq('published', false).select('title').single();
  if (error || !data) throw new Error(`Rejecting failed: ${error?.message || 'Draft not found'}`);
  return data;
}

export function approvalKeyboard(id: string) {
  return { inline_keyboard: [[
    { text: 'Approve and publish', callback_data: `journal:approve:${id}` },
    { text: 'Reject', callback_data: `journal:reject:${id}` },
  ]] };
}

function callback(update: TelegramUpdate) {
  const match = (update.callback_query?.data || '').match(/^journal:(approve|reject):([0-9a-f-]{36})$/i);
  return match ? { action: match[1].toLowerCase(), id: match[2] } : null;
}

function chatId(update: TelegramUpdate) {
  return update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? update.callback_query?.from?.id;
}

export async function processUpdate(update: TelegramUpdate) {
  const action = callback(update);
  const id = chatId(update);
  if (!isAllowedChat(id)) throw new Error('This Telegram account is not authorized.');
  if (action) {
    const post = action.action === 'approve' ? await publishDraft(action.id) : await rejectDraft(action.id);
    if (update.callback_query) await telegram('answerCallbackQuery', { callback_query_id: update.callback_query.id, text: action.action === 'approve' ? 'Published' : 'Rejected' });
    if (update.callback_query?.message?.message_id) await telegram('editMessageReplyMarkup', { chat_id: id, message_id: update.callback_query.message.message_id, reply_markup: { inline_keyboard: [] } });
    await sendMessage(id!, action.action === 'approve' ? `<b>Published</b>\n\n${text(post.title)}\nhttps://olaoluwamichael.vercel.app/journal/${encodeURIComponent(post.slug)}` : `<b>Draft rejected</b>\n\n${text(post.title)}`);
    return;
  }
  if (update.message?.text === '/start' || update.message?.text === '/help') {
    await sendMessage(id!, '<b>BLOSSOM Journal Bot</b>\nSend a photo with a caption containing your title, direction, Bible reference, verse, or category. I will create a draft for your approval.');
    return;
  }
  if (update.message?.photo?.length) {
    const draft = await createDraft(update);
    await sendMessage(id!, `<b>Draft created</b>\n\n<b>${text(draft.title)}</b>\nCategory: ${text(draft.category)}\n\n${text(draft.excerpt)}\n\nReview it, then choose an action below.`, approvalKeyboard(draft.id));
    return;
  }
  await sendMessage(id!, 'Please send a photo with your writing direction in the caption.');
}

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function safeError(error: unknown) { return error instanceof Error ? error.message : 'Unexpected automation error'; }
export function webhookUrl() { return `${import.meta.env.PUBLIC_SITE_URL || 'https://olaoluwamichael.vercel.app'}/api/telegram/webhook`; }
export function isConfigured() { return Boolean(import.meta.env.TELEGRAM_BOT_TOKEN && import.meta.env.SUPABASE_SERVICE_ROLE_KEY && import.meta.env.TELEGRAM_ADMIN_CHAT_ID); }
export async function setWebhook() { return telegram('setWebhook', { url: webhookUrl(), secret_token: import.meta.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'] }); }
export async function getWebhookInfo() { return telegram('getWebhookInfo', {}); }
export { instructions, fallbackContent, slugify };
