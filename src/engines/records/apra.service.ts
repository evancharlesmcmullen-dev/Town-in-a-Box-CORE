import { TenantContext } from '../../core/tenancy/types';
import {
  ApraRequest,
  ApraRequestSummary,
  ApraRequestStatus,
} from './apra.types';

// Input for creating a new APRA request (from citizen portal or email intake).
export interface CreateApraRequestInput {
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  mailingAddressLine1?: string;
  mailingAddressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  requestText: string;
}

// Basic filters for listing/searching APRA requests.
export interface ApraRequestFilter {
  status?: ApraRequestStatus;
  fromDate?: Date;
  toDate?: Date;
  searchText?: string;        // free text in requestText, requester name, etc.
}

// Public service interface for the Records/APRA engine.
// Implementations will use LegalEngine.getApraRules(...) to compute deadlines
// and validate actions, but we keep that dependency out of the interface for now.
export interface ApraService {
  createRequest(
    ctx: TenantContext,
    input: CreateApraRequestInput
  ): Promise<ApraRequest>;

  getRequest(
    ctx: TenantContext,
    id: string
  ): Promise<ApraRequest | null>;

  listRequests(
    ctx: TenantContext,
    filter?: ApraRequestFilter
  ): Promise<ApraRequestSummary[]>;

  // Later we’ll add methods such as:
  // - requestClarification(...)
  // - recordClarificationResponse(...)
  // - attachRecords(...)
  // - recordResponse(...)
  // - closeRequest(...)
}
