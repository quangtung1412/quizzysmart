// Gemini Model Rotation Service
// Manages multiple Gemini models to maximize free quota usage

interface ModelConfig {
    name: string;
    rpm: number;        // Requests Per Minute
    tpm: number;        // Tokens Per Minute (approximate)
    rpd: number;        // Requests Per Day
    priority: number;   // Lower is better (1 = highest priority)
    category: string;
}

interface ModelUsage {
    requestCount: number;
    lastResetTime: number;
    dailyRequestCount: number;
    lastDailyResetTime: number;
}

// Model configurations from the provided data
const MODEL_CONFIGS: ModelConfig[] = [
    { name: 'gemini-2.5-flash', rpm: 10, tpm: 250000, rpd: 250, priority: 1, category: 'Text-out models' },
    { name: 'gemini-2.0-flash', rpm: 15, tpm: 1000000, rpd: 200, priority: 2, category: 'Text-out models' },
    { name: 'gemini-2.0-flash-lite', rpm: 30, tpm: 1000000, rpd: 200, priority: 3, category: 'Text-out models' },
    { name: 'gemini-2.5-flash-lite', rpm: 15, tpm: 250000, rpd: 1000, priority: 4, category: 'Text-out models' },
    { name: 'gemini-2.0-flash-exp', rpm: 10, tpm: 250000, rpd: 50, priority: 5, category: 'Text-out models' },
    { name: 'gemini-2.5-pro', rpm: 2, tpm: 125000, rpd: 50, priority: 6, category: 'Text-out models' },
    { name: 'gemma-3-12b', rpm: 30, tpm: 15000, rpd: 14400, priority: 7, category: 'Other models' },
    { name: 'gemma-3-27b', rpm: 30, tpm: 15000, rpd: 14400, priority: 8, category: 'Other models' },
    { name: 'gemma-3-4b', rpm: 30, tpm: 15000, rpd: 14400, priority: 9, category: 'Other models' },
    { name: 'learnlm-2.0-flash-experimental', rpm: 15, tpm: 0, rpd: 1500, priority: 10, category: 'Text-out models' },
];

// Sort by priority (lowest first)
MODEL_CONFIGS.sort((a, b) => a.priority - b.priority);

class GeminiModelRotationService {
    private modelUsage: Map<string, ModelUsage> = new Map();
    private currentModelIndex: number = 0;

    constructor() {
        // Initialize usage tracking for all models
        for (const model of MODEL_CONFIGS) {
            this.modelUsage.set(model.name, {
                requestCount: 0,
                lastResetTime: Date.now(),
                dailyRequestCount: 0,
                lastDailyResetTime: Date.now(),
            });
        }

        // Setup periodic reset (every minute)
        setInterval(() => this.resetMinuteCounters(), 60 * 1000);
        // Setup daily reset (every 24 hours)
        setInterval(() => this.resetDailyCounters(), 24 * 60 * 60 * 1000);
    }

    private resetMinuteCounters() {
        const now = Date.now();
        for (const [modelName, usage] of this.modelUsage.entries()) {
            // Reset if more than 1 minute has passed
            if (now - usage.lastResetTime > 60 * 1000) {
                usage.requestCount = 0;
                usage.lastResetTime = now;
                console.log(`[ModelRotation] Reset minute counter for ${modelName}`);
            }
        }
    }

    private resetDailyCounters() {
        const now = Date.now();
        for (const [modelName, usage] of this.modelUsage.entries()) {
            // Reset if more than 24 hours have passed
            if (now - usage.lastDailyResetTime > 24 * 60 * 60 * 1000) {
                usage.dailyRequestCount = 0;
                usage.lastDailyResetTime = now;
                console.log(`[ModelRotation] Reset daily counter for ${modelName}`);
            }
        }
    }

