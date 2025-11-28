// src/states/in/finance/in-fund-structure.config.ts

/**
 * Indiana Fund Structure Configuration
 *
 * Defines the standard fund numbering, categories, and account structures
 * used by Indiana local governments per SBOA Uniform Chart of Accounts.
 *
 * This configuration supports:
 * - Towns, Cities, Townships, Counties
 * - Standard fund definitions with SBOA codes
 * - Required vs recommended fund identification
 * - Fire, utility, and special purpose fund variations
 */

import { StatutoryCitation } from '../../../core/state';
import { FundType, AccountType } from '../../../core/finance/finance.types';

// ============================================================================
// FUND CATEGORY TYPES
// ============================================================================

/**
 * Fund category definition with SBOA code ranges.
 */
export interface FundCategory {
  id: string;
  name: string;
  codeRange: { start: number; end: number };
  description: string;
  fundType: FundType;
  citation?: StatutoryCitation;
}

/**
 * Standard fund definition with Indiana-specific metadata.
 */
export interface INFundDefinition {
  code: string;
  name: string;
  category: string;
  fundType: FundType;
  isRestricted: boolean;
  isRequired: boolean;
  isRecommended: boolean;
  description: string;
  typicalUses: string[];
  allowedUseTags: string[];
  citation?: StatutoryCitation;
  applicableTo: JurisdictionKind[];
  conditionalOn?: FundCondition;
}

/**
 * Standard account definition for chart of accounts.
 */
export interface INAccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  isRequired: boolean;
  description?: string;
  parentCode?: string;
  sboacCode?: string;
  applicableFundCategories?: string[];
}

/**
 * Jurisdiction kinds for Indiana.
 */
export type JurisdictionKind = 'town' | 'city' | 'township' | 'county';

/**
 * Conditions that determine if a fund applies.
 */
export type FundCondition =
  | 'hasWaterUtility'
  | 'hasSewerUtility'
  | 'hasStormwaterUtility'
  | 'hasElectricUtility'
  | 'hasGasUtility'
  | 'hasFireDepartment'
  | 'hasFireTerritory'
  | 'hasParks'
  | 'hasCemetery'
  | 'hasTIF'
  | 'hasRedevelopment'
  | 'hasAmbulance';

// ============================================================================
// FUND CATEGORIES (SBOA)
// ============================================================================

/**
 * Indiana fund categories per SBOA Uniform Chart of Accounts.
 */
export const IN_FUND_CATEGORIES: FundCategory[] = [
  {
    id: 'general',
    name: 'General Funds',
    codeRange: { start: 100, end: 199 },
    description: 'General operating funds for unrestricted use.',
    fundType: 'GOVERNMENTAL',
  },
  {
    id: 'road',
    name: 'Highway and Street Funds',
    codeRange: { start: 200, end: 299 },
    description: 'Restricted funds for road, street, and highway purposes.',
    fundType: 'GOVERNMENTAL',
    citation: { code: 'IC 8-14-1', title: 'Motor Vehicle Highway Account' },
  },
  {
    id: 'park',
    name: 'Park Funds',
    codeRange: { start: 300, end: 399 },
    description: 'Funds for park and recreation purposes.',
    fundType: 'GOVERNMENTAL',
  },
  {
    id: 'debt',
    name: 'Debt Service Funds',
    codeRange: { start: 400, end: 499 },
    description: 'Funds for debt service and bond payments.',
    fundType: 'GOVERNMENTAL',
  },
  {
    id: 'capital',
    name: 'Capital Project Funds',
    codeRange: { start: 500, end: 599 },
    description: 'Funds for capital improvements and projects.',
    fundType: 'GOVERNMENTAL',
  },
  {
    id: 'utility',
    name: 'Utility Funds',
    codeRange: { start: 600, end: 699 },
    description: 'Enterprise funds for utility operations.',
    fundType: 'PROPRIETARY',
  },
  {
    id: 'special',
    name: 'Special Revenue Funds',
    codeRange: { start: 700, end: 799 },
    description: 'Special purpose and restricted revenue funds.',
    fundType: 'GOVERNMENTAL',
  },
  {
    id: 'trust',
    name: 'Trust and Agency Funds',
    codeRange: { start: 800, end: 899 },
    description: 'Fiduciary funds held in trust.',
    fundType: 'FIDUCIARY',
  },
  {
    id: 'tif',
    name: 'TIF Funds',
    codeRange: { start: 900, end: 999 },
    description: 'Tax Increment Financing allocation areas.',
    fundType: 'GOVERNMENTAL',
    citation: { code: 'IC 36-7-14', title: 'Redevelopment Commissions' },
  },
];

