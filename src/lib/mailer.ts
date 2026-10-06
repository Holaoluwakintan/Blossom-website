/**
 * One small mail sender for the whole site.
 *
 * Provider is picked from the environment, in this order:
 *   1. BREVO_API_KEY   -> Brevo HTTP API (free plan: 300 emails/day, a single verified
 *                         sender address such as your Gmail is enough, no domain needed)
 *   2. BREVO_SMTP_KEY + BREVO_SMTP_LOGIN -> Brevo over SMTP (smtp-relay.brevo.com:587).
 *                         The login is the one shown on Brevo -> SMTP & API -> SMTP
 *                         (looks like 9a1b2c001@smtp-brevo.com), the key starts with xsmtpsib-.
 *                         Generic SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS also work.
 *   3. RESEND_API_KEY  -> Resend (free plan: 100/day; the FROM address must be on a
 *                         domain you verified in Resend; *.vercel.app can never be verified)
 *
 * NEWSLETTER_FROM_EMAIL  the sender address (must be verified with the provider)
 * NEWSLETTER_FROM_NAME   display name, default "Olaoluwa Michael"
 * NEWSLETTER_REPLY_TO    optional reply-to address
 */

export type OutgoingEmail = {
  to: string;
  name?: string | null;
  subject: string;
  html: string;
  text?: string;
  unsubscribeUrl?: string;
};

export type SendResult = {
  provider: string;
  sent: number;
  failed: number;
  errors: string[];
  /** Addresses the provider accepted / refused, so a caller can track exactly who got a message. */
  sentTo?: string[];
  failedTo?: string[];
};

const env = (key: string) => String((import.meta.env as Record<string, unknown>)[key] ?? '').trim();

type Provider = 'brevo' | 'smtp' | 'resend';

function smtpConfig() {
  const host = env('SMTP_HOST') || (env('BREVO_SMTP_KEY') ? 'smtp-relay.brevo.com' : '');
  const user = env('SMTP_USER') || env('BREVO_SMTP_LOGIN');
  const pass = env('SMTP_PASS') || env('BREVO_SMTP_KEY');
  const port = Number(env('SMTP_PORT') || 587);
  return host && user && pass ? { host, port, user, pass } : null;
}

export function mailProvider(): Provider | null {
  if (env('BREVO_API_KEY')) return 'brevo';
  if (smtpConfig()) return 'smtp';
  if (env('RESEND_API_KEY')) return 'resend';
  return null;
}

export function mailConfigProblem(): string | null {
  const provider = mailProvider();
  if (!provider) {
    if (env('BREVO_SMTP_KEY') && !env('BREVO_SMTP_LOGIN')) {
      return 'BREVO_SMTP_KEY is set but BREVO_SMTP_LOGIN is missing (copy the Login from Brevo -> SMTP & API -> SMTP).';
    }
    return 'No email provider configured: set BREVO_API_KEY (recommended, free), BREVO_SMTP_KEY + BREVO_SMTP_LOGIN, or RESEND_API_KEY.';
  }
  const from = env('NEWSLETTER_FROM_EMAIL');
  if (!from) return 'NEWSLETTER_FROM_EMAIL is not set (use the sender address you verified with your email provider).';
  if (provider === 'resend' && /\.vercel\.app$/i.test(from.split('@')[1] || '')) {
    return 'Resend cannot send from a vercel.app address. Verify your own domain in Resend, or use Brevo with a verified Gmail sender.';
  }
  return null;
}

const sender = () => ({
  email: env('NEWSLETTER_FROM_EMAIL'),
  name: env('NEWSLETTER_FROM_NAME') || 'Olaoluwa Michael',
});

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

async function readError(response: Response) {
  const body = await response.text().catch(() => '');
  return `${response.status} ${body.slice(0, 300)}`;
}

