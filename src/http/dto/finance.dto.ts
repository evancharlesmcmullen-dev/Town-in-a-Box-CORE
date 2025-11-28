// src/http/dto/finance.dto.ts
//
// HTTP DTOs for Finance Ledger API.
// Keeps HTTP contracts clean and versionable.

import {
  FundType,
  AccountCategory,
  FinanceTransactionType,
} from '../../engines/finance/finance.types';

// =============================================================================
// FUND DTOs
// =============================================================================

/**
 * Request body for creating a new fund.
 */
export interface CreateFundBody {
  code: string;
  name: string;
  type: FundType;
  isActive?: boolean;
  sboaCode?: string;
  dlgfFundNumber?: string;
  isMajorFund?: boolean;
  description?: string;
}

/**
 * Request body for updating an existing fund.
 */
export interface UpdateFundBody {
  name?: string;
  type?: FundType;
  isActive?: boolean;
  sboaCode?: string;
  dlgfFundNumber?: string;
  isMajorFund?: boolean;
  description?: string;
}

// =============================================================================
// ACCOUNT DTOs
// =============================================================================

/**
 * Request body for creating a new account.
 */
export interface CreateAccountBody {
  code: string;
  name: string;
  category: AccountCategory;
  isActive?: boolean;
  sboaCode?: string;
  description?: string;
}

/**
 * Request body for updating an existing account.
 */
export interface UpdateAccountBody {
  name?: string;
  category?: AccountCategory;
  isActive?: boolean;
  sboaCode?: string;
  description?: string;
}

/**
 * Query parameters for listing accounts.
 */
export interface ListAccountsQuery {
  category?: AccountCategory;
  isActive?: boolean;
}

// =============================================================================
// TRANSACTION DTOs
// =============================================================================

/**
 * Request body for a transaction line item.
 */
export interface CreateTransactionLineBody {
  fundId: string;
  accountId: string;
  amountCents: number;
  isDebit: boolean;
  appropriationId?: string;
  memo?: string;
}

/**
 * Request body for creating a new transaction.
 */
export interface CreateTransactionBody {
  type: FinanceTransactionType;
  transactionDate: string;
  reference?: string;
  description: string;
  lines: CreateTransactionLineBody[];
}

/**
 * Query parameters for listing transactions.
 */
export interface ListTransactionsQuery {
  fundId?: string;
  accountId?: string;
  fromDate?: string;
  toDate?: string;
  type?: FinanceTransactionType;
}

// =============================================================================
// APPROPRIATION DTOs
// =============================================================================

/**
 * Request body for creating a new appropriation.
 */
export interface CreateAppropriationBody {
  fundId: string;
  accountId: string;
  budgetYear: number;
  adoptedAmountCents: number;
  additionalAppropriationCents?: number;
  reductionsCents?: number;
  ordinanceNumber?: string;
  adoptedDate?: string;
}

/**
 * Request body for updating an existing appropriation.
 */
export interface UpdateAppropriationBody {
  additionalAppropriationCents?: number;
  reductionsCents?: number;
  ordinanceNumber?: string;
}

/**
 * Query parameters for listing appropriations.
 */
export interface ListAppropriationsQuery {
  budgetYear?: number;
  fundId?: string;
  accountId?: string;
}

// =============================================================================
// SUMMARY DTOs
// =============================================================================

/**
 * Query parameters for fund balance summary.
 */
export interface FundBalanceSummaryQuery {
  asOfDate: string;
}

/**
 * Response for appropriation usage summary.
 */
export interface AppropriationUsageSummaryResponse {
  appropriationId: string;
  budgetYear: number;
  adoptedAmountCents: number;
  additionalAppropriationCents: number;
  reductionsCents: number;
  expendedCents: number;
  encumberedCents: number;
  availableCents: number;
}
