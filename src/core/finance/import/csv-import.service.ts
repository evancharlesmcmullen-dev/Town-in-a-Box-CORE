// src/core/finance/import/csv-import.service.ts

/**
 * Town-in-a-Box Finance Engine - CSV Import Service
 *
 * Convenience wrapper for importing CSV data using the Import Engine.
 * Provides a simplified API for common import scenarios.
 */

import {
  ImportProfile,
  ImportResult,
  ImportValidationResult,
  ImportOptions,
  ImportMappingContext,
  MappedTransaction,
  ParsedRow,
} from './import.types';
import { createImportEngine, DefaultImportEngine } from './import.engine';
import { getBuiltInProfile, GENERIC_TRANSACTION_CSV } from './import.profiles';
import { TransactionType, Fund, Account, Vendor } from '../finance.types';

// ============================================================================
// SIMPLE IMPORT TYPES
// ============================================================================

/**
 * Simplified imported transaction for quick imports.
 */
export interface SimpleImportedTransaction {
  date: Date;
  amount: number;
  type: TransactionType;
  description?: string;
  fundCode?: string;
  accountCode?: string;
  checkNumber?: string;
  vendorName?: string;
  externalRef?: string;
  raw?: Record<string, unknown>;
}

/**
 * Simple import result for convenience API.
 */
export interface SimpleImportResult {
  tenantId: string;
  profileId: string;
  importedTransactions: SimpleImportedTransaction[];
  warnings: Array<{ rowIndex: number; message: string }>;
  errors: Array<{ rowIndex: number; message: string }>;
  success: boolean;
  summary: string;
}

// ============================================================================
// CSV IMPORT SERVICE
// ============================================================================

/**
 * Import transactions from raw CSV text.
 *
 * This is the primary convenience function for importing CSV data.
 * It handles parsing, validation, and mapping in one call.
 *
 * @param tenantId - The tenant ID for the import
 * @param profile - The import profile to use
 * @param rawCsv - Raw CSV text content
 * @returns A simplified import result
 *
 * @example
 * ```ts
 * const result = await importTransactionsFromCsv(
 *   'tenant-123',
 *   GENERIC_TRANSACTION_CSV,
 *   `Date,Amount,Description,Type,Fund,Account
 *    01/15/2024,1000.00,Property Tax Receipt,Receipt,101,4100
 *    01/16/2024,500.00,Office Supplies,Disbursement,101,5200`
 * );
 *
 * console.log(result.importedTransactions.length); // 2
 * ```
 */
export async function importTransactionsFromCsv(
  tenantId: string,
  profile: ImportProfile,
  rawCsv: string
): Promise<SimpleImportResult> {
  const engine = createImportEngine() as DefaultImportEngine;

  const warnings: Array<{ rowIndex: number; message: string }> = [];
  const errors: Array<{ rowIndex: number; message: string }> = [];
  const importedTransactions: SimpleImportedTransaction[] = [];

  // Handle empty input
  const trimmedCsv = rawCsv.trim();
  if (!trimmedCsv) {
    return {
      tenantId,
      profileId: profile.id,
      importedTransactions: [],
      warnings: [],
      errors: [{ rowIndex: -1, message: 'Empty CSV content' }],
      success: false,
      summary: 'Import failed: empty CSV content',
    };
  }

  try {
    // Parse the CSV
    const rows = await engine.parseFile(trimmedCsv, profile.parseOptions || {});

    if (rows.length === 0) {
      return {
        tenantId,
        profileId: profile.id,
        importedTransactions: [],
        warnings: [],
        errors: [{ rowIndex: -1, message: 'No data rows found in CSV' }],
        success: false,
        summary: 'Import failed: no data rows found',
      };
    }

    // Create a minimal mapping context
    const context: ImportMappingContext = {
      tenantId,
      fundsByCode: new Map<string, Fund>(),
      accountsByKey: new Map<string, Account>(),
      vendorsByName: new Map<string, Vendor>(),
      autoCreateFunds: true,
      autoCreateAccounts: true,
      autoCreateVendors: true,
    };

    // Validate
    const validationResult = await engine.validate(rows, profile, context);

    // Collect errors and warnings
    for (const err of validationResult.errors) {
      errors.push({
        rowIndex: err.rowNumber,
        message: err.message,
      });
    }

    for (const warn of validationResult.warnings) {
      warnings.push({
        rowIndex: warn.rowNumber,
        message: warn.message,
      });
    }

    // Convert valid rows to SimpleImportedTransaction
    if (validationResult.preview) {
      for (const row of validationResult.preview) {
        if (row.isValid) {
          const mapped = row.mapped as Record<string, unknown>;
          importedTransactions.push({
            date: mapped.transactionDate as Date,
            amount: mapped.amount as number,
            type: (mapped.type as TransactionType) || 'DISBURSEMENT',
            description: mapped.description as string | undefined,
            fundCode: mapped.fundCode as string | undefined,
            accountCode: mapped.accountCode as string | undefined,
            checkNumber: mapped.checkNumber as string | undefined,
            vendorName: mapped.vendorName as string | undefined,
            externalRef: mapped.externalRef as string | undefined,
            raw: row.raw,
          });
        }
      }
    }

    const success = errors.length === 0;
    const summary = success
      ? `Successfully processed ${importedTransactions.length} transactions`
      : `Import completed with ${errors.length} errors and ${warnings.length} warnings`;

    return {
      tenantId,
      profileId: profile.id,
      importedTransactions,
      warnings,
      errors,
      success,
      summary,
    };
  } catch (error) {
    return {
      tenantId,
      profileId: profile.id,
      importedTransactions: [],
      warnings: [],
      errors: [{ rowIndex: -1, message: `Parse error: ${String(error)}` }],
      success: false,
      summary: `Import failed: ${String(error)}`,
    };
  }
}

