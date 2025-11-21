// src/core/tasks/in-memory-task.service.ts

import { randomUUID } from 'crypto';
import { TenantContext } from '../tenancy/types';
import { Task } from './task.types';
import { TaskService } from './task.service';

export interface InMemoryTaskSeedData {
  tasks?: Task[];
}

/**
 * In-memory implementation of TaskService. Data is scoped per tenant and
 * only persists for the process lifetime.
 */
export class InMemoryTaskService implements TaskService {
  private tasks: Task[];

  constructor(seed: InMemoryTaskSeedData = {}) {
    this.tasks = seed.tasks ? [...seed.tasks] : [];
  }

  async createTask(
    ctx: TenantContext,
    task: Omit<Task, 'id' | 'tenantId' | 'createdAt' | 'status'>
  ): Promise<Task> {
    const created: Task = {
      ...task,
      id: randomUUID(),
      tenantId: ctx.tenantId,
      status: 'open',
      createdAt: new Date(),
    };

    this.tasks.push(created);
    return created;
  }

  async updateTask(
    ctx: TenantContext,
    task: Task
  ): Promise<Task> {
    const idx = this.tasks.findIndex(
      (t) => t.id === task.id && t.tenantId === ctx.tenantId
    );

    if (idx === -1) {
      throw new Error('Task not found for tenant');
    }

    this.tasks[idx] = { ...task, tenantId: ctx.tenantId };
    return this.tasks[idx];
  }

  async listTasks(
    ctx: TenantContext,
    filter: { status?: Task['status']; assignedToUserId?: string } = {}
  ): Promise<Task[]> {
    let results = this.tasks.filter((t) => t.tenantId === ctx.tenantId);

    if (filter.status) {
      results = results.filter((t) => t.status === filter.status);
    }

    if (filter.assignedToUserId) {
      results = results.filter(
        (t) => t.assignedToUserId === filter.assignedToUserId
      );
    }

    return results;
  }
}
