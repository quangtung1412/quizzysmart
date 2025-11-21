/**
 * Gemini API Monitoring Routes
 * 
 * Admin endpoints for monitoring Gemini API usage, costs, and performance
 */

import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { geminiTrackerService } from '../services/gemini-tracker.service.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Middleware: Require admin role
 */
const requireAdmin = async (req: Request, res: Response, next: any) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }

        next();
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
};/**
 * GET /api/gemini/stats
 * Get aggregated statistics for a time range
 */
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const { startDate, endDate, modelName, requestType, status } = req.query;

        // Parse dates
        const start = startDate
            ? new Date(startDate as string)
            : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

        const end = endDate
            ? new Date(endDate as string)
            : new Date(); // Default: now

        const filters: any = {};
        if (modelName) filters.modelName = modelName as string;
        if (requestType) filters.requestType = requestType as string;
        if (status) filters.status = status as string;

        const stats = await geminiTrackerService.getStats(start, end, filters);

        res.json({
            success: true,
            data: stats,
            timeRange: {
                start: start.toISOString(),
                end: end.toISOString(),
            },
        });
    } catch (error: any) {
        console.error('[GeminiMonitoring] Failed to get stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve statistics',
            message: error.message,
        });
    }
});

/**
 * GET /api/gemini/calls
 * Get detailed call log with pagination
 */
router.get('/calls', requireAdmin, async (req, res) => {
    try {
        const {
            page = '1',
            pageSize = '50',
            startDate,
            endDate,
            modelName,
            requestType,
            status,
            userId
        } = req.query;

        const filters: any = {};
        if (startDate) filters.startDate = new Date(startDate as string);
        if (endDate) filters.endDate = new Date(endDate as string);
        if (modelName) filters.modelName = modelName as string;
        if (requestType) filters.requestType = requestType as string;
        if (status) filters.status = status as string;
        if (userId) filters.userId = userId as string;

        const result = await geminiTrackerService.getCallLog(
            parseInt(page as string),
            parseInt(pageSize as string),
            filters
        );

        res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error('[GeminiMonitoring] Failed to get call log:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve call log',
            message: error.message,
        });
    }
});

/**
 * GET /api/gemini/pricing
 * Get current pricing information for all models
 */
router.get('/pricing', requireAdmin, async (req, res) => {
    try {
        const pricing = geminiTrackerService.getPricing();

        res.json({
            success: true,
            data: pricing,
            note: 'Prices are in USD per 1 million tokens',
        });
    } catch (error: any) {
        console.error('[GeminiMonitoring] Failed to get pricing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve pricing',
            message: error.message,
        });
    }
});

/**
 * GET /api/gemini/summary
 * Get quick summary for dashboard
 */
router.get('/summary', requireAdmin, async (req, res) => {
    try {
        // Get stats for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayStats = await geminiTrackerService.getStats(today, tomorrow);

        // Get stats for this month
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        const monthStats = await geminiTrackerService.getStats(monthStart, monthEnd);

        // Get stats for last 7 days
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekStats = await geminiTrackerService.getStats(weekAgo, new Date());

        res.json({
            success: true,
            data: {
                today: todayStats.summary,
                thisMonth: monthStats.summary,
                last7Days: weekStats.summary,
            },
        });
    } catch (error: any) {
        console.error('[GeminiMonitoring] Failed to get summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve summary',
            message: error.message,
        });
    }
});

/**
 * GET /api/gemini/models
 * Get list of models with their usage
 */
router.get('/models', requireAdmin, async (req, res) => {
    try {
        const { days = '7' } = req.query;

        const startDate = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const stats = await geminiTrackerService.getStats(startDate, endDate);

        // Format model data for display
        const models = Object.entries(stats.byModel).map(([name, data]: [string, any]) => ({
            name,
            ...data,
        }));

        // Sort by total cost (highest first)
        models.sort((a, b) => b.cost - a.cost);

        res.json({
            success: true,
            data: models,
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                days: parseInt(days as string),
            },
        });
    } catch (error: any) {
        console.error('[GeminiMonitoring] Failed to get models:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve model usage',
            message: error.message,
        });
    }
});

/**
 * GET /api/gemini/request-types
 * Get breakdown by request type
 */
router.get('/request-types', requireAdmin, async (req, res) => {
    try {
        const { days = '7' } = req.query;

        const startDate = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const stats = await geminiTrackerService.getStats(startDate, endDate);

        // Format request type data
        const requestTypes = Object.entries(stats.byRequestType).map(([name, data]: [string, any]) => ({
            type: name,
            ...data,
        }));

        // Sort by number of calls (highest first)
        requestTypes.sort((a, b) => b.calls - a.calls);

        res.json({
            success: true,
            data: requestTypes,
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                days: parseInt(days as string),
            },
        });
    } catch (error: any) {
        console.error('[GeminiMonitoring] Failed to get request types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve request type breakdown',
            message: error.message,
        });
    }
});

/**
 * GET /api/gemini/timeline
 * Get time series data for charts
 */
