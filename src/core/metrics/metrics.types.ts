// src/core/metrics/metrics.types.ts

/**
 * A simple, generic metric data point.
 */
export interface MetricPoint {
  tenantId: string;
  metricName: string;     // e.g. "apra.requests.count"
  timestamp: Date;
  value: number;
  dimensions?: Record<string, string>;
}