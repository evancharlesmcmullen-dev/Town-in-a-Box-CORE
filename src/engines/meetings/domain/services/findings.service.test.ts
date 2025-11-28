// src/engines/meetings/domain/services/findings.service.test.ts
//
// Tests for the Findings of Fact Engine.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenantContext } from '../../../../core/tenancy/tenancy.types';
import {
  FindingsTemplateService,
  InMemoryFindingsStore,
} from './findings-template.service';
import {
  FindingsService,
  InMemoryFindingsDataStore,
  FindingsError,
} from './findings.service';
import {
  validateFindingsComplete,
  validateApprovalSupported,
  validateDenialSupported,
  validateFindingsForAction,
} from './compliance.service';
import { FindingsOfFact, FindingsCriterion } from '../types';
import { MEETINGS_ERROR_CODES } from '../constants/indiana.constants';

// Test fixture for TenantContext
const createTestContext = (
  tenantId = 'tenant-1',
  userId = 'user-1'
): TenantContext => ({
  tenantId,
  userId,
  jurisdiction: {
    tenantId,
    state: 'IN',
    kind: 'town',
    name: 'Test Town',
    authorityTags: ['bzaAuthority'],
  },
});

describe('FindingsTemplateService', () => {
  let templateService: FindingsTemplateService;
  let findingsStore: InMemoryFindingsStore;
  let ctx: TenantContext;

  beforeEach(() => {
    findingsStore = new InMemoryFindingsStore();
    templateService = new FindingsTemplateService(findingsStore);
    ctx = createTestContext();
  });

  describe('getCriteriaForCaseType', () => {
    it('should return 3 criteria for DEVELOPMENT_VARIANCE', () => {
      const criteria = templateService.getCriteriaForCaseType('DEVELOPMENT_VARIANCE');

      expect(criteria).toHaveLength(3);
      expect(criteria[0].criterionNumber).toBe(1);
      expect(criteria[0].criterionText).toContain('public health, safety, morals');
      expect(criteria[0].isRequired).toBe(true);
    });

    it('should return 5 criteria for USE_VARIANCE', () => {
      const criteria = templateService.getCriteriaForCaseType('USE_VARIANCE');

      expect(criteria).toHaveLength(5);
      expect(criteria[0].criterionNumber).toBe(1);
      expect(criteria[4].criterionNumber).toBe(5);
      expect(criteria[4].criterionText).toContain('comprehensive plan');
    });

    it('should return empty array for SPECIAL_EXCEPTION (local ordinance)', () => {
      const criteria = templateService.getCriteriaForCaseType('SPECIAL_EXCEPTION');

      expect(criteria).toHaveLength(0);
    });

    it('should return criteria with guidance notes', () => {
      const criteria = templateService.getCriteriaForCaseType('DEVELOPMENT_VARIANCE');

      // Case-insensitive match for 'practical difficulties'
      expect(criteria[2].guidanceNotes?.toLowerCase()).toContain('practical difficulties');
    });
  });

  describe('getAvailableCaseTypes', () => {
    it('should return all available case types', () => {
      const types = templateService.getAvailableCaseTypes();

      expect(types).toHaveLength(4);
      expect(types.map((t) => t.caseType)).toContain('DEVELOPMENT_VARIANCE');
      expect(types.map((t) => t.caseType)).toContain('USE_VARIANCE');
      expect(types.map((t) => t.caseType)).toContain('SPECIAL_EXCEPTION');
      expect(types.map((t) => t.caseType)).toContain('SUBDIVISION_WAIVER');
    });
  });

  describe('createFindingsFromTemplate', () => {
    it('should create findings with criteria from template', async () => {
      const findings = await templateService.createFindingsFromTemplate(ctx, {
        meetingId: 'meeting-1',
        agendaItemId: 'item-1',
        caseType: 'DEVELOPMENT_VARIANCE',
      });

      expect(findings.id).toBeDefined();
      expect(findings.caseType).toBe('DEVELOPMENT_VARIANCE');
      expect(findings.statutoryCite).toBe('IC 36-7-4-918.5');
      expect(findings.status).toBe('DRAFT');
      expect(findings.isLocked).toBe(false);
      expect(findings.criteria).toHaveLength(3);
    });

    it('should throw error for unknown case type', async () => {
      await expect(
        templateService.createFindingsFromTemplate(ctx, {
          meetingId: 'meeting-1',
          caseType: 'UNKNOWN_TYPE' as any,
        })
      ).rejects.toThrow('No template found');
    });
  });
});

