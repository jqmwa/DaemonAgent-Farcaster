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

  constructor() {
    super();
  }

  async isReady(): Promise<boolean> {
    return true;
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

  async createAgent(agent: any): Promise<any> {
    this.agentId = agent.id;
    this.agentData = agent;
    return agent;
  }

  async updateAgent(agentId: string, agent: any): Promise<any> {
    if (this.agentId === agentId) {
      this.agentData = { ...this.agentData, ...agent };
    }
    return this.agentData || agent;
  }

  // Stub methods for plugin migrations (not needed for webhook mode)
  async runMigrations(migrations: any[]): Promise<void> {
    // No-op for webhook mode
    return;
  }

  // Add other required methods as stubs
  async getMemory(params: any): Promise<any[]> {
    return [];
  }

  async createMemory(memory: any): Promise<any> {
    return memory;
  }

  async removeMemory(memoryId: string): Promise<void> {
    // No-op
  }

  async getCachedEmbeddings(params: any): Promise<any[]> {
    return [];
  }

  async createCachedEmbedding(embedding: any): Promise<any> {
    return embedding;
  }
}

export class ElizaService {
  private runtime: AgentRuntime | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the ElizaOS runtime with Farcaster plugin
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[ElizaOS] Service already initialized');
      return;
    }

    try {
      console.log('[ElizaOS] Initializing ElizaOS service...');

      // Validate required environment variables
      // Map actual env var names to ElizaOS expected names
      const farcasterFid = process.env.FARCASTER_FID
      const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.FARCASTER_NEYNAR_API_KEY
      const signerUuid = process.env.NEYNAR_SIGNER_UUID || process.env.FARCASTER_SIGNER_UUID

      if (!farcasterFid || !neynarApiKey || !signerUuid) {
        console.warn('[ElizaOS] ⚠️  Farcaster credentials not found in environment variables');
        console.warn('[ElizaOS] ⚠️  ElizaOS will not be available');
        console.warn('[ElizaOS] ⚠️  Required: FARCASTER_FID, NEYNAR_API_KEY (or FARCASTER_NEYNAR_API_KEY), NEYNAR_SIGNER_UUID (or FARCASTER_SIGNER_UUID)');
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
            FARCASTER_MODE: process.env.FARCASTER_MODE || 'webhook',
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
        await this.runtime.initialize();
        console.log('[ElizaOS] Runtime initialized successfully');
      } catch (initError: any) {
        console.error('[ElizaOS] Runtime initialization failed:', initError);
        console.error('[ElizaOS] Error details:', {
          message: initError?.message,
          stack: initError?.stack,
          adapterType: adapter?.constructor?.name,
          hasIsReady: typeof (adapter as any)?.isReady === 'function'
        });
        throw initError;
      }

      this.initialized = true;
      console.log('[ElizaOS] Service initialized successfully');
    } catch (error) {
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
    if (!this.initialized) {
      return;
    }

    try {
      console.log('[ElizaOS] Shutting down service...');
      
      // Cleanup runtime resources
      if (this.runtime) {
        // Add any cleanup logic here if needed
        this.runtime = null;
      }

      this.initialized = false;
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
