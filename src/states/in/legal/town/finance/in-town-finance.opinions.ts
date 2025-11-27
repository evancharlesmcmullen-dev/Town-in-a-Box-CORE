// src/states/in/legal/town/finance/in-town-finance.opinions.ts

import { LegalOpinion, StatutoryCitation } from '../../../../../core/state';

/**
 * Indiana Town Finance Legal Opinions
 *
 * Pre-researched legal interpretations for common finance questions
 * specific to Indiana towns. These can be used by AI assistants to
 * provide accurate guidance without re-researching each time.
 */

export const IN_TOWN_FINANCE_OPINIONS: LegalOpinion[] = [
  {
    id: 'in-town-fin-001',
    domain: 'finance',
    topic: 'Fund Transfers',
    question: 'Can an Indiana town transfer money between funds?',
    answer:
      'Generally, no. Indiana towns cannot transfer money between funds unless specifically authorized by statute. Most funds are restricted to their designated purpose (e.g., MVH funds must be used for road purposes). However, loans between funds may be permitted in limited circumstances with proper documentation and repayment plan. The General Fund cannot typically receive transfers from restricted funds.',
    citations: [
      { code: 'IC 36-1-8-4', title: 'Transfers Between Funds', notes: 'Loan provisions' },
      { code: 'SBOA Guidance', title: 'Fund Accounting Manual' },
    ],
    tags: ['funds', 'transfers', 'restrictions'],
  },
  {
    id: 'in-town-fin-002',
    domain: 'finance',
    topic: 'Additional Appropriations',
    question: 'How does an Indiana town make an additional appropriation?',
    answer:
      'To make an additional appropriation, the town must: (1) Publish notice at least 10 days before the public hearing; (2) Hold a public hearing; (3) Adopt the additional appropriation by ordinance; (4) Submit to DLGF for approval if it increases the budget. The appropriation must not exceed available revenues or fund balance. Emergency appropriations have separate procedures.',
    citations: [
      { code: 'IC 6-1.1-18-5', title: 'Additional Appropriations' },
      { code: 'IC 5-3-1-2', title: 'Publication Requirements' },
    ],
    tags: ['appropriations', 'budget', 'dlgf'],
  },
  {
    id: 'in-town-fin-003',
    domain: 'finance',
    topic: 'Encumbrances',
    question: 'Must Indiana towns encumber funds before spending?',
    answer:
      'Yes. Under Indiana law, a unit may not spend more than the amount appropriated. Best practice is to encumber funds when a purchase order or contract is issued to prevent over-appropriation. The SBOA strongly recommends encumbrance accounting. Spending beyond appropriations is a violation that may be cited in an audit.',
    citations: [
      { code: 'IC 5-11-10-1', title: 'Appropriation Limits' },
      { code: 'SBOA Uniform Compliance Guidelines' },
    ],
    tags: ['encumbrances', 'appropriations', 'purchasing'],
  },
  {
    id: 'in-town-fin-004',
    domain: 'finance',
    topic: 'Claims Processing',
    question: 'What is the proper claims approval process for Indiana towns?',
    answer:
      'All claims (except payroll) must be approved by the town council before payment. The claim must be itemized and filed with the clerk-treasurer. The council must review and approve claims at a public meeting. Payroll claims may be paid before council approval but must be ratified at the next meeting. Emergency claims may be paid with approval from two council members.',
    citations: [
      { code: 'IC 36-5-4-12', title: 'Claims Against Town' },
      { code: 'IC 5-11-10-1.6', title: 'Payroll Claims' },
    ],
    tags: ['claims', 'payments', 'council'],
  },
  {
    id: 'in-town-fin-005',
    domain: 'finance',
    topic: 'Investment of Funds',
    question: 'What investments are permitted for Indiana town funds?',
    answer:
      'Indiana towns may invest in: (1) Obligations of the U.S. government; (2) Obligations of federal agencies; (3) Repurchase agreements with qualified financial institutions; (4) Money market funds invested in U.S. obligations; (5) Deposit accounts in financial institutions; (6) Investment pools created by IC 5-13-9. The annual Board of Finance meeting must designate depositories.',
    citations: [
      { code: 'IC 5-13-9', title: 'Investment of Public Funds' },
      { code: 'IC 5-13-7-6', title: 'Board of Finance' },
    ],
    tags: ['investments', 'deposits', 'board-of-finance'],
  },
];

/**
 * Get all town finance opinions.
 */
export function getINTownFinanceOpinions(): LegalOpinion[] {
  return IN_TOWN_FINANCE_OPINIONS;
}

/**
 * Find opinions by tag.
 */
export function findOpinionsByTag(tag: string): LegalOpinion[] {
  return IN_TOWN_FINANCE_OPINIONS.filter((o) => o.tags?.includes(tag));
}

/**
 * Find opinion by ID.
 */
export function findOpinionById(id: string): LegalOpinion | undefined {
  return IN_TOWN_FINANCE_OPINIONS.find((o) => o.id === id);
}
