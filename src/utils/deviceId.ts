// Device ID management for single-device login enforcement

const DEVICE_ID_KEY = 'app_device_id';
const SESSION_TOKEN_KEY = 'app_session_token';

/**
 * Generate a unique device ID based on browser fingerprint
 */
export function generateDeviceId(): string {
    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        !!window.sessionStorage,
        !!window.localStorage,
    ].join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Add random component to make it unique per browser instance
    const random = Math.random().toString(36).substring(2, 15);
    return `device_${Math.abs(hash).toString(36)}_${random}`;
}

/**
 * Get or create device ID from localStorage
 */
export function getDeviceId(): string {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
        deviceId = generateDeviceId();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
}

/**
 * Store session token for this device
 */
export function setSessionToken(token: string): void {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
}

/**
 * Get session token for this device
 */
export function getSessionToken(): string | null {
    return localStorage.getItem(SESSION_TOKEN_KEY);
}

/**
 * Clear device session data (on logout)
 */
export function clearDeviceSession(): void {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    // Don't remove device ID - we want to keep it for the device
}

/**
 * Clear all device data including device ID
 */
export function clearAllDeviceData(): void {
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);
}