router.get('/timeline', requireAdmin, async (req, res) => {
    try {
        const { days = '7', groupBy = 'day' } = req.query;

        const startDate = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);
        const endDate = new Date();

        const stats = await geminiTrackerService.getStats(startDate, endDate);

        res.json({
            success: true,
            data: stats.timeSeries,
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                days: parseInt(days as string),
            },
        });
    } catch (error: any) {
        console.error('[GeminiMonitoring] Failed to get timeline:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve timeline data',
            message: error.message,
        });
    }
});

/**
 * GET /api/gemini/users
 * Get list of users who made API calls
 */
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const { days = '30' } = req.query;

        const startDate = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);

        // Get unique users with their usage stats
        const users = await (prisma as any).geminiApiCall.groupBy({
            by: ['userId'],
            where: {
                userId: { not: null },
                startTime: { gte: startDate },
            },
            _count: { id: true },
            _sum: {
                totalTokens: true,
                totalCost: true,
            },
        });

        // Fetch user details
        const userIds = users.map((u: any) => u.userId).filter(Boolean);
        const userDetails = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, username: true, email: true, role: true },
        });

        const userMap = new Map(userDetails.map((u: any) => [u.id, u]));

        // Combine stats with user details
        const result = users.map((u: any) => ({
            userId: u.userId,
            name: userMap.get(u.userId)?.name || 'Unknown',
            username: userMap.get(u.userId)?.username || '-',
            email: userMap.get(u.userId)?.email || '-',
            role: userMap.get(u.userId)?.role || 'user',
            callCount: u._count.id,
            totalTokens: u._sum.totalTokens || 0,
            totalCost: u._sum.totalCost || 0,
        })).sort((a: any, b: any) => b.callCount - a.callCount);

        res.json({
            success: true,
            data: result,
            timeRange: {
                start: startDate.toISOString(),
                end: new Date().toISOString(),
                days: parseInt(days as string),
            },
        });
    } catch (error: any) {
        console.error('[GeminiMonitoring] Failed to get users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve user list',
            message: error.message,
        });
    }
});

/**
 * GET /api/gemini/sessions
 * Get API calls grouped by session (user requests)
 */
router.get('/sessions', requireAdmin, async (req, res) => {
    try {
        const {
            page = '1',
            pageSize = '20',
            userId,
            days = '7',
        } = req.query;

        const startDate = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);

        const where: any = {
            startTime: { gte: startDate },
            sessionId: { not: null },
        };

        if (userId) {
            where.userId = userId as string;
        }

        // Get sessions with aggregated stats
        const sessions = await (prisma as any).geminiApiCall.groupBy({
            by: ['sessionId'],
            where,
            _count: { id: true },
            _sum: {
                totalTokens: true,
                totalCost: true,
                duration: true,
            },
            _min: { startTime: true },
            _max: { endTime: true },
            orderBy: { _min: { startTime: 'desc' } },
            skip: (parseInt(page as string) - 1) * parseInt(pageSize as string),
            take: parseInt(pageSize as string),
        });

        // For each session, get detailed calls and user info
        const sessionDetails = await Promise.all(
            sessions.map(async (session: any) => {
                const calls = await (prisma as any).geminiApiCall.findMany({
                    where: { sessionId: session.sessionId },
                    include: {
                        user: {
                            select: { id: true, name: true, username: true, role: true },
                        },
                    },
                    orderBy: { startTime: 'asc' },
                });

                const firstCall = calls[0];
                const user = firstCall?.user;

                return {
                    sessionId: session.sessionId,
                    user: user ? {
                        id: user.id,
                        name: user.name || 'Unknown',
                        username: user.username || '-',
                        role: user.role,
                    } : null,
                    requestType: firstCall?.requestType || 'unknown',
                    callCount: session._count.id,
                    totalTokens: session._sum.totalTokens || 0,
                    totalCost: session._sum.totalCost || 0,
                    totalDuration: session._sum.duration || 0,
                    startTime: session._min.startTime,
                    endTime: session._max.endTime,
                    calls: calls.map((call: any) => ({
                        id: call.id,
                        endpoint: call.endpoint,
                        modelName: call.modelName,
                        inputTokens: call.inputTokens,
                        outputTokens: call.outputTokens,
                        totalCost: call.totalCost,
                        duration: call.duration,
                        status: call.status,
                        startTime: call.startTime,
                    })),
                };
            })
        );

        // Get total count for pagination
        const totalSessions = await (prisma as any).geminiApiCall.groupBy({
            by: ['sessionId'],
            where,
            _count: { id: true },
        });

        res.json({
            success: true,
            data: sessionDetails,
            pagination: {
                page: parseInt(page as string),
                pageSize: parseInt(pageSize as string),
                total: totalSessions.length,
                totalPages: Math.ceil(totalSessions.length / parseInt(pageSize as string)),
            },
        });
    } catch (error: any) {
        console.error('[GeminiMonitoring] Failed to get sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve sessions',
            message: error.message,
        });
    }
});

export default router;
