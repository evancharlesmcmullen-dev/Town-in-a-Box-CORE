// src/states/in/legal/finance/in-financial-rules.engine.ts

import { JurisdictionProfile } from '../../../../core/tenancy/types';
import {
  FinanceRuleSet,
  FundDefinition,
  AppropriationRuleSet,
  FinanceReportingRequirement,
} from '../../../../core/finance/finance-rules.types';
import { FinancialRulesEngine } from '../../../../core/finance/finance-rules.engine';

/**
 * Indiana-specific financial rules engine.
 *
 * Phase 1: focus on towns (kind === 'town').
 * Later we can branch on townships/cities using j.kind and j.formId.
 */
export class INFinancialRulesEngine implements FinancialRulesEngine {
  readonly state = 'IN';

  getFinanceRules(j: JurisdictionProfile): FinanceRuleSet {
    if (j.state !== this.state) {
      throw new Error(`INFinancialRulesEngine only supports state IN, got ${j.state}`);
    }

    const fundCatalog = this.buildFundCatalogFor(j);
    const appropriationRules = this.buildAppropriationRulesFor(j);
    const reportingRequirements = this.buildReportingRequirementsFor(j);

    return {
      jurisdiction: j,
      fundCatalog,
      appropriationRules,
      reportingRequirements,
    };
  }

  //
  // FUND CATALOG (Indiana-specific)
  //

  private buildFundCatalogFor(_j: JurisdictionProfile): FundDefinition[] {
    const funds: FundDefinition[] = [
      {
        code: '101',
        name: 'General Fund',
        category: 'general',
        isRestricted: false,
        description: 'Primary operating fund for town operations.',
        allowedUseTags: ['operations', 'admin', 'publicSafety', 'parks'],
      },
      {
        code: '201',
        name: 'Motor Vehicle Highway (MVH)',
        category: 'road',
        isRestricted: true,
        description: 'Motor vehicle highway fund; must be used for road/street related purposes.',
        allowedUseTags: ['roads', 'streets', 'maintenance'],
      },
      {
        code: '202',
        name: 'Local Road and Street',
        category: 'road',
        isRestricted: true,
        description:
          'Local Road and Street fund; restricted to local road and street projects per Indiana statutes and SBOA guidance.',
        allowedUseTags: ['roads', 'streets', 'maintenance'],
      },
      {
        code: '601',
        name: 'Water Utility Operating',
        category: 'utility',
        isRestricted: true,
        description:
          'Water utility operating fund; revenues and expenses are restricted to the water utility enterprise.',
        allowedUseTags: ['utilityOperations', 'water'],
      },
      {
        code: '602',
        name: 'Sewer Utility Operating',
        category: 'utility',
        isRestricted: true,
        description:
          'Sewer utility operating fund; restricted to sewer utility operations and obligations.',
        allowedUseTags: ['utilityOperations', 'sewer'],
      },
      // TODO: add CCD, Cumulative Capital, Fire, Cemetery, Park funds, etc.
    ];

    return funds;
  }

  //
  // APPROPRIATION RULES (Indiana-specific)
  //

  private buildAppropriationRulesFor(_j: JurisdictionProfile): AppropriationRuleSet {
    return {
      enforceAppropriationLimit: true,
      allowsAdditionalAppropriations: true,
      additionalAppropriationNotes:
        'Additional appropriations require proper notice, hearing, and DLGF review/approval.',
      supportsEncumbrances: true,
    };
  }

  //
  // REPORTING REQUIREMENTS (Indiana-specific)
  //

  private buildReportingRequirementsFor(j: JurisdictionProfile): FinanceReportingRequirement[] {
    const reqs: FinanceReportingRequirement[] = [];

    // AFR - Annual Financial Report to SBOA (via Gateway)
    reqs.push({
      id: 'AFR',
      name: 'Annual Financial Report (AFR)',
      description:
        'Annual financial report of receipts, disbursements, and ending balances by fund, filed with SBOA via Gateway.',
      frequency: 'annual',
      dueDescription: 'Due by SBOA/IC deadline (typically 60 days after year end, check current guidance).',
      statutoryCitation: 'IC 5-11-1-4; SBOA AFR guidance',
      formCodes: ['GATEWAY_AFR'],
      overseenBy: ['SBOA'],
    });

    // DLGF Budget / Gateway forms
    reqs.push({
      id: 'BUDGET_GW',
      name: 'DLGF Budget / Gateway Upload',
      description:
        'Annual budget forms submitted via Gateway for DLGF review and budget order (Form 1, 2, 3, 4, 4B, etc.).',
      frequency: 'annual',
      dueDescription:
        'Hearing and adoption deadlines set annually by DLGF; budget forms must be submitted via Gateway by the prescribed dates.',
      statutoryCitation: 'IC 6-1.1-17; DLGF budget procedures',
      formCodes: ['FORM_1', 'FORM_2', 'FORM_3', 'FORM_4', 'FORM_4B'],
      overseenBy: ['DLGF', 'LegislativeBody'],
    });

    // Township assistance stats (TA-7) – for townships only
    if (j.kind === 'township') {
      reqs.push({
        id: 'TA7',
        name: 'Township Assistance Statistical Report (TA-7)',
        description:
          'Annual township assistance statistical report summarizing assistance cases and benefits.',
        frequency: 'annual',
        dueDescription: 'Due per township assistance reporting schedule.',
        statutoryCitation: 'IC 12-20-28-3',
        formCodes: ['TA-7'],
        overseenBy: ['SBOA', 'LegislativeBody'],
      });
    }

    // TODO: Add other IN-specific reports (TIF, CCD, food & beverage, etc.) as needed.

    return reqs;
  }
}
