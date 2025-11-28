// src/engines/finance/postgres-finance.service.ts
//
// PostgreSQL-backed implementation of FinanceService.
// Uses TenantAwareDb for RLS-enforced multi-tenancy.
//
// Supports Indiana-style double-entry fund accounting with:
// - Balanced transaction enforcement
// - Appropriation tracking
// - Fund balance and appropriation usage summaries

import { TenantAwareDb } from '../../db/tenant-aware-db';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  FinanceService,
  CreateFundInput,
  UpdateFundInput,
  CreateAccountInput,
  UpdateAccountInput,
  CreateTransactionInput,
  CreateAppropriationInput,
  UpdateAppropriationInput,
  AccountFilter,
  TransactionFilter,
  AppropriationFilter,
} from './finance.service';
import {
  Fund,
  FundType,
  Account,
  AccountCategory,
  FinanceTransaction,
  FinanceTransactionLine,
  FinanceTransactionType,
  Appropriation,
  FundBalanceSummary,
  AppropriationUsageSummary,
} from './finance.types';

// ===========================================================================
// ROW TYPES (from database schema)
// ===========================================================================

interface FundRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
  sboa_code: string | null;
  dlgf_fund_number: string | null;
  is_major_fund: boolean | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AccountRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  category: string;
  is_active: boolean;
  sboa_code: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TransactionRow {
  id: string;
  tenant_id: string;
  type: string;
  transaction_date: Date;
  reference: string | null;
  description: string;
  created_at: Date;
  updated_at: Date;
}

interface TransactionLineRow {
  id: string;
  tenant_id: string;
  transaction_id: string;
  fund_id: string;
  account_id: string;
  amount_cents: string | number; // BIGINT comes as string
  is_debit: boolean;
  appropriation_id: string | null;
  memo: string | null;
}

interface AppropriationRow {
  id: string;
  tenant_id: string;
  fund_id: string;
  account_id: string;
  budget_year: number;
  adopted_amount_cents: string | number;
  additional_appropriation_cents: string | number;
  reductions_cents: string | number;
  ordinance_number: string | null;
  adopted_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ===========================================================================
// POSTGRES FINANCE SERVICE
// ===========================================================================

/**
 * PostgreSQL-backed implementation of FinanceService.
 *
 * Uses TenantAwareDb for RLS-enforced multi-tenancy. All queries are
 * automatically scoped to the current tenant via PostgreSQL session variables.
 *
 * Database schema assumes these tables exist:
 * - funds
 * - accounts
 * - finance_transactions
 * - finance_transaction_lines
 * - appropriations
 */
export class PostgresFinanceService implements FinanceService {
  constructor(private readonly db: TenantAwareDb) {}

  // ===========================================================================
  // FUND OPERATIONS
  // ===========================================================================

  async createFund(ctx: TenantContext, input: CreateFundInput): Promise<Fund> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query<FundRow>(
        `
        INSERT INTO funds (
          tenant_id, code, name, type, is_active,
          sboa_code, dlgf_fund_number, is_major_fund, description,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          now(), now()
        )
        RETURNING *
        `,
        [
          ctx.tenantId,
          input.code,
          input.name,
          input.type,
          input.isActive ?? true,
          input.sboaCode ?? null,
          input.dlgfFundNumber ?? null,
          input.isMajorFund ?? null,
          input.description ?? null,
        ]
      );

