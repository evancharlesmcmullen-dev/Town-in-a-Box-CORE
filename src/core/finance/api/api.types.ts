// src/core/finance/api/api.types.ts

/**
 * Town-in-a-Box Finance Engine - REST API Types
 *
 * API request/response types and endpoint definitions including:
 * - Standard CRUD operations for finance entities
 * - Report generation endpoints
 * - Gateway integration endpoints
 * - Webhook support for external events
 */

// ============================================================================
// COMMON API TYPES
// ============================================================================

/**
 * Standard API response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMetadata;
}

/**
 * API error structure.
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string;
  timestamp: string;
}

/**
 * API metadata (pagination, timing, etc.).
 */
export interface ApiMetadata {
  requestId: string;
  timestamp: string;
  duration?: number;
  pagination?: PaginationMeta;
  links?: HateoasLinks;
}

/**
 * Pagination metadata.
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * HATEOAS links for discoverability.
 */
export interface HateoasLinks {
  self: string;
  first?: string;
  last?: string;
  next?: string;
  previous?: string;
  related?: Record<string, string>;
}

/**
 * Standard list response.
 */
export interface ListResponse<T> {
  items: T[];
  pagination: PaginationMeta;
  links?: HateoasLinks;
}

/**
 * Standard query parameters.
 */
export interface QueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  fields?: string;
  expand?: string;
}

// ============================================================================
// FUND ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/funds - List funds
 */
export interface ListFundsRequest extends QueryParams {
  type?: string;
  category?: string;
  activeOnly?: boolean;
}

/**
 * GET /api/v1/funds/:id - Get fund by ID
 */
export interface GetFundRequest {
  id: string;
  includeBalance?: boolean;
  includeSummary?: boolean;
}

/**
 * POST /api/v1/funds - Create fund
 */
export interface CreateFundRequest {
  code: string;
  name: string;
  type: string;
  category?: string;
  description?: string;
  isRestricted?: boolean;
  beginningBalance?: number;
}

/**
 * PUT /api/v1/funds/:id - Update fund
 */
export interface UpdateFundRequest {
  name?: string;
  category?: string;
  description?: string;
  isRestricted?: boolean;
  isActive?: boolean;
}

/**
 * GET /api/v1/funds/:id/summary - Get fund summary
 */
export interface GetFundSummaryRequest {
  fundId: string;
  startDate?: string;
  endDate?: string;
  fiscalYear?: number;
}

// ============================================================================
// TRANSACTION ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/transactions - List transactions
 */
export interface ListTransactionsRequest extends QueryParams {
  fundId?: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  vendorId?: string;
}

/**
 * GET /api/v1/transactions/:id - Get transaction
 */
export interface GetTransactionRequest {
  id: string;
  includeAuditTrail?: boolean;
}

/**
 * POST /api/v1/transactions - Create transaction
 */
export interface CreateTransactionRequest {
  fundId: string;
  accountId?: string;
  type: string;
  transactionDate: string;
  amount: number;
  description: string;
  vendorId?: string;
  vendorName?: string;
  checkNumber?: string;
  reference?: string;
  memo?: string;
}

/**
 * PUT /api/v1/transactions/:id - Update transaction
 */
export interface UpdateTransactionRequest {
  transactionDate?: string;
  amount?: number;
  description?: string;
  memo?: string;
  correctionReason?: string;
}

/**
 * POST /api/v1/transactions/:id/void - Void transaction
 */
export interface VoidTransactionRequest {
  reason: string;
}

/**
 * POST /api/v1/transactions/:id/approve - Approve transaction
 */
export interface ApproveTransactionRequest {
  notes?: string;
}

// ============================================================================
// BUDGET ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/budget - List budget lines
 */
export interface ListBudgetLinesRequest extends QueryParams {
  fiscalYear: number;
  fundId?: string;
  type?: string;
  category?: string;
}

/**
 * GET /api/v1/budget/:id - Get budget line
 */
export interface GetBudgetLineRequest {
  id: string;
}

/**
 * POST /api/v1/budget - Create budget line
 */
export interface CreateBudgetLineRequest {
  fiscalYear: number;
  fundId: string;
  accountId?: string;
  type: string;
  category?: string;
  description: string;
  amount: number;
}

