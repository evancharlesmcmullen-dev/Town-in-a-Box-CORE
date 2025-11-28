// src/core/finance/import/import.profiles.ts

/**
 * Town-in-a-Box Finance Engine - Import Profiles
 *
 * Pre-configured import profiles for common data sources.
 */

import {
  ImportProfile,
  ImportFileType,
  ImportDataType,
  KnownVendor,
  ColumnMapping,
} from './import.types';

// ============================================================================
// GENERIC TRANSACTION PROFILE
// ============================================================================

/**
 * Generic CSV transaction import profile.
 *
 * Expected columns:
 * - Date (or Transaction Date)
 * - Amount
 * - Description (or Memo)
 * - Type (or Transaction Type) - optional
 * - Fund (or Fund Code)
 * - Account (or Account Code) - optional
 * - Check Number (or Check #) - optional
 * - Vendor - optional
 * - Reference - optional
 */
export const GENERIC_TRANSACTION_CSV: ImportProfile = {
  id: 'generic-transaction-csv',
  name: 'Generic Transaction CSV',
  description: 'Import transactions from a standard CSV file',
  vendor: 'GENERIC',
  fileType: 'CSV',
  dataType: 'TRANSACTIONS',
  isSystem: true,
  parseOptions: {
    hasHeader: true,
    delimiter: ',',
    trimValues: true,
    dateFormat: 'MM/DD/YYYY',
  },
  mappings: [
    {
      sourceColumn: 'Date',
      targetField: 'transactionDate',
      transform: 'parseDateUS',
      required: true,
    },
    {
      sourceColumn: 'Amount',
      targetField: 'amount',
      transform: 'parseAmount',
      required: true,
    },
    {
      sourceColumn: 'Description',
      targetField: 'description',
      transform: 'trim',
      required: true,
    },
    {
      sourceColumn: 'Type',
      targetField: 'type',
      transform: 'mapTransactionType',
      defaultValue: 'DISBURSEMENT',
    },
    {
      sourceColumn: 'Fund',
      targetField: 'fundCode',
      transform: 'fundCodePad',
      required: true,
    },
    {
      sourceColumn: 'Account',
      targetField: 'accountCode',
      transform: 'accountCodePad',
    },
    {
      sourceColumn: 'Check Number',
      targetField: 'checkNumber',
      transform: 'trim',
    },
    {
      sourceColumn: 'Vendor',
      targetField: 'vendorName',
      transform: 'trim',
    },
    {
      sourceColumn: 'Reference',
      targetField: 'externalRef',
      transform: 'trim',
    },
  ],
  validationRules: [
    {
      id: 'valid-date',
      description: 'Transaction date must be valid',
      fields: ['transactionDate'],
      type: 'format',
      severity: 'error',
    },
    {
      id: 'valid-amount',
      description: 'Amount must be a valid number',
      fields: ['amount'],
      type: 'format',
      severity: 'error',
    },
    {
      id: 'fund-exists',
      description: 'Fund code must exist or be creatable',
      fields: ['fundCode'],
      type: 'lookup',
      severity: 'warning',
    },
  ],
};

// ============================================================================
// GENERIC BUDGET PROFILE
// ============================================================================

/**
 * Generic budget import profile.
 */
export const GENERIC_BUDGET_CSV: ImportProfile = {
  id: 'generic-budget-csv',
  name: 'Generic Budget CSV',
  description: 'Import budget lines from a standard CSV file',
  vendor: 'GENERIC',
  fileType: 'CSV',
  dataType: 'BUDGET',
  isSystem: true,
  parseOptions: {
    hasHeader: true,
    delimiter: ',',
    trimValues: true,
  },
  mappings: [
    {
      sourceColumn: 'Fund',
      targetField: 'fundCode',
      transform: 'fundCodePad',
      required: true,
    },
    {
      sourceColumn: 'Account',
      targetField: 'accountCode',
      transform: 'accountCodePad',
    },
    {
      sourceColumn: 'Year',
      targetField: 'fiscalYear',
      transform: 'parseInteger',
      required: true,
    },
    {
      sourceColumn: 'Adopted Amount',
      targetField: 'adoptedAmount',
      transform: 'parseAmount',
      required: true,
    },
    {
      sourceColumn: 'Amended Amount',
      targetField: 'amendedAmount',
      transform: 'parseAmount',
    },
    {
      sourceColumn: 'Category',
      targetField: 'category',
      transform: 'trim',
    },
    {
      sourceColumn: 'Type',
      targetField: 'lineType',
      transform: 'uppercase',
      defaultValue: 'APPROPRIATION',
    },
  ],
  validationRules: [
    {
      id: 'valid-year',
      description: 'Fiscal year must be valid',
      fields: ['fiscalYear'],
      type: 'range',
      severity: 'error',
      params: { min: 2000, max: 2100 },
    },
    {
      id: 'valid-amount',
      description: 'Adopted amount must be non-negative',
      fields: ['adoptedAmount'],
      type: 'range',
      severity: 'error',
      params: { min: 0 },
    },
  ],
};

// ============================================================================
// GENERIC FUND PROFILE
// ============================================================================

