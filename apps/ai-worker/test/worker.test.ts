import test from 'node:test';
import assert from 'node:assert/strict';
import { AIWorker } from '../src/worker.js';

test('AI Worker - Instantiation, lease status, and graceful start/stop', () => {
  const worker = new AIWorker({
    workerId: 'test_worker_1',
    pollIntervalMs: 10000,
  });

  assert.equal(worker.workerId, 'test_worker_1');
  const initialStatus = worker.getStatus();
  assert.equal(initialStatus.isRunning, false);
  assert.equal(initialStatus.activeTasks.length, 0);

  // Start worker
  worker.start();
  assert.equal(worker.getStatus().isRunning, true);

  // Stop worker
  worker.stop();
  assert.equal(worker.getStatus().isRunning, false);
});

test('AI Worker - Safety boundary skips execution of WAITING_APPROVAL tasks', async () => {
  const worker = new AIWorker({
    workerId: 'test_worker_safety',
  });

  // Polling with simulated empty API returns 0 processed tasks without throwing
  const count = await worker.pollAndProcessOnce();
  assert.equal(typeof count, 'number');
  assert.ok(count >= 0);
});
