/**
 * Branded "verify your email" email (subject + HTML + plaintext), sent via the
 * shared Resend provider — same look as the password-reset email. The link
 * points at our own /verify-email page, which calls the backend to consume the
 * token and log the user in.
 */

export interface VerificationEmailInput {
  /** Fully-formed link to our verify page, incl. the token. */
  verifyUrl: string;
  /** Site origin, e.g. https://www.myastro360.com (for the wordmark link). */
  appUrl: string;
  /** Recipient's display name, for the greeting. */
  name?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = "#FF4D00";

export function renderVerificationEmail(input: VerificationEmailInput): RenderedEmail {
  const { verifyUrl, appUrl, name } = input;
  const subject = "Verify your email for MyAstro360";
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : "Hello,";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#faf7f2;">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1200;">
      <a href="${appUrl}" style="text-decoration:none;font-size:20px;font-weight:700;color:#1a1200;">MyAstro<span style="color:${BRAND};">360</span></a>
      <p style="font-size:15px;line-height:1.6;margin:28px 0 8px;">${greeting}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Confirm your email address to activate your MyAstro360 account. This link expires in 24 hours.</p>
      <p style="margin:0 0 28px;">
        <a href="${verifyUrl}" style="display:inline-block;padding:13px 28px;background:${BRAND};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Verify my email</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#6b5d4f;margin:0 0 4px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size:12px;line-height:1.5;color:#8a7d6f;word-break:break-all;margin:0 0 24px;">${verifyUrl}</p>
      <p style="font-size:13px;line-height:1.6;color:#6b5d4f;margin:0;">If you didn't create a MyAstro360 account, you can safely ignore this email.</p>
      <p style="font-size:13px;line-height:1.6;color:#6b5d4f;margin:24px 0 0;">— The MyAstro360 team</p>
    </div>
  </body>
</html>`;

  const text = [
    "Verify your email for MyAstro360",
    "",
    greeting,
    "",
    "Confirm your email address to activate your MyAstro360 account (link expires in 24 hours):",
    "",
    verifyUrl,
    "",
    "If you didn't create a MyAstro360 account, you can safely ignore this email.",
    "",
    "— The MyAstro360 team",
  ].join("\n");

  return { subject, html, text };
}

/** Build the verify link to our own page from a bare token. */
export function buildVerifyUrl(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}