/**
 * Import transactions using the generic CSV profile.
 *
 * Convenience function that uses the built-in generic transaction profile.
 *
 * @param tenantId - The tenant ID
 * @param rawCsv - Raw CSV content
 * @returns Simple import result
 */
export async function importGenericTransactionCsv(
  tenantId: string,
  rawCsv: string
): Promise<SimpleImportResult> {
  return importTransactionsFromCsv(tenantId, GENERIC_TRANSACTION_CSV, rawCsv);
}

/**
 * Validate CSV without importing.
 *
 * Useful for previewing data before committing to an import.
 *
 * @param profile - The import profile
 * @param rawCsv - Raw CSV content
 * @returns Validation result with preview
 */
export async function validateCsv(
  profile: ImportProfile,
  rawCsv: string
): Promise<ImportValidationResult> {
  const engine = createImportEngine() as DefaultImportEngine;

  const rows = await engine.parseFile(rawCsv, profile.parseOptions || {});

  const context: ImportMappingContext = {
    tenantId: 'validation',
    fundsByCode: new Map(),
    accountsByKey: new Map(),
    vendorsByName: new Map(),
  };

  return engine.validate(rows, profile, context);
}

/**
 * Get column headers from a CSV file.
 *
 * Useful for building dynamic column mappings.
 *
 * @param rawCsv - Raw CSV content
 * @param delimiter - CSV delimiter (default: comma)
 * @returns Array of column header names
 */
export function getCsvHeaders(rawCsv: string, delimiter: string = ','): string[] {
  const lines = rawCsv.split(/\r?\n/);
  if (lines.length === 0) return [];

  const firstLine = lines[0].trim();
  if (!firstLine) return [];

  // Simple header parsing (doesn't handle quoted headers)
  return firstLine.split(delimiter).map((h) => h.trim());
}

/**
 * Create a custom import profile for a specific CSV format.
 *
 * @param id - Unique profile ID
 * @param name - Display name
 * @param columnMappings - Map of source column names to target fields
 * @returns Custom ImportProfile
 */
export function createCustomCsvProfile(
  id: string,
  name: string,
  columnMappings: Record<string, string>
): ImportProfile {
  const mappings = Object.entries(columnMappings).map(([source, target]) => ({
    sourceColumn: source,
    targetField: target,
    transform: inferTransform(target) as
      | 'parseDateUS'
      | 'parseAmount'
      | 'mapTransactionType'
      | 'trim'
      | 'fundCodePad'
      | 'accountCodePad'
      | 'none',
    required: ['transactionDate', 'amount', 'description'].includes(target),
  }));

  return {
    id,
    name,
    description: `Custom CSV profile: ${name}`,
    vendor: 'CUSTOM',
    fileType: 'CSV',
    dataType: 'TRANSACTIONS',
    isSystem: false,
    parseOptions: {
      hasHeader: true,
      delimiter: ',',
      trimValues: true,
    },
    mappings,
    validationRules: [],
  };
}

/**
 * Infer transform function based on target field name.
 */
function inferTransform(targetField: string): string {
  if (targetField.toLowerCase().includes('date')) {
    return 'parseDateUS';
  }
  if (targetField.toLowerCase().includes('amount')) {
    return 'parseAmount';
  }
  if (targetField === 'type') {
    return 'mapTransactionType';
  }
  if (targetField === 'fundCode') {
    return 'fundCodePad';
  }
  if (targetField === 'accountCode') {
    return 'accountCodePad';
  }
  return 'trim';
}

/**
 * Get all available import profiles.
 *
 * @param tenantId - Optional tenant ID for custom profiles
 * @returns Array of available import profiles
 */
export function getAvailableProfiles(tenantId?: string): ImportProfile[] {
  const engine = createImportEngine();
  return engine.getProfiles(tenantId);
}

/**
 * Get a specific import profile by ID.
 *
 * @param profileId - The profile ID
 * @returns The import profile, or undefined if not found
 */
export function getProfile(profileId: string): ImportProfile | undefined {
  return getBuiltInProfile(profileId);
}
