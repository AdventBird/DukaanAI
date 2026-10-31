import { randomUUID } from 'node:crypto';
import type {
  AgentTaskRecord,
  AgentTaskStatus,
  AgentTaskType,
  AgentTaskStep,
} from '@dukaanai/shared';

export class TaskService {
  private readonly tasks = new Map<string, AgentTaskRecord>();

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
    return task;
  }

  getTask(taskId: string): AgentTaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(storeId: string, statusFilter?: AgentTaskStatus): AgentTaskRecord[] {
    const all = Array.from(this.tasks.values()).filter((t) => t.storeId === storeId);
    if (statusFilter) {
      return all.filter((t) => t.status === statusFilter);
    }
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    return task;
  }
}

export const taskService = new TaskService();