/**
 * PUT /api/v1/budget/:id - Update budget line
 */
export interface UpdateBudgetLineRequest {
  description?: string;
  amount?: number;
  category?: string;
}

/**
 * GET /api/v1/budget/summary - Budget summary
 */
export interface GetBudgetSummaryRequest {
  fiscalYear: number;
  fundId?: string;
  groupBy?: 'fund' | 'category' | 'account';
}

/**
 * Budget summary response.
 */
export interface BudgetSummaryResponse {
  fiscalYear: number;
  totalRevenue: number;
  totalAppropriations: number;
  balance: number;
  byFund?: { fundId: string; fundName: string; revenue: number; appropriations: number }[];
  byCategory?: { category: string; revenue: number; appropriations: number }[];
}

// ============================================================================
// REPORT ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/reports - List available reports
 */
export interface ListReportsRequest {
  category?: string;
}

/**
 * Report definition for API.
 */
export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: ReportParameter[];
  formats: string[];
}

/**
 * Report parameter definition.
 */
export interface ReportParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  default?: unknown;
  options?: { value: string; label: string }[];
}

/**
 * POST /api/v1/reports/generate - Generate report
 */
export interface GenerateReportRequest {
  reportId: string;
  parameters: Record<string, unknown>;
  format: 'JSON' | 'CSV' | 'PDF' | 'XLSX';
}

/**
 * Report generation response.
 */
export interface GenerateReportResponse {
  reportId: string;
  generatedAt: string;
  format: string;
  downloadUrl?: string;
  data?: unknown;
}

// ============================================================================
// GATEWAY ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/gateway/reports - List Gateway reports
 */
export interface ListGatewayReportsRequest {
  fiscalYear?: number;
  reportType?: string;
  status?: string;
}

/**
 * POST /api/v1/gateway/generate - Generate Gateway report
 */
export interface GenerateGatewayReportRequest {
  reportType: string;
  fiscalYear: number;
  fundIds?: string[];
  validate?: boolean;
  format?: 'JSON' | 'CSV' | 'XML';
}

/**
 * GET /api/v1/gateway/:reportId/:lineId/explain - Explain line
 */
export interface ExplainGatewayLineRequest {
  reportId: string;
  lineId: string;
  fundNumber: string;
  fieldName: string;
  fiscalYear: number;
}

/**
 * POST /api/v1/gateway/:reportId/submit - Submit to Gateway
 */
export interface SubmitGatewayReportRequest {
  reportId: string;
  confirmationCode?: string;
}

// ============================================================================
// IMPORT ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/import/profiles - List import profiles
 */
export interface ListImportProfilesRequest {
  dataType?: string;
  vendor?: string;
}

/**
 * POST /api/v1/import/validate - Validate import file
 */
export interface ValidateImportRequest {
  profileId: string;
  file: string; // Base64 or file reference
  options?: {
    dryRun?: boolean;
    maxErrors?: number;
  };
}

/**
 * Import validation response.
 */
export interface ValidateImportResponse {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: { row: number; field: string; message: string }[];
  warnings: { row: number; message: string }[];
  preview?: Record<string, unknown>[];
}

/**
 * POST /api/v1/import/execute - Execute import
 */
export interface ExecuteImportRequest {
  profileId: string;
  file: string;
  options?: {
    continueOnError?: boolean;
    overwriteExisting?: boolean;
  };
}

/**
 * Import execution response.
 */
