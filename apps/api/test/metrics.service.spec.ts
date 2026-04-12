/**
 * Metrics Module Tests
 *
 * Verifies the Prometheus /metrics endpoint and custom metric counters.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../src/metrics/metrics.service';
import { MetricsController } from '../src/metrics/metrics.controller';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    // Clear the prom-client default registry between tests to avoid
    // "metric already registered" errors when the same counter name
    // is re-created across test modules.
    const client = await import('prom-client');
    client.register.clear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('onModuleInit should register default collectors', () => {
    service.onModuleInit();
    // After init, getMetrics() should return content including default Node.js metrics
    expect(service.getMetrics()).resolves.toContain('process_cpu');
  });

  it('getMetrics() should return Prometheus text format', async () => {
    const output = await service.getMetrics();
    expect(typeof output).toBe('string');
    // Custom metrics should appear
    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('llm_requests_total');
    expect(output).toContain('llm_cost_usd_total');
  });

  it('getContentType() should return Prometheus content type', () => {
    const ct = service.getContentType();
    expect(ct).toContain('text/plain');
  });

  it('httpRequestsTotal counter should increment', async () => {
    service.httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
    service.httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
    const output = await service.getMetrics();
    expect(output).toContain('http_requests_total{method="GET",route="/test",status_code="200"} 2');
  });

  it('httpRequestDuration histogram should record observations', async () => {
    service.httpRequestDuration.observe({ method: 'POST', route: '/api' }, 0.15);
    const output = await service.getMetrics();
    expect(output).toContain('http_request_duration_seconds');
  });

  it('llmRequestsTotal counter should track by provider/model/feature', async () => {
    service.llmRequestsTotal.inc({ provider: 'openai', model: 'gpt-4o', feature: 'chat' });
    const output = await service.getMetrics();
    expect(output).toContain('llm_requests_total{provider="openai",model="gpt-4o",feature="chat"} 1');
  });

  it('llmCostTotal counter should track by provider/model', async () => {
    service.llmCostTotal.inc({ provider: 'anthropic', model: 'claude-3' }, 0.05);
    const output = await service.getMetrics();
    expect(output).toContain('llm_cost_usd_total{provider="anthropic",model="claude-3"}');
  });
});

describe('MetricsController', () => {
  let controller: MetricsController;
  let service: MetricsService;

  beforeEach(async () => {
    const client = await import('prom-client');
    client.register.clear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [MetricsService],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    service = module.get<MetricsService>(MetricsService);
  });

  it('GET /metrics should call res.end with Prometheus text', async () => {
    const mockRes = {
      set: jest.fn(),
      end: jest.fn(),
    } as any;

    await controller.getMetrics(mockRes);
    expect(mockRes.set).toHaveBeenCalledWith('Content-Type', expect.stringContaining('text/plain'));
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('http_requests_total'));
  });

  it('should be decorated with @SkipThrottle', () => {
    // @SkipThrottle({ default: true }) stores metadata with key THROTTLER:SKIPdefault
    const metadata = Reflect.getMetadata('THROTTLER:SKIPdefault', MetricsController);
    expect(metadata).toBe(true);
  });
});
