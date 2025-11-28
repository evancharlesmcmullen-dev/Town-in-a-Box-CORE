// src/states/in/finance/in-finance-seed.ts
//
// Helper to seed standard Indiana municipal funds for a tenant.
// Based on SBOA Uniform Chart of Accounts fund definitions.

import { Fund, FundType } from '../../../engines/finance/finance.types';

/**
 * Create a standard set of Indiana town funds.
 *
 * This helper provides a baseline fund structure for small Indiana towns.
 * Includes the most common funds used by municipal governments.
 *
 * @param tenantId - The tenant ID to assign to the funds
 * @returns Array of Fund objects ready for seeding
 *
 * @example
 * ```typescript
 * const service = new InMemoryFinanceService({
 *   funds: getDefaultIndianaTownFunds('lapel'),
 * });
 * ```
 */
export function getDefaultIndianaTownFunds(tenantId: string): Fund[] {
  const now = new Date().toISOString();

  const makeFund = (
    code: string,
    name: string,
    type: FundType,
    options: {
      sboaCode?: string;
      dlgfFundNumber?: string;
      isMajorFund?: boolean;
      description?: string;
    } = {}
  ): Fund => ({
    id: `${tenantId}-${code}`,
    tenantId,
    code,
    name,
    type,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    sboaCode: options.sboaCode,
    dlgfFundNumber: options.dlgfFundNumber,
    isMajorFund: options.isMajorFund,
    description: options.description,
  });

  return [
    // General Funds
    makeFund('0101', 'General Fund', 'GENERAL', {
      isMajorFund: true,
      description: 'Primary operating fund for general town operations',
    }),

    // Road/Highway Funds
    makeFund('0706', 'MVH - Motor Vehicle Highway', 'MVH', {
      description: 'State-distributed motor vehicle highway funds for road maintenance',
    }),
    makeFund('0708', 'Local Road & Street', 'LOCAL_ROAD_AND_STREET', {
      description: 'Local road and street fund from state distributions',
    }),

    // Special Revenue Funds
    makeFund('1110', 'Rainy Day Fund', 'RAINY_DAY', {
      description: 'Reserve fund for emergencies and revenue shortfalls',
    }),
    makeFund('1176', 'Cumulative Capital Development', 'CUMULATIVE_CAPITAL_DEVELOPMENT', {
      description: 'Cumulative fund for capital projects and equipment',
    }),

    // Utility Operating Funds
    makeFund('6001', 'Water Operating', 'UTILITY_OPERATING', {
      isMajorFund: true,
      description: 'Water utility enterprise operating fund',
    }),
    makeFund('6002', 'Sewer Operating', 'UTILITY_OPERATING', {
      isMajorFund: true,
      description: 'Sewer utility enterprise operating fund',
    }),
    makeFund('6003', 'Stormwater Operating', 'UTILITY_OPERATING', {
      description: 'Stormwater utility enterprise operating fund',
    }),

    // Utility Debt Service Funds
    makeFund('6501', 'Water Debt Service', 'UTILITY_DEBT', {
      description: 'Debt service fund for water utility bonds and loans',
    }),
    makeFund('6502', 'Sewer Debt Service', 'UTILITY_DEBT', {
      description: 'Debt service fund for sewer utility bonds and loans',
    }),
  ];
}

/**
 * Create a minimal set of Indiana town funds (required only).
 *
 * For tenants that want to start with a minimal fund structure
 * and add more funds as needed.
 *
 * @param tenantId - The tenant ID to assign to the funds
 * @returns Array of Fund objects ready for seeding
 */
export function getMinimalIndianaTownFunds(tenantId: string): Fund[] {
  const now = new Date().toISOString();

  const makeFund = (
    code: string,
    name: string,
    type: FundType,
    isMajorFund = false
  ): Fund => ({
    id: `${tenantId}-${code}`,
    tenantId,
    code,
    name,
    type,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    isMajorFund,
  });

  return [
    makeFund('0101', 'General Fund', 'GENERAL', true),
    makeFund('0706', 'MVH - Motor Vehicle Highway', 'MVH'),
    makeFund('0708', 'Local Road & Street', 'LOCAL_ROAD_AND_STREET'),
  ];
}

/**
 * Create a standard set of Indiana township funds.
 *
 * Townships have a different fund structure than towns,
 * with emphasis on township assistance (poor relief) funds.
 *
 * @param tenantId - The tenant ID to assign to the funds
 * @returns Array of Fund objects ready for seeding
 */
export function getDefaultIndianaTownshipFunds(tenantId: string): Fund[] {
  const now = new Date().toISOString();

  const makeFund = (
    code: string,
    name: string,
    type: FundType,
    options: {
      isMajorFund?: boolean;
      description?: string;
    } = {}
  ): Fund => ({
    id: `${tenantId}-${code}`,
    tenantId,
    code,
    name,
    type,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    isMajorFund: options.isMajorFund,
    description: options.description,
  });

  return [
    // General Fund
    makeFund('0001', 'Township General Fund', 'GENERAL', {
      isMajorFund: true,
      description: 'Primary operating fund for township operations',
    }),

    // Township Assistance
    makeFund('0840', 'Township Assistance', 'OTHER', {
      isMajorFund: true,
      description: 'Fund for township poor relief programs per IC 12-20',
    }),

    // Fire Protection
    makeFund('1111', 'Fire Protection Territory', 'FIRE', {
      description: 'Fund for fire territory participation',
    }),

    // Rainy Day
    makeFund('1110', 'Rainy Day Fund', 'RAINY_DAY', {
      description: 'Reserve fund for emergencies',
    }),

    // Cemetery (if applicable)
    makeFund('0350', 'Cemetery Fund', 'CEMETERY', {
      description: 'Fund for cemetery operations and maintenance',
    }),
  ];
}

/**
 * Get funds for a town that has fire department (not territory).
 *
 * Adds fire-related funds to the base town funds.
 *
 * @param tenantId - The tenant ID to assign to the funds
 * @returns Array of Fund objects ready for seeding
 */
export function getIndianaTownWithFireDeptFunds(tenantId: string): Fund[] {
  const baseFunds = getDefaultIndianaTownFunds(tenantId);
  const now = new Date().toISOString();

  const fireFund: Fund = {
    id: `${tenantId}-0703`,
    tenantId,
    code: '0703',
    name: 'Fire Fighting Fund',
    type: 'FIRE',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    description: 'Fund for fire department operations and equipment',
  };

  return [...baseFunds, fireFund];
}
