import type { APIRoute } from 'astro';
import { getWebhookInfo, hasWebhookSecret, isConfigured, jsonResponse, safeError, setWebhook } from '../../../lib/telegram-journal';

export const GET: APIRoute = async ({ request }) => {
  if (!isConfigured()) return jsonResponse({ error: 'Telegram automation is not configured.' }, 503);
  if (!hasWebhookSecret(request)) return jsonResponse({ error: 'Unauthorized' }, 401);
  try {
    return jsonResponse({ ok: true, webhook: await getWebhookInfo() });
  } catch (error) {
    return jsonResponse({ ok: false, error: safeError(error) }, 502);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!isConfigured()) return jsonResponse({ error: 'Telegram automation is not configured.' }, 503);
  if (!hasWebhookSecret(request)) return jsonResponse({ error: 'Unauthorized' }, 401);
  try {
    return jsonResponse({ ok: true, webhook: await setWebhook() });
  } catch (error) {
    return jsonResponse({ ok: false, error: safeError(error) }, 502);
  }
};