async function sendBrevo(emails: OutgoingEmail[]): Promise<SendResult> {
  const result: SendResult = { provider: 'brevo', sent: 0, failed: 0, errors: [], sentTo: [], failedTo: [] };
  const replyTo = env('NEWSLETTER_REPLY_TO');
  // One API call per recipient keeps every unsubscribe link personal and never
  // exposes one subscriber's address to another. Calls run 5 at a time.
  for (const group of chunk(emails, 5)) {
    await Promise.all(
      group.map(async (email) => {
        try {
          const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': env('BREVO_API_KEY'), 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              sender: sender(),
              to: [{ email: email.to, ...(email.name ? { name: email.name } : {}) }],
              subject: email.subject,
              htmlContent: email.html,
              ...(email.text ? { textContent: email.text } : {}),
              ...(replyTo ? { replyTo: { email: replyTo } } : {}),
              ...(email.unsubscribeUrl
                ? { headers: { 'List-Unsubscribe': `<${email.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
                : {}),
            }),
          });
          if (response.ok) {
            result.sent += 1;
            result.sentTo!.push(email.to);
          } else {
            result.failed += 1;
            result.failedTo!.push(email.to);
            if (result.errors.length < 5) result.errors.push(await readError(response));
          }
        } catch (error) {
          result.failed += 1;
          result.failedTo!.push(email.to);
          if (result.errors.length < 5) result.errors.push(error instanceof Error ? error.message : 'network error');
        }
      }),
    );
  }
  return result;
}

async function sendSmtp(emails: OutgoingEmail[]): Promise<SendResult> {
  const result: SendResult = { provider: 'smtp', sent: 0, failed: 0, errors: [], sentTo: [], failedTo: [] };
  const config = smtpConfig()!;
  const { email: fromEmail, name } = sender();
  const replyTo = env('NEWSLETTER_REPLY_TO');
  let transport: { sendMail: (m: Record<string, unknown>) => Promise<unknown>; close?: () => void };
  try {
    const nodemailer = (await import('nodemailer')).default;
    transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      pool: true,
      maxConnections: 3,
    });
  } catch (error) {
    return { ...result, failed: emails.length, errors: [error instanceof Error ? error.message : 'SMTP setup failed'] };
  }
  for (const group of chunk(emails, 3)) {
    await Promise.all(
      group.map(async (email) => {
        try {
          await transport.sendMail({
            from: { name, address: fromEmail },
            to: email.name ? { name: email.name, address: email.to } : email.to,
            subject: email.subject,
            html: email.html,
            ...(email.text ? { text: email.text } : {}),
            ...(replyTo ? { replyTo } : {}),
            ...(email.unsubscribeUrl
              ? { headers: { 'List-Unsubscribe': `<${email.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
              : {}),
          });
          result.sent += 1;
          result.sentTo!.push(email.to);
        } catch (error) {
          result.failed += 1;
          result.failedTo!.push(email.to);
          if (result.errors.length < 5) result.errors.push(error instanceof Error ? error.message.slice(0, 300) : 'SMTP send failed');
        }
      }),
    );
  }
  transport.close?.();
  return result;
}

async function sendResend(emails: OutgoingEmail[]): Promise<SendResult> {
  const result: SendResult = { provider: 'resend', sent: 0, failed: 0, errors: [], sentTo: [], failedTo: [] };
  const { email: fromEmail, name } = sender();
  const replyTo = env('NEWSLETTER_REPLY_TO');
  // Resend's batch endpoint takes at most 100 emails per call.
  for (const group of chunk(emails, 100)) {
    try {
      const response = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          group.map((email) => ({
            from: `${name} <${fromEmail}>`,
            to: email.to,
            subject: email.subject,
            html: email.html,
            ...(email.text ? { text: email.text } : {}),
            ...(replyTo ? { reply_to: replyTo } : {}),
            ...(email.unsubscribeUrl
              ? { headers: { 'List-Unsubscribe': `<${email.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
              : {}),
          })),
        ),
      });
      if (response.ok) {
        result.sent += group.length;
        result.sentTo!.push(...group.map((e) => e.to));
      } else {
        result.failed += group.length;
        result.failedTo!.push(...group.map((e) => e.to));
        if (result.errors.length < 5) result.errors.push(await readError(response));
      }
    } catch (error) {
      result.failed += group.length;
      result.failedTo!.push(...group.map((e) => e.to));
      if (result.errors.length < 5) result.errors.push(error instanceof Error ? error.message : 'network error');
    }
  }
  return result;
}

export async function sendEmails(emails: OutgoingEmail[]): Promise<SendResult> {
  const problem = mailConfigProblem();
  if (problem) return { provider: mailProvider() ?? 'none', sent: 0, failed: emails.length, errors: [problem] };
  if (!emails.length) return { provider: mailProvider()!, sent: 0, failed: 0, errors: [] };
  const provider = mailProvider();
  if (provider === 'brevo') return sendBrevo(emails);
  if (provider === 'smtp') return sendSmtp(emails);
  return sendResend(emails);
}
