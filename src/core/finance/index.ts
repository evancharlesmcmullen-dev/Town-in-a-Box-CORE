// src/core/finance/index.ts

/**
 * Town-in-a-Box Finance Engine - Core Module
 *
 * This module exports the canonical finance data model, repository interface,
 * and in-memory implementation for the Town-in-a-Box Finance Engine.
 */

// Core Types
export * from './finance.types';

// Repository Interface & Filters
export * from './finance.repository';

// In-Memory Implementation
export * from './in-memory-finance.repository';

// Rules Types & Engine
export * from './finance-rules.types';
export * from './finance-rules.engine';

// Import Engine
export * from './import';

// Reports
export * from './reports';

// Forecasting
export * from './forecast';

// Debt Scenario Modeling
export * from './debt';

// Audit & Traceability
export * from './audit';

// Citizen Finance Portal
export * from './citizen';

// REST API Types
export * from './api';
