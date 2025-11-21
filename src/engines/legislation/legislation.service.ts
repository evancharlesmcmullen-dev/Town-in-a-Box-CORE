// src/engines/legislation/legislation.service.ts

import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  LegislativeItem,
  LegislativeItemSummary,
  LegislativeItemType,
  CodeSection,
} from './legislation.types';

export interface LegislativeItemFilter {
  type?: LegislativeItemType;
  numberContains?: string;
  titleContains?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Service interface for legislation and code registry.
 */
export interface LegislationService {
  //
  // LEGISLATIVE ITEMS (ORDINANCES / RESOLUTIONS)
  //

  listItems(
    ctx: TenantContext,
    filter?: LegislativeItemFilter
  ): Promise<LegislativeItemSummary[]>;

  getItem(
    ctx: TenantContext,
    id: string
  ): Promise<LegislativeItem | null>;

  upsertItem(
    ctx: TenantContext,
    item: LegislativeItem
  ): Promise<LegislativeItem>;

  //
  // CODE SECTIONS
  //

  listCodeSections(
    ctx: TenantContext
  ): Promise<CodeSection[]>;

  getCodeSectionByCitation(
    ctx: TenantContext,
    citation: string
  ): Promise<CodeSection | null>;

  upsertCodeSection(
    ctx: TenantContext,
    section: CodeSection
  ): Promise<CodeSection>;
}