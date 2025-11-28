// src/core/finance/import/import.engine.ts

/**
 * Town-in-a-Box Finance Engine - Import Engine
 *
 * Core import engine for processing CSV, XLSX, and other file formats.
 */

import {
  ImportEngine,
  ImportProfile,
  ImportValidationResult,
  ImportResult,
  ImportOptions,
  ImportMappingContext,
  ParseOptions,
  ParsedRow,
  ColumnMapping,
  TransformFunction,
  ColumnStats,
  SkippedRow,
} from './import.types';
import { ImportError, ImportWarning, TransactionType } from '../finance.types';
import { BUILT_IN_PROFILES, getBuiltInProfile } from './import.profiles';

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Parse a date string in US format (MM/DD/YYYY).
 */
function parseDateUS(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Try MM/DD/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
    const date = new Date(fullYear, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Try ISO format
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) return isoDate;

  return null;
}

/**
 * Parse a date string in ISO format (YYYY-MM-DD).
 */
function parseDateISO(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  const date = new Date(str);
  if (!isNaN(date.getTime())) return date;

  return null;
}

/**
 * Parse an amount string to number.
 */
function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') return value;

  let str = String(value).trim();

  // Remove currency symbols and commas
  str = str.replace(/[$,]/g, '');

  // Handle negative in parentheses: (100.00) -> -100.00
  if (str.startsWith('(') && str.endsWith(')')) {
    str = '-' + str.slice(1, -1);
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Parse amount with negative in parentheses.
 */
function parseAmountNegativeParens(value: unknown): number | null {
  return parseAmount(value);
}

/**
 * Parse a boolean value.
 */
function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const str = String(value).toLowerCase().trim();
  return ['true', 'yes', '1', 'y', 'x'].includes(str);
}

/**
 * Parse an integer value.
 */
function parseInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Math.round(value);

  const num = parseInt(String(value), 10);
  return isNaN(num) ? null : num;
}

/**
 * Pad fund code to 3 digits.
 */
function fundCodePad(value: unknown): string {
  if (!value) return '';
  const str = String(value).trim();
  // If it's numeric, pad to 3 digits
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 0) {
    return num.toString().padStart(3, '0');
  }
  return str;
}

/**
 * Pad account code to 4 digits.
 */
function accountCodePad(value: unknown): string {
  if (!value) return '';
  const str = String(value).trim();
  // If it's numeric, pad to 4 digits
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 0) {
    return num.toString().padStart(4, '0');
  }
  return str;
}

/**
 * Map string to transaction type.
 */
function mapTransactionType(value: unknown): TransactionType {
  if (!value) return 'DISBURSEMENT';

  const str = String(value).toLowerCase().trim();

  // Receipt keywords
  if (
    str.includes('receipt') ||
    str.includes('deposit') ||
    str.includes('income') ||
    str.includes('revenue') ||
    str.includes('credit')
  ) {
    return 'RECEIPT';
  }

  // Transfer keywords
  if (str.includes('transfer') || str.includes('xfer')) {
    return 'TRANSFER';
  }

  // Adjustment keywords
  if (
    str.includes('adjust') ||
    str.includes('correction') ||
    str.includes('void')
  ) {
    return 'ADJUSTMENT';
  }

  // Default to disbursement
  return 'DISBURSEMENT';
}

/**
 * Apply a transform function to a value.
 */
function applyTransform(
  value: unknown,
  transform: TransformFunction | undefined
): unknown {
  if (!transform || transform === 'none') return value;

  switch (transform) {
    case 'parseDate':
    case 'parseDateUS':
      return parseDateUS(value);
    case 'parseDateISO':
      return parseDateISO(value);
    case 'parseAmount':
      return parseAmount(value);
    case 'parseAmountNegativeParens':
      return parseAmountNegativeParens(value);
    case 'parseBoolean':
      return parseBoolean(value);
    case 'parseInteger':
      return parseInteger(value);
    case 'trim':
      return value != null ? String(value).trim() : value;
    case 'uppercase':
      return value != null ? String(value).toUpperCase() : value;
    case 'lowercase':
      return value != null ? String(value).toLowerCase() : value;
    case 'fundCodePad':
      return fundCodePad(value);
    case 'accountCodePad':
      return accountCodePad(value);
    case 'mapTransactionType':
      return mapTransactionType(value);
    default:
      return value;
  }
}

