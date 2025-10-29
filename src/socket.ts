import { io, Socket } from 'socket.io-client';
import { API_BASE } from './api';

let socket: Socket | null = null;

// Determine Socket.IO URL based on environment
const getSocketURL = (): string => {
    // In development (Vite dev server on port 517x)
    if (typeof window !== 'undefined') {
        const port = window.location.port;
        const isDev = import.meta?.env?.DEV && /^517\d$/.test(port);

        if (isDev) {
            // Dev: Connect directly to localhost:3000
            return 'http://localhost:3000';
        }

        // Production: Use API_BASE as socket URL
        // This ensures socket connects to the same backend as API calls
        return API_BASE;
    }

    // Fallback for SSR
    return 'http://localhost:3000';
};

export const initSocket = (userId: string) => {
    if (socket?.connected) {
        console.log('[Socket] Already connected');
        return socket;
    }

    const socketURL = getSocketURL();
    console.log('[Socket] Connecting to:', socketURL);

    socket = io(socketURL, {
        path: '/socket.io',  // Explicit path for Socket.IO
        transports: ['polling', 'websocket'],  // Start with polling, upgrade to websocket
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,  // Increase attempts
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 30000,  // Increase timeout to 30s
        autoConnect: true,
        forceNew: false
    });

    socket.on('connect', () => {
        console.log('[Socket] Connected successfully!');
        console.log('[Socket] ID:', socket?.id);
        console.log('[Socket] Transport:', socket?.io.engine.transport.name);
        // Authenticate with userId
        socket?.emit('authenticate', userId);
    });

    socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
        if (reason === 'io server disconnect') {
            // Server disconnected, try to reconnect manually
            socket?.connect();
        }
    });

    socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        console.log('[Socket] Error details:', {
            message: error.message,
            type: (error as any).type,
            description: (error as any).description
        });
        console.log('[Socket] Retrying connection...');
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
        // Re-authenticate after reconnection
        socket?.emit('authenticate', userId);
    });

    socket.on('reconnect_error', (error) => {
        console.error('[Socket] Reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
        console.error('[Socket] Reconnection failed after all attempts');
    });

    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        console.log('[Socket] Disconnecting');
        socket.disconnect();
        socket = null;
    }
};

export default {
    init: initSocket,
    get: getSocket,
    disconnect: disconnectSocket
};

// Export socket instance for direct access
export { socket, getSocket as getSocketInstance };
