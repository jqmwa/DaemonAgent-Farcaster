/**
 * ElizaOS Integration Service
 * 
 * This service integrates the ElizaOS Farcaster plugin with the DaemonFetch application.
 * It provides methods to initialize ElizaOS runtime, handle Farcaster interactions,
 * and manage the agent lifecycle.
 */

import farcasterPlugin from '@elizaos/plugin-farcaster';
import { AgentRuntime, Character, DatabaseAdapter } from '@elizaos/core';
import elizaCharacter from './eliza-character.json';

/**
 * Minimal database adapter for webhook/serverless mode
 * Implements required methods without actual database connection
 */
class MinimalAdapter extends DatabaseAdapter {
  private agentId: string | null = null;
  private agentData: any = null;
  private entities: Map<string, any> = new Map(); // Store entities by ID
  public db: any = null; // Required by DatabaseAdapter

  constructor() {
    super();
  }

  async initialize(config?: any): Promise<void> {
    // No-op for minimal adapter
  }

  async init(): Promise<void> {
    // No-op for minimal adapter
  }

  async runPluginMigrations(plugins: Array<{ name: string; schema?: any }>, options?: any): Promise<void> {
    // No-op for webhook mode
  }

  async isReady(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    // No-op
  }

  async getConnection(): Promise<any> {
    return null;
  }

  async getAgent(agentId: string): Promise<any> {
    if (this.agentId === agentId && this.agentData) {
      return this.agentData;
    }
    // Return minimal agent data
    return {
      id: agentId,
      name: elizaCharacter.name,
      username: elizaCharacter.username,
    };
  }

  async getAgents(): Promise<any[]> {
    return this.agentData ? [this.agentData] : [];
  }

  async createAgent(agent: any): Promise<boolean> {
    this.agentId = agent.id;
    this.agentData = agent;
    
    // Also create an entity for the agent if it has an ID
    // This helps ElizaOS find the agent entity during initialization
    if (agent.id) {
      const agentEntity = {
        id: agent.id,
        name: agent.name || elizaCharacter.name,
        username: agent.username || elizaCharacter.username,
        ...agent
      };
      this.entities.set(agent.id, agentEntity);
      console.log('[MinimalAdapter] Created agent entity:', agent.id);
    }
    
    return true;
  }

  async updateAgent(agentId: string, agent: any): Promise<boolean> {
    if (this.agentId === agentId) {
      this.agentData = { ...this.agentData, ...agent };
    }
    return true;
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    if (this.agentId === agentId) {
      this.agentId = null;
      this.agentData = null;
    }
    return true;
  }

  async ensureEmbeddingDimension(dimension: number): Promise<void> {
    // No-op
  }

  // Cache methods
  async getCache<T>(key: string): Promise<T | undefined> {
    return undefined;
  }

  async setCache<T>(key: string, value: T): Promise<boolean> {
    return true;
  }

  async deleteCache(key: string): Promise<boolean> {
    return true;
  }

  // Entity methods
  async getEntitiesByIds(entityIds: string[]): Promise<any[] | null> {
    if (entityIds.length === 0) {
      return [];
    }
    
    // Return entities that were created and stored
    const foundEntities = entityIds
      .map(id => {
        const entity = this.entities.get(id);
        if (entity) {
          console.log('[MinimalAdapter] Found entity:', id);
        } else {
          console.log('[MinimalAdapter] Entity not found:', id, 'Available entities:', Array.from(this.entities.keys()));
        }
        return entity;
      })
      .filter(entity => entity !== undefined);
    
    // Return found entities array, or null if none found (as per interface)
    // Note: ElizaOS runtime.getEntityById expects getEntitiesByIds to return an array
    // and takes the first element, so we need to return an array with the entity
    if (foundEntities.length === 0) {
      console.log('[MinimalAdapter] No entities found for IDs:', entityIds);
      return null;
    }
    
    return foundEntities;
  }

  async getEntitiesForRoom(roomId: string, includeComponents?: boolean): Promise<any[]> {
    // Return entities associated with the room (if we had room tracking)
    // For minimal adapter, return empty array
    return [];
  }

