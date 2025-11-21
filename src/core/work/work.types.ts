// src/core/work/work.types.ts

/**
 * Citizen-facing service request (pothole, leak, tall grass, etc.).
 */
export interface ServiceRequest {
  id: string;
  tenantId: string;

  category: string;        // e.g. "pothole", "waterLeak"
  description: string;
  createdAt: Date;

  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;

  status: 'open' | 'inProgress' | 'closed';
}

/**
 * Internal work order executed by staff/crews.
 */
export interface WorkOrder {
  id: string;
  tenantId: string;

  serviceRequestId?: string;
  assetId?: string;

  summary: string;
  details?: string;

  status: 'open' | 'assigned' | 'inProgress' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

/**
 * A crew (field team) that can be assigned work orders.
 */
export interface Crew {
  id: string;
  tenantId: string;

  name: string;
  memberPersonIds: string[];
}

/**
 * A route (plow/mowing/meter reading, etc.).
 */
export interface Route {
  id: string;
  tenantId: string;

  name: string;
  description?: string;
  assetIds: string[];
}