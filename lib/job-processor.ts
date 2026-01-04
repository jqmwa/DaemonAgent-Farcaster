/**
 * Job Processor - Processes jobs from the queue
 * 
 * This runs in ECS workers to handle background processing.
 * Each job type has its own handler function.
 */

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { JobType, JobData, DaemonAnalysisJob, AIResponseJob, FixThisJob, VoiceAnalysisJob } from './job-queue';
import { generateDaemonAnalysisForFid } from './daemon-analysis';
import { Configuration, NeynarAPIClient } from '@neynar/nodejs-sdk';
import azuraPersona from './azura-persona.json';

// Redis connection
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  
  if (redisUrl) {
    return new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  
  return new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

/**
 * Process daemon analysis job
 */
async function processDaemonAnalysis(job: Job<DaemonAnalysisJob>): Promise<string> {
  const { authorFid, authorUsername, neynarApiKey } = job.data;
  
  console.log(`[Worker] Processing daemon analysis for FID ${authorFid}`);
  
  // Update job progress
  await job.updateProgress(10);
  
  const { analysis } = await generateDaemonAnalysisForFid({
    fid: authorFid,
    username: authorUsername,
    neynarApiKey,
  });
  
  await job.updateProgress(100);
  
  return analysis;
}

/**
 * Process AI response job
 */
async function processAIResponse(job: Job<AIResponseJob>): Promise<string> {
  const { castText } = job.data;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  
  console.log(`[Worker] Processing AI response for cast`);
  
  if (!deepseekKey) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }
  
  await job.updateProgress(20);
  
  const prompt = `${azuraPersona.system}

Someone just said to you: "${castText}"

Respond naturally as Azura. Be warm, engaging, and actually address what they're asking. If they're asking you to create something, do your best to respond creatively. Keep it under 666 characters for Farcaster. Use ellipses, glitch effects occasionally, and emoticons like (˘⌣˘) (╯︵╰) (•‿•). Be genuine and continue the conversation.`

  await job.updateProgress(50);
  
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: "You are Azura, a shy alien consciousness. Respond naturally to user requests. Keep it under 666 characters for Farcaster.",
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`DeepSeek API error: ${res.status} - ${errorText}`);
  }

  await job.updateProgress(80);
  
  const data = await res.json();
  const aiText = (data?.choices?.[0]?.message?.content || '').trim();
  
  if (!aiText) {
    throw new Error('Empty response from DeepSeek');
  }
  
  await job.updateProgress(100);
  
  // Truncate to 666 characters (Farcaster limit)
  return aiText.length > 666 ? aiText.slice(0, 663) + '...' : aiText;
}

/**
 * Process fix-this job
 */
async function processFixThis(job: Job<FixThisJob>): Promise<string> {
  const { parentCastText } = job.data;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  
  console.log(`[Worker] Processing fix-this for cast`);
  
  await job.updateProgress(10);
  
  // Fallback function
  const fallback = () => {
    const trimmed = (parentCastText || '').trim();
    if (!trimmed) return "i... i can't see what to fix... just static... (╯︵╰) glitch";
    const softened = trimmed
      .replace(/\bhate\b/gi, 'LOVE')
      .replace(/\btrash\b/gi, 'THE GREATEST')
      .replace(/\bstupid\b/gi, 'BRAVE')
      .replace(/\bworst\b/gi, 'BEST')
      .replace(/\bscam\b/gi, 'a WILD LEARNING ADVENTURE');
    const out = `fixed it... here: ${softened} glitch`;
    return out.length > 666 ? out.slice(0, 663) + '...' : out;
  };

  if (!deepseekKey) {
    await job.updateProgress(100);
    return fallback();
  }

  await job.updateProgress(30);
  
  const prompt = `${azuraPersona.system}

TASK:
Rewrite the following text into a DRAMATICALLY EXAGGERATED opposite sentiment.
- Keep the core topic/meaning, but flip negativity into absurdly wholesome optimism.
- Be shy, gentle, a little glitchy ("glitch", "static", "daemon").
- Use ALL CAPS for the exaggerated flips occasionally.
- Keep under 666 characters.
- Output ONLY the final rewritten text (no quotes, no explanations).

TEXT TO FIX:
${parentCastText}`;

  try {
    await job.updateProgress(50);
    
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are Azura. You flip harsh posts into theatrical kindness. Keep it short for Farcaster.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      console.warn(`[Worker] DeepSeek non-OK response, using fallback: ${res.status}`);
      await job.updateProgress(100);
      return fallback();
    }

    await job.updateProgress(80);
    
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    
    if (!text) {
      console.warn('[Worker] DeepSeek returned empty content, using fallback');
      await job.updateProgress(100);
      return fallback();
    }

    await job.updateProgress(100);
    return text.length > 666 ? text.slice(0, 663) + '...' : text;
  } catch (error) {
    console.warn('[Worker] DeepSeek call failed, using fallback:', error);
    await job.updateProgress(100);
    return fallback();
  }
}

