/**
 * Gemini API Tracker Service
 * 
 * Tracks all Gemini API calls with detailed metrics:
 * - Token usage (input/output)
 * - Cost calculation based on Gemini pricing
 * - Performance metrics (duration)
 * - Error tracking and retries
 * - Request categorization
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Gemini API Pricing (per 1 million tokens)
// Source: https://ai.google.dev/pricing
interface ModelPricing {
    inputPrice: number;   // USD per 1M input tokens
    outputPrice: number;  // USD per 1M output tokens
}

const GEMINI_PRICING: Record<string, ModelPricing> = {
    // Gemini 2.5 Flash
    'gemini-2.5-flash': {
        inputPrice: 0.0375,    // $0.0375 per 1M input tokens (≤128K context)
        outputPrice: 0.15,     // $0.15 per 1M output tokens
    },
    'gemini-2.5-flash-lite': {
        inputPrice: 0.00125,   // $0.00125 per 1M input tokens
        outputPrice: 0.005,    // $0.005 per 1M output tokens
    },

    // Gemini 2.5 Pro
    'gemini-2.5-pro': {
        inputPrice: 1.25,      // $1.25 per 1M input tokens (≤128K context)
        outputPrice: 5.00,     // $5.00 per 1M output tokens
    },

    // Gemini 2.0 Flash
    'gemini-2.0-flash': {
        inputPrice: 0.0,       // FREE (up to 10 RPM)
        outputPrice: 0.0,      // FREE
    },
    'gemini-2.0-flash-lite': {
        inputPrice: 0.0,       // FREE
        outputPrice: 0.0,      // FREE
    },
    'gemini-2.0-flash-exp': {
        inputPrice: 0.0,       // FREE (experimental)
        outputPrice: 0.0,      // FREE
    },

    // Gemini 1.5 Pro
    'gemini-1.5-pro': {
        inputPrice: 1.25,      // $1.25 per 1M input tokens (≤128K context)
        outputPrice: 5.00,     // $5.00 per 1M output tokens
    },

    // Gemini 1.5 Flash
    'gemini-1.5-flash': {
        inputPrice: 0.075,     // $0.075 per 1M input tokens (≤128K context)
        outputPrice: 0.30,     // $0.30 per 1M output tokens
    },
    'gemini-1.5-flash-8b': {
        inputPrice: 0.0375,    // $0.0375 per 1M input tokens (≤128K context)
        outputPrice: 0.15,     // $0.15 per 1M output tokens
    },

    // Embedding models
    'text-embedding-004': {
        inputPrice: 0.15,      // $0.15 per 1M tokens (updated pricing)
        outputPrice: 0.0,      // No output tokens
    },
    'gemini-embedding-001': {
        inputPrice: 0.15,      // $0.15 per 1M tokens (updated pricing)
        outputPrice: 0.0,      // No output tokens
    },
    'text-embedding-005': {
        inputPrice: 0.15,      // $0.15 per 1M tokens (updated pricing)
        outputPrice: 0.0,      // No output tokens
    },

    // Gemma models (Self-hosted, typically free on Vertex AI with quota)
    'gemma-3-12b': {
        inputPrice: 0.0,       // FREE (with quota)
        outputPrice: 0.0,
    },
    'gemma-3-27b': {
        inputPrice: 0.0,
        outputPrice: 0.0,
    },
    'gemma-3-4b': {
        inputPrice: 0.0,
        outputPrice: 0.0,
    },

    // LearnLM
    'learnlm-2.0-flash-experimental': {
        inputPrice: 0.0,       // FREE (experimental)
        outputPrice: 0.0,
    },
};

interface ApiCallStartParams {
    endpoint: string;          // e.g., 'generateContent', 'embedContent'
    modelName: string;         // e.g., 'gemini-2.5-flash'
    modelPriority?: number;    // From model rotation (0 = default)
    userId?: string;           // User who made request
    requestType: string;       // 'chat', 'search', 'embedding', 'document_extraction', 'query_preprocessing'
    sessionId?: string;        // Groups multiple API calls from single user request
    metadata?: Record<string, any>; // Additional context
}

interface ApiCallEndParams {
    inputTokens: number;
    outputTokens: number;
    status: 'success' | 'error';
    errorMessage?: string;
    retryCount?: number;
}

class GeminiTrackerService {
    /**
     * Calculate cost for a model based on token usage
     */
    private calculateCost(
        modelName: string,
        inputTokens: number,
        outputTokens: number
    ): { inputCost: number; outputCost: number; totalCost: number } {
        const pricing = GEMINI_PRICING[modelName] || GEMINI_PRICING['gemini-2.5-flash'];

        // Calculate costs (pricing is per 1M tokens)
        const inputCost = (inputTokens / 1_000_000) * pricing.inputPrice;
        const outputCost = (outputTokens / 1_000_000) * pricing.outputPrice;
        const totalCost = inputCost + outputCost;

        return {
            inputCost: parseFloat(inputCost.toFixed(8)),
            outputCost: parseFloat(outputCost.toFixed(8)),
            totalCost: parseFloat(totalCost.toFixed(8)),
        };
    }

    /**
     * Start tracking an API call
     * Returns the tracking ID that should be used to end the tracking
     */
    async startTracking(params: ApiCallStartParams): Promise<string> {
        try {
            const record = await (prisma as any).geminiApiCall.create({
                data: {
                    endpoint: params.endpoint,
                    modelName: params.modelName,
                    modelPriority: params.modelPriority || 0,
                    userId: params.userId,
                    requestType: params.requestType,
                    sessionId: params.sessionId,
                    startTime: new Date(),
                    status: 'pending',
                    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                },
            });

            return record.id;
        } catch (error) {
            console.error('[GeminiTracker] Failed to start tracking:', error);
            // Return dummy ID if tracking fails - don't break the main flow
            return 'tracking-error-' + Date.now();
        }
    }

    /**
     * End tracking an API call with results
     */
    async endTracking(trackingId: string, params: ApiCallEndParams): Promise<void> {
        try {
            // Skip if it's a dummy error ID
            if (trackingId.startsWith('tracking-error-')) {
                return;
            }

            const endTime = new Date();

            // Get the start record to calculate duration
            const record = await (prisma as any).geminiApiCall.findUnique({
                where: { id: trackingId },
            });

            if (!record) {
                console.warn(`[GeminiTracker] Record not found: ${trackingId}`);
                return;
            }

            const duration = endTime.getTime() - record.startTime.getTime();
            const totalTokens = params.inputTokens + params.outputTokens;

            // Calculate cost
            const cost = this.calculateCost(
                record.modelName,
                params.inputTokens,
                params.outputTokens
            );

            // Update record
            await (prisma as any).geminiApiCall.update({
                where: { id: trackingId },
                data: {
                    endTime,
                    duration,
                    inputTokens: params.inputTokens,
                    outputTokens: params.outputTokens,
                    totalTokens,
                    inputCost: cost.inputCost,
                    outputCost: cost.outputCost,
                    totalCost: cost.totalCost,
                    status: params.status,
                    errorMessage: params.errorMessage,
                    retryCount: params.retryCount || 0,
                },
            });

            // Log summary
            console.log(
                `[GeminiTracker] ${params.status.toUpperCase()} | ${record.modelName} | ` +
                `${record.requestType} | ${duration}ms | ` +
                `${totalTokens} tokens | $${cost.totalCost.toFixed(6)}`
            );
        } catch (error) {
            console.error('[GeminiTracker] Failed to end tracking:', error);
        }
    }

    /**
     * Quick track - for simple one-shot tracking without start/end
     */
    async trackCall(
        params: ApiCallStartParams & {
            inputTokens: number;
            outputTokens: number;
            duration: number;
            status: 'success' | 'error';
            errorMessage?: string;
            retryCount?: number;
        }
    ): Promise<void> {
        try {
            const totalTokens = params.inputTokens + params.outputTokens;
            const cost = this.calculateCost(params.modelName, params.inputTokens, params.outputTokens);

            await (prisma as any).geminiApiCall.create({
                data: {
                    endpoint: params.endpoint,
                    modelName: params.modelName,
                    modelPriority: params.modelPriority || 0,
                    userId: params.userId,
                    requestType: params.requestType,
                    startTime: new Date(Date.now() - params.duration),
                    endTime: new Date(),
                    duration: params.duration,
                    inputTokens: params.inputTokens,
                    outputTokens: params.outputTokens,
                    totalTokens,
                    inputCost: cost.inputCost,
                    outputCost: cost.outputCost,
                    totalCost: cost.totalCost,
                    status: params.status,
                    errorMessage: params.errorMessage,
                    retryCount: params.retryCount || 0,
                    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
                },
            });

            console.log(
                `[GeminiTracker] ${params.status.toUpperCase()} | ${params.modelName} | ` +
                `${params.requestType} | ${params.duration}ms | ` +
                `${totalTokens} tokens | $${cost.totalCost.toFixed(6)}`
            );
        } catch (error) {
            console.error('[GeminiTracker] Failed to track call:', error);
        }
    }

    /**
     * Get statistics for a time range
     */
    async getStats(
        startDate: Date,
        endDate: Date,
        filters?: {
            userId?: string;
            modelName?: string;
            requestType?: string;
            status?: string;
        }
    ) {
        try {
            const whereClause: any = {
                startTime: {
                    gte: startDate,
                    lte: endDate,
                },
            };

            if (filters?.userId) whereClause.userId = filters.userId;
            if (filters?.modelName) whereClause.modelName = filters.modelName;
            if (filters?.requestType) whereClause.requestType = filters.requestType;
            if (filters?.status) whereClause.status = filters.status;

            // Get all records
            const records = await (prisma as any).geminiApiCall.findMany({
                where: whereClause,
                orderBy: { startTime: 'desc' },
            });

            // Calculate aggregates
            const totalCalls = records.length;
            const successfulCalls = records.filter((r: any) => r.status === 'success').length;
            const failedCalls = records.filter((r: any) => r.status === 'error').length;

            const totalTokens = records.reduce((sum: number, r: any) => sum + r.totalTokens, 0);
            const totalCost = records.reduce((sum: number, r: any) => sum + r.totalCost, 0);
            const avgDuration = records.length > 0
                ? records.reduce((sum: number, r: any) => sum + r.duration, 0) / records.length
                : 0;

            // Group by model
            const byModel: Record<string, any> = {};
            records.forEach((r: any) => {
                if (!byModel[r.modelName]) {
                    byModel[r.modelName] = {
                        calls: 0,
                        tokens: 0,
                        cost: 0,
                        avgDuration: 0,
                        success: 0,
                        failed: 0,
                    };
                }
                byModel[r.modelName].calls++;
                byModel[r.modelName].tokens += r.totalTokens;
                byModel[r.modelName].cost += r.totalCost;
                byModel[r.modelName].avgDuration += r.duration;
                if (r.status === 'success') byModel[r.modelName].success++;
                if (r.status === 'error') byModel[r.modelName].failed++;
            });

            // Calculate averages for each model
            Object.keys(byModel).forEach((model) => {
                byModel[model].avgDuration = Math.round(byModel[model].avgDuration / byModel[model].calls);
                byModel[model].cost = parseFloat(byModel[model].cost.toFixed(6));
            });

            // Group by request type
            const byRequestType: Record<string, any> = {};
            records.forEach((r: any) => {
                if (!byRequestType[r.requestType]) {
                    byRequestType[r.requestType] = {
                        calls: 0,
                        tokens: 0,
                        cost: 0,
                        avgDuration: 0,
                    };
                }
                byRequestType[r.requestType].calls++;
                byRequestType[r.requestType].tokens += r.totalTokens;
                byRequestType[r.requestType].cost += r.totalCost;
                byRequestType[r.requestType].avgDuration += r.duration;
            });

            // Calculate averages for each request type
            Object.keys(byRequestType).forEach((type) => {
                byRequestType[type].avgDuration = Math.round(byRequestType[type].avgDuration / byRequestType[type].calls);
                byRequestType[type].cost = parseFloat(byRequestType[type].cost.toFixed(6));
            });

            // Group by day for time series
            const byDay: Record<string, any> = {};
            records.forEach((r: any) => {
                const day = new Date(r.startTime).toISOString().split('T')[0];
                if (!byDay[day]) {
                    byDay[day] = {
                        calls: 0,
                        tokens: 0,
                        cost: 0,
                    };
                }
                byDay[day].calls++;
                byDay[day].tokens += r.totalTokens;
                byDay[day].cost += r.totalCost;
            });

            // Format by day for charts
            const timeSeriesData = Object.keys(byDay)
                .sort()
                .map((day) => ({
                    date: day,
                    calls: byDay[day].calls,
                    tokens: byDay[day].tokens,
                    cost: parseFloat(byDay[day].cost.toFixed(6)),
                }));

            return {
                summary: {
                    totalCalls,
                    successfulCalls,
                    failedCalls,
                    successRate: totalCalls > 0 ? ((successfulCalls / totalCalls) * 100).toFixed(2) + '%' : '0%',
                    totalTokens,
                    totalCost: parseFloat(totalCost.toFixed(6)),
                    avgDuration: Math.round(avgDuration),
                    avgTokensPerCall: totalCalls > 0 ? Math.round(totalTokens / totalCalls) : 0,
                    avgCostPerCall: totalCalls > 0 ? parseFloat((totalCost / totalCalls).toFixed(6)) : 0,
                },
                byModel,
                byRequestType,
                timeSeries: timeSeriesData,
                recentCalls: records.slice(0, 100).map((r: any) => ({
                    id: r.id,
                    startTime: r.startTime,
                    modelName: r.modelName,
                    requestType: r.requestType,
                    duration: r.duration,
                    totalTokens: r.totalTokens,
                    totalCost: parseFloat(r.totalCost.toFixed(6)),
                    status: r.status,
                    errorMessage: r.errorMessage,
                })),
            };
        } catch (error) {
            console.error('[GeminiTracker] Failed to get stats:', error);
            throw error;
        }
    }

    /**
     * Get detailed call log with pagination
     */
    async getCallLog(
        page: number = 1,
        pageSize: number = 50,
        filters?: {
            startDate?: Date;
            endDate?: Date;
            userId?: string;
            modelName?: string;
            requestType?: string;
            status?: string;
        }
    ) {
        try {
            const whereClause: any = {};

            if (filters?.startDate || filters?.endDate) {
                whereClause.startTime = {};
                if (filters.startDate) whereClause.startTime.gte = filters.startDate;
                if (filters.endDate) whereClause.startTime.lte = filters.endDate;
            }

            if (filters?.userId) whereClause.userId = filters.userId;
            if (filters?.modelName) whereClause.modelName = filters.modelName;
            if (filters?.requestType) whereClause.requestType = filters.requestType;
            if (filters?.status) whereClause.status = filters.status;

            const skip = (page - 1) * pageSize;

            const [records, total] = await Promise.all([
                (prisma as any).geminiApiCall.findMany({
                    where: whereClause,
                    orderBy: { startTime: 'desc' },
                    skip,
                    take: pageSize,
                }),
                (prisma as any).geminiApiCall.count({ where: whereClause }),
            ]);

            return {
                data: records.map((r: any) => ({
                    id: r.id,
                    startTime: r.startTime,
                    endTime: r.endTime,
                    modelName: r.modelName,
                    endpoint: r.endpoint,
                    requestType: r.requestType,
                    userId: r.userId,
                    duration: r.duration,
                    inputTokens: r.inputTokens,
                    outputTokens: r.outputTokens,
                    totalTokens: r.totalTokens,
                    inputCost: r.inputCost,
                    outputCost: r.outputCost,
                    totalCost: parseFloat(r.totalCost.toFixed(6)),
                    status: r.status,
                    errorMessage: r.errorMessage,
                    retryCount: r.retryCount,
                    metadata: r.metadata ? JSON.parse(r.metadata) : null,
                })),
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize),
                },
            };
        } catch (error) {
            console.error('[GeminiTracker] Failed to get call log:', error);
            throw error;
        }
    }

    /**
     * Get pricing information for all models
     */
    getPricing(): Record<string, ModelPricing> {
        return GEMINI_PRICING;
    }
}

export const geminiTrackerService = new GeminiTrackerService();