/**
 * Generic fund import profile.
 */
export const GENERIC_FUND_CSV: ImportProfile = {
  id: 'generic-fund-csv',
  name: 'Generic Fund CSV',
  description: 'Import funds from a standard CSV file',
  vendor: 'GENERIC',
  fileType: 'CSV',
  dataType: 'FUNDS',
  isSystem: true,
  parseOptions: {
    hasHeader: true,
    delimiter: ',',
    trimValues: true,
  },
  mappings: [
    {
      sourceColumn: 'Code',
      targetField: 'code',
      transform: 'fundCodePad',
      required: true,
    },
    {
      sourceColumn: 'Name',
      targetField: 'name',
      transform: 'trim',
      required: true,
    },
    {
      sourceColumn: 'Type',
      targetField: 'type',
      transform: 'uppercase',
      defaultValue: 'GOVERNMENTAL',
    },
    {
      sourceColumn: 'Category',
      targetField: 'category',
      transform: 'lowercase',
    },
    {
      sourceColumn: 'Beginning Balance',
      targetField: 'beginningBalance',
      transform: 'parseAmount',
      defaultValue: 0,
    },
    {
      sourceColumn: 'Active',
      targetField: 'isActive',
      transform: 'parseBoolean',
      defaultValue: true,
    },
    {
      sourceColumn: 'Restricted',
      targetField: 'isRestricted',
      transform: 'parseBoolean',
      defaultValue: false,
    },
  ],
  validationRules: [
    {
      id: 'unique-code',
      description: 'Fund code must be unique',
      fields: ['code'],
      type: 'custom',
      severity: 'error',
    },
  ],
};

// ============================================================================
// GENERIC VENDOR PROFILE
// ============================================================================

/**
 * Generic vendor import profile.
 */
export const GENERIC_VENDOR_CSV: ImportProfile = {
  id: 'generic-vendor-csv',
  name: 'Generic Vendor CSV',
  description: 'Import vendors from a standard CSV file',
  vendor: 'GENERIC',
  fileType: 'CSV',
  dataType: 'VENDORS',
  isSystem: true,
  parseOptions: {
    hasHeader: true,
    delimiter: ',',
    trimValues: true,
  },
  mappings: [
    {
      sourceColumn: 'Name',
      targetField: 'name',
      transform: 'trim',
      required: true,
    },
    {
      sourceColumn: 'Vendor Number',
      targetField: 'vendorNumber',
      transform: 'trim',
    },
    {
      sourceColumn: 'Address',
      targetField: 'address.line1',
      transform: 'trim',
    },
    {
      sourceColumn: 'City',
      targetField: 'address.city',
      transform: 'trim',
    },
    {
      sourceColumn: 'State',
      targetField: 'address.state',
      transform: 'uppercase',
    },
    {
      sourceColumn: 'Zip',
      targetField: 'address.postalCode',
      transform: 'trim',
    },
    {
      sourceColumn: 'Phone',
      targetField: 'phone',
      transform: 'trim',
    },
    {
      sourceColumn: 'Email',
      targetField: 'email',
      transform: 'lowercase',
    },
    {
      sourceColumn: '1099',
      targetField: 'requires1099',
      transform: 'parseBoolean',
      defaultValue: false,
    },
    {
      sourceColumn: 'Tax ID',
      targetField: 'taxId',
      transform: 'trim',
    },
  ],
  validationRules: [
    {
      id: 'valid-name',
      description: 'Vendor name is required',
      fields: ['name'],
      type: 'required',
      severity: 'error',
    },
  ],
};

// ============================================================================
// OPENING BALANCE PROFILE
// ============================================================================

/**
 * Opening balance import profile.
 */
export const OPENING_BALANCE_CSV: ImportProfile = {
  id: 'opening-balance-csv',
  name: 'Opening Balance CSV',
  description: 'Import fund opening balances',
  vendor: 'GENERIC',
  fileType: 'CSV',
  dataType: 'OPENING_BALANCES',
  isSystem: true,
  parseOptions: {
    hasHeader: true,
    delimiter: ',',
    trimValues: true,
  },
  mappings: [
    {
      sourceColumn: 'Fund',
      targetField: 'fundCode',
      transform: 'fundCodePad',
      required: true,
    },
    {
      sourceColumn: 'Balance',
      targetField: 'beginningBalance',
      transform: 'parseAmount',
      required: true,
    },
    {
      sourceColumn: 'As Of Date',
      targetField: 'asOfDate',
      transform: 'parseDateUS',
      required: true,
    },
  ],
  validationRules: [],
};

// ============================================================================
// QUICKBOOKS PROFILE
// ============================================================================

/**
 * QuickBooks transaction export profile.
 */
