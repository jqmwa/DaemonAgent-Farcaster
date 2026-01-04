#!/usr/bin/env node
/**
 * ECS Worker Entry Point
 * 
 * This script runs in ECS containers to process background jobs.
 * It starts a BullMQ worker that listens for jobs from the queue.
 */

import { createWorker } from '../lib/job-processor';

console.log('[Worker] Starting DaemonFetch worker...');
console.log('[Worker] Environment:', {
  nodeEnv: process.env.NODE_ENV,
  redisUrl: process.env.REDIS_URL ? 'configured' : 'not configured',
  workerConcurrency: process.env.WORKER_CONCURRENCY || '5',
});

// Create and start the worker
const worker = createWorker();

// Graceful shutdown
const shutdown = async () => {
  console.log('[Worker] Shutting down gracefully...');
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Health check endpoint (for ECS health checks)
if (process.env.ENABLE_HEALTH_CHECK === 'true') {
  const http = require('http');
  const server = http.createServer((req: any, res: any) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  
  const port = process.env.HEALTH_CHECK_PORT || '3001';
  server.listen(port, () => {
    console.log(`[Worker] Health check server listening on port ${port}`);
  });
}

console.log('[Worker] Worker is running and ready to process jobs');
