// src/engines/meetings/domain/types/index.ts
//
// Domain types for the enhanced Meetings Module.
// Follows DDD patterns with entities, value objects, and enums.

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Status of a meeting in its lifecycle.
 */
export type MeetingStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'NOTICED'
  | 'IN_PROGRESS'
  | 'RECESSED'
  | 'ADJOURNED'
  | 'CANCELLED';

/**
 * Type of meeting.
 */
export type MeetingType =
  | 'REGULAR'
  | 'SPECIAL'
  | 'EXECUTIVE'
  | 'JOINT'
  | 'EMERGENCY';

/**
 * Status of an agenda.
 */
export type AgendaStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'AMENDED';

/**
 * Type of agenda item.
 */
export type AgendaItemType =
  | 'REGULAR'
  | 'CONSENT'
  | 'PUBLIC_HEARING'
  | 'EXECUTIVE_SESSION'
  | 'CEREMONIAL'
  | 'PRESENTATION'
  | 'NEW_BUSINESS'
  | 'OLD_BUSINESS';

/**
 * Status of an agenda item.
 */
export type AgendaItemStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'DISCUSSED'
  | 'TABLED'
  | 'WITHDRAWN'
  | 'ACTED_UPON';

/**
 * Status of an executive session.
 */
export type ExecutiveSessionStatus =
  | 'PENDING'
  | 'IN_SESSION'
  | 'ENDED'
  | 'CERTIFIED'
  | 'CANCELLED';

/**
 * Status of minutes.
 */
export type MinutesStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'AMENDED';

/**
 * Type of meeting action.
 */
export type ActionType =
  | 'MOTION'
  | 'RESOLUTION'
  | 'ORDINANCE'
  | 'AMENDMENT'
  | 'NOMINATION'
  | 'PROCEDURAL';

/**
 * Result of a meeting action.
 */
export type ActionResult =
  | 'PASSED'
  | 'FAILED'
  | 'TABLED'
  | 'WITHDRAWN'
  | 'DIED_FOR_LACK_OF_SECOND'
  | 'PENDING';

/**
 * Vote value for a member.
 */
export type VoteValue = 'YEA' | 'NAY' | 'ABSTAIN' | 'ABSENT' | 'RECUSED';

/**
 * Attendance status for a member.
 */
export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'EXCUSED'
  | 'LATE'
  | 'LEFT_EARLY';

/**
 * Type of governing body.
 */
export type GoverningBodyType =
  | 'COUNCIL'
  | 'BOARD'
  | 'COMMISSION'
  | 'BZA'
  | 'PLAN_COMMISSION'
  | 'REDEVELOPMENT'
  | 'PARKS_BOARD'
  | 'UTILITY_BOARD';

/**
 * Quorum calculation type.
 */
export type QuorumType = 'MAJORITY' | 'TWO_THIRDS' | 'SPECIFIC';

/**
 * Media type for meeting recordings.
 */
export type MediaType =
  | 'VIDEO'
  | 'AUDIO'
  | 'PRESENTATION'
  | 'DOCUMENT'
  | 'EXHIBIT';

/**
 * Notice method for Open Door Law.
 */
export type NoticeMethod =
  | 'PHYSICAL_POSTING'
  | 'WEBSITE'
  | 'NEWSPAPER'
  | 'EMAIL_LIST'
  | 'SOCIAL_MEDIA';

// =============================================================================
// VALUE OBJECTS
// =============================================================================

/**
 * Open Door Law compliance status.
 */
export interface OpenDoorCompliance {
  timeliness: 'COMPLIANT' | 'LATE' | 'UNKNOWN';
  requiredPostedBy?: string;
  actualPostedAt?: string;
  businessHoursLead?: number;
  notes?: string;
  lastCheckedAt: Date;
}

/**
 * Quorum rules for a governing body.
 */
export interface QuorumRules {
  quorumType: QuorumType;
  specificNumber?: number;
  countsAbsentees: boolean;
}

/**
 * Quorum calculation result.
 */
export interface QuorumResult {
  isQuorumMet: boolean;
  totalMembers: number;
  presentMembers: number;
  recusedMembers: number;
  requiredForQuorum: number;
  eligibleVoters: number;
}

// =============================================================================
// ENTITIES
// =============================================================================

