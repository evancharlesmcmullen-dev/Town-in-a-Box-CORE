// src/core/tasks/task.service.ts

import { TenantContext } from '../tenancy/types';
import { Task } from './task.types';

export interface TaskService {
  createTask(
    ctx: TenantContext,
    task: Omit<Task, 'id' | 'tenantId' | 'createdAt' | 'status'>
  ): Promise<Task>;

  updateTask(
    ctx: TenantContext,
    task: Task
  ): Promise<Task>;

  listTasks(
    ctx: TenantContext,
    filter?: { status?: Task['status']; assignedToUserId?: string }
  ): Promise<Task[]>;
}