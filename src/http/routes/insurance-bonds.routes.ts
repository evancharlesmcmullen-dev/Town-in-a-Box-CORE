// src/http/routes/insurance-bonds.routes.ts
//
// REST API routes for the Insurance & Bonds engine.

import { Router, Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../core/tenancy/tenancy.types';
import {
  InsuranceBondsService,
  InsurancePolicyFilter,
  OfficialBondFilter,
} from '../../engines/insurance-bonds/insurance-bonds.service';
import {
  InsurancePolicyType,
  InsurancePolicyStatus,
  OfficialBondType,
  OfficialBondStatus,
} from '../../engines/insurance-bonds/insurance-bonds.types';
import { buildTenantContext, isTenantTownship } from '../context';

// Extend Request to include tenant context
interface ApiRequest extends Request {
  ctx: TenantContext;
}

/**
 * Create insurance & bonds router with all endpoints.
 *
 * @param insuranceBonds - The insurance & bonds service instance
 */
export function createInsuranceBondsRouter(
  insuranceBonds: InsuranceBondsService
): Router {
  const router = Router();

  // Middleware to attach tenant context and verify township
  router.use((req: Request, res: Response, next: NextFunction) => {
    const ctx = buildTenantContext(req);
    (req as ApiRequest).ctx = ctx;

    // Verify this is a township tenant
    if (!isTenantTownship(ctx.tenantId)) {
      res.status(403).json({
        error: 'Insurance & bonds management is only available for township tenants',
      });
      return;
    }

    next();
  });

  // ===========================================================================
  // CARRIERS
  // ===========================================================================

  /**
   * GET /api/township/insurance/carriers
   * List insurance carriers.
   */
  router.get('/carriers', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const carriers = await insuranceBonds.listCarriers(ctx);
      res.json(carriers);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/insurance/carriers/:id
   * Get a single carrier by ID.
   */
  router.get('/carriers/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const carrier = await insuranceBonds.getCarrier(ctx, req.params.id);

      if (!carrier) {
        res.status(404).json({ error: 'Carrier not found' });
        return;
      }

      res.json(carrier);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/insurance/carriers
   * Create a carrier.
   */
  router.post('/carriers', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.name) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      const input = {
        name: req.body.name,
        contactName: req.body.contactName,
        contactEmail: req.body.contactEmail,
        contactPhone: req.body.contactPhone,
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        city: req.body.city,
        state: req.body.state,
        postalCode: req.body.postalCode,
        notes: req.body.notes,
      };

      const carrier = await insuranceBonds.createCarrier(ctx, input);
      res.status(201).json(carrier);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PUT /api/township/insurance/carriers/:id
   * Update a carrier.
   */
  router.put('/carriers/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const input = {
        name: req.body.name,
        contactName: req.body.contactName,
        contactEmail: req.body.contactEmail,
        contactPhone: req.body.contactPhone,
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        city: req.body.city,
        state: req.body.state,
        postalCode: req.body.postalCode,
        notes: req.body.notes,
      };

      const carrier = await insuranceBonds.updateCarrier(ctx, req.params.id, input);
      res.json(carrier);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // POLICIES
  // ===========================================================================

  /**
   * GET /api/township/insurance/policies
   * List insurance policies with optional filters.
   */
  router.get('/policies', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: InsurancePolicyFilter = {};

      if (req.query.policyType) {
        filter.policyType = String(req.query.policyType) as InsurancePolicyType;
      }
      if (req.query.status) {
        filter.status = String(req.query.status) as InsurancePolicyStatus;
      }
      if (req.query.carrierId) {
        filter.carrierId = String(req.query.carrierId);
      }
      if (req.query.expiringWithinDays) {
        filter.expiringWithinDays = Number(req.query.expiringWithinDays);
      }

      const policies = await insuranceBonds.listPolicies(ctx, filter);
      res.json(policies);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/insurance/policies/:id
   * Get a single policy by ID.
   */
  router.get('/policies/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const policy = await insuranceBonds.getPolicy(ctx, req.params.id);

      if (!policy) {
        res.status(404).json({ error: 'Policy not found' });
        return;
      }

      res.json(policy);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/insurance/policies
   * Create a policy.
   */
  router.post('/policies', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.policyType) {
        res.status(400).json({ error: 'policyType is required' });
        return;
      }
      if (!req.body.policyNumber) {
        res.status(400).json({ error: 'policyNumber is required' });
        return;
      }
      if (!req.body.carrierId) {
        res.status(400).json({ error: 'carrierId is required' });
        return;
      }
      if (!req.body.effectiveDate) {
        res.status(400).json({ error: 'effectiveDate is required' });
        return;
      }
      if (!req.body.expirationDate) {
        res.status(400).json({ error: 'expirationDate is required' });
        return;
      }
      if (req.body.premiumAmountCents === undefined) {
        res.status(400).json({ error: 'premiumAmountCents is required' });
        return;
      }

      const input = {
        policyType: req.body.policyType,
        policyNumber: req.body.policyNumber,
        carrierId: req.body.carrierId,
        effectiveDate: new Date(req.body.effectiveDate),
        expirationDate: new Date(req.body.expirationDate),
        premiumAmountCents: req.body.premiumAmountCents,
        paymentFrequency: req.body.paymentFrequency,
        fundId: req.body.fundId,
        renewalNoticeDays: req.body.renewalNoticeDays,
        notes: req.body.notes,
      };

      const policy = await insuranceBonds.createPolicy(ctx, input);
      res.status(201).json(policy);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PUT /api/township/insurance/policies/:id
   * Update a policy.
   */
  router.put('/policies/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const input = {
        policyType: req.body.policyType,
        policyNumber: req.body.policyNumber,
        carrierId: req.body.carrierId,
        status: req.body.status,
        effectiveDate: req.body.effectiveDate
          ? new Date(req.body.effectiveDate)
          : undefined,
        expirationDate: req.body.expirationDate
          ? new Date(req.body.expirationDate)
          : undefined,
        premiumAmountCents: req.body.premiumAmountCents,
        paymentFrequency: req.body.paymentFrequency,
        fundId: req.body.fundId,
        renewalNoticeDays: req.body.renewalNoticeDays,
        notes: req.body.notes,
      };

      const policy = await insuranceBonds.updatePolicy(ctx, req.params.id, input);
      res.json(policy);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/insurance/policies/:id/renew
   * Renew a policy.
   */
  router.post('/policies/:id/renew', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.newExpirationDate) {
        res.status(400).json({ error: 'newExpirationDate is required' });
        return;
      }

      const policy = await insuranceBonds.renewPolicy(
        ctx,
        req.params.id,
        new Date(req.body.newExpirationDate),
        req.body.newPremiumAmountCents
      );
      res.status(201).json(policy);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // POLICY COVERAGES
  // ===========================================================================

  /**
   * GET /api/township/insurance/policies/:id/coverages
   * List coverages for a policy.
   */
  router.get('/policies/:id/coverages', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const coverages = await insuranceBonds.listCoveragesForPolicy(
        ctx,
        req.params.id
      );
      res.json(coverages);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/insurance/policies/:id/coverages
   * Add a coverage to a policy.
   */
  router.post('/policies/:id/coverages', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.coverageType) {
        res.status(400).json({ error: 'coverageType is required' });
        return;
      }
      if (req.body.limitAmountCents === undefined) {
        res.status(400).json({ error: 'limitAmountCents is required' });
        return;
      }

      const input = {
        policyId: req.params.id,
        coverageType: req.body.coverageType,
        limitAmountCents: req.body.limitAmountCents,
        deductibleAmountCents: req.body.deductibleAmountCents,
        perOccurrence: req.body.perOccurrence,
        aggregateLimitCents: req.body.aggregateLimitCents,
        notes: req.body.notes,
      };

      const coverage = await insuranceBonds.addCoverage(ctx, input);
      res.status(201).json(coverage);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * DELETE /api/township/insurance/coverages/:id
   * Remove a coverage.
   */
  router.delete('/coverages/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      await insuranceBonds.removeCoverage(ctx, req.params.id);
      res.status(204).send();
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // OFFICIAL BONDS
  // ===========================================================================

  /**
   * GET /api/township/insurance/bonds
   * List official bonds with optional filters.
   */
  router.get('/bonds', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const filter: OfficialBondFilter = {};

      if (req.query.bondType) {
        filter.bondType = String(req.query.bondType) as OfficialBondType;
      }
      if (req.query.status) {
        filter.status = String(req.query.status) as OfficialBondStatus;
      }
      if (req.query.officialName) {
        filter.officialNameContains = String(req.query.officialName);
      }
      if (req.query.expiringWithinDays) {
        filter.expiringWithinDays = Number(req.query.expiringWithinDays);
      }

      const bonds = await insuranceBonds.listBonds(ctx, filter);
      res.json(bonds);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * GET /api/township/insurance/bonds/:id
   * Get a single bond by ID.
   */
  router.get('/bonds/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;
      const bond = await insuranceBonds.getBond(ctx, req.params.id);

      if (!bond) {
        res.status(404).json({ error: 'Bond not found' });
        return;
      }

      res.json(bond);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/insurance/bonds
   * Create a bond.
   */
  router.post('/bonds', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.bondType) {
        res.status(400).json({ error: 'bondType is required' });
        return;
      }
      if (!req.body.officialName) {
        res.status(400).json({ error: 'officialName is required' });
        return;
      }
      if (!req.body.officialTitle) {
        res.status(400).json({ error: 'officialTitle is required' });
        return;
      }
      if (req.body.bondAmountCents === undefined) {
        res.status(400).json({ error: 'bondAmountCents is required' });
        return;
      }
      if (!req.body.effectiveDate) {
        res.status(400).json({ error: 'effectiveDate is required' });
        return;
      }
      if (!req.body.expirationDate) {
        res.status(400).json({ error: 'expirationDate is required' });
        return;
      }

      const input = {
        bondType: req.body.bondType,
        officialName: req.body.officialName,
        officialTitle: req.body.officialTitle,
        bondNumber: req.body.bondNumber,
        carrierId: req.body.carrierId,
        bondAmountCents: req.body.bondAmountCents,
        premiumAmountCents: req.body.premiumAmountCents,
        effectiveDate: new Date(req.body.effectiveDate),
        expirationDate: new Date(req.body.expirationDate),
        renewalNoticeDays: req.body.renewalNoticeDays,
        notes: req.body.notes,
      };

      const bond = await insuranceBonds.createBond(ctx, input);
      res.status(201).json(bond);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * PUT /api/township/insurance/bonds/:id
   * Update a bond.
   */
  router.put('/bonds/:id', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const input = {
        bondType: req.body.bondType,
        officialName: req.body.officialName,
        officialTitle: req.body.officialTitle,
        status: req.body.status,
        bondNumber: req.body.bondNumber,
        carrierId: req.body.carrierId,
        bondAmountCents: req.body.bondAmountCents,
        premiumAmountCents: req.body.premiumAmountCents,
        effectiveDate: req.body.effectiveDate
          ? new Date(req.body.effectiveDate)
          : undefined,
        expirationDate: req.body.expirationDate
          ? new Date(req.body.expirationDate)
          : undefined,
        renewalNoticeDays: req.body.renewalNoticeDays,
        filedWithCountyAt: req.body.filedWithCountyAt
          ? new Date(req.body.filedWithCountyAt)
          : undefined,
        countyRecordingReference: req.body.countyRecordingReference,
        notes: req.body.notes,
      };

      const bond = await insuranceBonds.updateBond(ctx, req.params.id, input);
      res.json(bond);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/insurance/bonds/:id/file
   * Record bond filing with county.
   */
  router.post('/bonds/:id/file', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.filedAt) {
        res.status(400).json({ error: 'filedAt is required' });
        return;
      }

      const bond = await insuranceBonds.recordBondFiling(
        ctx,
        req.params.id,
        new Date(req.body.filedAt),
        req.body.recordingReference
      );
      res.json(bond);
    } catch (err) {
      handleError(res, err);
    }
  });

  /**
   * POST /api/township/insurance/bonds/:id/renew
   * Renew a bond.
   */
  router.post('/bonds/:id/renew', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      if (!req.body.newExpirationDate) {
        res.status(400).json({ error: 'newExpirationDate is required' });
        return;
      }

      const bond = await insuranceBonds.renewBond(
        ctx,
        req.params.id,
        new Date(req.body.newExpirationDate),
        req.body.newPremiumAmountCents
      );
      res.status(201).json(bond);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ===========================================================================
  // RENEWAL TRACKING
  // ===========================================================================

  /**
   * GET /api/township/insurance/renewals
   * Get upcoming renewals (policies and bonds).
   */
  router.get('/renewals', async (req: Request, res: Response) => {
    try {
      const ctx = (req as ApiRequest).ctx;

      const withinDays = req.query.days ? Number(req.query.days) : 90;
      const renewals = await insuranceBonds.getUpcomingRenewals(ctx, withinDays);
      res.json(renewals);
    } catch (err) {
      handleError(res, err);
    }
  });

  return router;
}

/**
 * Handle errors and return appropriate HTTP status.
 */
function handleError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Unknown error';

  if (message.includes('not found')) {
    res.status(404).json({ error: message });
    return;
  }

  console.error('API Error:', err);
  res.status(500).json({ error: message });
}
