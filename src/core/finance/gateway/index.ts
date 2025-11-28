// src/core/finance/gateway/index.ts

/**
 * Gateway Export Module
 *
 * Provides types and functions for generating Gateway-style exports
 * for state compliance reporting (e.g., Indiana Gateway AFR).
 */

// Types
export {
  GatewayExportContext,
  GatewayFundSummaryRow,
  GatewayFundSummaryExport,
  GatewayExportMetadata,
  GatewayExportType,
  GatewayExportFormat,
  GatewayValidationResult,
  GatewayValidationMessage,
} from './gateway.types';

// Service functions
export {
  buildGatewayFundSummaryExport,
  validateGatewayFundSummaryExport,
  generateExportMetadata,
  exportFundSummaryToCSV,
  sortGatewayFundSummaryRows,
} from './gateway.service';
