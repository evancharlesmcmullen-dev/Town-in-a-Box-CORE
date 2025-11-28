// src/core/finance/import/import.types.ts

/**
 * Town-in-a-Box Finance Engine - Import Types
 *
 * Types for importing data from legacy vendors and spreadsheets.
 * Supports various file formats and column mappings.
 */

import {
  Transaction,
  TransactionType,
  Fund,
  Account,
  BudgetLine,
  Vendor,
  ImportError,
  ImportWarning,
} from '../finance.types';

// ============================================================================
// IMPORT SOURCE TYPES
// ============================================================================

/**
 * Supported import file types.
 */
export type ImportFileType =
  | 'CSV'
  | 'XLSX'
  | 'XLS'
  | 'JSON'
  | 'OFX'        // Open Financial Exchange (bank feeds)
  | 'QIF'        // Quicken Interchange Format
  | 'GATEWAY';   // Indiana Gateway exports

/**
 * Import data type being imported.
 */
export type ImportDataType =
  | 'TRANSACTIONS'
  | 'BUDGET'
  | 'CHART_OF_ACCOUNTS'
  | 'VENDORS'
  | 'FUNDS'
  | 'OPENING_BALANCES';

/**
 * Known vendor systems for pre-configured mappings.
 */
export type KnownVendor =
  | 'GENERIC'           // Generic CSV/XLSX
  | 'QUICKBOOKS'
  | 'SAGE'
  | 'CASELLE'
  | 'BS_AND_A'          // BS&A Software
  | 'KEYSTONE'
  | 'ACCUFUND'
  | 'MUNIS'
  | 'INCODE'
  | 'GATEWAY'           // Indiana Gateway exports
  | 'CUSTOM';           // User-defined mapping

// ============================================================================
// COLUMN MAPPING
// ============================================================================

/**
 * Mapping from source columns to destination fields.
 */
export interface ColumnMapping {
  /** Source column name or index (0-based) */
  sourceColumn: string | number;

  /** Target field name on the entity */
  targetField: string;

  /** Transform function name (e.g., 'parseDate', 'parseAmount') */
  transform?: TransformFunction;

  /** Default value if source is empty */
  defaultValue?: unknown;

  /** Whether this field is required */
  required?: boolean;

  /** Validation regex pattern */
  validationPattern?: string;

  /** Custom validation function name */
  customValidator?: string;
}

/**
 * Built-in transform functions.
 */
export type TransformFunction =
  | 'parseDate'
  | 'parseDateUS'       // MM/DD/YYYY
  | 'parseDateISO'      // YYYY-MM-DD
  | 'parseAmount'
  | 'parseAmountNegativeParens' // (100.00) = -100.00
  | 'parseBoolean'
  | 'parseInteger'
  | 'trim'
  | 'uppercase'
  | 'lowercase'
  | 'fundCodePad'       // Pad fund code to 3 digits
  | 'accountCodePad'    // Pad account code to 4 digits
  | 'mapTransactionType'
  | 'none';

// ============================================================================
// IMPORT PROFILE
// ============================================================================

/**
 * Import profile defining how to read and map data.
 */
export interface ImportProfile {
  /** Unique profile identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description?: string;

  /** Known vendor for pre-configured settings */
  vendor: KnownVendor;

  /** File type this profile handles */
  fileType: ImportFileType;

  /** Type of data being imported */
  dataType: ImportDataType;

  /** Column mappings */
  mappings: ColumnMapping[];

  /** File parsing options */
  parseOptions?: ParseOptions;

  /** Validation rules */
  validationRules?: ValidationRule[];

  /** Whether this profile is system-defined or user-created */
  isSystem: boolean;

  /** Tenant ID for user-created profiles */
  tenantId?: string;
}

/**
 * File parsing options.
 */
export interface ParseOptions {
  /** CSV delimiter (default: comma) */
  delimiter?: string;

  /** Whether file has header row */
  hasHeader?: boolean;

  /** Number of header rows to skip */
  skipRows?: number;

  /** Sheet name for Excel files */
  sheetName?: string;

  /** Sheet index for Excel files (0-based) */
  sheetIndex?: number;

  /** Date format string */
  dateFormat?: string;

  /** Number decimal separator */
  decimalSeparator?: string;

  /** Encoding (default: UTF-8) */
  encoding?: string;

  /** Trim whitespace from values */
  trimValues?: boolean;
}

/**
 * Validation rule for imported data.
 */
export interface ValidationRule {
  /** Rule ID */
  id: string;

  /** Human-readable description */
  description: string;

  /** Field(s) this rule applies to */
  fields: string[];

  /** Rule type */
  type: 'required' | 'format' | 'range' | 'lookup' | 'custom';

  /** Severity if rule fails */
  severity: 'error' | 'warning';

  /** Rule parameters */
  params?: Record<string, unknown>;
}

// ============================================================================
// IMPORT RESULT
// ============================================================================

/**
 * Result of a validation pass.
 */
export interface ImportValidationResult {
  /** Whether validation passed */
  isValid: boolean;

  /** Total rows processed */
  totalRows: number;

  /** Rows that passed validation */
  validRows: number;

  /** Rows with errors */
  errorRows: number;

  /** Rows with warnings */
  warningRows: number;

