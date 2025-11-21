// src/engines/cemeteries/cemetery.types.ts

// Core types for township cemetery registry and maintenance.

export type CemeteryStatus =
  | 'active'
  | 'inactive'
  | 'pioneer'
  | 'abandoned';

export interface Cemetery {
  id: string;
  tenantId: string;

  name: string;
  status: CemeteryStatus;

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;

  // For future GIS integration.
  latitude?: number;
  longitude?: number;

  notes?: string;
}

/**
 * Log entry for maintenance activities (mowing, repairs, etc.).
 */
export interface CemeteryMaintenanceLog {
  id: string;
  tenantId: string;

  cemeteryId: string;
  date: Date;
  description: string;
  performedBy?: string;        // contractor or staff name
}

/**
 * A burial plot/lot in a cemetery.
 */
export interface CemeteryPlot {
  id: string;
  tenantId: string;

  cemeteryId: string;

  section?: string;
  lot?: string;
  grave?: string;

  // If sold/owned, record deed info.
  deedHolderName?: string;
  deedIssuedAt?: Date;

  notes?: string;
}

/**
 * A record of a burial in a plot.
 */
export interface BurialRecord {
  id: string;
  tenantId: string;

  plotId: string;

  decedentName: string;
  dateOfBirth?: Date;
  dateOfDeath?: Date;
  burialDate?: Date;

  veteran?: boolean;
  notes?: string;
}