// src/http/server.ts
//
// Express server for Town-in-a-Box-CORE HTTP API.
// Combines AI bootstrap with middleware, error handling, and validation.
//
// Run with: npm run dev
// Or directly: npx ts-node-dev --respawn src/http/server.ts

import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { Server } from 'http';
import {
  createAiBootstrap,
  InMemoryMeetingsService,
  AiBootstrap,
} from '../index';
import { ApraService } from '../engines/records/apra.service';
import { InMemoryApraService } from '../engines/records/in-memory-apra.service';
import { PostgresApraService } from '../engines/records/postgres-apra.service';
import { AiApraServiceImpl } from '../engines/records/ai-apra.service.impl';
import { ApraFeeCalculator } from '../engines/records/apra-fee.calculator';
import { ApraNotificationService } from '../engines/records/apra-notification.service';
import { NotificationService } from '../core/notifications/notification.service';
import { InMemoryNotificationService } from '../core/notifications/in-memory-notification.service';
import { EmailNotificationService } from '../core/notifications/email-notification.service';
import { TenantAwareDb } from '../db/tenant-aware-db';
import { createMeetingsRouter } from './routes/meetings.routes';
import { createRecordsRouter } from './routes/records.routes';
import { createTownshipAssistanceRouter } from './routes/township-assistance.routes';
import { createFenceViewerRouter } from './routes/fence-viewer.routes';
import { createWeedControlRouter } from './routes/weed-control.routes';
import { createCemeteriesRouter } from './routes/cemeteries.routes';
import { createFireContractsRouter } from './routes/fire-contracts.routes';
import { createInsuranceBondsRouter } from './routes/insurance-bonds.routes';
import { createPoliciesRouter } from './routes/policies.routes';
import { createFinanceRouter } from './routes/finance.routes';
import { createDashboardRouter, createFinanceSummaryRouter } from './routes/dashboard.routes';
import { requestLogger, tenantContextMiddleware } from './middleware';
import { errorHandler, notFoundHandler } from './errors';
import { createAiRouter, AiClient, MockAiClient } from './ai.routes';