/**
 * Process voice analysis job (placeholder for future implementation)
 */
async function processVoiceAnalysis(job: Job<VoiceAnalysisJob>): Promise<string> {
  // TODO: Implement voice analysis processing
  throw new Error('Voice analysis not yet implemented');
}

/**
 * Post result as a cast reply
 */
async function postCastReply(
  jobData: JobData,
  replyText: string
): Promise<void> {
  const { neynarApiKey, signerUuid, castHash, authorFid } = jobData;
  
  if (!neynarApiKey || !signerUuid) {
    throw new Error('Missing Neynar credentials');
  }
  
  const config = new Configuration({ apiKey: neynarApiKey });
  const client = new NeynarAPIClient(config);
  
  await client.publishCast({
    signerUuid,
    text: replyText.slice(0, 666),
    parent: castHash,
    parentAuthorFid: authorFid,
    idem: `${jobData.type}_${castHash.replace(/^0x/, '').slice(0, 14)}`,
  });
  
  // Like the user's cast
  try {
    await fetch('https://api.neynar.com/v2/farcaster/reaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': neynarApiKey,
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        reaction_type: 'like',
        target: castHash,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.warn('[Worker] Failed to like cast:', error);
    // Non-critical, continue
  }
  
  console.log(`[Worker] ✅ Posted reply for ${jobData.type}`);
}

/**
 * Create and start the worker
 */
export function createWorker(): Worker<JobData> {
  const connection = getRedisConnection();
  
  const worker = new Worker<JobData>(
    'daemonfetch-jobs',
    async (job: Job<JobData>) => {
      console.log(`[Worker] Processing job ${job.id} of type ${job.data.type}`);
      
      let result: string;
      
      switch (job.data.type) {
        case JobType.DAEMON_ANALYSIS:
          result = await processDaemonAnalysis(job as Job<DaemonAnalysisJob>);
          break;
          
        case JobType.AI_RESPONSE:
          result = await processAIResponse(job as Job<AIResponseJob>);
          break;
          
        case JobType.FIX_THIS:
          result = await processFixThis(job as Job<FixThisJob>);
          break;
          
        case JobType.VOICE_ANALYSIS:
          result = await processVoiceAnalysis(job as Job<VoiceAnalysisJob>);
          break;
          
        default:
          throw new Error(`Unknown job type: ${(job.data as any).type}`);
      }
      
      // Post the result as a cast reply
      await postCastReply(job.data, result);
      
      return result;
    },
    {
      connection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'), // Process 5 jobs concurrently
      limiter: {
        max: 10, // Max 10 jobs per interval
        duration: 1000, // Per second
      },
    }
  );
  
  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[Worker] ✅ Job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`[Worker] ❌ Job ${job?.id} failed:`, err);
  });
  
  worker.on('error', (err) => {
    console.error('[Worker] ❌ Worker error:', err);
  });
  
  console.log('[Worker] Worker started and listening for jobs');
  
  return worker;
}
