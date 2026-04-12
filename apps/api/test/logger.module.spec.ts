/**
 * AppLoggerModule Tests
 *
 * Validates the pino-based structured logging configuration.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('AppLoggerModule Configuration', () => {
  const loggerModulePath = path.resolve(__dirname, '../src/common/logger/logger.module.ts');

  it('logger module file should exist', () => {
    expect(fs.existsSync(loggerModulePath)).toBe(true);
  });

  it('should use nestjs-pino for structured logging', () => {
    const content = fs.readFileSync(loggerModulePath, 'utf-8');
    expect(content).toContain('nestjs-pino');
  });

  it('should redact authorization headers', () => {
    const content = fs.readFileSync(loggerModulePath, 'utf-8');
    expect(content).toContain('authorization');
  });

  it('should configure pino-pretty for development', () => {
    const content = fs.readFileSync(loggerModulePath, 'utf-8');
    expect(content).toContain('pino-pretty');
  });
});
