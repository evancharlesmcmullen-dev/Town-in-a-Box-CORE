// src/http/server.ts
// Main HTTP server with all middleware and routes.

import express, { Express, Request, Response } from 'express';
import { InMemoryMeetingsService } from '../engines/meetings/in-memory-meetings.service';
import { requestLogger, tenantContextMiddleware } from './middleware';
import { errorHandler, notFoundHandler } from './errors';
import { createMeetingsRouter } from './meetings.routes';
import { createAiRouter, AiClient, MockAiClient } from './ai.routes';

/**
 * Configuration for creating the HTTP server.
 */
export interface ServerConfig {
  meetingsService?: InMemoryMeetingsService;
  aiClient?: AiClient;
}

/**
 * Create and configure the Express application.
 */
export function createApp(config: ServerConfig = {}): Express {
  const app = express();

  // Use provided services or create defaults
  const meetingsService = config.meetingsService ?? new InMemoryMeetingsService();
  const aiClient = config.aiClient ?? new MockAiClient();

  // ─────────────────────────────────────────────────────────────────────────
  // Middleware
  // ─────────────────────────────────────────────────────────────────────────

  // Parse JSON bodies
  app.use(express.json());

  // Request logging and correlation ID
  app.use(requestLogger);

  // Tenant context extraction
  app.use(tenantContextMiddleware);

  // ─────────────────────────────────────────────────────────────────────────
  // Health check
  // ─────────────────────────────────────────────────────────────────────────

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // API Routes
  // ─────────────────────────────────────────────────────────────────────────

  // Meetings routes
  app.use('/api/meetings', createMeetingsRouter(meetingsService));

  // AI routes (standalone endpoints)
  const aiRouter = createAiRouter(meetingsService, aiClient);
  app.use('/api/ai', aiRouter);

  // AI routes (meeting-specific endpoints need to be mounted on /api)
  app.use('/api', aiRouter);

  // ─────────────────────────────────────────────────────────────────────────
  // Error handling
  // ─────────────────────────────────────────────────────────────────────────

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

/**
 * Start the HTTP server on the specified port.
 */
export function startServer(app: Express, port: number = 3000): void {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

// Export types and utilities for use in other modules
export { AiClient, MockAiClient } from './ai.routes';
export { InMemoryMeetingsService } from '../engines/meetings/in-memory-meetings.service';
