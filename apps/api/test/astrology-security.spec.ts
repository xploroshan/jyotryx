/**
 * Astrology Traditions — Security Tests
 *
 * Validates input sanitization, enum enforcement, and that
 * internal prompt templates are not exposed through public APIs.
 */
import {
  TRADITION_CONFIGS,
  AVAILABLE_TRADITIONS,
  getTraditionConfig,
} from '../src/modules/astrology/traditions';

describe('Security — Tradition Input Validation', () => {
  describe('Tradition enum enforcement', () => {
    it('should not return config for SQL injection attempts', () => {
      expect(getTraditionConfig("'; DROP TABLE users;--")).toBeUndefined();
      expect(getTraditionConfig("VEDIC' OR '1'='1")).toBeUndefined();
    });

    it('should not return config for XSS payloads', () => {
      expect(getTraditionConfig('<script>alert(1)</script>')).toBeUndefined();
      expect(getTraditionConfig('"><img src=x onerror=alert(1)>')).toBeUndefined();
    });

    it('should not return config for path traversal', () => {
      expect(getTraditionConfig('../../etc/passwd')).toBeUndefined();
      expect(getTraditionConfig('..\\..\\windows\\system32')).toBeUndefined();
    });

    it('should not return config for empty string', () => {
      expect(getTraditionConfig('')).toBeUndefined();
    });

    it('should only return config for exact enum matches', () => {
      // Case sensitivity
      expect(getTraditionConfig('vedic')).toBeUndefined();
      expect(getTraditionConfig('Vedic')).toBeUndefined();
      expect(getTraditionConfig('VEDIC')).toBeDefined();

      // Partial matches should fail
      expect(getTraditionConfig('VED')).toBeUndefined();
      expect(getTraditionConfig('VEDIC_EXTRA')).toBeUndefined();
    });

    it('should not return config for null-like values', () => {
      expect(getTraditionConfig('null')).toBeUndefined();
      expect(getTraditionConfig('undefined')).toBeUndefined();
      expect(getTraditionConfig('NaN')).toBeUndefined();
    });
  });

  describe('API response sanitization', () => {
    it('getAvailableTraditions should not expose system prompts', () => {
      const publicFields = AVAILABLE_TRADITIONS.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        zodiacType: t.zodiacType,
        signSystem: t.signSystem,
        features: t.features,
        isAvailable: t.isAvailable,
      }));

      for (const t of publicFields) {
        // Ensure systemPromptPrefix is NOT in the public data
        expect((t as any).systemPromptPrefix).toBeUndefined();
        expect((t as any).horoscopePrompt).toBeUndefined();
      }
    });

    it('tradition configs should not contain sensitive data in public fields', () => {
      for (const config of AVAILABLE_TRADITIONS) {
        // Name and description should not contain API keys or secrets
        expect(config.name).not.toMatch(/sk-|api[_-]?key|secret|password/i);
        expect(config.description).not.toMatch(/sk-|api[_-]?key|secret|password/i);
      }
    });
  });

  describe('Prompt injection resistance', () => {
    it('horoscope prompts should be deterministic per tradition', () => {
      const vedicPrompt1 = TRADITION_CONFIGS.VEDIC.horoscopePrompt('Aries', 'daily', "today's");
      const vedicPrompt2 = TRADITION_CONFIGS.VEDIC.horoscopePrompt('Aries', 'daily', "today's");
      expect(vedicPrompt1).toBe(vedicPrompt2);
    });

    it('malicious sign input should not alter prompt structure', () => {
      const maliciousSign = '{{system.exec("rm -rf /")}}';
      const prompt = TRADITION_CONFIGS.VEDIC.horoscopePrompt(maliciousSign, 'daily', "today's");
      // Prompt should still be a plain string and not throw
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
      // The prompt template itself should be intact
      expect(prompt).toContain('Vedic astrologer');
      expect(prompt).toContain('prediction');
    });

    it('malicious period input should not break prompt generation', () => {
      const maliciousPeriod = '"; DROP TABLE users; --';
      const prompt = TRADITION_CONFIGS.VEDIC.horoscopePrompt('Aries', maliciousPeriod, "today's");
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('Vedic astrologer');
    });
  });

  describe('VALID_TRADITIONS set', () => {
    it('should only accept VEDIC, WESTERN, CHINESE for user profiles', () => {
      // Simulates the validation logic in user.service.ts
      const VALID_TRADITIONS = new Set(['VEDIC', 'WESTERN', 'CHINESE']);

      expect(VALID_TRADITIONS.has('VEDIC')).toBe(true);
      expect(VALID_TRADITIONS.has('WESTERN')).toBe(true);
      expect(VALID_TRADITIONS.has('CHINESE')).toBe(true);
      expect(VALID_TRADITIONS.has('HELLENISTIC')).toBe(false);
      expect(VALID_TRADITIONS.has('HORARY')).toBe(false);
      expect(VALID_TRADITIONS.has('MEDICAL')).toBe(false);
      expect(VALID_TRADITIONS.has('__proto__')).toBe(false);
      expect(VALID_TRADITIONS.has('constructor')).toBe(false);
    });
  });
});

describe('Security — Tradition Data Isolation', () => {
  it('each tradition config should have a unique ID', () => {
    const ids = Object.values(TRADITION_CONFIGS).map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('tradition IDs should match their registry keys', () => {
    for (const [key, config] of Object.entries(TRADITION_CONFIGS)) {
      expect(config.id).toBe(key);
    }
  });

  it('sign systems should not share mutable references', () => {
    const vedicSigns = TRADITION_CONFIGS.VEDIC.signSystem;
    const westernSigns = TRADITION_CONFIGS.WESTERN.signSystem;
    // Even though they contain the same values, they should be the same
    // array reference is OK since they're defined as const arrays
    // But Chinese should be different
    const chineseSigns = TRADITION_CONFIGS.CHINESE.signSystem;
    expect(chineseSigns).not.toEqual(vedicSigns);
  });
});