  /** Detailed errors by row */
  errors: ImportError[];

  /** Detailed warnings by row */
  warnings: ImportWarning[];

  /** Preview of valid data (first N rows) */
  preview?: ParsedRow[];

  /** Column statistics */
  columnStats?: ColumnStats[];
}

/**
 * Result of an import operation.
 */
export interface ImportResult<T = unknown> {
  /** Whether import succeeded */
  success: boolean;

  /** Import batch ID for tracking */
  batchId: string;

  /** Total rows in source */
  totalRows: number;

  /** Successfully imported rows */
  successfulRows: number;

  /** Failed rows */
  failedRows: number;

  /** Rows with warnings */
  warningRows: number;

  /** Imported entities */
  imported: T[];

  /** Skipped rows with reasons */
  skipped: SkippedRow[];

  /** Errors encountered */
  errors: ImportError[];

  /** Warnings generated */
  warnings: ImportWarning[];

  /** Duration in milliseconds */
  durationMs: number;

  /** Summary message */
  summary: string;
}

/**
 * A parsed row from the source file.
 */
export interface ParsedRow {
  /** Row number in source (1-based) */
  rowNumber: number;

  /** Raw values from source */
  raw: Record<string, unknown>;

  /** Mapped values */
  mapped: Record<string, unknown>;

  /** Whether row is valid */
  isValid: boolean;

  /** Row-level errors */
  errors: ImportError[];

  /** Row-level warnings */
  warnings: ImportWarning[];
}

/**
 * Skipped row with reason.
 */
export interface SkippedRow {
  rowNumber: number;
  reason: string;
  raw?: Record<string, unknown>;
}

/**
 * Statistics for a column.
 */
export interface ColumnStats {
  columnName: string;
  totalValues: number;
  nonEmptyValues: number;
  uniqueValues: number;
  sampleValues: unknown[];
  detectedType: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
}

// ============================================================================
// IMPORT OPTIONS
// ============================================================================

/**
 * Options for import operation.
 */
export interface ImportOptions {
  /** Tenant ID */
  tenantId: string;

  /** Import profile to use */
  profileId: string;

  /** Skip validation (use with caution) */
  skipValidation?: boolean;

  /** Continue on row errors */
  continueOnError?: boolean;

  /** Maximum errors before stopping */
  maxErrors?: number;

  /** Dry run - validate only, don't import */
  dryRun?: boolean;

  /** Overwrite existing records with same key */
  overwriteExisting?: boolean;

  /** User ID performing the import */
  userId?: string;

  /** Additional context for logging */
  context?: Record<string, unknown>;
}

// ============================================================================
// TRANSACTION-SPECIFIC TYPES
// ============================================================================

/**
 * Raw transaction row before mapping.
 */
export interface RawTransactionRow {
  date?: string;
  amount?: string | number;
  description?: string;
  type?: string;
  fundCode?: string;
  accountCode?: string;
  checkNumber?: string;
  vendorName?: string;
  reference?: string;
  [key: string]: unknown;
}

/**
 * Mapped transaction ready for import.
 */
export interface MappedTransaction {
  transactionDate: Date;
  amount: number;
  description: string;
  type: TransactionType;
  fundId?: string;
  fundCode?: string;
  accountId?: string;
  accountCode?: string;
  checkNumber?: string;
  vendorId?: string;
  vendorName?: string;
  externalRef?: string;
  memo?: string;
}

// ============================================================================
// FUND/ACCOUNT MAPPING CONTEXT
// ============================================================================

/**
 * Context for resolving fund and account codes during import.
 */
export interface ImportMappingContext {
  /** Tenant ID */
  tenantId: string;

  /** Existing funds by code */
  fundsByCode: Map<string, Fund>;

  /** Existing accounts by fund+code */
  accountsByKey: Map<string, Account>;

  /** Existing vendors by name (normalized) */
  vendorsByName: Map<string, Vendor>;

  /** Transaction type mapping */
  transactionTypeMap?: Record<string, TransactionType>;

  /** Auto-create missing funds */
  autoCreateFunds?: boolean;

  /** Auto-create missing accounts */
  autoCreateAccounts?: boolean;

  /** Auto-create missing vendors */
  autoCreateVendors?: boolean;
}

// ============================================================================
// IMPORT ENGINE INTERFACE
// ============================================================================

/**
 * Import engine interface for processing imports.
 */
export interface ImportEngine {
  /**
   * Parse a file and return raw rows.
   */
  parseFile(
    content: Buffer | string,
    options: ParseOptions
  ): Promise<Record<string, unknown>[]>;

  /**
   * Validate data against profile and rules.
   */
  validate(
    rows: Record<string, unknown>[],
    profile: ImportProfile,
    context: ImportMappingContext
  ): Promise<ImportValidationResult>;

  /**
   * Import data into the system.
   */
  import<T>(
    rows: ParsedRow[],
    profile: ImportProfile,
    options: ImportOptions,
    context: ImportMappingContext
  ): Promise<ImportResult<T>>;

  /**
   * Get available import profiles.
   */
  getProfiles(tenantId?: string): ImportProfile[];

  /**
   * Get a specific profile.
   */
  getProfile(profileId: string): ImportProfile | undefined;
}
