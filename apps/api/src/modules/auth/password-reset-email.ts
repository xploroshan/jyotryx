/**
 * Branded password-reset email (subject + HTML + plaintext).
 *
 * We render + send this ourselves via the shared Resend provider instead of
 * relying on Firebase's built-in email templates: on Identity Platform the
 * console template editor is locked once a custom email domain is set, so a
 * branded button / our-own-domain link isn't achievable there. Owning the
 * template here also means the reset link points at OUR /reset-password page
 * (which verifies + consumes the oobCode) rather than the generic Firebase
 * action handler.
 */

export interface PasswordResetEmailInput {
  /** Fully-formed link to our reset page, incl. mode + oobCode. */
  resetUrl: string;
  /** Site origin, e.g. https://www.myastro360.com (for the wordmark link). */
  appUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = "#FF4D00";

export function renderPasswordResetEmail(input: PasswordResetEmailInput): RenderedEmail {
  const { resetUrl, appUrl } = input;
  const subject = "Reset your MyAstro360 password";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#faf7f2;">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1200;">
      <a href="${appUrl}" style="text-decoration:none;font-size:20px;font-weight:700;color:#1a1200;">MyAstro<span style="color:${BRAND};">360</span></a>
      <p style="font-size:15px;line-height:1.6;margin:28px 0 8px;">Hello,</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">We received a request to reset your MyAstro360 password. Tap the button below to choose a new one. This link can be used once and expires in an hour.</p>
      <p style="margin:0 0 28px;">
        <a href="${resetUrl}" style="display:inline-block;padding:13px 28px;background:${BRAND};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Reset your password</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#6b5d4f;margin:0 0 4px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="font-size:12px;line-height:1.5;color:#8a7d6f;word-break:break-all;margin:0 0 24px;">${resetUrl}</p>
      <p style="font-size:13px;line-height:1.6;color:#6b5d4f;margin:0;">If you didn't ask to reset your password, you can safely ignore this email — your password won't change.</p>
      <p style="font-size:13px;line-height:1.6;color:#6b5d4f;margin:24px 0 0;">— The MyAstro360 team</p>
    </div>
  </body>
</html>`;

  const text = [
    "Reset your MyAstro360 password",
    "",
    "We received a request to reset your MyAstro360 password. Open the link below to choose a new one (usable once, expires in an hour):",
    "",
    resetUrl,
    "",
    "If you didn't ask to reset your password, you can safely ignore this email — your password won't change.",
    "",
    "— The MyAstro360 team",
  ].join("\n");

  return { subject, html, text };
}

/**
 * Firebase Admin's generatePasswordResetLink() returns a link pointed at the
 * Firebase action handler with the oobCode in the query string. We only want
 * the oobCode so we can build a link to our own reset page. Returns null if
 * the code can't be extracted (caller then aborts the send).
 */
export function extractOobCode(firebaseLink: string): string | null {
  try {
    return new URL(firebaseLink).searchParams.get("oobCode");
  } catch {
    return null;
  }
}

/** Build the reset link to our own page from a bare oobCode. */
export function buildResetUrl(appUrl: string, oobCode: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/reset-password?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`;
}
