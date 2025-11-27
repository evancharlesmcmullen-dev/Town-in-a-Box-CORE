// src/states/in/legal/city/finance/in-city-finance.opinions.ts

import { LegalOpinion, StatutoryCitation } from '../../../../../core/state';

/**
 * Indiana City Finance Legal Opinions
 *
 * Pre-researched legal interpretations for finance questions
 * specific to Indiana cities.
 */

export const IN_CITY_FINANCE_OPINIONS: LegalOpinion[] = [
  {
    id: 'in-city-fin-001',
    domain: 'finance',
    topic: 'City Financial Officers',
    question: 'Who are the financial officers in an Indiana city?',
    answer:
      'In Indiana cities, the key financial officers are: (1) Controller (appointed by mayor in cities over 50,000 or elected in some cities) - chief fiscal officer responsible for accounting, claims, and financial reporting; (2) Clerk - maintains council records and may have financial duties; (3) City Court Clerk - handles court financial matters. Second and third class cities have a clerk-treasurer who performs combined duties.',
    citations: [
      { code: 'IC 36-4-10', title: 'City Controller' },
      { code: 'IC 36-4-6-9', title: 'Clerk Duties' },
      { code: 'IC 36-4-10.5', title: 'Second/Third Class City Financial Officers' },
    ],
    tags: ['controller', 'clerk', 'officers'],
  },
  {
    id: 'in-city-fin-002',
    domain: 'finance',
    topic: 'TIF Districts',
    question: 'How do Indiana cities manage Tax Increment Financing (TIF)?',
    answer:
      'Cities manage TIF through a Redevelopment Commission. Key requirements: (1) Establish allocation area by ordinance with DLGF approval; (2) Create TIF fund for captured increment; (3) Funds may only be used for purposes specified in the declaratory resolution; (4) Annual TIF reporting to DLGF is required; (5) Commission must hold public hearings before approving projects. The base assessed value is frozen when area is established.',
    citations: [
      { code: 'IC 36-7-14', title: 'Redevelopment Commissions' },
      { code: 'IC 36-7-14-39', title: 'TIF Fund' },
      { code: 'IC 36-7-14.5', title: 'Economic Development Areas' },
    ],
    tags: ['tif', 'redevelopment', 'increment'],
  },
  {
    id: 'in-city-fin-003',
    domain: 'finance',
    topic: 'Appropriation Ordinances',
    question: 'What is the process for city budget appropriations?',
    answer:
      'The city budget process: (1) Department heads submit budget requests to controller; (2) Controller prepares budget proposal; (3) Mayor submits budget to council; (4) Council holds public hearing (10 days published notice); (5) Council adopts appropriation ordinance before October 1; (6) Submit to DLGF for review; (7) DLGF issues budget order. Council may reduce but not increase mayor\'s request for executive departments.',
    citations: [
      { code: 'IC 6-1.1-17', title: 'Budget Procedures' },
      { code: 'IC 36-4-6-8', title: 'Council Budget Powers' },
      { code: 'DLGF Budget Calendar', notes: 'Annual deadlines' },
    ],
    tags: ['budget', 'appropriations', 'council'],
  },
  {
    id: 'in-city-fin-004',
    domain: 'finance',
    topic: 'Utility Revenues',
    question: 'How must Indiana cities account for utility revenues?',
    answer:
      'City utility revenues must be: (1) Deposited in separate utility funds (enterprise accounting); (2) Used only for utility purposes unless a transfer is specifically authorized; (3) Accounted for separately from general government; (4) Subject to rate ordinance requirements with public hearing; (5) May not subsidize general fund operations. Utility bond covenants may impose additional restrictions on revenue use.',
    citations: [
      { code: 'IC 8-1.5-3', title: 'Municipal Utility Finances' },
      { code: 'GASB 34', notes: 'Proprietary fund accounting requirements' },
    ],
    tags: ['utility', 'enterprise', 'revenues'],
  },
  {
    id: 'in-city-fin-005',
    domain: 'finance',
    topic: 'Debt Issuance',
    question: 'What are the debt limits and requirements for Indiana cities?',
    answer:
      'Indiana cities must follow: (1) Constitutional debt limit of 2% of assessed valuation for general obligation bonds; (2) Revenue bonds not subject to debt limit but require sufficient pledged revenues; (3) Bond Bank participation available for qualifying projects; (4) Petition and remonstrance process for some bonds; (5) DLGF approval for certain debt. Lease-purchase arrangements may have different requirements.',
    citations: [
      { code: 'IC 36-1-15', title: 'Local Government Debt' },
      { code: 'Indiana Constitution Article 13', title: 'Debt Limitations' },
      { code: 'IC 5-1-14', title: 'Bond Bank' },
    ],
    tags: ['debt', 'bonds', 'borrowing'],
  },
];

/**
 * Get all city finance opinions.
 */
export function getINCityFinanceOpinions(): LegalOpinion[] {
  return IN_CITY_FINANCE_OPINIONS;
}

/**
 * Find opinions by tag.
 */
export function findOpinionsByTag(tag: string): LegalOpinion[] {
  return IN_CITY_FINANCE_OPINIONS.filter((o) => o.tags?.includes(tag));
}

/**
 * Find opinion by ID.
 */
export function findOpinionById(id: string): LegalOpinion | undefined {
  return IN_CITY_FINANCE_OPINIONS.find((o) => o.id === id);
}