export interface ExecuteImportResponse {
  batchId: string;
  success: boolean;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: { row: number; message: string }[];
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

/**
 * Webhook event types.
 */
export type WebhookEventType =
  | 'transaction.created'
  | 'transaction.updated'
  | 'transaction.voided'
  | 'transaction.approved'
  | 'fund.created'
  | 'fund.updated'
  | 'budget.created'
  | 'budget.updated'
  | 'report.generated'
  | 'gateway.submitted'
  | 'gateway.accepted'
  | 'gateway.rejected'
  | 'import.completed'
  | 'import.failed'
  | 'bank_feed.received'
  | 'validation.failed';

/**
 * Webhook subscription.
 */
export interface WebhookSubscription {
  id: string;
  tenantId: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
  lastTriggeredAt?: Date;
  failureCount: number;
}

/**
 * Webhook payload.
 */
export interface WebhookPayload<T = unknown> {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  tenantId: string;
  data: T;
  metadata?: {
    userId?: string;
    source?: string;
    correlationId?: string;
  };
}

/**
 * POST /api/v1/webhooks - Create webhook subscription
 */
export interface CreateWebhookRequest {
  url: string;
  events: WebhookEventType[];
  secret?: string;
}

/**
 * PUT /api/v1/webhooks/:id - Update webhook subscription
 */
export interface UpdateWebhookRequest {
  url?: string;
  events?: WebhookEventType[];
  isActive?: boolean;
}

/**
 * POST /api/v1/webhooks/:id/test - Test webhook
 */
export interface TestWebhookRequest {
  webhookId: string;
  eventType?: WebhookEventType;
}

// ============================================================================
// API ENDPOINT DEFINITIONS
// ============================================================================

/**
 * API endpoint definition for documentation.
 */
export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  requestBody?: {
    description: string;
    contentType: string;
    schema: string;
  };
  parameters?: {
    name: string;
    in: 'path' | 'query' | 'header';
    required: boolean;
    description: string;
    type: string;
  }[];
  responses: {
    statusCode: number;
    description: string;
    schema?: string;
  }[];
  security?: string[];
}

/**
 * Full API specification.
 */
export interface ApiSpecification {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, Record<string, ApiEndpoint>>;
}

// ============================================================================
// PREDEFINED API ENDPOINTS
// ============================================================================

/**
 * Finance API endpoint definitions.
 */