// Township engine services
import { InMemoryAssistanceService } from '../engines/township-assistance/in-memory-assistance.service';
import { InMemoryAssistanceReportingService } from '../engines/township-assistance/in-memory-assistance.reporting.service';
import { InMemoryFenceViewerService } from '../engines/fence-viewer/in-memory-fence-viewer.service';
import { InMemoryWeedControlService } from '../engines/weed-control/in-memory-weed-control.service';
import { InMemoryCemeteryService } from '../engines/cemeteries/in-memory-cemetery.service';
import { InMemoryFireContractService } from '../engines/fire/in-memory-fire-contract.service';
import { InMemoryInsuranceBondsService } from '../engines/insurance-bonds/in-memory-insurance-bonds.service';
import { InMemoryPolicyService } from '../engines/policies/in-memory-policy.service';
import { InMemoryFinanceService } from '../engines/finance/in-memory-finance.service';
import { InMemoryFinanceRepository } from '../core/finance/in-memory-finance.repository';

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

  // Create APRA/records services
  // Select implementation based on environment:
  // - DATABASE_URL set → PostgresApraService (production)
  // - Otherwise → InMemoryApraService (development/testing)
  let baseRecords: ApraService;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = new TenantAwareDb(pool);
    baseRecords = new PostgresApraService(db);
    console.log('[Server] Using PostgresApraService (DATABASE_URL detected)');
  } else {
    baseRecords = new InMemoryApraService();
    console.log('[Server] Using InMemoryApraService (no DATABASE_URL)');
  }

  const aiApra = new AiApraServiceImpl(baseRecords, ai.core);
  const feeCalculator = new ApraFeeCalculator();

  // Select notification service based on environment:
  // - EMAIL_TRANSPORT set (not 'console') → EmailNotificationService (production)
  // - Otherwise → InMemoryNotificationService (development/testing)
  let notificationService: NotificationService;
  const emailTransport = process.env.EMAIL_TRANSPORT;
  if (emailTransport && emailTransport !== 'console') {
    notificationService = new EmailNotificationService();
    console.log(`[Server] Using EmailNotificationService (transport: ${emailTransport})`);
  } else {
    notificationService = new InMemoryNotificationService();
    console.log('[Server] Using InMemoryNotificationService');
  }

  const apraNotifications = new ApraNotificationService(
    baseRecords,
    notificationService
  );

  // AI client (can be injected for testing)
  const aiClient = config.aiClient ?? new MockAiClient();

  // ─────────────────────────────────────────────────────────────────────────
  // Security Middleware
  // ─────────────────────────────────────────────────────────────────────────

  // Security headers (helmet)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for API
  }));

  // CORS configuration
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-user-id', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
    credentials: true,
    maxAge: 86400, // 24 hours
  };
  app.use(cors(corsOptions));

  // Rate limiting (100 requests per minute per IP)
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    skip: (req) => req.path === '/health', // Skip rate limiting for health checks
  });
  app.use(limiter);

  // ─────────────────────────────────────────────────────────────────────────
  // Body Parsing & Logging
  // ─────────────────────────────────────────────────────────────────────────

  // Parse JSON bodies (with size limit)
  app.use(express.json({ limit: '10mb' }));

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
        dashboard: '/api/dashboard',
        meetings: '/api/meetings',
        records: '/api/records',
        finance: '/api/finance',
        'finance/fund-summary': '/api/finance/fund-summary',
        'finance/forecast': '/api/finance/forecast',
        ai: '/api/ai',
        health: '/health',
      },
      headers: {
        'x-tenant-id': 'Tenant identifier (default: lapel-in)',
        'x-user-id': 'User identifier (default: system)',
        'x-tenant-state': 'State code (default: IN)',
        'x-tenant-entity-class': 'Entity class: TOWN, CITY, TOWNSHIP (default: TOWN)',
      },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // API Routes
  // ─────────────────────────────────────────────────────────────────────────

  // Meetings routes
  app.use('/api/meetings', createMeetingsRouter(meetings));

  // Records/APRA routes (with AI, fees, and notifications)
  app.use('/api/records', createRecordsRouter({
    records: baseRecords,
    aiApra,
    feeCalculator,
    apraNotifications,
  }));

  // Township engine services
  const assistanceService = new InMemoryAssistanceService();
  const assistanceReporting = new InMemoryAssistanceReportingService(assistanceService);
  const fenceViewerService = new InMemoryFenceViewerService();
  const weedControlService = new InMemoryWeedControlService();
  const cemeteryService = new InMemoryCemeteryService();
  const fireContractService = new InMemoryFireContractService();
  const insuranceBondsService = new InMemoryInsuranceBondsService();
  const policyService = new InMemoryPolicyService();

  // Township routes (all under /api/township)
  app.use('/api/township/assistance', createTownshipAssistanceRouter({
    assistance: assistanceService,
    reporting: assistanceReporting,
  }));
  app.use('/api/township/fence-viewer', createFenceViewerRouter(fenceViewerService));
  app.use('/api/township/weed-control', createWeedControlRouter(weedControlService));
  app.use('/api/township/cemeteries', createCemeteriesRouter(cemeteryService));
  app.use('/api/township/fire', createFireContractsRouter(fireContractService));
  app.use('/api/township/insurance', createInsuranceBondsRouter(insuranceBondsService));

  // Policies routes (shared across all unit types, not under /township)
  app.use('/api/policies', createPoliciesRouter(policyService));

  // Finance Ledger routes
  const financeService = new InMemoryFinanceService();
  app.use('/api/finance', createFinanceRouter(financeService));

  // Dashboard and Finance Summary routes (uses the core finance repository)
  // Note: Cast needed due to index signature mismatch in FinanceRepository interface
  const financeRepo = new InMemoryFinanceRepository() as unknown as import('../core/finance/finance.repository').FinanceRepository;
  app.use('/api/dashboard', createDashboardRouter({ financeRepo }));
  app.use('/api/finance', createFinanceSummaryRouter({ financeRepo }));

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
 * Start the HTTP server with graceful shutdown support.
 */
export async function startServer(
  config: ServerConfig = { port: 3000 }
): Promise<Server> {
  const { app, ai } = await createServer(config);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;

  const server = app.listen(port, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('Town-in-a-Box-CORE API Server');
    console.log('='.repeat(60));
    console.log(`Server:    http://localhost:${port}`);
    console.log(`Health:    http://localhost:${port}/health`);
    console.log(`API Info:  http://localhost:${port}/api`);
    console.log(`Dashboard: http://localhost:${port}/api/dashboard`);
    console.log(`Meetings:  http://localhost:${port}/api/meetings`);
    console.log(`Records:   http://localhost:${port}/api/records`);
    console.log(`Finance:   http://localhost:${port}/api/finance`);
    console.log(`  Fund Summary: http://localhost:${port}/api/finance/fund-summary`);
    console.log(`  Forecast:     http://localhost:${port}/api/finance/forecast`);
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

  // Graceful shutdown handler
  const shutdown = (signal: string) => {
    console.log(`\n[Server] ${signal} received, shutting down gracefully...`);

    server.close((err) => {
      if (err) {
        console.error('[Server] Error during shutdown:', err);
        process.exit(1);
      }
      console.log('[Server] HTTP server closed');
      console.log('[Server] Shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
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
