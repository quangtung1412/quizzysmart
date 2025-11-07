/**
 * Model Settings Service
 * 
 * Manages and caches AI model settings from database
 * Provides fallback to default values if database is unavailable
 */

interface ModelSettings {
  defaultModel: string;
  cheaperModel: string;
  embeddingModel: string;
}

class ModelSettingsService {
  private settings: ModelSettings = {
    defaultModel: 'gemini-2.5-flash',
    cheaperModel: 'gemini-2.0-flash-lite',
    embeddingModel: 'gemini-embedding-001'
  };

  private lastFetch: number = 0;
  private cacheDuration = 60000; // Cache for 1 minute
  private prisma: any = null;

  /**
   * Initialize with Prisma client
   */
  initialize(prismaClient: any) {
    this.prisma = prismaClient;
    // Load settings immediately
    this.loadSettings().catch(err => {
      console.error('[ModelSettings] Failed to load initial settings:', err);
    });
  }

  /**
   * Load settings from database
   */
  private async loadSettings(): Promise<void> {
    if (!this.prisma) {
      console.warn('[ModelSettings] Prisma not initialized, using defaults');
      return;
    }

    try {
      const dbSettings = await this.prisma.modelSettings.findFirst();
      
      if (dbSettings) {
        this.settings = {
          defaultModel: dbSettings.defaultModel || this.settings.defaultModel,
          cheaperModel: dbSettings.cheaperModel || this.settings.cheaperModel,
          embeddingModel: dbSettings.embeddingModel || this.settings.embeddingModel
        };
        this.lastFetch = Date.now();
        console.log('[ModelSettings] Loaded from database:', this.settings);
      } else {
        console.log('[ModelSettings] No settings in database, using defaults:', this.settings);
      }
    } catch (error) {
      console.error('[ModelSettings] Error loading settings:', error);
      // Keep using current/default settings on error
    }
  }

  /**
   * Get settings with automatic refresh if cache expired
   */
  private async getSettings(): Promise<ModelSettings> {
    const now = Date.now();
    
    // Refresh if cache expired
    if (now - this.lastFetch > this.cacheDuration) {
      await this.loadSettings();
    }

    return this.settings;
  }

  /**
   * Get default model for regular queries
   */
  async getDefaultModel(): Promise<string> {
    const settings = await this.getSettings();
    return settings.defaultModel;
  }

  /**
   * Get cheaper model for query analysis and simple tasks
   */
  async getCheaperModel(): Promise<string> {
    const settings = await this.getSettings();
    return settings.cheaperModel;
  }

  /**
   * Get embedding model for RAG
   */
  async getEmbeddingModel(): Promise<string> {
    const settings = await this.getSettings();
    return settings.embeddingModel;
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<ModelSettings> {
    return await this.getSettings();
  }

  /**
   * Force refresh settings from database
   */
  async refresh(): Promise<void> {
    await this.loadSettings();
  }

  /**
   * Get current cached settings (synchronous, no DB call)
   */
  getCurrentSettings(): ModelSettings {
    return { ...this.settings };
  }
}

// Export singleton instance
export const modelSettingsService = new ModelSettingsService();