// ============================================================================
// CSV PARSER
// ============================================================================

/**
 * Parse CSV content into rows.
 */
function parseCSV(
  content: string,
  options: ParseOptions
): Record<string, unknown>[] {
  const delimiter = options.delimiter || ',';
  const hasHeader = options.hasHeader !== false;
  const skipRows = options.skipRows || 0;
  const trimValues = options.trimValues !== false;

  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  // Skip rows if specified
  const dataLines = lines.slice(skipRows);

  if (dataLines.length === 0) return [];

  // Parse header
  let headers: string[];
  let startIndex: number;

  if (hasHeader) {
    headers = parseCSVLine(dataLines[0], delimiter);
    startIndex = 1;
  } else {
    // Generate column names
    const firstLine = parseCSVLine(dataLines[0], delimiter);
    headers = firstLine.map((_, i) => `Column${i + 1}`);
    startIndex = 0;
  }

  // Parse data rows
  const rows: Record<string, unknown>[] = [];

  for (let i = startIndex; i < dataLines.length; i++) {
    const values = parseCSVLine(dataLines[i], delimiter);
    const row: Record<string, unknown> = {};

    for (let j = 0; j < headers.length; j++) {
      let value: unknown = values[j] ?? '';
      if (trimValues && typeof value === 'string') {
        value = value.trim();
      }
      row[headers[j]] = value;
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted values.
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // End of quoted value
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  values.push(current);
  return values;
}

// ============================================================================
// IMPORT ENGINE IMPLEMENTATION
// ============================================================================

/**
 * Default import engine implementation.
 */
export class DefaultImportEngine implements ImportEngine {
  private customProfiles: ImportProfile[] = [];

  /**
   * Parse a file and return raw rows.
   */
  async parseFile(
    content: Buffer | string,
    options: ParseOptions
  ): Promise<Record<string, unknown>[]> {
    const text =
      typeof content === 'string' ? content : content.toString(options.encoding || 'utf-8');

    // Currently only CSV is fully implemented
    // XLSX support would require a library like xlsx or exceljs
    return parseCSV(text, options);
  }

  /**
   * Validate data against profile and rules.
   */
  async validate(
    rows: Record<string, unknown>[],
    profile: ImportProfile,
    context: ImportMappingContext
  ): Promise<ImportValidationResult> {
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];
    const parsedRows: ParsedRow[] = [];

    let validRows = 0;
    let errorRows = 0;
    let warningRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1 + (profile.parseOptions?.skipRows || 0) + (profile.parseOptions?.hasHeader ? 1 : 0);
      const raw = rows[i];
      const rowErrors: ImportError[] = [];
      const rowWarnings: ImportWarning[] = [];

      // Apply mappings
      const mapped: Record<string, unknown> = {};

      for (const mapping of profile.mappings) {
        const sourceKey =
          typeof mapping.sourceColumn === 'number'
            ? Object.keys(raw)[mapping.sourceColumn]
            : mapping.sourceColumn;

        // Try exact match first, then case-insensitive
        let value = raw[sourceKey];
        if (value === undefined) {
          const lowerSource = sourceKey.toLowerCase();
          const key = Object.keys(raw).find((k) => k.toLowerCase() === lowerSource);
          if (key) value = raw[key];
        }

        // Apply default if empty
        if (value === undefined || value === null || value === '') {
          if (mapping.defaultValue !== undefined) {
            value = mapping.defaultValue;
          } else if (mapping.required) {
            rowErrors.push({
              rowNumber,
              field: mapping.targetField,
              errorCode: 'REQUIRED_FIELD',
              message: `Required field '${mapping.targetField}' is missing (source: ${sourceKey})`,
            });
            continue;
          }
        }

        // Apply transform
        const transformed = applyTransform(value, mapping.transform);

        // Validate transformed value
        if (mapping.required && (transformed === null || transformed === undefined || transformed === '')) {
          rowErrors.push({
            rowNumber,
            field: mapping.targetField,
            value: String(value),
            errorCode: 'TRANSFORM_FAILED',
            message: `Failed to transform '${sourceKey}' to ${mapping.targetField}`,
          });
          continue;
        }

        // Set nested property if target contains '.'
        if (mapping.targetField.includes('.')) {
          const parts = mapping.targetField.split('.');
          let obj = mapped;
          for (let j = 0; j < parts.length - 1; j++) {
            if (!obj[parts[j]]) {
              obj[parts[j]] = {};
            }
            obj = obj[parts[j]] as Record<string, unknown>;
          }
          obj[parts[parts.length - 1]] = transformed;
        } else {
          mapped[mapping.targetField] = transformed;
        }
      }

      // Apply validation rules
      for (const rule of profile.validationRules || []) {
        const ruleResult = this.validateRule(rule, mapped, context, rowNumber);
        if (!ruleResult.valid) {
          if (rule.severity === 'error') {
            rowErrors.push({
              rowNumber,
              errorCode: rule.id,
              message: ruleResult.message || rule.description,
            });
          } else {
            rowWarnings.push({
              rowNumber,
              warningCode: rule.id,
              message: ruleResult.message || rule.description,
            });
          }
        }
      }

      // Track row results
      const isValid = rowErrors.length === 0;
      if (isValid) {
        validRows++;
      } else {
        errorRows++;
      }
      if (rowWarnings.length > 0) {
        warningRows++;
      }

      errors.push(...rowErrors);
      warnings.push(...rowWarnings);

      parsedRows.push({
        rowNumber,
        raw,
        mapped,
        isValid,
        errors: rowErrors,
        warnings: rowWarnings,
      });
    }

    // Calculate column statistics
    const columnStats = this.calculateColumnStats(rows);

    return {
      isValid: errorRows === 0,
      totalRows: rows.length,
      validRows,
      errorRows,
      warningRows,
      errors,
      warnings,
      preview: parsedRows.slice(0, 10),
      columnStats,
    };
  }

  /**
   * Import data into the system.
   */
  async import<T>(
    rows: ParsedRow[],
    profile: ImportProfile,
    options: ImportOptions,
    context: ImportMappingContext
  ): Promise<ImportResult<T>> {
    const startTime = Date.now();
    const imported: T[] = [];
    const skipped: SkippedRow[] = [];
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];

    let successfulRows = 0;
    let failedRows = 0;
    let warningRows = 0;
    let errorCount = 0;

    // Generate batch ID
    const batchId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    for (const row of rows) {
      // Skip invalid rows unless continuing on error
      if (!row.isValid) {
        if (options.continueOnError) {
          skipped.push({
            rowNumber: row.rowNumber,
            reason: 'Validation failed',
            raw: row.raw,
          });
          failedRows++;
          errorCount += row.errors.length;

          if (options.maxErrors && errorCount >= options.maxErrors) {
            errors.push({
              rowNumber: row.rowNumber,
              errorCode: 'MAX_ERRORS_REACHED',
              message: `Maximum errors (${options.maxErrors}) reached, stopping import`,
            });
            break;
          }
          continue;
        } else {
          errors.push(...row.errors);
          failedRows++;
          continue;
        }
      }

      // In dry run mode, just track what would be imported
      if (options.dryRun) {
        imported.push(row.mapped as T);
        successfulRows++;
        continue;
      }

      // TODO: Actually save to repository based on profile.dataType
      // For now, just collect the mapped data
      imported.push({
        ...row.mapped,
        importBatchId: batchId,
        importRowNumber: row.rowNumber,
      } as T);

      successfulRows++;
      if (row.warnings.length > 0) {
        warningRows++;
        warnings.push(...row.warnings);
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      success: failedRows === 0,
      batchId,
      totalRows: rows.length,
      successfulRows,
      failedRows,
      warningRows,
      imported,
      skipped,
      errors,
      warnings,
      durationMs,
      summary: `Imported ${successfulRows} of ${rows.length} rows in ${durationMs}ms`,
    };
  }

  /**
   * Get available import profiles.
   */
  getProfiles(tenantId?: string): ImportProfile[] {
    const profiles = [...BUILT_IN_PROFILES];

    // Add custom profiles for tenant
    if (tenantId) {
      profiles.push(
        ...this.customProfiles.filter((p) => p.tenantId === tenantId)
      );
    }

    return profiles;
  }

  /**
   * Get a specific profile.
   */
  getProfile(profileId: string): ImportProfile | undefined {
    return (
      getBuiltInProfile(profileId) ||
      this.customProfiles.find((p) => p.id === profileId)
    );
  }

  /**
   * Register a custom import profile.
   */
  registerProfile(profile: ImportProfile): void {
    // Remove existing profile with same ID
    this.customProfiles = this.customProfiles.filter((p) => p.id !== profile.id);
    this.customProfiles.push(profile);
  }

  /**
   * Validate a single rule.
   */
  private validateRule(
    rule: { type: string; params?: Record<string, unknown> },
    data: Record<string, unknown>,
    context: ImportMappingContext,
    rowNumber: number
  ): { valid: boolean; message?: string } {
    switch (rule.type) {
      case 'required': {
        // All fields must have non-empty values
        return { valid: true };
      }

      case 'range': {
        const min = rule.params?.min as number | undefined;
        const max = rule.params?.max as number | undefined;
        // Simplified - would check actual field values
        return { valid: true };
      }

      case 'lookup': {
        // Would check against context lookups
        return { valid: true };
      }

      default:
        return { valid: true };
    }
  }

  /**
   * Calculate statistics for columns.
   */
  private calculateColumnStats(
    rows: Record<string, unknown>[]
  ): ColumnStats[] {
    if (rows.length === 0) return [];

    const columns = Object.keys(rows[0]);
    const stats: ColumnStats[] = [];

    for (const col of columns) {
      const values = rows.map((r) => r[col]);
      const nonEmpty = values.filter(
        (v) => v !== null && v !== undefined && v !== ''
      );
      const unique = new Set(nonEmpty.map((v) => String(v)));

      // Detect type
      let detectedType: ColumnStats['detectedType'] = 'string';
      if (nonEmpty.length > 0) {
        const sample = nonEmpty[0];
        if (typeof sample === 'number') {
          detectedType = 'number';
        } else if (typeof sample === 'boolean') {
          detectedType = 'boolean';
        } else if (typeof sample === 'string') {
          // Check if all values look like dates or numbers
          const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
          const isoDatePattern = /^\d{4}-\d{2}-\d{2}/;
          const numberPattern = /^-?[\d,]+\.?\d*$/;

          const looksLikeDate = nonEmpty.every(
            (v) =>
              datePattern.test(String(v)) || isoDatePattern.test(String(v))
          );
          const looksLikeNumber = nonEmpty.every((v) =>
            numberPattern.test(String(v).replace(/[$,]/g, ''))
          );

          if (looksLikeDate) {
            detectedType = 'date';
          } else if (looksLikeNumber) {
            detectedType = 'number';
          }
        }
      }

      stats.push({
        columnName: col,
        totalValues: values.length,
        nonEmptyValues: nonEmpty.length,
        uniqueValues: unique.size,
        sampleValues: nonEmpty.slice(0, 5),
        detectedType,
      });
    }

    return stats;
  }
}

/**
 * Create a new import engine instance.
 */
export function createImportEngine(): ImportEngine {
  return new DefaultImportEngine();
}
