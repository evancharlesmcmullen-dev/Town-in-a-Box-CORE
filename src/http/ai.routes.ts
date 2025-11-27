// src/http/ai.routes.ts
// AI routes for meeting summaries and deadline scanning.

import { Router, Request, Response } from 'express';
import { InMemoryMeetingsService } from '../engines/meetings/in-memory-meetings.service';
import { ApiRequest, asyncHandler } from './middleware';
import { NotFoundError, AiError, AiErrorCode } from './errors';
import { assertString, assertBoolean } from './validation';

/**
 * AI client interface for generating summaries and scanning deadlines.
 */
export interface AiClient {
  generateSummary(agendaText: string): Promise<string>;
  scanDeadlines(packetText: string): Promise<ScannedDeadline[]>;
}

/**
 * A deadline scanned from a meeting packet.
 */
export interface ScannedDeadline {
  id: string;
  description: string;
  dueDate: string;
  source: string;
  isConfirmed?: boolean;
}

/**
 * Mock AI client for testing.
 */
export class MockAiClient implements AiClient {
  async generateSummary(agendaText: string): Promise<string> {
    // Return a mock summary based on the agenda text
    const wordCount = agendaText.split(/\s+/).length;
    return `Mock AI Summary: This agenda contains approximately ${wordCount} words. Key topics will be discussed at the meeting.`;
  }

  async scanDeadlines(_packetText: string): Promise<ScannedDeadline[]> {
    // Return mock deadlines
    return [
      {
        id: 'deadline-1',
        description: 'Submit budget proposal',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'Page 1, Section 2',
      },
      {
        id: 'deadline-2',
        description: 'Review zoning amendments',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'Page 3, Section 1',
      },
    ];
  }
}

// In-memory storage for scanned deadlines (per tenant)
const scannedDeadlines = new Map<string, Map<string, ScannedDeadline>>();

function getDeadlineStore(tenantId: string): Map<string, ScannedDeadline> {
  let store = scannedDeadlines.get(tenantId);
  if (!store) {
    store = new Map();
    scannedDeadlines.set(tenantId, store);
  }
  return store;
}

/**
 * Create AI router with the provided services.
 */
export function createAiRouter(
  meetingsService: InMemoryMeetingsService,
  aiClient: AiClient
): Router {
  const router = Router();

  /**
   * POST /api/ai/summary - Generate AI summary for agenda text.
   */
  router.post(
    '/summary',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body;

      // Validate required fields
      assertString(body.agendaText, 'agendaText');

      try {
        const summary = await aiClient.generateSummary(body.agendaText);
        res.json({ summary });
      } catch (err) {
        throw wrapAiError(err);
      }
    })
  );

  /**
   * POST /api/meetings/:id/ai/summary - Generate and store AI summary for a meeting.
   */
  router.post(
    '/meetings/:id/ai/summary',
    asyncHandler(async (req: Request, res: Response) => {
      const apiReq = req as ApiRequest;
      const ctx = apiReq.tenantContext;
      const { id } = req.params;
      const body = req.body;

      // Validate required fields
      assertString(body.agendaText, 'agendaText');

      // Verify meeting exists
      const meeting = await meetingsService.getMeeting(ctx, id);
      if (!meeting) {
        throw new NotFoundError(`Meeting not found: ${id}`);
      }

      try {
        const summary = await aiClient.generateSummary(body.agendaText);
        const updatedMeeting = await meetingsService.updateAiSummary(ctx, id, summary);
        res.json(updatedMeeting);
      } catch (err) {
        if (err instanceof NotFoundError) throw err;
        throw wrapAiError(err);
      }
    })
  );

  /**
   * POST /api/ai/deadlines/scan - Scan a meeting packet for deadlines.
   */
  router.post(
    '/deadlines/scan',
    asyncHandler(async (req: Request, res: Response) => {
      const apiReq = req as ApiRequest;
      const ctx = apiReq.tenantContext;
      const body = req.body;

      // Validate required fields
      assertString(body.packetText, 'packetText');

      try {
        const deadlines = await aiClient.scanDeadlines(body.packetText);

        // Store scanned deadlines
        const store = getDeadlineStore(ctx.tenantId);
        for (const deadline of deadlines) {
          store.set(deadline.id, deadline);
        }

        res.json({ deadlines });
      } catch (err) {
        throw wrapAiError(err);
      }
    })
  );

  /**
   * POST /api/ai/deadlines/:deadlineId/review - Confirm or reject a scanned deadline.
   */
  router.post(
    '/deadlines/:deadlineId/review',
    asyncHandler(async (req: Request, res: Response) => {
      const apiReq = req as ApiRequest;
      const ctx = apiReq.tenantContext;
      const { deadlineId } = req.params;
      const body = req.body;

      // Validate required fields
      assertBoolean(body.isConfirmed, 'isConfirmed');

      // Find the deadline
      const store = getDeadlineStore(ctx.tenantId);
      const deadline = store.get(deadlineId);
      if (!deadline) {
        throw new NotFoundError(`Deadline not found: ${deadlineId}`);
      }

      // Update confirmation status
      deadline.isConfirmed = body.isConfirmed;
      store.set(deadlineId, deadline);

      res.json(deadline);
    })
  );

  return router;
}

/**
 * Wrap unknown errors as AI errors.
 */
function wrapAiError(err: unknown): AiError {
  if (err instanceof AiError) {
    return err;
  }

  // Determine error code from error message/type
  let code: AiErrorCode = 'AI_UNAVAILABLE';
  let message = 'AI service is unavailable';

  if (err instanceof Error) {
    message = err.message;
    if (message.includes('rate') || message.includes('limit')) {
      code = 'AI_RATE_LIMITED';
    } else if (message.includes('timeout')) {
      code = 'AI_TIMEOUT';
    } else if (message.includes('invalid') || message.includes('parse')) {
      code = 'AI_INVALID_RESPONSE';
    } else if (message.includes('config') || message.includes('key')) {
      code = 'AI_CONFIGURATION_ERROR';
    }
  }

  return new AiError(code, message);
}
