/**
 * Job Queue System for Background Processing
 * 
 * Uses BullMQ with Redis for reliable job processing.
 * Jobs are enqueued from webhook handler and processed by ECS workers.
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection (supports both local and AWS ElastiCache)
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  
  if (redisUrl) {
    // URL format: redis://host:port or rediss://host:port (SSL)
    return new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  
  // Fallback to local Redis (for development)
  return new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

// Job types
export enum JobType {
  DAEMON_ANALYSIS = 'daemon-analysis',
  VOICE_ANALYSIS = 'voice-analysis',
  AI_RESPONSE = 'ai-response',
  FIX_THIS = 'fix-this', // Can be processed in webhook or worker
}

// Job data interfaces
export interface DaemonAnalysisJob {
  type: JobType.DAEMON_ANALYSIS;
  castHash: string;
  authorFid: number;
  authorUsername: string;
  neynarApiKey: string;
  signerUuid: string;
  parentCastHash: string;
}

export interface VoiceAnalysisJob {
  type: JobType.VOICE_ANALYSIS;
  castHash: string;
  authorFid: number;
  authorUsername: string;
  neynarApiKey: string;
  signerUuid: string;
  parentCastHash: string;
}

export interface AIResponseJob {
  type: JobType.AI_RESPONSE;
  castHash: string;
  castText: string;
  authorFid: number;
  authorUsername: string;
  neynarApiKey: string;
  signerUuid: string;
  parentCastHash: string;
}

export interface FixThisJob {
  type: JobType.FIX_THIS;
  castHash: string;
  parentCastHash: string;
  parentCastText: string;
  authorFid: number;
  authorUsername: string;
  neynarApiKey: string;
  signerUuid: string;
}

export type JobData = DaemonAnalysisJob | VoiceAnalysisJob | AIResponseJob | FixThisJob;

// Queue instance (singleton)
let queueInstance: Queue<JobData> | null = null;

/**
 * Get or create the job queue instance
 */
export function getJobQueue(): Queue<JobData> {
  if (!queueInstance) {
    const connection = getRedisConnection();
    
    queueInstance = new Queue<JobData>('daemonfetch-jobs', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep last 1000 jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    });
    
    console.log('[JobQueue] Queue initialized');
  }
  
  return queueInstance;
}

/**
 * Enqueue a job for background processing
 */
export async function enqueueJob(
  jobData: JobData,
  options?: {
    priority?: number;
    delay?: number;
  }
): Promise<Job<JobData>> {
  const queue = getJobQueue();
  
  const job = await queue.add(jobData.type, jobData, {
    priority: options?.priority || 0,
    delay: options?.delay || 0,
    jobId: `${jobData.type}-${jobData.castHash}-${Date.now()}`, // Unique job ID
  });
  
  console.log(`[JobQueue] Enqueued job: ${jobData.type} for cast ${jobData.castHash.substring(0, 10)}...`);
  
  return job;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string): Promise<{
  state: string;
  progress?: number;
  result?: any;
  error?: string;
} | null> {
  const queue = getJobQueue();
  const job = await queue.getJob(jobId);
  
  if (!job) {
    return null;
  }
  
  const state = await job.getState();
  const progress = job.progress;
  const result = job.returnvalue;
  const failedReason = job.failedReason;
  
  return {
    state,
    progress: typeof progress === 'number' ? progress : undefined,
    result,
    error: failedReason,
  };
}

/**
 * Close queue connection (for graceful shutdown)
 */
export async function closeQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
    console.log('[JobQueue] Queue closed');
  }
}