// ============================================================================
// STANDARD FUND DEFINITIONS
// ============================================================================

/**
 * Comprehensive Indiana fund definitions.
 */
export const IN_STANDARD_FUNDS: INFundDefinition[] = [
  // ========================
  // GENERAL FUNDS (100-199)
  // ========================
  {
    code: '101',
    name: 'General Fund',
    category: 'general',
    fundType: 'GOVERNMENTAL',
    isRestricted: false,
    isRequired: true,
    isRecommended: true,
    description: 'Primary operating fund for general operations.',
    typicalUses: [
      'General government operations',
      'Administrative salaries',
      'Office expenses',
      'General public safety (if no dedicated fund)',
    ],
    allowedUseTags: ['operations', 'admin', 'publicSafety', 'parks', 'general'],
    applicableTo: ['town', 'city', 'township', 'county'],
  },
  {
    code: '102',
    name: 'Donation Fund',
    category: 'general',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Fund for private donations with donor-specified purposes.',
    typicalUses: ['Donor-specified projects', 'Community programs'],
    allowedUseTags: ['donations', 'community'],
    applicableTo: ['town', 'city', 'township', 'county'],
  },

  // ========================
  // ROAD/HIGHWAY FUNDS (200-299)
  // ========================
  {
    code: '201',
    name: 'Motor Vehicle Highway (MVH)',
    category: 'road',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: true,
    isRecommended: true,
    description: 'State-distributed motor vehicle highway funds.',
    typicalUses: [
      'Road construction and maintenance',
      'Snow removal',
      'Traffic signals',
      'Street lighting (up to 50%)',
    ],
    allowedUseTags: ['roads', 'streets', 'highways', 'maintenance'],
    citation: { code: 'IC 8-14-1', title: 'Motor Vehicle Highway Account' },
    applicableTo: ['town', 'city', 'county'],
  },
  {
    code: '202',
    name: 'Local Road and Street (LRS)',
    category: 'road',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: true,
    isRecommended: true,
    description: 'Local road and street fund from state distributions.',
    typicalUses: [
      'Local road maintenance',
      'Street repairs',
      'Sidewalk improvements',
    ],
    allowedUseTags: ['roads', 'streets', 'localRoads', 'maintenance'],
    citation: { code: 'IC 8-14-2', title: 'Local Road and Street Fund' },
    applicableTo: ['town', 'city'],
  },
  {
    code: '203',
    name: 'Cumulative Bridge',
    category: 'road',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Cumulative fund for bridge construction and repair.',
    typicalUses: ['Bridge construction', 'Bridge repairs', 'Bridge inspections'],
    allowedUseTags: ['bridges', 'capital'],
    citation: { code: 'IC 8-16-3', title: 'Cumulative Bridge Fund' },
    applicableTo: ['county'],
  },

  // ========================
  // PARK FUNDS (300-399)
  // ========================
  {
    code: '301',
    name: 'Park Fund',
    category: 'park',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Park and recreation operations and maintenance.',
    typicalUses: [
      'Park maintenance',
      'Recreation programs',
      'Park equipment',
      'Facility operations',
    ],
    allowedUseTags: ['parks', 'recreation', 'maintenance'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasParks',
  },
  {
    code: '302',
    name: 'Park Non-Reverting Operating',
    category: 'park',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Non-reverting fund for park program revenues.',
    typicalUses: ['Program fees', 'Rental income', 'Concessions'],
    allowedUseTags: ['parks', 'recreation', 'programs'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasParks',
  },

  // ========================
  // DEBT SERVICE FUNDS (400-499)
  // ========================
  {
    code: '401',
    name: 'General Obligation Debt Service',
    category: 'debt',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Debt service for general obligation bonds.',
    typicalUses: ['GO bond principal', 'GO bond interest'],
    allowedUseTags: ['debt', 'bonds', 'debtService'],
    applicableTo: ['town', 'city', 'township', 'county'],
  },
  {
    code: '402',
    name: 'Lease Rental Debt Service',
    category: 'debt',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Debt service for lease rental agreements.',
    typicalUses: ['Lease rental payments', 'Building corporation payments'],
    allowedUseTags: ['debt', 'leaseRental', 'debtService'],
    citation: { code: 'IC 36-1-10', title: 'Lease Rental Bonds' },
    applicableTo: ['town', 'city', 'township', 'county'],
  },

  // ========================
  // CAPITAL FUNDS (500-599)
  // ========================
  {
    code: '501',
    name: 'Capital Projects Fund',
    category: 'capital',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Fund for specific capital improvement projects.',
    typicalUses: ['Major construction', 'Equipment purchases', 'Infrastructure'],
    allowedUseTags: ['capital', 'construction', 'equipment'],
    applicableTo: ['town', 'city', 'township', 'county'],
  },

  // ========================
  // UTILITY FUNDS (600-699)
  // ========================
  {
    code: '601',
    name: 'Water Utility Operating',
    category: 'utility',
    fundType: 'PROPRIETARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Water utility enterprise operating fund.',
    typicalUses: [
      'Water treatment operations',
      'Distribution system maintenance',
      'Meter reading and billing',
      'Water purchases',
    ],
    allowedUseTags: ['water', 'utility', 'operations'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasWaterUtility',
  },
  {
    code: '602',
    name: 'Sewer Utility Operating',
    category: 'utility',
    fundType: 'PROPRIETARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Sewer utility enterprise operating fund.',
    typicalUses: [
      'Wastewater treatment',
      'Collection system maintenance',
      'Lift station operations',
    ],
    allowedUseTags: ['sewer', 'utility', 'operations'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasSewerUtility',
  },
  {
    code: '603',
    name: 'Stormwater Utility Operating',
    category: 'utility',
    fundType: 'PROPRIETARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Stormwater utility enterprise operating fund.',
    typicalUses: [
      'Stormwater management',
      'Drainage maintenance',
      'MS4 compliance',
    ],
    allowedUseTags: ['stormwater', 'utility', 'operations'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasStormwaterUtility',
  },
  {
    code: '604',
    name: 'Electric Utility Operating',
    category: 'utility',
    fundType: 'PROPRIETARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Electric utility enterprise operating fund.',
    typicalUses: [
      'Power purchases',
      'Distribution maintenance',
      'Line crews',
    ],
    allowedUseTags: ['electric', 'utility', 'operations'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasElectricUtility',
  },
  {
    code: '605',
    name: 'Gas Utility Operating',
    category: 'utility',
    fundType: 'PROPRIETARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Gas utility enterprise operating fund.',
    typicalUses: [
      'Gas purchases',
      'Distribution system maintenance',
      'Safety inspections',
    ],
    allowedUseTags: ['gas', 'utility', 'operations'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasGasUtility',
  },
  {
    code: '610',
    name: 'Water Utility Depreciation',
    category: 'utility',
    fundType: 'PROPRIETARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Depreciation reserves for water utility capital.',
    typicalUses: ['Capital replacement', 'Major repairs'],
    allowedUseTags: ['water', 'utility', 'depreciation', 'capital'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasWaterUtility',
  },
  {
    code: '620',
    name: 'Sewer Utility Depreciation',
    category: 'utility',
    fundType: 'PROPRIETARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Depreciation reserves for sewer utility capital.',
    typicalUses: ['Capital replacement', 'Major repairs'],
    allowedUseTags: ['sewer', 'utility', 'depreciation', 'capital'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasSewerUtility',
  },
  {
    code: '650',
    name: 'Water Debt Service',
    category: 'utility',
    fundType: 'PROPRIETARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Debt service fund for water utility bonds/loans.',
    typicalUses: ['Revenue bond payments', 'SRF loan payments'],
    allowedUseTags: ['water', 'utility', 'debt', 'debtService'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasWaterUtility',
  },
  {
    code: '660',
    name: 'Sewer Debt Service',
    category: 'utility',
    fundType: 'PROPRIETARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Debt service fund for sewer utility bonds/loans.',
    typicalUses: ['Revenue bond payments', 'SRF loan payments'],
    allowedUseTags: ['sewer', 'utility', 'debt', 'debtService'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasSewerUtility',
  },

  // ========================
  // SPECIAL REVENUE FUNDS (700-799)
  // ========================
  {
    code: '701',
    name: 'Cumulative Capital Development (CCD)',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Cumulative capital development fund for capital projects.',
    typicalUses: [
      'Buildings and structures',
      'Equipment and vehicles',
      'Land acquisition',
      'Technology infrastructure',
    ],
    allowedUseTags: ['capital', 'equipment', 'buildings', 'vehicles'],
    citation: { code: 'IC 36-9-15.5', title: 'Cumulative Capital Development Fund' },
    applicableTo: ['town', 'city'],
  },
  {
    code: '702',
    name: 'Cumulative Capital Improvement (CCI)',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Cumulative capital improvement fund.',
    typicalUses: ['Capital improvements', 'Infrastructure'],
    allowedUseTags: ['capital', 'improvements'],
    applicableTo: ['town', 'city'],
  },
  {
    code: '703',
    name: 'Fire Fighting Fund',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Fund for fire department operations.',
    typicalUses: [
      'Fire personnel',
      'Fire equipment',
      'Training',
      'Fire station maintenance',
    ],
    allowedUseTags: ['fire', 'publicSafety', 'operations'],
    applicableTo: ['town', 'city'],
    conditionalOn: 'hasFireDepartment',
  },
  {
    code: '704',
    name: 'Fire Territory Operating',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Operating fund for fire territory participation.',
    typicalUses: ['Fire territory contributions', 'Shared fire services'],
    allowedUseTags: ['fire', 'territory', 'publicSafety'],
    citation: { code: 'IC 36-8-19', title: 'Fire Protection Territories' },
    applicableTo: ['town', 'city', 'township'],
    conditionalOn: 'hasFireTerritory',
  },
  {
    code: '705',
    name: 'Police Pension',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Fund for police pension obligations (pre-1977).',
    typicalUses: ['Police pension payments'],
    allowedUseTags: ['police', 'pension', 'publicSafety'],
    citation: { code: 'IC 36-8-6', title: 'Police Pension Fund' },
    applicableTo: ['city'],
  },
  {
    code: '706',
    name: 'Fire Pension',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Fund for fire pension obligations (pre-1977).',
    typicalUses: ['Fire pension payments'],
    allowedUseTags: ['fire', 'pension', 'publicSafety'],
    citation: { code: 'IC 36-8-7', title: 'Fire Pension Fund' },
    applicableTo: ['city'],
  },
  {
    code: '707',
    name: 'Cemetery Fund',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Fund for cemetery operations and maintenance.',
    typicalUses: ['Cemetery maintenance', 'Lot sales', 'Interments'],
    allowedUseTags: ['cemetery', 'operations'],
    applicableTo: ['town', 'city', 'township'],
    conditionalOn: 'hasCemetery',
  },
  {
    code: '708',
    name: 'Ambulance/EMS Fund',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Fund for ambulance and emergency medical services.',
    typicalUses: ['EMS personnel', 'Ambulance equipment', 'Medical supplies'],
    allowedUseTags: ['ambulance', 'ems', 'publicSafety'],
    applicableTo: ['town', 'city', 'township'],
    conditionalOn: 'hasAmbulance',
  },
  {
    code: '720',
    name: 'Rainy Day Fund',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Reserve fund for emergencies and revenue shortfalls.',
    typicalUses: ['Emergency expenditures', 'Revenue stabilization'],
    allowedUseTags: ['reserves', 'emergency', 'rainyDay'],
    citation: { code: 'IC 36-1-8-5.1', title: 'Rainy Day Fund' },
    applicableTo: ['town', 'city', 'township', 'county'],
  },
  {
    code: '750',
    name: 'Township Assistance',
    category: 'special',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: true,
    isRecommended: true,
    description: 'Fund for township assistance (poor relief) programs.',
    typicalUses: [
      'Emergency assistance',
      'Utility assistance',
      'Medical assistance',
      'Housing assistance',
    ],
    allowedUseTags: ['assistance', 'welfare', 'poorRelief'],
    citation: { code: 'IC 12-20', title: 'Township Assistance' },
    applicableTo: ['township'],
  },

  // ========================
  // TRUST/AGENCY FUNDS (800-899)
  // ========================
  {
    code: '801',
    name: 'Payroll Withholding',
    category: 'trust',
    fundType: 'FIDUCIARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: true,
    description: 'Agency fund for payroll withholdings.',
    typicalUses: ['Federal tax withholding', 'State tax withholding', 'PERF', 'Health insurance'],
    allowedUseTags: ['payroll', 'withholding', 'agency'],
    applicableTo: ['town', 'city', 'township', 'county'],
  },
  {
    code: '802',
    name: 'Performance Bond Deposits',
    category: 'trust',
    fundType: 'FIDUCIARY',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Agency fund for contractor performance bonds.',
    typicalUses: ['Performance bond deposits', 'Surety bond escrows'],
    allowedUseTags: ['bonds', 'escrow', 'agency'],
    applicableTo: ['town', 'city', 'township', 'county'],
  },

  // ========================
  // TIF FUNDS (900-999)
  // ========================
  {
    code: '901',
    name: 'TIF District #1',
    category: 'tif',
    fundType: 'GOVERNMENTAL',
    isRestricted: true,
    isRequired: false,
    isRecommended: false,
    description: 'Tax increment financing allocation area.',
    typicalUses: ['TIF infrastructure', 'Economic development', 'Debt service'],
    allowedUseTags: ['tif', 'redevelopment', 'economic'],
    citation: { code: 'IC 36-7-14', title: 'Redevelopment Commissions' },
    applicableTo: ['town', 'city', 'county'],
    conditionalOn: 'hasTIF',
  },
];

// ============================================================================
// STANDARD ACCOUNT DEFINITIONS
// ============================================================================

/**
 * Standard revenue account codes.
 */
export const IN_REVENUE_ACCOUNTS: INAccountDefinition[] = [
  {
    code: '4100',
    name: 'Property Taxes',
    type: 'REVENUE',
    isRequired: true,
    description: 'Ad valorem property tax receipts',
    sboacCode: '310',
    applicableFundCategories: ['general', 'road', 'park', 'special'],
  },
  {
    code: '4110',
    name: 'Local Income Tax (LIT)',
    type: 'REVENUE',
    isRequired: false,
    description: 'Local income tax distributions',
    sboacCode: '315',
    applicableFundCategories: ['general', 'special'],
  },
  {
    code: '4200',
    name: 'Licenses and Permits',
    type: 'REVENUE',
    isRequired: false,
    description: 'License fees and building permits',
    sboacCode: '320',
    applicableFundCategories: ['general'],
  },
  {
    code: '4300',
    name: 'Intergovernmental Revenue',
    type: 'REVENUE',
    isRequired: false,
    description: 'State and federal grants and distributions',
    sboacCode: '330',
  },
  {
    code: '4310',
    name: 'MVH Distributions',
    type: 'REVENUE',
    isRequired: true,
    description: 'Motor Vehicle Highway distributions',
    parentCode: '4300',
    sboacCode: '331',
    applicableFundCategories: ['road'],
  },
  {
    code: '4320',
    name: 'LRS Distributions',
    type: 'REVENUE',
    isRequired: true,
    description: 'Local Road and Street distributions',
    parentCode: '4300',
    sboacCode: '332',
    applicableFundCategories: ['road'],
  },
  {
    code: '4400',
    name: 'Charges for Services',
    type: 'REVENUE',
    isRequired: false,
    description: 'Fees charged for services provided',
    sboacCode: '340',
  },
  {
    code: '4410',
    name: 'Utility Service Charges',
    type: 'REVENUE',
    isRequired: true,
    description: 'Charges for water, sewer, and other utility services',
    parentCode: '4400',
    sboacCode: '341',
    applicableFundCategories: ['utility'],
  },
  {
    code: '4500',
    name: 'Fines and Forfeitures',
    type: 'REVENUE',
    isRequired: false,
    description: 'Court fines and code enforcement penalties',
    sboacCode: '350',
  },
  {
    code: '4600',
    name: 'Miscellaneous Revenue',
    type: 'REVENUE',
    isRequired: false,
    description: 'Other revenue not classified elsewhere',
    sboacCode: '360',
  },
  {
    code: '4610',
    name: 'Interest Income',
    type: 'REVENUE',
    isRequired: false,
    description: 'Interest earned on investments and deposits',
    parentCode: '4600',
    sboacCode: '361',
  },
  {
    code: '4700',
    name: 'Other Financing Sources',
    type: 'REVENUE',
    isRequired: false,
    description: 'Transfers in, bond proceeds, sale of assets',
    sboacCode: '370',
  },
];

/**
 * Standard expenditure account codes.
 */
export const IN_EXPENDITURE_ACCOUNTS: INAccountDefinition[] = [
  {
    code: '5100',
    name: 'Personal Services',
    type: 'EXPENDITURE',
    isRequired: true,
    description: 'Salaries, wages, and employee benefits',
    sboacCode: '410',
  },
  {
    code: '5110',
    name: 'Salaries and Wages',
    type: 'EXPENDITURE',
    isRequired: true,
    parentCode: '5100',
    sboacCode: '411',
  },
  {
    code: '5120',
    name: 'Employee Benefits',
    type: 'EXPENDITURE',
    isRequired: true,
    parentCode: '5100',
    description: 'PERF, health insurance, FICA',
    sboacCode: '412',
  },
  {
    code: '5200',
    name: 'Supplies',
    type: 'EXPENDITURE',
    isRequired: true,
    description: 'Office supplies, operating supplies, materials',
    sboacCode: '420',
  },
  {
    code: '5300',
    name: 'Other Services and Charges',
    type: 'EXPENDITURE',
    isRequired: true,
    description: 'Professional services, utilities, repairs',
    sboacCode: '430',
  },
  {
    code: '5310',
    name: 'Professional Services',
    type: 'EXPENDITURE',
    isRequired: false,
    parentCode: '5300',
    description: 'Legal, accounting, engineering services',
    sboacCode: '431',
  },
  {
    code: '5320',
    name: 'Repairs and Maintenance',
    type: 'EXPENDITURE',
    isRequired: false,
    parentCode: '5300',
    sboacCode: '432',
  },
  {
    code: '5330',
    name: 'Utilities',
    type: 'EXPENDITURE',
    isRequired: false,
    parentCode: '5300',
    description: 'Electric, gas, water, telephone',
    sboacCode: '433',
  },
  {
    code: '5340',
    name: 'Insurance',
    type: 'EXPENDITURE',
    isRequired: false,
    parentCode: '5300',
    sboacCode: '434',
  },
  {
    code: '5400',
    name: 'Capital Outlays',
    type: 'EXPENDITURE',
    isRequired: false,
    description: 'Equipment, vehicles, land, buildings',
    sboacCode: '440',
  },
  {
    code: '5500',
    name: 'Debt Service',
    type: 'EXPENDITURE',
    isRequired: false,
    description: 'Principal and interest payments',
    sboacCode: '450',
  },
  {
    code: '5510',
    name: 'Principal',
    type: 'EXPENDITURE',
    isRequired: false,
    parentCode: '5500',
    sboacCode: '451',
  },
  {
    code: '5520',
    name: 'Interest',
    type: 'EXPENDITURE',
    isRequired: false,
    parentCode: '5500',
    sboacCode: '452',
  },
  {
    code: '5600',
    name: 'Other Financing Uses',
    type: 'EXPENDITURE',
    isRequired: false,
    description: 'Transfers out, refunds',
    sboacCode: '460',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get required funds for a jurisdiction type.
 */
export function getRequiredFunds(kind: JurisdictionKind): INFundDefinition[] {
  return IN_STANDARD_FUNDS.filter(
    (f) => f.isRequired && f.applicableTo.includes(kind)
  );
}

/**
 * Get recommended funds for a jurisdiction with specific features.
 */
export function getRecommendedFunds(
  kind: JurisdictionKind,
  options?: {
    hasWaterUtility?: boolean;
    hasSewerUtility?: boolean;
    hasStormwaterUtility?: boolean;
    hasElectricUtility?: boolean;
    hasGasUtility?: boolean;
    hasFireDepartment?: boolean;
    hasFireTerritory?: boolean;
    hasParks?: boolean;
    hasCemetery?: boolean;
    hasTIF?: boolean;
    hasAmbulance?: boolean;
  }
): INFundDefinition[] {
  return IN_STANDARD_FUNDS.filter((f) => {
    // Must be applicable to this jurisdiction type
    if (!f.applicableTo.includes(kind)) return false;

    // Must be required or recommended
    if (!f.isRequired && !f.isRecommended) return false;

    // Check conditional requirements
    if (f.conditionalOn && options) {
      switch (f.conditionalOn) {
        case 'hasWaterUtility':
          if (!options.hasWaterUtility) return false;
          break;
        case 'hasSewerUtility':
          if (!options.hasSewerUtility) return false;
          break;
        case 'hasStormwaterUtility':
          if (!options.hasStormwaterUtility) return false;
          break;
        case 'hasElectricUtility':
          if (!options.hasElectricUtility) return false;
          break;
        case 'hasGasUtility':
          if (!options.hasGasUtility) return false;
          break;
        case 'hasFireDepartment':
          if (!options.hasFireDepartment) return false;
          break;
        case 'hasFireTerritory':
          if (!options.hasFireTerritory) return false;
          break;
        case 'hasParks':
          if (!options.hasParks) return false;
          break;
        case 'hasCemetery':
          if (!options.hasCemetery) return false;
          break;
        case 'hasTIF':
          if (!options.hasTIF) return false;
          break;
        case 'hasAmbulance':
          if (!options.hasAmbulance) return false;
          break;
      }
    }

    return true;
  });
}

/**
 * Get all applicable funds for a jurisdiction type.
 */
export function getApplicableFunds(kind: JurisdictionKind): INFundDefinition[] {
  return IN_STANDARD_FUNDS.filter((f) => f.applicableTo.includes(kind));
}

/**
 * Get standard funds for a jurisdiction type (backward compatibility).
 */
export function getStandardFundsFor(kind: string): INFundDefinition[] {
  return getApplicableFunds(kind as JurisdictionKind);
}

/**
 * Get fund category by code.
 */
export function getFundCategory(fundCode: string): FundCategory | undefined {
  const codeNum = parseInt(fundCode, 10);
  if (isNaN(codeNum)) return undefined;

  return IN_FUND_CATEGORIES.find(
    (c) => codeNum >= c.codeRange.start && codeNum <= c.codeRange.end
  );
}

/**
 * Get fund definition by code.
 */
export function getFundDefinition(fundCode: string): INFundDefinition | undefined {
  return IN_STANDARD_FUNDS.find((f) => f.code === fundCode);
}

/**
 * Validate a fund code for a jurisdiction.
 */
export function validateFundCode(
  fundCode: string,
  kind: JurisdictionKind
): { isValid: boolean; message?: string; fund?: INFundDefinition } {
  const fundDef = getFundDefinition(fundCode);

  if (!fundDef) {
    // Check if it's in a valid range
    const category = getFundCategory(fundCode);
    if (category) {
      return {
        isValid: true,
        message: `Custom fund in ${category.name} range`,
      };
    }
    return { isValid: false, message: 'Invalid fund code' };
  }

  if (!fundDef.applicableTo.includes(kind)) {
    return {
      isValid: false,
      message: `Fund ${fundCode} (${fundDef.name}) is not applicable to ${kind}`,
      fund: fundDef,
    };
  }

  return { isValid: true, fund: fundDef };
}

/**
 * Get standard accounts for a fund category.
 */
export function getAccountsForFundCategory(
  categoryId: string,
  type?: AccountType
): INAccountDefinition[] {
  let accounts = [
    ...IN_REVENUE_ACCOUNTS,
    ...IN_EXPENDITURE_ACCOUNTS,
  ];

  if (type) {
    accounts = accounts.filter((a) => a.type === type);
  }

  // Filter by applicable fund categories if specified
  accounts = accounts.filter(
    (a) =>
      !a.applicableFundCategories ||
      a.applicableFundCategories.includes(categoryId)
  );

  return accounts;
}

/**
 * Build a default chart of accounts for a fund.
 */
export function buildDefaultChartOfAccounts(
  fundCode: string,
  fundCategory: string
): INAccountDefinition[] {
  const category = getFundCategory(fundCode);
  if (!category) return [];

  // Get revenue accounts for this fund category
  const revenueAccounts = getAccountsForFundCategory(category.id, 'REVENUE');

  // Get expenditure accounts
  const expenditureAccounts = getAccountsForFundCategory(category.id, 'EXPENDITURE');

  return [...revenueAccounts, ...expenditureAccounts];
}
