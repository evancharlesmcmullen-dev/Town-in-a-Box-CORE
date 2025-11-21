// src/core/tasks/task.types.ts

/**
 * Generic task assigned to a user or team.
 */
export interface Task {
  id: string;
  tenantId: string;

  title: string;
  description?: string;

  assignedToUserId?: string;
  assignedToTeamId?: string;

  relatedType?: string;    // e.g. "Case", "WorkOrder"
  relatedId?: string;

  dueDate?: Date;
  status: 'open' | 'inProgress' | 'done' | 'cancelled';

  createdAt: Date;
  completedAt?: Date;
}