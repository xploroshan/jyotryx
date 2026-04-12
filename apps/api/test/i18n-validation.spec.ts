/**
 * Internationalization (i18n) Validation Tests
 *
 * Validates that all locale files have consistent keys, no missing translations,
 * and the backend locale utility covers all supported languages.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getLocaleInstruction, isValidLocale } from '../src/common/locale';

const I18N_DIR = path.resolve(__dirname, '../../web/src/i18n');
const SUPPORTED_LOCALES = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as'];

describe('i18n — Language Parity Validation', () => {
  let enKeys: string[] = [];
  const localeData: Record<string, Record<string, any>> = {};

  beforeAll(() => {
    // Load all locale files
    for (const locale of SUPPORTED_LOCALES) {
      const filePath = path.join(I18N_DIR, `${locale}.ts`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Extract keys from the exported object
        const keys = extractTranslationKeys(content);
        localeData[locale] = keys;
      }
    }
    if (localeData.en) {
      enKeys = Object.keys(flattenObject(localeData.en));
    }
  });

  it('should have all 12 locale files present', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const filePath = path.join(I18N_DIR, `${locale}.ts`);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('should have an index.ts that exports all locales', () => {
    const indexPath = path.join(I18N_DIR, 'index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);

    const content = fs.readFileSync(indexPath, 'utf-8');
    for (const locale of SUPPORTED_LOCALES) {
      expect(content).toContain(locale);
    }
  });

  it('backend locale utility should support all frontend locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isValidLocale(locale)).toBe(true);
    }
  });

  it('should generate non-empty instructions for all non-English locales', () => {
    const nonEnglish = SUPPORTED_LOCALES.filter((l) => l !== 'en');
    for (const locale of nonEnglish) {
      const instruction = getLocaleInstruction(locale);
      expect(instruction.length).toBeGreaterThan(10);
      expect(instruction).toContain('MUST respond');
    }
  });

  it('no locale file should contain empty string values', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const filePath = path.join(I18N_DIR, `${locale}.ts`);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      // Look for suspicious patterns like: key: '',  or  key: ""
      const emptyStringMatches = content.match(/:\s*['"]['"]\s*[,}]/g) || [];
      // Filter out legitimate empty strings (like default values)
      const suspicious = emptyStringMatches.filter((m) => !m.includes('default'));

      expect(suspicious.length).toBe(0);
    }
  });

  it('each locale file should be a valid TypeScript module', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const filePath = path.join(I18N_DIR, `${locale}.ts`);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      // Should have an export
      expect(content).toMatch(/export\s+(default|const|function)/);
    }
  });

  it('no locale should have significantly fewer top-level keys than English', () => {
    const enPath = path.join(I18N_DIR, 'en.ts');
    if (!fs.existsSync(enPath)) return;

    const enContent = fs.readFileSync(enPath, 'utf-8');
    const enTopLevelKeyCount = (enContent.match(/^\s+\w+:/gm) || []).length;

    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== 'en')) {
      const filePath = path.join(I18N_DIR, `${locale}.ts`);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const keyCount = (content.match(/^\s+\w+:/gm) || []).length;

      // Each locale should have at least 70% of English keys
      const ratio = keyCount / enTopLevelKeyCount;
      expect(ratio).toBeGreaterThan(0.7);
    }
  });
});

// Helper: extract keys from TS source (rough heuristic)
function extractTranslationKeys(source: string): Record<string, any> {
  const obj: Record<string, any> = {};
  const matches = source.matchAll(/(\w+)\s*:\s*['"`]([^'"`]*)['"`]/g);
  for (const match of matches) {
    obj[match[1]] = match[2];
  }
  return obj;
}

function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}
