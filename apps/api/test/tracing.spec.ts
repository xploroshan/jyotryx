/**
 * OpenTelemetry Tracing Tests
 *
 * Validates the tracing module configuration without actually starting the SDK.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('OpenTelemetry Tracing Configuration', () => {
  const tracingPath = path.resolve(__dirname, '../src/tracing.ts');

  it('tracing.ts should exist', () => {
    expect(fs.existsSync(tracingPath)).toBe(true);
  });

  it('should import @opentelemetry/sdk-node', () => {
    const content = fs.readFileSync(tracingPath, 'utf-8');
    expect(content).toContain('@opentelemetry/sdk-node');
  });

  it('should include PrismaInstrumentation', () => {
    const content = fs.readFileSync(tracingPath, 'utf-8');
    expect(content).toContain('PrismaInstrumentation');
  });
});
