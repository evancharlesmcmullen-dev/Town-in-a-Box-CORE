// src/http/server.ts
//
// Express server for Town-in-a-Box-CORE HTTP API.
// Combines AI bootstrap with middleware, error handling, and validation.
//
// Run with: npm run dev
// Or directly: npx ts-node-dev --respawn src/http/server.ts

import express, { Express, Request, Response } from 'express';
import {
  createAiBootstrap,
  InMemoryMeetingsService,
  AiBootstrap,
} from '../index';
import { createMeetingsRouter } from './routes/meetings.routes';
import { requestLogger, tenantContextMiddleware } from './middleware';
import { errorHandler, notFoundHandler } from './errors';
import { createAiRouter, AiClient, MockAiClient } from './ai.routes';

export interface ServerConfig {
  port: number;
  aiClient?: AiClient;
}

export interface ServerInstance {
  app: Express;
  ai: AiBootstrap;
}

/**
 * Create and configure the Express application.
 *
 * Wires up:
 * - JSON body parsing
 * - Request logging and correlation
 * - Tenant context extraction
 * - AI bootstrap with meetings service
 * - All API routes
 * - Centralized error handling
 *
 * @returns Configured Express app and AI bootstrap
 */
export async function createServer(config: Partial<ServerConfig> = {}): Promise<ServerInstance> {
  const app = express();

  // Bootstrap AI services
  const ai = createAiBootstrap();

  // Create meetings service with AI wrapper
  const baseMeetings = new InMemoryMeetingsService();
  const meetings = ai.aiMeetingsService(baseMeetings);

  // AI client (can be injected for testing)
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
    res.json({
      status: 'ok',
      provider: ai.config.provider,
      model: ai.config.defaultModel,
    });
  });

  // API info
  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      name: 'Town-in-a-Box-CORE API',
      version: '0.1.0',
      endpoints: {
        meetings: '/api/meetings',
        ai: '/api/ai',
        health: '/health',
      },
      headers: {
        'x-tenant-id': 'Tenant identifier (default: lapel-in)',
        'x-user-id': 'User identifier (default: system)',
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // API Routes
  // ─────────────────────────────────────────────────────────────────────────

  // Meetings routes
  app.use('/api/meetings', createMeetingsRouter(meetings));

  // AI routes (standalone endpoints)
  const aiRouter = createAiRouter(baseMeetings, aiClient);
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

  return { app, ai };
}

/**
 * Start the HTTP server.
 */
export async function startServer(
  config: ServerConfig = { port: 3000 }
): Promise<void> {
  const { app, ai } = await createServer(config);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;

  app.listen(port, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('Town-in-a-Box-CORE API Server');
    console.log('='.repeat(60));
    console.log(`Server:    http://localhost:${port}`);
    console.log(`Health:    http://localhost:${port}/health`);
    console.log(`API Info:  http://localhost:${port}/api`);
    console.log(`Meetings:  http://localhost:${port}/api/meetings`);
    console.log(`AI:        http://localhost:${port}/api/ai`);
    console.log('');
    console.log(`AI Provider: ${ai.config.provider}`);
    console.log(`AI Model: ${ai.config.defaultModel}`);
    console.log('');
    console.log('Headers for requests:');
    console.log('  x-tenant-id: <tenant-id> (default: lapel-in)');
    console.log('  x-user-id: <user-id> (default: system)');
    console.log('='.repeat(60));
    console.log('');
  });
}

// Export types and utilities for use in other modules
export { AiClient, MockAiClient } from './ai.routes';
export { InMemoryMeetingsService } from '../engines/meetings/in-memory-meetings.service';

// Run server if this is the main module
if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
