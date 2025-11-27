// src/states/in/legal/township/finance/in-township-finance.opinions.ts

import { LegalOpinion, StatutoryCitation } from '../../../../../core/state';

/**
 * Indiana Township Finance Legal Opinions
 *
 * Pre-researched legal interpretations for finance questions
 * specific to Indiana townships.
 */

export const IN_TOWNSHIP_FINANCE_OPINIONS: LegalOpinion[] = [
  {
    id: 'in-twp-fin-001',
    domain: 'finance',
    topic: 'Trustee Authority',
    question: 'What financial authority does an Indiana township trustee have?',
    answer:
      'The township trustee is the chief executive and financial officer of the township. The trustee has authority to: (1) manage township funds; (2) pay claims approved by the board; (3) administer township assistance; (4) oversee township property. However, the trustee cannot expend funds without appropriation by the township board and must submit financial reports to the board.',
    citations: [
      { code: 'IC 36-6-4-2', title: 'Township Trustee Duties' },
      { code: 'IC 36-6-6', title: 'Township Fiscal Matters' },
    ],
    tags: ['trustee', 'authority', 'executive'],
  },
  {
    id: 'in-twp-fin-002',
    domain: 'finance',
    topic: 'Township Assistance',
    question: 'What are the financial requirements for township assistance?',
    answer:
      'Township assistance is funded from the township general fund. The trustee must: (1) establish written standards for eligibility; (2) investigate applications within 72 hours of complete application; (3) provide only for basic necessities (shelter, utilities, food, medical); (4) document all decisions; (5) maintain confidential case files. Assistance must be the last resort after other resources are exhausted.',
    citations: [
      { code: 'IC 12-20-6', title: 'Township Assistance Eligibility' },
      { code: 'IC 12-20-16', title: 'Application Investigation' },
    ],
    tags: ['assistance', 'poor-relief', 'welfare'],
  },
  {
    id: 'in-twp-fin-003',
    domain: 'finance',
    topic: 'Annual Financial Report',
    question: 'What annual financial reports must Indiana townships file?',
    answer:
      'Townships must: (1) Submit the Annual Financial Report (AFR) to SBOA via Gateway; (2) File the Personnel Report (Form 100R) by January 31; (3) Submit township assistance statistical report (TA-7 or successor); (4) Present annual financial report to the township board for approval. Budget forms must be submitted to DLGF per annual calendar.',
    citations: [
      { code: 'IC 5-11-1-4', title: 'Annual Financial Report' },
      { code: 'IC 36-6-6-9', title: 'Board Approval of Report' },
      { code: 'IC 12-20-28-3', title: 'Assistance Statistical Report' },
    ],
    tags: ['reporting', 'afr', 'sboa', 'gateway'],
  },
  {
    id: 'in-twp-fin-004',
    domain: 'finance',
    topic: 'Board Approval',
    question: 'What financial matters require township board approval?',
    answer:
      'The township board must approve: (1) Annual budget and tax levy; (2) Additional appropriations; (3) Claims against the township (except payroll per IC 5-11-10-1.6); (4) Purchase or sale of real property; (5) Contracts over threshold amounts; (6) Annual financial report. The board cannot increase the trustee\'s budget request.',
    citations: [
      { code: 'IC 36-6-6-2', title: 'Board Fiscal Powers' },
      { code: 'IC 36-6-6-9', title: 'Report Approval' },
    ],
    tags: ['board', 'approval', 'claims'],
  },
  {
    id: 'in-twp-fin-005',
    domain: 'finance',
    topic: 'Fire Protection Funding',
    question: 'How do Indiana townships fund fire protection?',
    answer:
      'Townships may fund fire protection through: (1) General fund appropriations; (2) Fire protection territory (per IC 36-8-11); (3) Cumulative fire fund levy (per IC 36-8-13); (4) Contract with a municipal fire department. If a fire territory is established, funding comes from the territory\'s tax levy. Equipment purchases may also be funded through bonds.',
    citations: [
      { code: 'IC 36-8-13', title: 'Cumulative Fire Fund' },
      { code: 'IC 36-8-11', title: 'Fire Protection Territories' },
    ],
    tags: ['fire', 'fire-territory', 'levy'],
  },
];

/**
 * Get all township finance opinions.
 */
export function getINTownshipFinanceOpinions(): LegalOpinion[] {
  return IN_TOWNSHIP_FINANCE_OPINIONS;
}

/**
 * Find opinions by tag.
 */
export function findOpinionsByTag(tag: string): LegalOpinion[] {
  return IN_TOWNSHIP_FINANCE_OPINIONS.filter((o) => o.tags?.includes(tag));
}

/**
 * Find opinion by ID.
 */
export function findOpinionById(id: string): LegalOpinion | undefined {
  return IN_TOWNSHIP_FINANCE_OPINIONS.find((o) => o.id === id);
}