    private canUseModel(model: ModelConfig): boolean {
        const usage = this.modelUsage.get(model.name);
        if (!usage) return false;

        const now = Date.now();

        // Check if minute counter needs reset
        if (now - usage.lastResetTime > 60 * 1000) {
            usage.requestCount = 0;
            usage.lastResetTime = now;
        }

        // Check if daily counter needs reset
        if (now - usage.lastDailyResetTime > 24 * 60 * 60 * 1000) {
            usage.dailyRequestCount = 0;
            usage.lastDailyResetTime = now;
        }

        // Check RPM limit
        if (usage.requestCount >= model.rpm) {
            console.log(`[ModelRotation] ${model.name} reached RPM limit (${usage.requestCount}/${model.rpm})`);
            return false;
        }

        // Check RPD limit
        if (usage.dailyRequestCount >= model.rpd) {
            console.log(`[ModelRotation] ${model.name} reached RPD limit (${usage.dailyRequestCount}/${model.rpd})`);
            return false;
        }

        return true;
    }

    /**
     * Get the next available model based on priority and usage limits
     * @returns {ModelConfig | null} Next available model or null if all exhausted
     */
    public getNextAvailableModel(): ModelConfig | null {
        // Try to find an available model starting from the current index (priority order)
        for (let i = 0; i < MODEL_CONFIGS.length; i++) {
            const modelIndex = (this.currentModelIndex + i) % MODEL_CONFIGS.length;
            const model = MODEL_CONFIGS[modelIndex];

            if (this.canUseModel(model)) {
                this.currentModelIndex = modelIndex;
                return model;
            }
        }

        // All models exhausted
        console.error('[ModelRotation] All models have reached their limits!');
        return null;
    }

    /**
     * Record a successful request for a model
     * @param modelName Name of the model used
     */
    public recordRequest(modelName: string) {
        const usage = this.modelUsage.get(modelName);
        if (!usage) return;

        usage.requestCount++;
        usage.dailyRequestCount++;

        const model = MODEL_CONFIGS.find(m => m.name === modelName);
        if (model) {
            console.log(
                `[ModelRotation] ${modelName} - RPM: ${usage.requestCount}/${model.rpm}, ` +
                `RPD: ${usage.dailyRequestCount}/${model.rpd}, Priority: ${model.priority}`
            );
        }

        // If current model reaches limit, try to move to next priority
        if (model && !this.canUseModel(model)) {
            console.log(`[ModelRotation] ${modelName} limit reached, will switch to next available model`);
            // Find next available model
            const nextModel = this.getNextAvailableModel();
            if (nextModel) {
                console.log(`[ModelRotation] Next available model: ${nextModel.name} (priority ${nextModel.priority})`);
            }
        }
    }

    /**
     * Get usage statistics for all models
     */
    public getUsageStats() {
        const stats: any[] = [];
        for (const model of MODEL_CONFIGS) {
            const usage = this.modelUsage.get(model.name);
            if (usage) {
                stats.push({
                    name: model.name,
                    priority: model.priority,
                    rpm: `${usage.requestCount}/${model.rpm}`,
                    rpd: `${usage.dailyRequestCount}/${model.rpd}`,
                    rpmPercent: ((usage.requestCount / model.rpm) * 100).toFixed(1) + '%',
                    rpdPercent: ((usage.dailyRequestCount / model.rpd) * 100).toFixed(1) + '%',
                    available: this.canUseModel(model)
                });
            }
        }
        return stats;
    }

    /**
     * Reset usage for a specific model (for testing)
     */
    public resetModelUsage(modelName: string) {
        const usage = this.modelUsage.get(modelName);
        if (usage) {
            usage.requestCount = 0;
            usage.dailyRequestCount = 0;
            usage.lastResetTime = Date.now();
            usage.lastDailyResetTime = Date.now();
            console.log(`[ModelRotation] Reset usage for ${modelName}`);
        }
    }

    /**
     * Reset all model usage (for testing)
     */
    public resetAllUsage() {
        for (const [modelName, _] of this.modelUsage.entries()) {
            this.resetModelUsage(modelName);
        }
        this.currentModelIndex = 0;
        console.log('[ModelRotation] Reset all model usage');
    }
}

// Export singleton instance
export const geminiModelRotation = new GeminiModelRotationService();
