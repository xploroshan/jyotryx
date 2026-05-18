import type { DailyBriefingResult } from './daily-briefing.service';

/**
 * HTML + plaintext template for the daily briefing email.
 *
 * Constraints:
 *   - Inline CSS only (Gmail strips <style> in the head).
 *   - Tables for layout (Outlook 2016 still doesn't honour flex/grid).
 *   - Width 600px max — the de-facto safe email width on every desktop
 *     client.
 *   - Plaintext part is mandatory (Gmail otherwise penalises HTML-only
 *     mail as "promotional"). Should mirror the HTML so screen
 *     readers and Apple Watch previews aren't gibberish.
 */

export interface BriefingEmailParams {
  userName: string;
  briefing: DailyBriefingResult;
  /** Absolute URL to the in-app daily briefing for the "Read more" CTA. */
  appUrl: string;
  /** Absolute URL of the unsubscribe / preferences page. */
  prefsUrl: string;
}

function escape(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bullets(items: string[]): string {
  if (!items?.length) return '';
  return items
    .slice(0, 5)
    .map((i) => `<li style="margin: 0 0 4px 0;">${escape(i)}</li>`)
    .join('');
}

export function renderBriefingEmail(params: BriefingEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, briefing, appUrl, prefsUrl } = params;
  const dateLabel = new Date(briefing.date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const greeting = briefing.greeting?.trim()
    ? briefing.greeting
    : `Good morning, ${userName.split(' ')[0]}`;
  const subject = `🌅 ${greeting} — ${briefing.panchang.tithi}, ${briefing.panchang.nakshatra}`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escape(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#0b0b13; color:#e7e7ea; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0b0b13;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; background-color:#15151f; border-radius: 12px; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding: 24px 24px 12px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);">
              <p style="margin:0 0 4px 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color:#8a8aa0;">${escape(dateLabel)} · myastro360</p>
              <h1 style="margin: 4px 0 0 0; font-size: 22px; font-weight: 600; color:#ffffff;">${escape(greeting)}</h1>
            </td>
          </tr>

          <!-- Day quality + summary -->
          <tr>
            <td style="padding: 20px 24px;">
              <p style="margin: 0 0 12px 0; font-size: 13px; color:#8a8aa0; text-transform: uppercase; letter-spacing: 0.08em;">Today is <span style="color:#c8a8ff;">${escape(briefing.dayQuality)}</span></p>
              <p style="margin: 0; font-size: 15px; line-height: 1.55; color:#e7e7ea;">${escape(briefing.summary)}</p>
            </td>
          </tr>

          <!-- Panchang -->
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#1d1d2c; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 0.08em; color:#8a8aa0;">PANCHANG</p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color:#e7e7ea;">
                      <strong>Tithi:</strong> ${escape(briefing.panchang.tithi)}<br/>
                      <strong>Nakshatra:</strong> ${escape(briefing.panchang.nakshatra)}<br/>
                      <strong>Yoga:</strong> ${escape(briefing.panchang.yoga)}<br/>
                      <strong>Rahu Kaal:</strong> <span style="color:#f5b76a;">${escape(briefing.panchang.rahukaal)}</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Do / Avoid -->
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td valign="top" width="50%" style="padding-right: 8px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 0.08em; color:#7ee9a3;">DO TODAY</p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.5; color:#e7e7ea;">
                      ${bullets(briefing.doList)}
                    </ul>
                  </td>
                  <td valign="top" width="50%" style="padding-left: 8px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; letter-spacing: 0.08em; color:#f5b76a;">AVOID</p>
                    <ul style="margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.5; color:#e7e7ea;">
                      ${bullets(briefing.avoidList)}
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Lucky -->
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#1d1d2c; border-radius: 8px;">
                <tr>
                  <td align="center" width="33%" style="padding: 14px 8px;">
                    <p style="margin:0 0 4px 0; font-size: 11px; color:#8a8aa0; text-transform: uppercase;">Colour</p>
                    <p style="margin:0; font-size: 14px; color:#ffffff;">${escape(briefing.luckyColor)}</p>
                  </td>
                  <td align="center" width="33%" style="padding: 14px 8px;">
                    <p style="margin:0 0 4px 0; font-size: 11px; color:#8a8aa0; text-transform: uppercase;">Number</p>
                    <p style="margin:0; font-size: 14px; color:#ffffff;">${escape(String(briefing.luckyNumber))}</p>
                  </td>
                  <td align="center" width="33%" style="padding: 14px 8px;">
                    <p style="margin:0 0 4px 0; font-size: 11px; color:#8a8aa0; text-transform: uppercase;">Time</p>
                    <p style="margin:0; font-size: 14px; color:#ffffff;">${escape(briefing.luckyTime)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${briefing.transitAlert
            ? `
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#3b2a4a; border-left: 3px solid #c8a8ff; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px 14px;">
                    <p style="margin: 0; font-size: 13px; color:#e7d6ff; line-height: 1.5;"><strong>Transit alert:</strong> ${escape(briefing.transitAlert)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
            : ''}

          <!-- CTA -->
          <tr>
            <td align="center" style="padding: 8px 24px 28px 24px;">
              <a href="${escape(appUrl)}" style="display:inline-block; padding: 12px 22px; border-radius: 8px; background-color:#7c5cff; color:#ffffff; text-decoration:none; font-size: 14px; font-weight: 600;">Open today's briefing</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 24px; background-color:#0b0b13; border-top: 1px solid rgba(255,255,255,0.06);">
              <p style="margin: 0; font-size: 11px; color:#5d5d70; text-align:center; line-height: 1.5;">
                You're receiving this because you turned on daily briefings on myastro360.<br/>
                <a href="${escape(prefsUrl)}" style="color:#8a8aa0;">Manage preferences</a> · For entertainment and spiritual guidance only — not professional advice.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plaintext mirror — same information, just for clients that prefer
  // text/plain (Apple Watch, accessibility readers, Gmail's clip-detect).
  const text = [
    `${greeting} — ${dateLabel}`,
    '',
    `Today is ${briefing.dayQuality}.`,
    briefing.summary,
    '',
    'PANCHANG',
    `  Tithi: ${briefing.panchang.tithi}`,
    `  Nakshatra: ${briefing.panchang.nakshatra}`,
    `  Yoga: ${briefing.panchang.yoga}`,
    `  Rahu Kaal: ${briefing.panchang.rahukaal}`,
    '',
    'DO TODAY',
    ...briefing.doList.slice(0, 5).map((d) => `  • ${d}`),
    '',
    'AVOID',
    ...briefing.avoidList.slice(0, 5).map((d) => `  • ${d}`),
    '',
    `Lucky colour: ${briefing.luckyColor}`,
    `Lucky number: ${briefing.luckyNumber}`,
    `Lucky time: ${briefing.luckyTime}`,
    ...(briefing.transitAlert ? ['', `Transit alert: ${briefing.transitAlert}`] : []),
    '',
    `Open today's briefing → ${appUrl}`,
    '',
    `Manage preferences → ${prefsUrl}`,
    '',
    'For entertainment and spiritual guidance only — not professional advice.',
  ].join('\n');

  return { subject, html, text };
}