/**
 * A location where meetings are held.
 */
export interface Location {
  id: string;
  tenantId: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state: string;
  zipCode?: string;
  isDefault: boolean;
  accessibilityInfo?: string;
  capacity?: number;
}

/**
 * A member of a governing body.
 */
export interface GoverningBodyMember {
  id: string;
  tenantId: string;
  bodyId: string;
  userId: string;
  title?: string;
  seatNumber?: number;
  termStart?: Date;
  termEnd?: Date;
  isVotingMember: boolean;
  isActive: boolean;
}

/**
 * Enhanced governing body with quorum rules.
 */
export interface GoverningBody {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  bodyType?: GoverningBodyType;
  quorumType: QuorumType;
  quorumNumber?: number;
  totalSeats: number;
  members?: GoverningBodyMember[];
}

/**
 * An agenda for a meeting.
 */
export interface Agenda {
  id: string;
  tenantId: string;
  meetingId: string;
  status: AgendaStatus;
  version: number;
  title?: string;
  preamble?: string;
  postamble?: string;
  items?: AgendaItem[];
  publishedAt?: Date;
  publishedByUserId?: string;
  approvedAt?: Date;
  approvedByUserId?: string;
  documentFileId?: string;
  createdByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * An item on a meeting agenda.
 */
export interface AgendaItem {
  id: string;
  tenantId: string;
  meetingId: string;
  agendaId?: string;
  orderIndex: number;
  title: string;
  description?: string;
  status: AgendaItemStatus;
  itemType: AgendaItemType;
  parentItemId?: string;
  children?: AgendaItem[];
  durationMinutes?: number;
  requiresVote: boolean;
  requiresPublicHearing: boolean;
  presenterName?: string;
  presenterUserId?: string;
  supportingDocumentIds?: string[];
  discussionNotes?: string;
  relatedType?: string;
  relatedId?: string;
}

/**
 * An executive session during a meeting.
 */
export interface ExecutiveSession {
  id: string;
  tenantId: string;
  meetingId: string;
  agendaItemId?: string;
  status: ExecutiveSessionStatus;
  basisCode: string;
  basisDescription?: string;
  statutoryCite: string;
  subject: string;
  scheduledStart?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  attendeeUserIds?: string[];
  preCertStatement?: string;
  preCertByUserId?: string;
  preCertAt?: Date;
  postCertStatement?: string;
  postCertByUserId?: string;
  postCertAt?: Date;
  postCertDocumentId?: string;
  createdByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A recusal by a member from an agenda item or meeting.
 */
export interface MemberRecusal {
  id: string;
  tenantId: string;
  meetingId: string;
  agendaItemId?: string;
  memberId: string;
  reason?: string;
  statutoryCite?: string;
  disclosedAt: Date;
}

/**
 * A formal action taken at a meeting.
 */
export interface MeetingAction {
  id: string;
  tenantId: string;
  meetingId: string;
  agendaItemId?: string;
  actionType: ActionType;
  actionNumber?: string;
  title: string;
  description?: string;
  movedByUserId?: string;
  secondedByUserId?: string;
  movedAt?: Date;
  result?: ActionResult;
  effectiveDate?: Date;
  documentFileId?: string;
  votes?: VoteRecord[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A vote cast by a member.
 */
export interface VoteRecord {
  id: string;
  tenantId: string;
  meetingId: string;
  agendaItemId?: string;
  actionId?: string;
  memberId: string;
  vote: VoteValue;
  isRecused: boolean;
  recusalId?: string;
  votedAt: Date;
}

/**
 * Attendance record for a member at a meeting.
 */
export interface MeetingAttendance {
  id: string;
  tenantId: string;
  meetingId: string;
  memberId: string;
  status: AttendanceStatus;
  arrivedAt?: Date;
  departedAt?: Date;
  notes?: string;
}

/**
 * Minutes for a meeting.
 */
export interface Minutes {
  id: string;
  tenantId: string;
  meetingId: string;
  status: MinutesStatus;
  version: number;
  body?: string;
  preparedByUserId?: string;
  preparedAt?: Date;
  approvedAt?: Date;
  approvedByUserId?: string;
  approvalMeetingId?: string;
  documentFileId?: string;
  amendments?: MinutesAmendment[];
}

/**
 * An amendment to meeting minutes.
 */
export interface MinutesAmendment {
  id: string;
  tenantId: string;
  minutesId: string;
  amendmentType: 'CORRECTION' | 'ADDITION' | 'DELETION';
  sectionReference?: string;
  originalText?: string;
  amendedText?: string;
  reason?: string;
  proposedByUserId?: string;
  proposedAt: Date;
  approvedAt?: Date;
  approvedAtMeetingId?: string;
}

/**
 * Media associated with a meeting.
 */
export interface MeetingMedia {
  id: string;
  tenantId: string;
  meetingId: string;
  mediaType: MediaType;
  title: string;
  description?: string;
  fileId?: string;
  externalUrl?: string;
  provider?: string;
  durationSeconds?: number;
  startOffsetSeconds?: number;
  status: 'PROCESSING' | 'AVAILABLE' | 'FAILED' | 'ARCHIVED';
  isPublic: boolean;
  uploadedByUserId?: string;
  uploadedAt: Date;
  timestamps?: MediaTimestamp[];
}

/**
 * A timestamp linking agenda items to media.
 */
export interface MediaTimestamp {
  id: string;
  tenantId: string;
  mediaId: string;
  agendaItemId?: string;
  actionId?: string;
  timestampSeconds: number;
  label?: string;
}

/**
 * A notice posted for a meeting.
 */
export interface MeetingNotice {
  id: string;
  meetingId: string;
  postedAt: Date;
  postedByUserId: string;
  methods: NoticeMethod[];
  locations: string[];
  proofUris?: string[];
  requiredLeadTimeHours: number;
  isTimely: boolean;
  notes?: string;
}

/**
 * Enhanced meeting entity with all relationships.
 */
export interface Meeting {
  id: string;
  tenantId: string;
  bodyId: string;
  body?: GoverningBody;
  type: MeetingType;
  status: MeetingStatus;
  scheduledStart: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  location: string;
  locationId?: string;
  locationDetails?: Location;
  isHybrid: boolean;
  remoteMeetingLink?: string;
  isEmergency: boolean;

  // Agenda
  agenda?: Agenda;

  // Attendance
  attendance?: MeetingAttendance[];

  // Executive sessions
  executiveSessions?: ExecutiveSession[];

  // Recusals
  recusals?: MemberRecusal[];

  // Actions and votes
  actions?: MeetingAction[];

  // Minutes
  minutes?: Minutes;

  // Media
  media?: MeetingMedia[];

  // Notice tracking
  notices?: MeetingNotice[];
  noticePostedAt?: Date;
  lastNoticePostedAt?: Date;
  openDoorCompliance?: OpenDoorCompliance;

  // Cancellation
  cancelledAt?: Date;
  cancelledByUserId?: string;
  cancellationReason?: string;

  // Session lifecycle
  recessedAt?: Date;
  adjournedAt?: Date;
  adjournedByUserId?: string;

  // AI-generated content
  aiCouncilSummary?: string;
  aiSummaryGeneratedAt?: string;

  // Audit
  createdByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lightweight meeting summary for list views.
 */
export interface MeetingSummary {
  id: string;
  tenantId: string;
  bodyId: string;
  bodyName?: string;
  type: MeetingType;
  status: MeetingStatus;
  scheduledStart: Date;
  location: string;
  isEmergency: boolean;
  hasNotice: boolean;
  hasAgenda: boolean;
  hasMinutes: boolean;
}

// =============================================================================
// RECORD BUNDLE (for APRA compliance)
// =============================================================================

/**
 * A bundle of records for a meeting (APRA compliance).
 */
export interface MeetingRecordBundle {
  id: string;
  tenantId: string;
  meetingId: string;
  status: 'PENDING' | 'ASSEMBLING' | 'COMPLETE' | 'ARCHIVED';
  agendaFileId?: string;
  minutesFileId?: string;
  noticeFileIds?: string[];
  supportingDocumentIds?: string[];
  mediaFileIds?: string[];
  archivedAt?: Date;
  archiveLocation?: string;
  assembledAt?: Date;
  assembledByUserId?: string;
}

// =============================================================================
// NOTICE & PUBLICATION TYPES
// =============================================================================

/**
 * Reason for a notice/publication requirement.
 * Maps to Indiana statutory requirements.
 */
export type NoticeReason =
  | 'OPEN_DOOR_MEETING'
  | 'GENERAL_PUBLIC_HEARING'
  | 'ZONING_MAP_AMENDMENT'
  | 'VARIANCE_HEARING'
  | 'BOND_HEARING'
  | 'BUDGET_HEARING'
  | 'ANNEXATION_HEARING'
  | 'TAX_ABATEMENT_HEARING'
  | 'ECONOMIC_DEVELOPMENT_HEARING';

/**
 * Status of a notice requirement.
 */
export type NoticeRequirementStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SATISFIED'
  | 'FAILED'
  | 'WAIVED';

/**
 * Risk level for deadline compliance.
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'IMPOSSIBLE';

/**
 * Day of week for newspaper schedules.
 */
export type DayOfWeek =
  | 'SUNDAY'
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY';

/**
 * Notice channel type.
 */
export type NoticeChannelType =
  | 'NEWSPAPER'
  | 'WEBSITE'
  | 'PHYSICAL_POSTING'
  | 'EMAIL_LIST'
  | 'SOCIAL_MEDIA';

/**
 * Publication rule defining statutory requirements.
 */
export interface PublicationRule {
  id: string;
  tenantId: string;
  ruleType: NoticeReason;
  requiredPublications: number;
  requiredLeadDays: number;
  mustBeConsecutive: boolean;
  requiredChannels: NoticeChannelType[];
  statutoryCite: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Submission deadline configuration for a newspaper.
 */
export interface SubmissionDeadline {
  publicationDay: DayOfWeek;
  submissionDay: DayOfWeek;
  submissionTime: string; // HH:MM format (24hr)
  daysBeforePublication: number;
}

/**
 * Newspaper schedule for publication planning.
 */
export interface NewspaperSchedule {
  id: string;
  tenantId: string;
  name: string;
  publicationDays: DayOfWeek[];
  submissionDeadlines: SubmissionDeadline[];
  submissionLeadDays: number;
  holidayClosures: Date[];
  canAccommodateRush: boolean;
  isLegalPublication: boolean;
  contactInfo?: {
    phone?: string;
    email?: string;
    contactName?: string;
    address?: string;
  };
  isActive: boolean;
  createdAt: Date;
}

/**
 * A required publication for a deadline calculation.
 */
export interface RequiredPublication {
  publicationNumber: number;
  latestPublicationDate: Date;
  submissionDeadline: Date;
  newspaperChannelId: string | null;
}

/**
 * Deadline calculation result.
 */
export interface DeadlineCalculation {
  hearingDate: Date;
  noticeReason: NoticeReason;
  rule: PublicationRule;
  requiredPublications: RequiredPublication[];
  earliestSubmissionDeadline: Date;
  riskLevel: RiskLevel;
  riskMessage: string | null;
}

/**
 * Notice requirement for a meeting or hearing.
 */
export interface NoticeRequirement {
  id: string;
  tenantId: string;
  meetingId: string;
  agendaItemId?: string;
  noticeReason: NoticeReason;
  ruleId: string;
  status: NoticeRequirementStatus;
  calculatedDeadlineAt?: Date;
  riskLevel?: RiskLevel;
  satisfiedAt?: Date;
  satisfiedByUserId?: string;
  failedAt?: Date;
  failureReason?: string;
  waivedAt?: Date;
  waivedByUserId?: string;
  waiverReason?: string;
  deliveries?: NoticeDelivery[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Delivery status for a notice.
 */
export type NoticeDeliveryStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED';

/**
 * A delivery attempt for a notice requirement.
 */
export interface NoticeDelivery {
  id: string;
  tenantId: string;
  requirementId: string;
  channelType: NoticeChannelType;
  channelId?: string; // Reference to newspaper_schedules or notice_channels
  status: NoticeDeliveryStatus;
  publicationNumber: number; // 1st, 2nd publication etc.
  submittedAt?: Date;
  submittedByUserId?: string;
  targetPublicationDate?: Date;
  actualPublicationDate?: Date;
  confirmedAt?: Date;
  confirmedByUserId?: string;
  proofDocumentId?: string;
  affidavitFileId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a notice delivery.
 */
export interface CreateNoticeDeliveryInput {
  channelType: NoticeChannelType;
  channelId?: string;
  publicationNumber: number;
  targetPublicationDate?: Date;
  notes?: string;
}

/**
 * Confirmation input for a delivery.
 */
export interface DeliveryConfirmation {
  actualPublicationDate: Date;
  proofDocumentId?: string;
  affidavitFileId?: string;
  notes?: string;
}

// =============================================================================
// FINDINGS OF FACT TYPES
// =============================================================================

/**
 * Case types that require findings of fact.
 */
export type FindingsCaseType =
  | 'DEVELOPMENT_VARIANCE'
  | 'USE_VARIANCE'
  | 'SPECIAL_EXCEPTION'
  | 'SUBDIVISION_WAIVER';

/**
 * Status of a findings of fact record.
 */
export type FindingsStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ADOPTED'
  | 'REJECTED';

/**
 * Determination for a criterion (staff recommendation or board determination).
 */
export type FindingsDetermination =
  | 'MET'
  | 'NOT_MET'
  | 'UNABLE_TO_DETERMINE';

/**
 * A criterion template for findings of fact.
 */
export interface CriterionTemplate {
  criterionNumber: number;
  criterionText: string;
  statutoryCite?: string;
  isRequired: boolean;
  guidanceNotes?: string;
}

/**
 * A findings template for a case type.
 */
export interface FindingsTemplate {
  id: string;
  tenantId: string;
  caseType: FindingsCaseType;
  templateName: string;
  statutoryCite: string;
  criteriaTemplate: CriterionTemplate[];
  isActive: boolean;
  isDefault: boolean;
  createdByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * An individual criterion within findings of fact.
 */
export interface FindingsCriterion {
  id: string;
  tenantId: string;
  findingsId: string;
  criterionNumber: number;
  criterionText: string;
  statutoryCite?: string;
  isRequired: boolean;

  // Staff analysis
  staffRecommendation?: FindingsDetermination;
  staffRationale?: string;
  staffUpdatedAt?: Date;
  staffUpdatedByUserId?: string;

  // Board determination
  boardDetermination?: FindingsDetermination;
  boardRationale?: string;
  boardUpdatedAt?: Date;
  boardUpdatedByUserId?: string;

  // Guidance for staff
  guidanceNotes?: string;

  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A condition of approval attached to findings.
 */
export interface FindingsCondition {
  id: string;
  tenantId: string;
  findingsId: string;
  conditionNumber: number;
  conditionText: string;
  orderIndex: number;
  createdByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Findings of fact for a BZA/Plan Commission case.
 */
export interface FindingsOfFact {
  id: string;
  tenantId: string;
  meetingId: string;
  agendaItemId?: string;
  caseType: FindingsCaseType;
  statutoryCite: string;
  status: FindingsStatus;

  // Criteria
  criteria?: FindingsCriterion[];

  // Conditions of approval
  conditions?: FindingsCondition[];

  // Adoption
  voteRecordId?: string;
  adoptedAt?: Date;
  adoptedByUserId?: string;

  // Document
  generatedDocumentId?: string;
  generatedAt?: Date;

  // Lock status
  isLocked: boolean;

  // Audit
  createdByUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of validating findings of fact.
 */
export interface FindingsValidationResult {
  isComplete: boolean;
  missingCriteria: Array<{
    criterionNumber: number;
    criterionText: string;
    missing: 'determination' | 'rationale' | 'both';
  }>;
  canApprove: boolean;
  canDeny: boolean;
  unmetCriteria: Array<{
    criterionNumber: number;
    criterionText: string;
  }>;
}

/**
 * Input for updating staff recommendation.
 */
export interface UpdateStaffRecommendationInput {
  recommendation: FindingsDetermination;
  rationale: string;
}

/**
 * Input for updating board determination.
 */
export interface UpdateBoardDeterminationInput {
  determination: FindingsDetermination;
  rationale: string;
}

/**
 * Input for creating a condition of approval.
 */
export interface CreateConditionInput {
  conditionText: string;
}

/**
 * Document generation result.
 */
export interface FindingsDocumentResult {
  documentId: string;
  url?: string;
  generatedAt: Date;
}
