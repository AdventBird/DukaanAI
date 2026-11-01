import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  AgentTaskRecord,
  AgentTaskStatus,
  AgentTaskType,
  AgentTaskStep,
} from '@dukaanai/shared';

export class TaskService {
  private readonly tasks = new Map<string, AgentTaskRecord>();
  private prisma: PrismaClient | null = null;

  setPrisma(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  createTask(params: {
    storeId: string;
    taskType: AgentTaskType;
    inputSummary: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    steps: Array<{ name: string; toolName?: string }>;
    initialCheckpoint?: Record<string, unknown>;
  }): AgentTaskRecord {
    const taskId = `task_${Date.now()}_${randomUUID().slice(0, 6)}`;
    const now = new Date().toISOString();

    const formattedSteps: AgentTaskStep[] = params.steps.map((s, idx) => ({
      stepIndex: idx,
      name: s.name,
      status: idx === 0 ? 'PENDING' : 'PENDING',
      toolName: s.toolName,
    }));

    const task: AgentTaskRecord = {
      id: taskId,
      storeId: params.storeId,
      taskType: params.taskType,
      status: 'QUEUED',
      relatedEntityType: params.relatedEntityType || null,
      relatedEntityId: params.relatedEntityId || null,
      inputSummary: params.inputSummary,
      currentStep: 0,
      steps: formattedSteps,
      checkpoint: params.initialCheckpoint || {},
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(taskId, task);
    this.persistTask(task);
    return task;
  }

  getTask(taskId: string): AgentTaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  async getTaskAsync(taskId: string): Promise<AgentTaskRecord | undefined> {
    const cached = this.tasks.get(taskId);
    if (cached) return cached;

    if (this.prisma) {
      const row = await this.prisma.agentTask.findUnique({ where: { id: taskId } });
      if (row) {
        const record = this.fromRow(row);
        this.tasks.set(record.id, record);
        return record;
      }
    }
    return undefined;
  }

  listTasks(storeId: string, statusFilter?: AgentTaskStatus): AgentTaskRecord[] {
    const all = Array.from(this.tasks.values()).filter((t) => t.storeId === storeId);
    if (statusFilter) {
      return all.filter((t) => t.status === statusFilter);
    }
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listTasksAsync(storeId: string, statusFilter?: AgentTaskStatus): Promise<AgentTaskRecord[]> {
    if (this.prisma) {
      try {
        const rows = await this.prisma.agentTask.findMany({
          where: {
            storeId,
            ...(statusFilter ? { status: statusFilter } : {}),
          },
          orderBy: { createdAt: 'desc' },
        });
        for (const row of rows) {
          this.tasks.set(row.id, this.fromRow(row));
        }
      } catch {
        // Fallback to in-memory if query fails
      }
    }
    return this.listTasks(storeId, statusFilter);
  }

  findOpenReplenishmentTask(storeId: string, productId: string): AgentTaskRecord | undefined {
    // Check in-memory map
    const openStatuses: AgentTaskStatus[] = ['QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'NEEDS_ATTENTION'];
    for (const t of this.tasks.values()) {
      if (
        t.storeId === storeId &&
        t.relatedEntityType === 'PRODUCT' &&
        t.relatedEntityId === productId &&
        openStatuses.includes(t.status)
      ) {
        return t;
      }
    }
    return undefined;
  }

  async findOpenReplenishmentTaskAsync(storeId: string, productId: string): Promise<AgentTaskRecord | undefined> {
    const inMem = this.findOpenReplenishmentTask(storeId, productId);
    if (inMem) return inMem;

    if (this.prisma) {
      try {
        const row = await this.prisma.agentTask.findFirst({
          where: {
            storeId,
            relatedEntityType: 'PRODUCT',
            relatedEntityId: productId,
            status: { in: ['QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'NEEDS_ATTENTION'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (row) {
          const rec = this.fromRow(row);
          this.tasks.set(rec.id, rec);
          return rec;
        }
      } catch {
        // Continue
      }
    }
    return undefined;
  }

  updateTaskStatus(
    taskId: string,
    status: AgentTaskStatus,
    errorCode?: string,
    checkpointUpdate?: Record<string, unknown>
  ): AgentTaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (errorCode) task.lastErrorCode = errorCode;
    if (checkpointUpdate) {
      task.checkpoint = { ...task.checkpoint, ...checkpointUpdate };
    }
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      task.completedAt = task.updatedAt;
    }

    this.persistTask(task);
    return task;
  }

  advanceStep(
    taskId: string,
    stepIndex: number,
    stepStatus: AgentTaskStep['status'],
    detail?: string
  ): AgentTaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.steps[stepIndex]) {
      task.steps[stepIndex].status = stepStatus;
      if (detail) task.steps[stepIndex].detail = detail;
      if (stepStatus === 'COMPLETED') {
        task.steps[stepIndex].completedAt = new Date().toISOString();
      }
    }

    if (stepStatus === 'COMPLETED' && stepIndex + 1 < task.steps.length) {
      task.currentStep = stepIndex + 1;
      task.steps[task.currentStep].status = 'RUNNING';
    }

    task.updatedAt = new Date().toISOString();
    this.persistTask(task);
    return task;
  }

  cancelTask(taskId: string, reason?: string): AgentTaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.status === 'COMPLETED') {
      throw new Error('Cannot cancel a task that has already completed.');
    }

    task.status = 'CANCELLED';
    task.lastErrorCode = reason || 'CANCELLED_BY_USER';
    task.completedAt = new Date().toISOString();
    task.updatedAt = task.completedAt;
    this.persistTask(task);
    return task;
  }

  private persistTask(task: AgentTaskRecord) {
    if (!this.prisma) return;
    this.prisma.agentTask.upsert({
      where: { id: task.id },
      update: {
        status: task.status,
        currentStep: task.currentStep,
        steps: task.steps as any,
        checkpoint: task.checkpoint as any,
        attemptCount: task.attemptCount,
        lastErrorCode: task.lastErrorCode,
        completedAt: task.completedAt ? new Date(task.completedAt) : null,
      },
      create: {
        id: task.id,
        storeId: task.storeId,
        taskType: task.taskType,
        status: task.status,
        relatedEntityType: task.relatedEntityType,
        relatedEntityId: task.relatedEntityId,
        inputSummary: task.inputSummary,
        currentStep: task.currentStep,
        steps: task.steps as any,
        checkpoint: task.checkpoint as any,
        attemptCount: task.attemptCount,
        maxAttempts: task.maxAttempts,
        lastErrorCode: task.lastErrorCode,
        completedAt: task.completedAt ? new Date(task.completedAt) : null,
      },
    }).catch((err) => {
      console.warn(`[TaskService] Background persistence error for task ${task.id}:`, err?.message);
    });
  }

  private fromRow(row: any): AgentTaskRecord {
    return {
      id: row.id,
      storeId: row.storeId,
      taskType: row.taskType as AgentTaskType,
      status: row.status as AgentTaskStatus,
      relatedEntityType: row.relatedEntityType,
      relatedEntityId: row.relatedEntityId,
      inputSummary: row.inputSummary,
      currentStep: row.currentStep,
      steps: (row.steps || []) as AgentTaskStep[],
      checkpoint: (row.checkpoint || {}) as Record<string, unknown>,
      attemptCount: row.attemptCount,
      maxAttempts: row.maxAttempts,
      nextRunAt: row.nextRunAt?.toISOString() || null,
      leaseOwner: row.leaseOwner,
      leaseExpiresAt: row.leaseExpiresAt?.toISOString() || null,
      lastErrorCode: row.lastErrorCode,
      createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
      completedAt: row.completedAt?.toISOString() || null,
    };
  }
}

export const taskService = new TaskService();
