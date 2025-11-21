// src/core/metrics/metrics.service.ts

import { TenantContext } from '../tenancy/tenancy.types';
import { MetricPoint } from './metrics.types';

export interface MetricsService {
  recordMetric(point: MetricPoint): Promise<void>;

  queryMetrics(
    ctx: TenantContext,
    metricName: string,
    from: Date,
    to: Date
  ): Promise<MetricPoint[]>;
}