  async createEntities(entities: any[]): Promise<boolean> {
    // Store entities in memory by their ID
    for (const entity of entities) {
      if (entity.id) {
        this.entities.set(entity.id, entity);
        console.log('[MinimalAdapter] Stored entity:', entity.id, 'Type:', entity.type || 'unknown', 'Name:', entity.name || 'unnamed');
      } else {
        console.warn('[MinimalAdapter] Entity without ID provided:', entity);
      }
    }
    console.log('[MinimalAdapter] Total entities stored:', this.entities.size);
    return true;
  }

  async updateEntity(entity: any): Promise<void> {
    // Update stored entity if it exists
    if (entity.id && this.entities.has(entity.id)) {
      this.entities.set(entity.id, { ...this.entities.get(entity.id), ...entity });
    }
  }

  // Component methods
  async getComponent(entityId: string, type: string, worldId?: string, sourceEntityId?: string): Promise<any> {
    return null;
  }

  async getComponents(entityId: string, worldId?: string, sourceEntityId?: string): Promise<any[]> {
    return [];
  }

  async createComponent(component: any): Promise<boolean> {
    return true;
  }

  async updateComponent(component: any): Promise<void> {
    // No-op
  }

  async deleteComponent(componentId: string): Promise<void> {
    // No-op
  }

  // Memory methods
  async getMemories(params: any): Promise<any[]> {
    return [];
  }

  async getMemoryById(id: string): Promise<any> {
    return null;
  }

  async getMemoriesByIds(ids: string[], tableName?: string): Promise<any[]> {
    return [];
  }

  async getMemoriesByRoomIds(params: { roomIds: string[]; tableName: string; limit?: number }): Promise<any[]> {
    return [];
  }

  async createMemory(memory: any, tableName: string, unique?: boolean): Promise<string> {
    return memory.id || 'stub-id';
  }

  async updateMemory(memory: any): Promise<boolean> {
    return true;
  }

  async deleteMemory(memoryId: string): Promise<void> {
    // No-op
  }

  async deleteManyMemories(memoryIds: string[]): Promise<void> {
    // No-op
  }

  async deleteAllMemories(roomId: string, tableName: string): Promise<void> {
    // No-op
  }

  async countMemories(roomId: string, unique?: boolean, tableName?: string): Promise<number> {
    return 0;
  }

  async searchMemories(params: any): Promise<any[]> {
    return [];
  }

  async getCachedEmbeddings(params: any): Promise<any[]> {
    return [];
  }

  async createCachedEmbedding(embedding: any): Promise<any> {
    return embedding;
  }

  // Log methods
  async log(params: any): Promise<void> {
    // No-op
  }

  async getLogs(params: any): Promise<any[]> {
    return [];
  }

  async deleteLog(logId: string): Promise<void> {
    // No-op
  }

  // World methods
  async createWorld(world: any): Promise<string> {
    return world.id || 'stub-world-id';
  }

  async getWorld(id: string): Promise<any> {
    return null;
  }

  async removeWorld(id: string): Promise<void> {
    // No-op
  }

  async getAllWorlds(): Promise<any[]> {
    return [];
  }

  async updateWorld(world: any): Promise<void> {
    // No-op
  }

  // Room methods
  async getRoomsByIds(roomIds: string[]): Promise<any[] | null> {
    return [];
  }

  async createRooms(rooms: any[]): Promise<string[]> {
    return rooms.map(r => r.id || 'stub-room-id');
  }

  async deleteRoom(roomId: string): Promise<void> {
    // No-op
  }

  async deleteRoomsByWorldId(worldId: string): Promise<void> {
    // No-op
  }

  async updateRoom(room: any): Promise<void> {
    // No-op
  }

  async getRoomsForParticipant(entityId: string): Promise<string[]> {
    return [];
  }

  async getRoomsForParticipants(userIds: string[]): Promise<string[]> {
    return [];
  }

  async getRoomsByWorld(worldId: string): Promise<any[]> {
    return [];
  }

  // Participant methods
  async addParticipantsRoom(entityIds: string[], roomId: string): Promise<boolean> {
    // For minimal adapter, just return true - we don't need to track participants
    return true;
  }

  async removeParticipant(entityId: string, roomId: string): Promise<boolean> {
    return true;
  }

  async getParticipantsForEntity(entityId: string): Promise<any[]> {
    return [];
  }

  async getParticipantsForRoom(roomId: string): Promise<string[]> {
    return [];
  }

