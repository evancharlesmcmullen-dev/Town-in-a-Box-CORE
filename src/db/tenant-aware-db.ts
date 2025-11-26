// ============================================
// File: src/db/tenant-aware-db.ts
// ============================================

import { Pool, PoolClient } from 'pg';

/**
 * TenantAwareDb wraps a pg.Pool and ensures that, for every operation,
 * PostgreSQL Row Level Security (RLS) is given the correct tenant context
 * via the `app.current_tenant_id` setting.
 *
 * All Postgres-backed services should use this instead of using Pool directly.
 */
export class TenantAwareDb {
  constructor(private pool: Pool) {}

  /**
   * Run a callback within a transaction and a tenant context.
   * RLS policies should use `current_setting('app.current_tenant_id', true)`
   * to filter by tenant_id.
   */
  async withTenant<T>(
    tenantId: string,
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}