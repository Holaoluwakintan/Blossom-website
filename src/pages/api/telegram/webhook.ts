import type { APIRoute } from 'astro';
import { hasWebhookSecret, isConfigured, jsonResponse, processUpdate, safeError } from '../../../lib/telegram-journal';

export const POST: APIRoute = async ({ request }) => {
  if (!isConfigured()) return jsonResponse({ error: 'Telegram automation is not configured.' }, 503);
  if (!hasWebhookSecret(request)) return jsonResponse({ error: 'Unauthorized' }, 401);
  try {
    const update = await request.json();
    await processUpdate(update);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('[telegram webhook]', safeError(error));
    return jsonResponse({ ok: false, error: safeError(error) }, 200);
  }
};

export const ALL: APIRoute = async () => jsonResponse({ error: 'Method not allowed' }, 405);
