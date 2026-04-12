import { Worker } from 'worker_threads';
import { Logger } from '@nestjs/common';
import * as os from 'os';

interface PendingTask {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class WorkerPool {
  private readonly logger = new Logger(WorkerPool.name);
  private workers: Worker[] = [];
  private taskQueues: Map<number, PendingTask[]> = new Map();
  private pendingTasks: Map<string, PendingTask> = new Map();
  private nextWorker = 0;
  private destroyed = false;

  constructor(
    private readonly workerPath: string,
    private readonly poolSize: number = Math.max(2, os.cpus().length - 1),
    private readonly taskTimeoutMs: number = 10_000,
  ) {}

  async initialize(): Promise<void> {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerPath);
      worker.on('message', (msg: { id: string; result?: any; error?: string }) => {
        const task = this.pendingTasks.get(msg.id);
        if (!task) return;
        this.pendingTasks.delete(msg.id);
        clearTimeout(task.timer);

        if (msg.error) {
          task.reject(new Error(msg.error));
        } else {
          task.resolve(msg.result);
        }
      });

      worker.on('error', (err) => {
        this.logger.error(`Worker ${i} error: ${err.message}`);
      });

      this.workers.push(worker);
    }
    this.logger.log(`Worker pool initialized with ${this.poolSize} workers`);
  }

  async execute<T>(type: string, payload: any): Promise<T> {
    if (this.destroyed) throw new Error('Worker pool is destroyed');
    if (this.workers.length === 0) throw new Error('Worker pool not initialized');

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const worker = this.workers[this.nextWorker % this.workers.length];
    this.nextWorker++;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTasks.delete(id);
        reject(new Error(`Worker task timed out after ${this.taskTimeoutMs}ms`));
      }, this.taskTimeoutMs);

      this.pendingTasks.set(id, { resolve, reject, timer });
      worker.postMessage({ id, type, payload });
    });
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    for (const task of this.pendingTasks.values()) {
      clearTimeout(task.timer);
      task.reject(new Error('Worker pool destroyed'));
    }
    this.pendingTasks.clear();
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
  }
}