  async isRoomParticipant(roomId: string, entityId: string): Promise<boolean> {
    return false;
  }

  async getParticipantUserState(roomId: string, entityId: string): Promise<'FOLLOWED' | 'MUTED' | null> {
    return null;
  }

  async setParticipantUserState(roomId: string, entityId: string, state: 'FOLLOWED' | 'MUTED' | null): Promise<void> {
    // No-op
  }

  // Relationship methods
  async getRelationships(params: any): Promise<any[]> {
    return [];
  }

  async getRelationship(params: any): Promise<any> {
    return null;
  }

  async createRelationship(params: {
    sourceEntityId: string;
    targetEntityId: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    return true;
  }

  async updateRelationship(params: {
    sourceEntityId: string;
    targetEntityId: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    // No-op
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    // No-op
  }

  // Task methods
  async getTasks(params: any): Promise<any[]> {
    return [];
  }

  async getTask(taskId: string): Promise<any> {
    return null;
  }

  async getTasksByName(name: string): Promise<any[]> {
    return [];
  }

  async createTask(task: any): Promise<string> {
    return task.id || 'stub-task-id';
  }

  async updateTask(task: any): Promise<void> {
    // No-op
  }

  async deleteTask(taskId: string): Promise<void> {
    // No-op
  }

  // Optional methods
  async getAgentRunSummaries?(params: any): Promise<any> {
    return { runs: [], total: 0, hasMore: false };
  }

  async withEntityContext?<T>(entityId: string | null, callback: () => Promise<T>): Promise<T> {
    return callback();
  }
}

export class ElizaService {
  private runtime: AgentRuntime | null = null;
  private initialized: boolean = false;
  private initializing: boolean = false; // Prevent concurrent initialization

  /**
   * Initialize the ElizaOS runtime with Farcaster plugin
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[ElizaOS] Service already initialized');
      return;
    }

    // Prevent concurrent initialization attempts
    if (this.initializing) {
      console.log('[ElizaOS] Initialization already in progress, waiting...');
      // Wait for the current initialization to complete (with timeout)
      const maxWait = 30000; // 30 seconds
      const startTime = Date.now();
      while (this.initializing && Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.initialized) {
        console.log('[ElizaOS] Initialization completed while waiting');
        return;
      }
      throw new Error('Initialization timeout - another initialization attempt did not complete');
    }

    this.initializing = true;

    try {
      console.log('[ElizaOS] Initializing ElizaOS service...');

      // Validate required environment variables
      // Map actual env var names to ElizaOS expected names (check both naming conventions)
      const farcasterFid = process.env.FARCASTER_FID || process.env.BOT_FID
      const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY
      const signerUuid = process.env.NEYNAR_SIGNER_UUID || process.env.FARCASTER_SIGNER_UUID
      const farcasterMode = process.env.FARCASTER_MODE || 'webhook'

      console.log('[ElizaOS] Environment variable check:', {
        farcasterFid: farcasterFid ? 'found' : 'missing',
        neynarApiKey: neynarApiKey ? 'found' : 'missing',
        signerUuid: signerUuid ? 'found' : 'missing',
        checkedVars: {
          FARCASTER_FID: !!process.env.FARCASTER_FID,
          BOT_FID: !!process.env.BOT_FID,
          NEYNAR_API_KEY: !!process.env.NEYNAR_API_KEY,
          FARCASTER_NEYNAR_API_KEY: !!process.env.FARCASTER_NEYNAR_API_KEY,
          NEYNAR_SIGNER_UUID: !!process.env.NEYNAR_SIGNER_UUID,
          FARCASTER_SIGNER_UUID: !!process.env.FARCASTER_SIGNER_UUID
        }
      })

      if (!farcasterFid || !neynarApiKey || !signerUuid) {
        console.warn('[ElizaOS] ⚠️  Farcaster credentials not found in environment variables');
        console.warn('[ElizaOS] ⚠️  ElizaOS will not be available');
        console.warn('[ElizaOS] ⚠️  Required: FARCASTER_FID (or BOT_FID), NEYNAR_API_KEY (or FARCASTER_NEYNAR_API_KEY), NEYNAR_SIGNER_UUID (or FARCASTER_SIGNER_UUID)');
        throw new Error('Missing required environment variables for ElizaOS');
      }

      // Prepare character configuration
      const character: Character = {
        ...elizaCharacter,
        name: elizaCharacter.name,
        username: elizaCharacter.username,
        bio: elizaCharacter.bio,
        lore: elizaCharacter.lore,
        knowledge: elizaCharacter.knowledge,
        messageExamples: elizaCharacter.messageExamples,
        postExamples: elizaCharacter.postExamples,
        topics: elizaCharacter.topics,
        style: elizaCharacter.style,
        adjectives: elizaCharacter.adjectives,
        plugins: [farcasterPlugin],
        settings: {
          ...elizaCharacter.settings,
          secrets: {
            FARCASTER_FID: farcasterFid,
            FARCASTER_NEYNAR_API_KEY: neynarApiKey,
            FARCASTER_SIGNER_UUID: signerUuid,
            // NOTE: @elizaos/plugin-farcaster currently ALWAYS runs a periodic mentions loop.
            // In webhook mode we effectively disable polling by setting a very large poll interval.
            FARCASTER_POLL_INTERVAL:
              farcasterMode === 'webhook'
                ? (process.env.FARCASTER_POLL_INTERVAL_WEBHOOK_DISABLED || '86400') // 24h
                : (process.env.FARCASTER_POLL_INTERVAL || '60'), // seconds
            // Disable background posting + action loops unless explicitly enabled
            ENABLE_CAST: process.env.ENABLE_CAST || 'false',
            ENABLE_ACTION_PROCESSING: process.env.ENABLE_ACTION_PROCESSING || 'false',
            ACTION_INTERVAL: process.env.ACTION_INTERVAL || '60',
            CAST_INTERVAL_MIN: process.env.CAST_INTERVAL_MIN || '90',
            CAST_INTERVAL_MAX: process.env.CAST_INTERVAL_MAX || '180',
            FARCASTER_DRY_RUN: process.env.FARCASTER_DRY_RUN || 'false',
          }
        },
        clientConfig: elizaCharacter.clientConfig
      } as Character;

      // Create minimal adapter for webhook/serverless mode
      // This adapter implements all required methods without a real database
      console.log('[ElizaOS] Creating minimal adapter for webhook mode...');
      const adapter = new MinimalAdapter();
      
      // Initialize adapter if needed
      if (typeof adapter.initialize === 'function') {
        try {
          await adapter.initialize();
          console.log('[ElizaOS] Minimal adapter initialized');
        } catch (initError) {
          console.warn('[ElizaOS] Adapter initialization warning (continuing):', initError);
        }
      }

      // Create runtime instance
      console.log('[ElizaOS] Creating AgentRuntime with adapter...');
      this.runtime = new AgentRuntime({
        character,
        adapter,
        plugins: [farcasterPlugin],
      });

      // Initialize plugins - this is where adapter.isReady() might be called
      console.log('[ElizaOS] Initializing runtime (this may call adapter.isReady)...');
      try {
        // Add timeout to prevent infinite hangs
        const initPromise = this.runtime.initialize();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Runtime initialization timeout after 30 seconds')), 30000);
        });
        
        await Promise.race([initPromise, timeoutPromise]);
        console.log('[ElizaOS] Runtime initialized successfully');

        // IMPORTANT: @elizaos/plugin-farcaster always starts a polling loop (mentions/replies).
        // In webhook mode we do NOT want polling at all (it can spam 429s and flood logs).
        // We keep the Farcaster client alive for posting, but stop the interactions poller only.
        if (farcasterMode === 'webhook') {
          try {
            const farcasterService: any = this.runtime.getService('farcaster');
            const manager = farcasterService?.managers?.get?.(this.runtime.agentId);
            if (manager?.interactions?.stop) {
              await manager.interactions.stop();
              console.log('[ElizaOS] Webhook mode: stopped Farcaster interactions poller');
            } else {
              console.warn('[ElizaOS] Webhook mode: could not find Farcaster interactions poller to stop');
            }
          } catch (stopPollError) {
            console.warn('[ElizaOS] Webhook mode: error stopping Farcaster interactions poller (continuing):', stopPollError);
          }
        }
      } catch (initError: any) {
        console.error('[ElizaOS] Runtime initialization failed:', initError);
        console.error('[ElizaOS] Error details:', {
          message: initError?.message,
          stack: initError?.stack,
          adapterType: adapter?.constructor?.name,
          hasIsReady: typeof (adapter as any)?.isReady === 'function'
        });
        // Best-effort stop to prevent background loops (plugin-farcaster starts pollers)
        try {
          await this.runtime?.stop?.();
        } catch (stopError) {
          console.warn('[ElizaOS] Runtime stop warning (continuing):', stopError);
        }
        this.runtime = null;
        this.initializing = false;
        throw initError;
      }

      this.initialized = true;
      this.initializing = false;
      console.log('[ElizaOS] Service initialized successfully');
    } catch (error) {
      this.initializing = false;
      console.error('[ElizaOS] Failed to initialize service:', error);
      throw error;
    }
  }

  /**
   * Get the initialized runtime instance
   */
  getRuntime(): AgentRuntime {
    if (!this.initialized || !this.runtime) {
      throw new Error('ElizaOS service not initialized. Call initialize() first.');
    }
    return this.runtime;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Process a Farcaster webhook event using ElizaOS
   * This method handles incoming cast events through ElizaOS runtime
   */
  async processWebhookEvent(event: any): Promise<any> {
    if (!this.initialized || !this.runtime) {
      throw new Error('ElizaOS service not initialized');
    }

    try {
      console.log('[ElizaOS] Processing webhook event:', {
        type: event.type,
        timestamp: new Date().toISOString()
      });

      // Get the Farcaster service from runtime
      const farcasterService = this.runtime.getService('farcaster');
      
      if (!farcasterService) {
        throw new Error('Farcaster service not found in runtime');
      }

      // Process the event through the Farcaster plugin
      // The plugin will handle mentions, replies, and generate responses
      // based on the character configuration
      if (typeof (farcasterService as any).handleWebhookEvent === 'function') {
        await (farcasterService as any).handleWebhookEvent(event);
      } else if (typeof (farcasterService as any).processEvent === 'function') {
        await (farcasterService as any).processEvent(event);
      } else if (typeof this.runtime.processEvent === 'function') {
        await this.runtime.processEvent(event);
      } else {
        // Fallback: Let the plugin handle it through its initialization
        // In webhook mode, the plugin should automatically process events
        console.log('[ElizaOS] Event passed to runtime, plugin will handle automatically');
      }

      return {
        success: true,
        message: 'Event processed by ElizaOS',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[ElizaOS] Error processing webhook event:', error);
      throw error;
    }
  }

  /**
   * Manually post a cast using ElizaOS
   */
  async postCast(text: string, options?: { parentHash?: string }): Promise<any> {
    if (!this.initialized || !this.runtime) {
      throw new Error('ElizaOS service not initialized');
    }

    try {
      console.log('[ElizaOS] Posting cast:', text.substring(0, 50));

      const farcasterService = this.runtime.getService('farcaster');
      
      if (!farcasterService) {
        throw new Error('Farcaster service not found in runtime');
      }

      // Use the message service to send a cast
      const messageService = (farcasterService as any).getMessageService?.(this.runtime.agentId);
      
      if (messageService) {
        const result = await messageService.sendMessage({
          text,
          parentHash: options?.parentHash
        });

        return result;
      }

      throw new Error('Message service not available');
    } catch (error) {
      console.error('[ElizaOS] Error posting cast:', error);
      throw error;
    }
  }

  /**
   * Cleanup and shutdown the service
   */
  async shutdown(): Promise<void> {
    try {
      console.log('[ElizaOS] Shutting down service...');
      
      // Cleanup runtime resources
      if (this.runtime) {
        try {
          await this.runtime.stop?.();
          console.log('[ElizaOS] Runtime stopped');
        } catch (stopError) {
          console.warn('[ElizaOS] Runtime stop warning (continuing):', stopError);
        }
        this.runtime = null;
      }

      this.initialized = false;
      this.initializing = false;
      console.log('[ElizaOS] Service shutdown complete');
    } catch (error) {
      console.error('[ElizaOS] Error during shutdown:', error);
      throw error;
    }
  }
}

// Export a singleton instance
let elizaServiceInstance: ElizaService | null = null;

export function getElizaService(): ElizaService {
  if (!elizaServiceInstance) {
    elizaServiceInstance = new ElizaService();
  }
  return elizaServiceInstance;
}

export default ElizaService;
