import 'dotenv/config';
import { AIWorker } from './worker.js';

const worker = new AIWorker({
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 5000),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api',
});

worker.start();

process.on('SIGINT', () => {
  console.log('[AI-Worker] Received SIGINT, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[AI-Worker] Received SIGTERM, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});