export const FINANCE_API_ENDPOINTS: ApiEndpoint[] = [
  // Funds
  {
    method: 'GET',
    path: '/api/v1/funds',
    summary: 'List funds',
    description: 'Retrieve a paginated list of funds',
    tags: ['Funds'],
    parameters: [
      { name: 'page', in: 'query', required: false, description: 'Page number', type: 'integer' },
      { name: 'pageSize', in: 'query', required: false, description: 'Items per page', type: 'integer' },
      { name: 'type', in: 'query', required: false, description: 'Filter by fund type', type: 'string' },
      { name: 'activeOnly', in: 'query', required: false, description: 'Only active funds', type: 'boolean' },
    ],
    responses: [
      { statusCode: 200, description: 'List of funds', schema: 'ListResponse<Fund>' },
      { statusCode: 401, description: 'Unauthorized' },
    ],
    security: ['bearerAuth'],
  },
  {
    method: 'POST',
    path: '/api/v1/funds',
    summary: 'Create fund',
    description: 'Create a new fund',
    tags: ['Funds'],
    requestBody: { description: 'Fund to create', contentType: 'application/json', schema: 'CreateFundRequest' },
    responses: [
      { statusCode: 201, description: 'Fund created', schema: 'Fund' },
      { statusCode: 400, description: 'Validation error' },
      { statusCode: 401, description: 'Unauthorized' },
    ],
    security: ['bearerAuth'],
  },
  {
    method: 'GET',
    path: '/api/v1/funds/{id}',
    summary: 'Get fund',
    description: 'Retrieve a fund by ID',
    tags: ['Funds'],
    parameters: [
      { name: 'id', in: 'path', required: true, description: 'Fund ID', type: 'string' },
    ],
    responses: [
      { statusCode: 200, description: 'Fund details', schema: 'Fund' },
      { statusCode: 404, description: 'Fund not found' },
    ],
    security: ['bearerAuth'],
  },

  // Transactions
  {
    method: 'GET',
    path: '/api/v1/transactions',
    summary: 'List transactions',
    description: 'Retrieve a paginated list of transactions',
    tags: ['Transactions'],
    parameters: [
      { name: 'fundId', in: 'query', required: false, description: 'Filter by fund', type: 'string' },
      { name: 'type', in: 'query', required: false, description: 'Transaction type', type: 'string' },
      { name: 'startDate', in: 'query', required: false, description: 'From date', type: 'string' },
      { name: 'endDate', in: 'query', required: false, description: 'To date', type: 'string' },
    ],
    responses: [
      { statusCode: 200, description: 'List of transactions', schema: 'ListResponse<Transaction>' },
    ],
    security: ['bearerAuth'],
  },
  {
    method: 'POST',
    path: '/api/v1/transactions',
    summary: 'Create transaction',
    description: 'Create a new transaction',
    tags: ['Transactions'],
    requestBody: { description: 'Transaction to create', contentType: 'application/json', schema: 'CreateTransactionRequest' },
    responses: [
      { statusCode: 201, description: 'Transaction created', schema: 'Transaction' },
      { statusCode: 400, description: 'Validation error' },
    ],
    security: ['bearerAuth'],
  },

  // Budget
  {
    method: 'GET',
    path: '/api/v1/budget',
    summary: 'List budget lines',
    description: 'Retrieve budget lines for a fiscal year',
    tags: ['Budget'],
    parameters: [
      { name: 'fiscalYear', in: 'query', required: true, description: 'Fiscal year', type: 'integer' },
      { name: 'fundId', in: 'query', required: false, description: 'Filter by fund', type: 'string' },
    ],
    responses: [
      { statusCode: 200, description: 'List of budget lines', schema: 'ListResponse<BudgetLine>' },
    ],
    security: ['bearerAuth'],
  },
  {
    method: 'GET',
    path: '/api/v1/budget/summary',
    summary: 'Budget summary',
    description: 'Get budget summary with totals',
    tags: ['Budget'],
    parameters: [
      { name: 'fiscalYear', in: 'query', required: true, description: 'Fiscal year', type: 'integer' },
    ],
    responses: [
      { statusCode: 200, description: 'Budget summary', schema: 'BudgetSummaryResponse' },
    ],
    security: ['bearerAuth'],
  },

  // Reports
  {
    method: 'GET',
    path: '/api/v1/reports',
    summary: 'List available reports',
    description: 'Get list of available report types',
    tags: ['Reports'],
    responses: [
      { statusCode: 200, description: 'List of reports', schema: 'ReportDefinition[]' },
    ],
    security: ['bearerAuth'],
  },
  {
    method: 'POST',
    path: '/api/v1/reports/generate',
    summary: 'Generate report',
    description: 'Generate a report with specified parameters',
    tags: ['Reports'],
    requestBody: { description: 'Report parameters', contentType: 'application/json', schema: 'GenerateReportRequest' },
    responses: [
      { statusCode: 200, description: 'Report generated', schema: 'GenerateReportResponse' },
      { statusCode: 400, description: 'Invalid parameters' },
    ],
    security: ['bearerAuth'],
  },

  // Gateway
  {
    method: 'POST',
    path: '/api/v1/gateway/generate',
    summary: 'Generate Gateway report',
    description: 'Generate a Gateway-ready report for SBOA/DLGF filing',
    tags: ['Gateway'],
    requestBody: { description: 'Gateway report request', contentType: 'application/json', schema: 'GenerateGatewayReportRequest' },
    responses: [
      { statusCode: 200, description: 'Gateway report generated', schema: 'GatewayExportResult' },
      { statusCode: 400, description: 'Validation errors' },
    ],
    security: ['bearerAuth'],
  },
  {
    method: 'GET',
    path: '/api/v1/gateway/{reportId}/{lineId}/explain',
    summary: 'Explain Gateway line',
    description: 'Get detailed explanation for a Gateway report line item',
    tags: ['Gateway'],
    parameters: [
      { name: 'reportId', in: 'path', required: true, description: 'Report ID', type: 'string' },
      { name: 'lineId', in: 'path', required: true, description: 'Line ID', type: 'string' },
    ],
    responses: [
      { statusCode: 200, description: 'Line explanation', schema: 'GatewayLineExplanation' },
      { statusCode: 404, description: 'Line not found' },
    ],
    security: ['bearerAuth'],
  },

  // Webhooks
  {
    method: 'POST',
    path: '/api/v1/webhooks',
    summary: 'Create webhook',
    description: 'Subscribe to webhook events',
    tags: ['Webhooks'],
    requestBody: { description: 'Webhook subscription', contentType: 'application/json', schema: 'CreateWebhookRequest' },
    responses: [
      { statusCode: 201, description: 'Webhook created', schema: 'WebhookSubscription' },
    ],
    security: ['bearerAuth'],
  },
];
