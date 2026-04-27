import { Logger } from '@nestjs/common';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromEmail: string;
  fromName: string;
  /** Optional message id we want the provider to echo back so we can
   *  correlate bounces / complaints later. */
  idempotencyKey?: string;
}

export interface EmailSendResult {
  /** Provider-side message id (e.g. Resend's `id`). Empty string if
   *  the provider doesn't return one or we fell through to the no-op
   *  log channel. */
  providerId: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<EmailSendResult>;
  readonly kind: 'resend' | 'log';
}

/**
 * Resend (resend.com) — single API call, JSON body. We don't pull the
 * official npm package because it adds ~200 kB to the API bundle for
 * a single endpoint, and the wire format is stable.
 *
 * `RESEND_API_KEY` is the only required env var. If the key is
 * missing we fall back to the log provider so dev / staging never
 * fail a deploy just because the email path isn't configured.
 */
class ResendProvider implements EmailProvider {
  readonly kind = 'resend';
  private readonly logger = new Logger('ResendProvider');

  constructor(private readonly apiKey: string) {}

  async send(params: SendEmailParams): Promise<EmailSendResult> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        // Idempotency: Resend honours this header and dedupes within
        // the last 24h, so a queue-side retry of the same job won't
        // produce a second email even if our DB-side guard fails.
        ...(params.idempotencyKey
          ? { 'Idempotency-Key': params.idempotencyKey }
          : {}),
      },
      body: JSON.stringify({
        from: `${params.fromName} <${params.fromEmail}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { providerId: data.id ?? '' };
  }
}

/**
 * No-op provider that just logs. Used when no real provider is
 * configured — keeps dev/CI working without a real account, and
 * the `BriefingDelivery` rows still land so the admin tab has
 * something to show.
 */
class LogProvider implements EmailProvider {
  readonly kind = 'log';
  private readonly logger = new Logger('LogEmailProvider');

  async send(params: SendEmailParams): Promise<EmailSendResult> {
    this.logger.log(
      `[no-provider] Would send email to=${params.to} subject="${params.subject}" (text: ${params.text.length} chars)`,
    );
    return { providerId: '' };
  }
}

/**
 * Provider selection. Centralised so admin code that wants to
 * "send a test email" picks the same provider as the daily worker,
 * and so swapping to SES later is a one-file change.
 */
export function createEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const resendKey = env.RESEND_API_KEY;
  if (resendKey) return new ResendProvider(resendKey);
  return new LogProvider();
}
