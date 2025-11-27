// src/http/server.ts
//
// Express server for Town-in-a-Box-CORE HTTP API.
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

export interface ServerConfig {
  port: number;
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
 * - AI bootstrap with meetings service
 * - All API routes
 *
 * @returns Configured Express app and AI bootstrap
 */
export async function createServer(): Promise<ServerInstance> {
  const app = express();

  // Middleware
  app.use(express.json());

  // Bootstrap AI services
  const ai = createAiBootstrap();
  console.log(`AI Provider: ${ai.config.provider}`);
  console.log(`AI Model: ${ai.config.defaultModel}`);

  // Create meetings service with AI wrapper
  const baseMeetings = new InMemoryMeetingsService();
  const meetings = ai.aiMeetingsService(baseMeetings);

  // Health check
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
        health: '/health',
      },
      headers: {
        'x-tenant-id': 'Tenant identifier (default: lapel-in)',
        'x-user-id': 'User identifier (default: system)',
      },
    });
  });

  // Mount route modules
  app.use('/api/meetings', createMeetingsRouter(meetings));

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  return { app, ai };
}

/**
 * Start the HTTP server.
 */
export async function startServer(
  config: ServerConfig = { port: 3000 }
): Promise<void> {
  const { app, ai } = await createServer();

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
    console.log('');
    console.log('Headers for requests:');
    console.log('  x-tenant-id: <tenant-id> (default: lapel-in)');
    console.log('  x-user-id: <user-id> (default: system)');
    console.log('='.repeat(60));
    console.log('');
  });
}

// Run server if this is the main module
if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