export const QUICKBOOKS_TRANSACTION_CSV: ImportProfile = {
  id: 'quickbooks-transaction-csv',
  name: 'QuickBooks Transaction Export',
  description: 'Import transactions exported from QuickBooks',
  vendor: 'QUICKBOOKS',
  fileType: 'CSV',
  dataType: 'TRANSACTIONS',
  isSystem: true,
  parseOptions: {
    hasHeader: true,
    delimiter: ',',
    trimValues: true,
    dateFormat: 'MM/DD/YYYY',
  },
  mappings: [
    {
      sourceColumn: 'Date',
      targetField: 'transactionDate',
      transform: 'parseDateUS',
      required: true,
    },
    {
      sourceColumn: 'Amount',
      targetField: 'amount',
      transform: 'parseAmountNegativeParens',
      required: true,
    },
    {
      sourceColumn: 'Memo',
      targetField: 'description',
      transform: 'trim',
      required: true,
    },
    {
      sourceColumn: 'Type',
      targetField: 'type',
      transform: 'mapTransactionType',
    },
    {
      sourceColumn: 'Account',
      targetField: 'accountCode',
      transform: 'trim',
    },
    {
      sourceColumn: 'Num',
      targetField: 'checkNumber',
      transform: 'trim',
    },
    {
      sourceColumn: 'Name',
      targetField: 'vendorName',
      transform: 'trim',
    },
    {
      sourceColumn: 'Class',
      targetField: 'fundCode',
      transform: 'trim',
    },
  ],
  validationRules: [],
};

// ============================================================================
// INDIANA GATEWAY PROFILE
// ============================================================================

/**
 * Indiana Gateway export profile.
 */
export const GATEWAY_AFR_EXPORT: ImportProfile = {
  id: 'gateway-afr-export',
  name: 'Gateway AFR Export',
  description: 'Import data from Indiana Gateway AFR export',
  vendor: 'GATEWAY',
  fileType: 'CSV',
  dataType: 'TRANSACTIONS',
  isSystem: true,
  parseOptions: {
    hasHeader: true,
    delimiter: ',',
    skipRows: 1,
    trimValues: true,
    dateFormat: 'MM/DD/YYYY',
  },
  mappings: [
    {
      sourceColumn: 'Fund Number',
      targetField: 'fundCode',
      transform: 'fundCodePad',
      required: true,
    },
    {
      sourceColumn: 'Fund Name',
      targetField: 'fundName',
      transform: 'trim',
    },
    {
      sourceColumn: 'Beginning Balance',
      targetField: 'beginningBalance',
      transform: 'parseAmount',
    },
    {
      sourceColumn: 'Receipts',
      targetField: 'receipts',
      transform: 'parseAmount',
    },
    {
      sourceColumn: 'Disbursements',
      targetField: 'disbursements',
      transform: 'parseAmount',
    },
    {
      sourceColumn: 'Ending Balance',
      targetField: 'endingBalance',
      transform: 'parseAmount',
    },
  ],
  validationRules: [],
};

// ============================================================================
// BANK STATEMENT PROFILES
// ============================================================================

/**
 * Generic bank statement CSV profile.
 */
export const BANK_STATEMENT_CSV: ImportProfile = {
  id: 'bank-statement-csv',
  name: 'Bank Statement CSV',
  description: 'Import transactions from bank statement CSV export',
  vendor: 'GENERIC',
  fileType: 'CSV',
  dataType: 'TRANSACTIONS',
  isSystem: true,
  parseOptions: {
    hasHeader: true,
    delimiter: ',',
    trimValues: true,
    dateFormat: 'MM/DD/YYYY',
  },
  mappings: [
    {
      sourceColumn: 'Date',
      targetField: 'transactionDate',
      transform: 'parseDateUS',
      required: true,
    },
    {
      sourceColumn: 'Description',
      targetField: 'description',
      transform: 'trim',
      required: true,
    },
    {
      sourceColumn: 'Debit',
      targetField: 'debit',
      transform: 'parseAmount',
    },
    {
      sourceColumn: 'Credit',
      targetField: 'credit',
      transform: 'parseAmount',
    },
    {
      sourceColumn: 'Check Number',
      targetField: 'checkNumber',
      transform: 'trim',
    },
    {
      sourceColumn: 'Reference',
      targetField: 'externalRef',
      transform: 'trim',
    },
  ],
  validationRules: [],
};

// ============================================================================
// PROFILE REGISTRY
// ============================================================================

/**
 * All built-in import profiles.
 */
export const BUILT_IN_PROFILES: ImportProfile[] = [
  GENERIC_TRANSACTION_CSV,
  GENERIC_BUDGET_CSV,
  GENERIC_FUND_CSV,
  GENERIC_VENDOR_CSV,
  OPENING_BALANCE_CSV,
  QUICKBOOKS_TRANSACTION_CSV,
  GATEWAY_AFR_EXPORT,
  BANK_STATEMENT_CSV,
];

/**
 * Get a profile by ID.
 */
export function getBuiltInProfile(profileId: string): ImportProfile | undefined {
  return BUILT_IN_PROFILES.find((p) => p.id === profileId);
}

/**
 * Get profiles for a specific vendor.
 */
export function getProfilesByVendor(vendor: KnownVendor): ImportProfile[] {
  return BUILT_IN_PROFILES.filter((p) => p.vendor === vendor);
}

/**
 * Get profiles for a specific data type.
 */
export function getProfilesByDataType(dataType: ImportDataType): ImportProfile[] {
  return BUILT_IN_PROFILES.filter((p) => p.dataType === dataType);
}
