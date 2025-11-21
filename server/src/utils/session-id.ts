/**
 * Session ID Utility
 * 
 * Generates unique session IDs to group multiple API calls
 * from a single user request (e.g., RAG pipeline with query preprocessing + embedding + answer generation)
 */

import { randomBytes } from 'crypto';

/**
 * Generate a unique session ID
 * Format: {userId}-{timestamp}-{random}
 */
export function generateSessionId(userId?: string): string {
    const timestamp = Date.now().toString(36); // Base36 for shorter string
    const random = randomBytes(4).toString('hex'); // 8 chars random
    const userPrefix = userId ? userId.substring(0, 8) : 'anon';

    return `${userPrefix}-${timestamp}-${random}`;
}

/**
 * Parse session ID to extract components
 */
export function parseSessionId(sessionId: string): {
    userPrefix: string;
    timestamp: number;
    random: string;
} | null {
    try {
        const parts = sessionId.split('-');
        if (parts.length !== 3) return null;

        return {
            userPrefix: parts[0],
            timestamp: parseInt(parts[1], 36),
            random: parts[2],
        };
    } catch {
        return null;
    }
}
