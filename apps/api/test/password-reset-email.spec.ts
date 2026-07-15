import {
  renderPasswordResetEmail,
  extractOobCode,
  buildResetUrl,
} from '../src/modules/auth/password-reset-email';

describe('password-reset-email', () => {
  describe('extractOobCode', () => {
    it('pulls the oobCode out of a Firebase reset link', () => {
      const link =
        'https://jyotron-8a830.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123&apiKey=x';
      expect(extractOobCode(link)).toBe('ABC123');
    });

    it('returns null for a malformed link or a link with no code', () => {
      expect(extractOobCode('not a url')).toBeNull();
      expect(extractOobCode('https://example.com/x')).toBeNull();
    });
  });

  describe('buildResetUrl', () => {
    it('points at our reset page with mode + encoded code, trimming trailing slash', () => {
      expect(buildResetUrl('https://www.myastro360.com/', 'a b+c')).toBe(
        'https://www.myastro360.com/reset-password?mode=resetPassword&oobCode=a%20b%2Bc',
      );
    });
  });

  describe('renderPasswordResetEmail', () => {
    const rendered = renderPasswordResetEmail({
      resetUrl: 'https://www.myastro360.com/reset-password?mode=resetPassword&oobCode=XYZ',
      appUrl: 'https://www.myastro360.com',
    });

    it('embeds the reset link in both the button and the plaintext fallback', () => {
      expect(rendered.html).toContain(
        'href="https://www.myastro360.com/reset-password?mode=resetPassword&oobCode=XYZ"',
      );
      expect(rendered.text).toContain(
        'https://www.myastro360.com/reset-password?mode=resetPassword&oobCode=XYZ',
      );
    });

    it('never references the Firebase action-handler host', () => {
      expect(rendered.html).not.toContain('firebaseapp.com');
      expect(rendered.text).not.toContain('firebaseapp.com');
    });

    it('has a subject and a text part', () => {
      expect(rendered.subject).toMatch(/reset/i);
      expect(rendered.text.length).toBeGreaterThan(0);
    });
  });
});
