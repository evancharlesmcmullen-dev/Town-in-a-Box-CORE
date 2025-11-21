// src/core/metrics/in-memory-metrics.service.ts

import { TenantContext } from '../tenancy/types';
import { MetricPoint } from './metrics.types';
import { MetricsService } from './metrics.service';

export class InMemoryMetricsService implements MetricsService {
  private points: MetricPoint[] = [];

  async recordMetric(point: MetricPoint): Promise<void> {
    this.points.push(point);
  }

  async queryMetrics(
    ctx: TenantContext,
    metricName: string,
    from: Date,
    to: Date
  ): Promise<MetricPoint[]> {
    return this.points.filter(
      (p) =>
        p.tenantId === ctx.tenantId &&
        p.metricName === metricName &&
        p.timestamp >= from &&
        p.timestamp <= to
    );
  }
}
