// src/http/server.ts

import express from 'express';
import { createMeetingsRouter } from './routes/meetings.routes';

/**
 * Create the Express application with all routes mounted.
 */
export async function createServer(): Promise<express.Application> {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Mount routes
  app.use('/api/meetings', createMeetingsRouter());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

// Start server if run directly
if (require.main === module) {
  createServer()
    .then((app) => {
      const port = process.env.PORT ?? 3000;
      app.listen(port, () => {
        console.log(`Town-in-a-Box-CORE API at http://localhost:${port}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server', err);
      process.exit(1);
    });
}
