import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register = client.register;

  readonly httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'] as const,
  });

  readonly httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  readonly llmRequestsTotal = new client.Counter({
    name: 'llm_requests_total',
    help: 'Total number of LLM API calls',
    labelNames: ['provider', 'model', 'feature'] as const,
  });

  readonly llmCostTotal = new client.Counter({
    name: 'llm_cost_usd_total',
    help: 'Total LLM cost in USD',
    labelNames: ['provider', 'model'] as const,
  });

  onModuleInit() {
    client.collectDefaultMetrics({ register: this.register });
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }
}
