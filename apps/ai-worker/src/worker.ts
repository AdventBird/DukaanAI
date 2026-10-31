import { randomUUID } from 'node:crypto';
import type { AgentTaskRecord, AgentTaskStatus } from '@dukaanai/shared';

export interface WorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  apiBaseUrl?: string;
  leaseDurationMs?: number;
}

export class AIWorker {
  readonly workerId: string;
  private readonly pollIntervalMs: number;
  private readonly apiBaseUrl: string;
  private readonly leaseDurationMs: number;
  private isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private inFlightTasks = new Set<string>();

  constructor(options: WorkerOptions = {}) {
    this.workerId = options.workerId || `worker_${Date.now()}_${randomUUID().slice(0, 6)}`;
    this.pollIntervalMs = options.pollIntervalMs || 5000;
    this.apiBaseUrl = (options.apiBaseUrl || process.env.API_BASE_URL || 'http://localhost:3001/api').replace(/\/$/, '');
    this.leaseDurationMs = options.leaseDurationMs || 60000;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[AI-Worker] Started worker instance ${this.workerId} (polling ${this.apiBaseUrl} every ${this.pollIntervalMs}ms)`);
    this.scheduleNextPoll();
  }

  stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log(`[AI-Worker] Stopped worker ${this.workerId}`);
  }

  getStatus() {
    return {
      workerId: this.workerId,
      isRunning: this.isRunning,
      activeTasks: Array.from(this.inFlightTasks),
      apiBaseUrl: this.apiBaseUrl,
    };
  }

  async pollAndProcessOnce(): Promise<number> {
    try {
      const tasks = await this.fetchQueuedTasks();
      let processed = 0;

      for (const task of tasks) {
        if (!this.isRunning) break;
        if (this.inFlightTasks.has(task.id)) continue;

        const claimed = await this.claimTaskLease(task.id);
        if (claimed) {
          this.inFlightTasks.add(task.id);
          try {
            await this.processTask(task);
            processed++;
          } finally {
            this.inFlightTasks.delete(task.id);
          }
        }
      }

      return processed;
    } catch (err: any) {
      console.warn(`[AI-Worker] Polling error: ${err.message}`);
      return 0;
    }
  }

  private scheduleNextPoll() {
    if (!this.isRunning) return;
    this.pollTimer = setTimeout(async () => {
      await this.pollAndProcessOnce();
      this.scheduleNextPoll();
    }, this.pollIntervalMs);
  }

  private async fetchQueuedTasks(): Promise<AgentTaskRecord[]> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/ai/tasks?status=QUEUED`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return [];
      const json: any = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }

  private async claimTaskLease(taskId: string): Promise<boolean> {
    try {
      // Internal or mock lease acquisition
      return true;
    } catch {
      return false;
    }
  }

  private async processTask(task: AgentTaskRecord): Promise<void> {
    console.log(`[AI-Worker ${this.workerId}] Processing task ${task.id} (${task.taskType}): ${task.inputSummary}`);

    // If task has reached WAITING_APPROVAL, worker will not auto-approve
    if (task.status === 'WAITING_APPROVAL') {
      console.log(`[AI-Worker] Task ${task.id} is paused awaiting kirana store owner approval. Skipping execution.`);
      return;
    }
  }
}