describe('FindingsService', () => {
  let findingsService: FindingsService;
  let findingsDataStore: InMemoryFindingsDataStore;
  let ctx: TenantContext;

  beforeEach(() => {
    findingsDataStore = new InMemoryFindingsDataStore();
    findingsService = new FindingsService(findingsDataStore);
    ctx = createTestContext();
  });

  // Helper to create test findings with criteria
  const createTestFindings = async (
    withCriteria: Array<{
      criterionNumber: number;
      isRequired: boolean;
      boardDetermination?: string;
      boardRationale?: string;
    }> = []
  ): Promise<FindingsOfFact> => {
    const findings = await findingsDataStore.createFindings(ctx, {
      tenantId: ctx.tenantId,
      meetingId: 'meeting-1',
      agendaItemId: 'item-1',
      caseType: 'DEVELOPMENT_VARIANCE',
      statutoryCite: 'IC 36-7-4-918.5',
    });

    for (const c of withCriteria) {
      findingsDataStore.addCriterion({
        id: `criterion-${c.criterionNumber}`,
        tenantId: ctx.tenantId,
        findingsId: findings.id,
        criterionNumber: c.criterionNumber,
        criterionText: `Criterion ${c.criterionNumber} text`,
        isRequired: c.isRequired,
        boardDetermination: c.boardDetermination as any,
        boardRationale: c.boardRationale,
        orderIndex: c.criterionNumber - 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return findingsService.getFindingsById(ctx, findings.id) as Promise<FindingsOfFact>;
  };

  describe('validateFindings', () => {
    it('should report incomplete when missing determinations', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true },
        { criterionNumber: 2, isRequired: true },
        { criterionNumber: 3, isRequired: true },
      ]);

      const result = findingsService.validateFindings(findings);

      expect(result.isComplete).toBe(false);
      expect(result.missingCriteria).toHaveLength(3);
      expect(result.missingCriteria[0].missing).toBe('both');
    });

    it('should report incomplete when missing rationale', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true, boardDetermination: 'MET' },
        { criterionNumber: 2, isRequired: true, boardDetermination: 'MET', boardRationale: '' },
        { criterionNumber: 3, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because...' },
      ]);

      const result = findingsService.validateFindings(findings);

      expect(result.isComplete).toBe(false);
      expect(result.missingCriteria).toHaveLength(2);
      expect(result.missingCriteria[0].missing).toBe('rationale');
    });

    it('should be complete when all criteria have determinations and rationale', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 1' },
        { criterionNumber: 2, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 2' },
        { criterionNumber: 3, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 3' },
      ]);

      const result = findingsService.validateFindings(findings);

      expect(result.isComplete).toBe(true);
      expect(result.missingCriteria).toHaveLength(0);
    });

    it('should indicate canApprove when all required criteria are MET', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 1' },
        { criterionNumber: 2, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 2' },
        { criterionNumber: 3, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 3' },
      ]);

      const result = findingsService.validateFindings(findings);

      expect(result.canApprove).toBe(true);
      expect(result.canDeny).toBe(false);
    });

    it('should indicate canDeny when any required criterion is NOT_MET', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 1' },
        { criterionNumber: 2, isRequired: true, boardDetermination: 'NOT_MET', boardRationale: 'Because 2' },
        { criterionNumber: 3, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 3' },
      ]);

      const result = findingsService.validateFindings(findings);

      expect(result.canApprove).toBe(false);
      expect(result.canDeny).toBe(true);
      expect(result.unmetCriteria).toHaveLength(1);
      expect(result.unmetCriteria[0].criterionNumber).toBe(2);
    });
  });

  describe('updateStaffRecommendation', () => {
    it('should update staff recommendation', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true },
      ]);

      const criterion = await findingsService.updateStaffRecommendation(
        ctx,
        'criterion-1',
        { recommendation: 'MET', rationale: 'Staff recommends approval because...' }
      );

      expect(criterion.staffRecommendation).toBe('MET');
      expect(criterion.staffRationale).toBe('Staff recommends approval because...');
      expect(criterion.staffUpdatedByUserId).toBe(ctx.userId);
    });

    it('should throw error when criterion not found', async () => {
      await expect(
        findingsService.updateStaffRecommendation(ctx, 'nonexistent', {
          recommendation: 'MET',
          rationale: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('recordBoardDetermination', () => {
    it('should record board determination', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true },
      ]);

      const criterion = await findingsService.recordBoardDetermination(
        ctx,
        'criterion-1',
        { determination: 'MET', rationale: 'The board finds this criterion met because...' }
      );

      expect(criterion.boardDetermination).toBe('MET');
      expect(criterion.boardRationale).toBe('The board finds this criterion met because...');
      expect(criterion.boardUpdatedByUserId).toBe(ctx.userId);
    });

    it('should reject update when findings is locked', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true, boardDetermination: 'MET', boardRationale: 'Done' },
      ]);

      // Lock the findings
      await findingsDataStore.updateFindings(ctx, findings.id, { isLocked: true });

      await expect(
        findingsService.recordBoardDetermination(ctx, 'criterion-1', {
          determination: 'NOT_MET',
          rationale: 'Changed mind',
        })
      ).rejects.toThrow('Cannot modify findings after adoption');
    });
  });

  describe('adoptFindings', () => {
    it('should adopt complete findings', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 1' },
        { criterionNumber: 2, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 2' },
        { criterionNumber: 3, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 3' },
      ]);

      const adopted = await findingsService.adoptFindings(ctx, findings.id, 'vote-1');

      expect(adopted.status).toBe('ADOPTED');
      expect(adopted.voteRecordId).toBe('vote-1');
      expect(adopted.adoptedAt).toBeDefined();
      expect(adopted.adoptedByUserId).toBe(ctx.userId);
      expect(adopted.isLocked).toBe(true);
    });

    it('should reject adoption of incomplete findings', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true, boardDetermination: 'MET' },
        { criterionNumber: 2, isRequired: true },
        { criterionNumber: 3, isRequired: true },
      ]);

      await expect(
        findingsService.adoptFindings(ctx, findings.id, 'vote-1')
      ).rejects.toThrow('written findings required for all criteria');
    });

    it('should reject adoption of already locked findings', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true, boardDetermination: 'MET', boardRationale: 'Done' },
      ]);

      await findingsDataStore.updateFindings(ctx, findings.id, { isLocked: true });

      await expect(
        findingsService.adoptFindings(ctx, findings.id, 'vote-1')
      ).rejects.toThrow('already been adopted');
    });
  });

  describe('rejectFindings', () => {
    it('should reject findings for denied cases', async () => {
      const findings = await createTestFindings([
        { criterionNumber: 1, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 1' },
        { criterionNumber: 2, isRequired: true, boardDetermination: 'NOT_MET', boardRationale: 'Because 2' },
        { criterionNumber: 3, isRequired: true, boardDetermination: 'MET', boardRationale: 'Because 3' },
      ]);

      const rejected = await findingsService.rejectFindings(ctx, findings.id, 'vote-1');

      expect(rejected.status).toBe('REJECTED');
      expect(rejected.isLocked).toBe(true);
    });
  });

  describe('conditions', () => {
    it('should add a condition of approval', async () => {
      const findings = await createTestFindings([]);

      const condition = await findingsService.addCondition(ctx, findings.id, {
        conditionText: 'Applicant shall maintain a 10-foot setback',
      });

      expect(condition.conditionNumber).toBe(1);
      expect(condition.conditionText).toBe('Applicant shall maintain a 10-foot setback');
    });

    it('should auto-increment condition numbers', async () => {
      const findings = await createTestFindings([]);

      await findingsService.addCondition(ctx, findings.id, { conditionText: 'Condition 1' });
      const condition2 = await findingsService.addCondition(ctx, findings.id, { conditionText: 'Condition 2' });

      expect(condition2.conditionNumber).toBe(2);
    });

    it('should reject adding conditions to locked findings', async () => {
      const findings = await createTestFindings([]);
      await findingsDataStore.updateFindings(ctx, findings.id, { isLocked: true });

      await expect(
        findingsService.addCondition(ctx, findings.id, { conditionText: 'Late condition' })
      ).rejects.toThrow('Cannot modify');
    });
  });
});

