import { renderVerificationEmail, buildVerifyUrl } from '../src/modules/auth/email-verification-email';

describe('email-verification-email', () => {
  it('buildVerifyUrl points at our verify page with an encoded token', () => {
    expect(buildVerifyUrl('https://www.myastro360.com/', 'a b+c')).toBe(
      'https://www.myastro360.com/verify-email?token=a%20b%2Bc',
    );
  });

  it('renders the verify link in button + plaintext, greets by name, no firebase host', () => {
    const r = renderVerificationEmail({
      verifyUrl: 'https://www.myastro360.com/verify-email?token=XYZ',
      appUrl: 'https://www.myastro360.com',
      name: 'Asha',
    });
    expect(r.subject).toMatch(/verify/i);
    expect(r.html).toContain('href="https://www.myastro360.com/verify-email?token=XYZ"');
    expect(r.html).toContain('Hello Asha,');
    expect(r.text).toContain('https://www.myastro360.com/verify-email?token=XYZ');
    expect(r.html).not.toContain('firebaseapp.com');
  });

  it('falls back to a generic greeting without a name', () => {
    const r = renderVerificationEmail({ verifyUrl: 'https://x/y', appUrl: 'https://x' });
    expect(r.html).toContain('Hello,');
  });
});
