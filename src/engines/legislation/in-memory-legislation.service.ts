// src/engines/legislation/in-memory-legislation.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  LegislativeItem,
  LegislativeItemSummary,
  CodeSection,
} from './legislation.types';
import {
  LegislationService,
  LegislativeItemFilter,
} from './legislation.service';

export interface InMemoryLegislationSeedData {
  items?: LegislativeItem[];
  codeSections?: CodeSection[];
}

/**
 * In-memory LegislationService for demos/tests. Data is scoped per tenant and
 * lasts only for the process lifetime.
 */
export class InMemoryLegislationService implements LegislationService {
  private items: LegislativeItem[];
  private codeSections: CodeSection[];

  constructor(seed: InMemoryLegislationSeedData = {}) {
    this.items = seed.items ? [...seed.items] : [];
    this.codeSections = seed.codeSections ? [...seed.codeSections] : [];
  }

  //
  // ITEMS
  //

  async listItems(
    ctx: TenantContext,
    filter: LegislativeItemFilter = {}
  ): Promise<LegislativeItemSummary[]> {
    let results = this.items.filter((i) => i.tenantId === ctx.tenantId);

    if (filter.type) {
      results = results.filter((i) => i.type === filter.type);
    }

    if (filter.numberContains) {
      const q = filter.numberContains.toLowerCase();
      results = results.filter(
        (i) => (i.number ?? '').toLowerCase().includes(q)
      );
    }

    if (filter.titleContains) {
      const q = filter.titleContains.toLowerCase();
      results = results.filter((i) => i.title.toLowerCase().includes(q));
    }

    if (filter.fromDate) {
      results = results.filter(
        (i) => i.adoptedAt && i.adoptedAt >= filter.fromDate!
      );
    }

    if (filter.toDate) {
      results = results.filter(
        (i) => i.adoptedAt && i.adoptedAt <= filter.toDate!
      );
    }

    return results.map<LegislativeItemSummary>((i) => ({
      id: i.id,
      tenantId: i.tenantId,
      type: i.type,
      number: i.number,
      title: i.title,
      adoptedAt: i.adoptedAt,
    }));
  }

  async getItem(
    ctx: TenantContext,
    id: string
  ): Promise<LegislativeItem | null> {
    return (
      this.items.find((i) => i.id === id && i.tenantId === ctx.tenantId) ?? null
    );
  }

  async upsertItem(
    ctx: TenantContext,
    item: LegislativeItem
  ): Promise<LegislativeItem> {
    const idx = this.items.findIndex(
      (i) => i.id === item.id && i.tenantId === ctx.tenantId
    );

    if (idx >= 0) {
      const updated: LegislativeItem = {
        ...item,
        tenantId: ctx.tenantId,
      };
      this.items[idx] = updated;
      return updated;
    }

    const created: LegislativeItem = {
      ...item,
      id: item.id || randomUUID(),
      tenantId: ctx.tenantId,
    };

    this.items.push(created);
    return created;
  }

  //
  // CODE SECTIONS
  //

  async listCodeSections(ctx: TenantContext): Promise<CodeSection[]> {
    return this.codeSections.filter((s) => s.tenantId === ctx.tenantId);
  }

  async getCodeSectionByCitation(
    ctx: TenantContext,
    citation: string
  ): Promise<CodeSection | null> {
    return (
      this.codeSections.find(
        (s) => s.citation === citation && s.tenantId === ctx.tenantId
      ) ?? null
    );
  }

  async upsertCodeSection(
    ctx: TenantContext,
    section: CodeSection
  ): Promise<CodeSection> {
    const idx = this.codeSections.findIndex(
      (s) => s.id === section.id && s.tenantId === ctx.tenantId
    );

    if (idx >= 0) {
      const updated: CodeSection = {
        ...section,
        tenantId: ctx.tenantId,
      };
      this.codeSections[idx] = updated;
      return updated;
    }

    const created: CodeSection = {
      ...section,
      id: section.id || randomUUID(),
      tenantId: ctx.tenantId,
    };

    this.codeSections.push(created);
    return created;
  }
}