      return this.mapFundRow(result.rows[0]);
    });
  }

  async getFund(ctx: TenantContext, id: string): Promise<Fund | null> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query<FundRow>(
        `SELECT * FROM funds WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, id]
      );

      return result.rows.length > 0 ? this.mapFundRow(result.rows[0]) : null;
    });
  }

  async listFunds(ctx: TenantContext): Promise<Fund[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query<FundRow>(
        `SELECT * FROM funds WHERE tenant_id = $1 ORDER BY code`,
        [ctx.tenantId]
      );

      return result.rows.map((row) => this.mapFundRow(row));
    });
  }

  async updateFund(
    ctx: TenantContext,
    id: string,
    input: UpdateFundInput
  ): Promise<Fund> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // First check if fund exists
      const existing = await client.query<FundRow>(
        `SELECT * FROM funds WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, id]
      );

      if (existing.rows.length === 0) {
        throw new Error('Fund not found for tenant');
      }

      // Build dynamic update
      const updates: string[] = [];
      const params: unknown[] = [ctx.tenantId, id];
      let paramIdx = 3;

      if (input.name !== undefined) {
        updates.push(`name = $${paramIdx++}`);
        params.push(input.name);
      }
      if (input.type !== undefined) {
        updates.push(`type = $${paramIdx++}`);
        params.push(input.type);
      }
      if (input.isActive !== undefined) {
        updates.push(`is_active = $${paramIdx++}`);
        params.push(input.isActive);
      }
      if (input.sboaCode !== undefined) {
        updates.push(`sboa_code = $${paramIdx++}`);
        params.push(input.sboaCode);
      }
      if (input.dlgfFundNumber !== undefined) {
        updates.push(`dlgf_fund_number = $${paramIdx++}`);
        params.push(input.dlgfFundNumber);
      }
      if (input.isMajorFund !== undefined) {
        updates.push(`is_major_fund = $${paramIdx++}`);
        params.push(input.isMajorFund);
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramIdx++}`);
        params.push(input.description);
      }

      updates.push(`updated_at = now()`);

      const result = await client.query<FundRow>(
        `UPDATE funds SET ${updates.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
        params
      );

      return this.mapFundRow(result.rows[0]);
    });
  }

  // ===========================================================================
  // ACCOUNT OPERATIONS
  // ===========================================================================

  async createAccount(
    ctx: TenantContext,
    input: CreateAccountInput
  ): Promise<Account> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query<AccountRow>(
        `
        INSERT INTO accounts (
          tenant_id, code, name, category, is_active,
          sboa_code, description,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7,
          now(), now()
        )
        RETURNING *
        `,
        [
          ctx.tenantId,
          input.code,
          input.name,
          input.category,
          input.isActive ?? true,
          input.sboaCode ?? null,
          input.description ?? null,
        ]
      );

      return this.mapAccountRow(result.rows[0]);
    });
  }

  async getAccount(ctx: TenantContext, id: string): Promise<Account | null> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query<AccountRow>(
        `SELECT * FROM accounts WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, id]
      );

      return result.rows.length > 0 ? this.mapAccountRow(result.rows[0]) : null;
    });
  }

  async listAccounts(
    ctx: TenantContext,
    filter?: AccountFilter
  ): Promise<Account[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const conditions: string[] = ['tenant_id = $1'];
      const params: unknown[] = [ctx.tenantId];
      let idx = 2;

      if (filter?.category !== undefined) {
        conditions.push(`category = $${idx++}`);
        params.push(filter.category);
      }

      if (filter?.isActive !== undefined) {
        conditions.push(`is_active = $${idx++}`);
        params.push(filter.isActive);
      }

      const result = await client.query<AccountRow>(
        `SELECT * FROM accounts WHERE ${conditions.join(' AND ')} ORDER BY code`,
        params
      );

      return result.rows.map((row) => this.mapAccountRow(row));
    });
  }

  async updateAccount(
    ctx: TenantContext,
    id: string,
    input: UpdateAccountInput
  ): Promise<Account> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // First check if account exists
      const existing = await client.query<AccountRow>(
        `SELECT * FROM accounts WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, id]
      );

      if (existing.rows.length === 0) {
        throw new Error('Account not found for tenant');
      }

      // Build dynamic update
      const updates: string[] = [];
      const params: unknown[] = [ctx.tenantId, id];
      let paramIdx = 3;

      if (input.name !== undefined) {
        updates.push(`name = $${paramIdx++}`);
        params.push(input.name);
      }
      if (input.category !== undefined) {
        updates.push(`category = $${paramIdx++}`);
        params.push(input.category);
      }
      if (input.isActive !== undefined) {
        updates.push(`is_active = $${paramIdx++}`);
        params.push(input.isActive);
      }
      if (input.sboaCode !== undefined) {
        updates.push(`sboa_code = $${paramIdx++}`);
        params.push(input.sboaCode);
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramIdx++}`);
        params.push(input.description);
      }

      updates.push(`updated_at = now()`);

      const result = await client.query<AccountRow>(
        `UPDATE accounts SET ${updates.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
        params
      );

      return this.mapAccountRow(result.rows[0]);
    });
  }

  // ===========================================================================
  // TRANSACTION OPERATIONS
  // ===========================================================================

  async createTransaction(
    ctx: TenantContext,
    input: CreateTransactionInput
  ): Promise<FinanceTransaction> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Validate: lines is not empty
      if (!input.lines || input.lines.length === 0) {
        throw new Error('Transaction must have at least one line');
      }

      // Validate: all fundIds exist for this tenant
      for (const line of input.lines) {
        const fundCheck = await client.query(
          `SELECT id FROM funds WHERE tenant_id = $1 AND id = $2`,
          [ctx.tenantId, line.fundId]
        );
        if (fundCheck.rows.length === 0) {
          throw new Error(`Fund not found: ${line.fundId}`);
        }
      }

      // Validate: all accountIds exist for this tenant
      for (const line of input.lines) {
        const accountCheck = await client.query(
          `SELECT id FROM accounts WHERE tenant_id = $1 AND id = $2`,
          [ctx.tenantId, line.accountId]
        );
        if (accountCheck.rows.length === 0) {
          throw new Error(`Account not found: ${line.accountId}`);
        }
      }

      // Validate: total debits = total credits (balanced transaction)
      let totalDebits = 0;
      let totalCredits = 0;
      for (const line of input.lines) {
        if (line.isDebit) {
          totalDebits += line.amountCents;
        } else {
          totalCredits += line.amountCents;
        }
      }

      if (totalDebits !== totalCredits) {
        throw new Error(
          `FinanceTransaction is not balanced: debits=${totalDebits}, credits=${totalCredits}`
        );
      }

      // Insert transaction header
      const txResult = await client.query<TransactionRow>(
        `
        INSERT INTO finance_transactions (
          tenant_id, type, transaction_date, reference, description,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, now(), now())
        RETURNING *
        `,
        [
          ctx.tenantId,
          input.type,
          input.transactionDate,
          input.reference ?? null,
          input.description,
        ]
      );

      const transactionId = txResult.rows[0].id;

      // Insert all transaction lines
      const lineResults: TransactionLineRow[] = [];
      for (const lineInput of input.lines) {
        const lineResult = await client.query<TransactionLineRow>(
          `
          INSERT INTO finance_transaction_lines (
            tenant_id, transaction_id, fund_id, account_id,
            amount_cents, is_debit, appropriation_id, memo
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
          `,
          [
            ctx.tenantId,
            transactionId,
            lineInput.fundId,
            lineInput.accountId,
            lineInput.amountCents,
            lineInput.isDebit,
            lineInput.appropriationId ?? null,
            lineInput.memo ?? null,
          ]
        );
        lineResults.push(lineResult.rows[0]);
      }

      return this.mapTransactionRow(txResult.rows[0], lineResults);
    });
  }

  async getTransaction(
    ctx: TenantContext,
    id: string
  ): Promise<FinanceTransaction | null> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const txResult = await client.query<TransactionRow>(
        `SELECT * FROM finance_transactions WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, id]
      );

      if (txResult.rows.length === 0) {
        return null;
      }

      const linesResult = await client.query<TransactionLineRow>(
        `SELECT * FROM finance_transaction_lines WHERE transaction_id = $1 ORDER BY id`,
        [id]
      );

      return this.mapTransactionRow(txResult.rows[0], linesResult.rows);
    });
  }

  async listTransactions(
    ctx: TenantContext,
    filter?: TransactionFilter
  ): Promise<FinanceTransaction[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const conditions: string[] = ['t.tenant_id = $1'];
      const params: unknown[] = [ctx.tenantId];
      let idx = 2;

      if (filter?.type !== undefined) {
        conditions.push(`t.type = $${idx++}`);
        params.push(filter.type);
      }

      if (filter?.fromDate !== undefined) {
        conditions.push(`t.transaction_date >= $${idx++}`);
        params.push(filter.fromDate);
      }

      if (filter?.toDate !== undefined) {
        conditions.push(`t.transaction_date <= $${idx++}`);
        params.push(filter.toDate);
      }

      // For fundId/accountId filters, we need to join with lines
      let joinClause = '';
      if (filter?.fundId !== undefined || filter?.accountId !== undefined) {
        joinClause = `
          JOIN finance_transaction_lines l ON l.transaction_id = t.id
        `;

        if (filter?.fundId !== undefined) {
          conditions.push(`l.fund_id = $${idx++}`);
          params.push(filter.fundId);
        }

        if (filter?.accountId !== undefined) {
          conditions.push(`l.account_id = $${idx++}`);
          params.push(filter.accountId);
        }
      }

      const txResult = await client.query<TransactionRow>(
        `
        SELECT DISTINCT t.*
        FROM finance_transactions t
        ${joinClause}
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.transaction_date DESC, t.created_at DESC
        `,
        params
      );

      // Fetch lines for each transaction
      const transactions: FinanceTransaction[] = [];
      for (const txRow of txResult.rows) {
        const linesResult = await client.query<TransactionLineRow>(
          `SELECT * FROM finance_transaction_lines WHERE transaction_id = $1 ORDER BY id`,
          [txRow.id]
        );
        transactions.push(this.mapTransactionRow(txRow, linesResult.rows));
      }

      return transactions;
    });
  }

  // ===========================================================================
  // APPROPRIATION OPERATIONS
  // ===========================================================================

  async createAppropriation(
    ctx: TenantContext,
    input: CreateAppropriationInput
  ): Promise<Appropriation> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Validate fund exists
      const fundCheck = await client.query(
        `SELECT id FROM funds WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, input.fundId]
      );
      if (fundCheck.rows.length === 0) {
        throw new Error(`Fund not found: ${input.fundId}`);
      }

      // Validate account exists
      const accountCheck = await client.query(
        `SELECT id FROM accounts WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, input.accountId]
      );
      if (accountCheck.rows.length === 0) {
        throw new Error(`Account not found: ${input.accountId}`);
      }

      const result = await client.query<AppropriationRow>(
        `
        INSERT INTO appropriations (
          tenant_id, fund_id, account_id, budget_year,
          adopted_amount_cents, additional_appropriation_cents, reductions_cents,
          ordinance_number, adopted_date,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
        RETURNING *
        `,
        [
          ctx.tenantId,
          input.fundId,
          input.accountId,
          input.budgetYear,
          input.adoptedAmountCents,
          input.additionalAppropriationCents ?? 0,
          input.reductionsCents ?? 0,
          input.ordinanceNumber ?? null,
          input.adoptedDate ?? null,
        ]
      );

      return this.mapAppropriationRow(result.rows[0]);
    });
  }

  async getAppropriation(
    ctx: TenantContext,
    id: string
  ): Promise<Appropriation | null> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const result = await client.query<AppropriationRow>(
        `SELECT * FROM appropriations WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, id]
      );

      return result.rows.length > 0
        ? this.mapAppropriationRow(result.rows[0])
        : null;
    });
  }

  async listAppropriations(
    ctx: TenantContext,
    filter?: AppropriationFilter
  ): Promise<Appropriation[]> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      const conditions: string[] = ['tenant_id = $1'];
      const params: unknown[] = [ctx.tenantId];
      let idx = 2;

      if (filter?.budgetYear !== undefined) {
        conditions.push(`budget_year = $${idx++}`);
        params.push(filter.budgetYear);
      }

      if (filter?.fundId !== undefined) {
        conditions.push(`fund_id = $${idx++}`);
        params.push(filter.fundId);
      }

      if (filter?.accountId !== undefined) {
        conditions.push(`account_id = $${idx++}`);
        params.push(filter.accountId);
      }

      const result = await client.query<AppropriationRow>(
        `SELECT * FROM appropriations WHERE ${conditions.join(' AND ')} ORDER BY budget_year DESC, created_at DESC`,
        params
      );

      return result.rows.map((row) => this.mapAppropriationRow(row));
    });
  }

  async updateAppropriation(
    ctx: TenantContext,
    id: string,
    input: UpdateAppropriationInput
  ): Promise<Appropriation> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // First check if appropriation exists
      const existing = await client.query<AppropriationRow>(
        `SELECT * FROM appropriations WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, id]
      );

      if (existing.rows.length === 0) {
        throw new Error('Appropriation not found for tenant');
      }

      // Build dynamic update
      const updates: string[] = [];
      const params: unknown[] = [ctx.tenantId, id];
      let paramIdx = 3;

      if (input.additionalAppropriationCents !== undefined) {
        updates.push(`additional_appropriation_cents = $${paramIdx++}`);
        params.push(input.additionalAppropriationCents);
      }
      if (input.reductionsCents !== undefined) {
        updates.push(`reductions_cents = $${paramIdx++}`);
        params.push(input.reductionsCents);
      }
      if (input.ordinanceNumber !== undefined) {
        updates.push(`ordinance_number = $${paramIdx++}`);
        params.push(input.ordinanceNumber);
      }

      updates.push(`updated_at = now()`);

      const result = await client.query<AppropriationRow>(
        `UPDATE appropriations SET ${updates.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`,
        params
      );

      return this.mapAppropriationRow(result.rows[0]);
    });
  }

  // ===========================================================================
  // SUMMARY OPERATIONS
  // ===========================================================================

  /**
   * Get fund balance summary as of a specific date.
   *
   * Calculation logic:
   * - Walk all transaction lines for the specified fund up to asOfDate
   * - For CASH accounts: debits increase balance, credits decrease balance
   * - Encumbrances are not yet tracked (placeholder 0)
   *
   * Standard double-entry rules:
   * - Receipts: debit CASH (increase), credit REVENUE
   * - Disbursements: credit CASH (decrease), debit EXPENDITURE
   */
  async getFundBalanceSummary(
    ctx: TenantContext,
    fundId: string,
    asOfDate: string
  ): Promise<FundBalanceSummary> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Validate fund exists
      const fundCheck = await client.query(
        `SELECT id FROM funds WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, fundId]
      );

      if (fundCheck.rows.length === 0) {
        throw new Error('Fund not found for tenant');
      }

      // Calculate cash balance
      // For CASH accounts: debits increase balance, credits decrease
      const result = await client.query<{ cash_balance_cents: string | null }>(
        `
        SELECT
          COALESCE(SUM(
            CASE
              WHEN a.category = 'CASH' AND l.is_debit THEN l.amount_cents
              WHEN a.category = 'CASH' AND NOT l.is_debit THEN -l.amount_cents
              ELSE 0
            END
          ), 0) AS cash_balance_cents
        FROM finance_transaction_lines l
        JOIN finance_transactions t ON t.id = l.transaction_id
        JOIN accounts a ON a.id = l.account_id
        WHERE l.tenant_id = $1
          AND l.fund_id = $2
          AND t.transaction_date <= $3
        `,
        [ctx.tenantId, fundId, asOfDate]
      );

      const cashBalanceCents = Number(result.rows[0].cash_balance_cents ?? 0);

      // Encumbrances are placeholder 0 for now (TODO: implement encumbrance tracking)
      const encumberedCents = 0;
      const availableCents = cashBalanceCents - encumberedCents;

      return {
        fundId,
        asOfDate,
        cashBalanceCents,
        encumberedCents,
        availableCents,
      };
    });
  }

  /**
   * Get appropriation usage summary.
   *
   * Calculation logic:
   * - Find the appropriation
   * - Sum all transaction lines that reference this appropriation
   * - Only count debits to EXPENDITURE accounts as "expended"
   * - Encumbrances are placeholder 0 for now
   * - availableCents = adopted + additional - reductions - expended - encumbered
   */
  async getAppropriationUsageSummary(
    ctx: TenantContext,
    appropriationId: string
  ): Promise<AppropriationUsageSummary> {
    return this.db.withTenant(ctx.tenantId, async (client) => {
      // Get appropriation
      const appResult = await client.query<AppropriationRow>(
        `SELECT * FROM appropriations WHERE tenant_id = $1 AND id = $2`,
        [ctx.tenantId, appropriationId]
      );

      if (appResult.rows.length === 0) {
        throw new Error('Appropriation not found for tenant');
      }

      const appropriation = appResult.rows[0];

      // Sum expenditures for this appropriation
      // Count debits to expenditure accounts that reference this appropriation
      const expendResult = await client.query<{ expended_cents: string | null }>(
        `
        SELECT
          COALESCE(SUM(
            CASE
              WHEN a.category = 'EXPENDITURE' AND l.is_debit THEN l.amount_cents
              ELSE 0
            END
          ), 0) AS expended_cents
        FROM finance_transaction_lines l
        JOIN accounts a ON a.id = l.account_id
        WHERE l.tenant_id = $1
          AND l.appropriation_id = $2
        `,
        [ctx.tenantId, appropriationId]
      );

      const expendedCents = Number(expendResult.rows[0].expended_cents ?? 0);

      // Encumbrances are placeholder 0 for now (TODO: implement encumbrance tracking)
      const encumberedCents = 0;

      const adoptedAmountCents = Number(appropriation.adopted_amount_cents);
      const additionalAppropriationCents = Number(
        appropriation.additional_appropriation_cents
      );
      const reductionsCents = Number(appropriation.reductions_cents);

      const availableCents =
        adoptedAmountCents +
        additionalAppropriationCents -
        reductionsCents -
        expendedCents -
        encumberedCents;

      return {
        appropriationId,
        budgetYear: appropriation.budget_year,
        adoptedAmountCents,
        additionalAppropriationCents,
        reductionsCents,
        expendedCents,
        encumberedCents,
        availableCents,
      };
    });
  }

  // ===========================================================================
  // ROW MAPPING HELPERS
  // ===========================================================================

  private mapFundRow(row: FundRow): Fund {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      type: row.type as FundType,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      sboaCode: row.sboa_code ?? undefined,
      dlgfFundNumber: row.dlgf_fund_number ?? undefined,
      isMajorFund: row.is_major_fund ?? undefined,
      description: row.description ?? undefined,
    };
  }

  private mapAccountRow(row: AccountRow): Account {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      name: row.name,
      category: row.category as AccountCategory,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      sboaCode: row.sboa_code ?? undefined,
      description: row.description ?? undefined,
    };
  }

  private mapTransactionRow(
    row: TransactionRow,
    lineRows: TransactionLineRow[]
  ): FinanceTransaction {
    // Format date as ISO string (YYYY-MM-DD)
    const transactionDate =
      row.transaction_date instanceof Date
        ? row.transaction_date.toISOString().split('T')[0]
        : String(row.transaction_date);

    return {
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type as FinanceTransactionType,
      transactionDate,
      reference: row.reference ?? undefined,
      description: row.description,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      lines: lineRows.map((lineRow) => this.mapTransactionLineRow(lineRow)),
    };
  }

  private mapTransactionLineRow(row: TransactionLineRow): FinanceTransactionLine {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      transactionId: row.transaction_id,
      fundId: row.fund_id,
      accountId: row.account_id,
      amountCents: Number(row.amount_cents),
      isDebit: row.is_debit,
      appropriationId: row.appropriation_id ?? undefined,
      memo: row.memo ?? undefined,
    };
  }

  private mapAppropriationRow(row: AppropriationRow): Appropriation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      fundId: row.fund_id,
      accountId: row.account_id,
      budgetYear: row.budget_year,
      adoptedAmountCents: Number(row.adopted_amount_cents),
      additionalAppropriationCents: Number(row.additional_appropriation_cents),
      reductionsCents: Number(row.reductions_cents),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      ordinanceNumber: row.ordinance_number ?? undefined,
      adoptedDate: row.adopted_date
        ? row.adopted_date.toISOString().split('T')[0]
        : undefined,
    };
  }
}