describe('Compliance Validation Functions', () => {
  describe('validateFindingsComplete', () => {
    it('should pass for complete findings', () => {
      const findings: FindingsOfFact = {
        id: 'findings-1',
        tenantId: 'tenant-1',
        meetingId: 'meeting-1',
        caseType: 'DEVELOPMENT_VARIANCE',
        statutoryCite: 'IC 36-7-4-918.5',
        status: 'DRAFT',
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        criteria: [
          {
            id: 'c1',
            tenantId: 'tenant-1',
            findingsId: 'findings-1',
            criterionNumber: 1,
            criterionText: 'Criterion 1',
            isRequired: true,
            boardDetermination: 'MET',
            boardRationale: 'Because...',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = validateFindingsComplete(findings);

      expect(result.valid).toBe(true);
    });

    it('should fail for incomplete findings', () => {
      const findings: FindingsOfFact = {
        id: 'findings-1',
        tenantId: 'tenant-1',
        meetingId: 'meeting-1',
        caseType: 'DEVELOPMENT_VARIANCE',
        statutoryCite: 'IC 36-7-4-918.5',
        status: 'DRAFT',
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        criteria: [
          {
            id: 'c1',
            tenantId: 'tenant-1',
            findingsId: 'findings-1',
            criterionNumber: 1,
            criterionText: 'Criterion 1',
            isRequired: true,
            boardDetermination: 'MET',
            // Missing rationale
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = validateFindingsComplete(findings);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.FINDINGS_INCOMPLETE);
    });
  });

  describe('validateApprovalSupported', () => {
    it('should pass when all required criteria are MET', () => {
      const findings: FindingsOfFact = {
        id: 'findings-1',
        tenantId: 'tenant-1',
        meetingId: 'meeting-1',
        caseType: 'DEVELOPMENT_VARIANCE',
        statutoryCite: 'IC 36-7-4-918.5',
        status: 'DRAFT',
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        criteria: [
          {
            id: 'c1',
            tenantId: 'tenant-1',
            findingsId: 'findings-1',
            criterionNumber: 1,
            criterionText: 'Criterion 1',
            isRequired: true,
            boardDetermination: 'MET',
            boardRationale: 'Because...',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = validateApprovalSupported(findings);

      expect(result.valid).toBe(true);
    });

    it('should fail when required criterion is NOT_MET', () => {
      const findings: FindingsOfFact = {
        id: 'findings-1',
        tenantId: 'tenant-1',
        meetingId: 'meeting-1',
        caseType: 'DEVELOPMENT_VARIANCE',
        statutoryCite: 'IC 36-7-4-918.5',
        status: 'DRAFT',
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        criteria: [
          {
            id: 'c1',
            tenantId: 'tenant-1',
            findingsId: 'findings-1',
            criterionNumber: 1,
            criterionText: 'Criterion 1',
            isRequired: true,
            boardDetermination: 'NOT_MET',
            boardRationale: 'Because...',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = validateApprovalSupported(findings);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.FINDINGS_NOT_SUPPORTED);
    });
  });

  describe('validateDenialSupported', () => {
    it('should pass when at least one required criterion is NOT_MET', () => {
      const findings: FindingsOfFact = {
        id: 'findings-1',
        tenantId: 'tenant-1',
        meetingId: 'meeting-1',
        caseType: 'DEVELOPMENT_VARIANCE',
        statutoryCite: 'IC 36-7-4-918.5',
        status: 'DRAFT',
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        criteria: [
          {
            id: 'c1',
            tenantId: 'tenant-1',
            findingsId: 'findings-1',
            criterionNumber: 1,
            criterionText: 'Criterion 1',
            isRequired: true,
            boardDetermination: 'NOT_MET',
            boardRationale: 'Because...',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = validateDenialSupported(findings);

      expect(result.valid).toBe(true);
    });

    it('should fail when all required criteria are MET', () => {
      const findings: FindingsOfFact = {
        id: 'findings-1',
        tenantId: 'tenant-1',
        meetingId: 'meeting-1',
        caseType: 'DEVELOPMENT_VARIANCE',
        statutoryCite: 'IC 36-7-4-918.5',
        status: 'DRAFT',
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        criteria: [
          {
            id: 'c1',
            tenantId: 'tenant-1',
            findingsId: 'findings-1',
            criterionNumber: 1,
            criterionText: 'Criterion 1',
            isRequired: true,
            boardDetermination: 'MET',
            boardRationale: 'Because...',
            orderIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = validateDenialSupported(findings);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(MEETINGS_ERROR_CODES.FINDINGS_NOT_SUPPORTED);
    });
  });

  describe('validateFindingsForAction', () => {
    const createCompleteFindings = (determination: 'MET' | 'NOT_MET'): FindingsOfFact => ({
      id: 'findings-1',
      tenantId: 'tenant-1',
      meetingId: 'meeting-1',
      caseType: 'DEVELOPMENT_VARIANCE',
      statutoryCite: 'IC 36-7-4-918.5',
      status: 'DRAFT',
      isLocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      criteria: [
        {
          id: 'c1',
          tenantId: 'tenant-1',
          findingsId: 'findings-1',
          criterionNumber: 1,
          criterionText: 'Criterion 1',
          isRequired: true,
          boardDetermination: determination,
          boardRationale: 'Because...',
          orderIndex: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    it('should validate APPROVE action correctly', () => {
      const findings = createCompleteFindings('MET');
      const result = validateFindingsForAction(findings, 'APPROVE');

      expect(result.valid).toBe(true);
    });

    it('should reject APPROVE when criterion is NOT_MET', () => {
      const findings = createCompleteFindings('NOT_MET');
      const result = validateFindingsForAction(findings, 'APPROVE');

      expect(result.valid).toBe(false);
    });

    it('should validate DENY action correctly', () => {
      const findings = createCompleteFindings('NOT_MET');
      const result = validateFindingsForAction(findings, 'DENY');

      expect(result.valid).toBe(true);
    });

    it('should reject DENY when all criteria are MET', () => {
      const findings = createCompleteFindings('MET');
      const result = validateFindingsForAction(findings, 'DENY');

      expect(result.valid).toBe(false);
    });
  });
});
