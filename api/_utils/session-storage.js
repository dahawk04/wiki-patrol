const crypto = require('crypto');

// Session storage interface that supports multiple backends
class SessionStorage {
    constructor() {
        // In-memory fallback (for local development)
        this.memoryStore = new Map();
        
        // Check if Vercel KV is available
        this.kvStore = null;
        if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            console.log('Vercel KV detected, using KV for session storage');
            this.initKV();
        } else {
            console.log('No Vercel KV configured, using in-memory storage (not suitable for production)');
        }
    }

    async initKV() {
        try {
            // Dynamically import @vercel/kv if available
            const { kv } = await import('@vercel/kv');
            this.kvStore = kv;
        } catch (error) {
            console.error('Failed to initialize Vercel KV:', error);
            console.log('Falling back to in-memory storage');
        }
    }

    // Generate a secure session ID
    generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Store session data
    async set(sessionId, data, ttlSeconds = 3600) {
        const sessionData = {
            ...data,
            createdAt: Date.now(),
            expiresAt: Date.now() + (ttlSeconds * 1000)
        };

        if (this.kvStore) {
            try {
                await this.kvStore.set(`session:${sessionId}`, JSON.stringify(sessionData), {
                    ex: ttlSeconds
                });
                return true;
            } catch (error) {
                console.error('KV storage error:', error);
                // Fall back to memory store
            }
        }

        // Fallback to memory store
        this.memoryStore.set(sessionId, sessionData);
        
        // Clean up expired sessions periodically
        this.cleanupExpiredSessions();
        
        return true;
    }

    // Get session data
    async get(sessionId) {
        if (this.kvStore) {
            try {
                const data = await this.kvStore.get(`session:${sessionId}`);
                if (data) {
                    const sessionData = JSON.parse(data);
                    // Check if session has expired
                    if (sessionData.expiresAt && sessionData.expiresAt < Date.now()) {
                        await this.delete(sessionId);
                        return null;
                    }
                    return sessionData;
                }
            } catch (error) {
                console.error('KV retrieval error:', error);
                // Fall back to memory store
            }
        }

        // Fallback to memory store
        const sessionData = this.memoryStore.get(sessionId);
        if (sessionData) {
            // Check if session has expired
            if (sessionData.expiresAt && sessionData.expiresAt < Date.now()) {
                this.memoryStore.delete(sessionId);
                return null;
            }
            return sessionData;
        }

        return null;
    }

    // Delete session
    async delete(sessionId) {
        if (this.kvStore) {
            try {
                await this.kvStore.del(`session:${sessionId}`);
            } catch (error) {
                console.error('KV deletion error:', error);
            }
        }
        
        this.memoryStore.delete(sessionId);
        return true;
    }

    // Find session by request token
    async findByRequestToken(requestToken) {
        if (this.kvStore) {
            // For KV store, we need to maintain a reverse index
            try {
                const sessionId = await this.kvStore.get(`token:${requestToken}`);
                if (sessionId) {
                    const session = await this.get(sessionId);
                    if (session) {
                        return { sessionId, session };
                    }
                }
            } catch (error) {
                console.error('KV token lookup error:', error);
            }
        }

        // Fallback to memory store (iterate through all sessions)
        for (const [sessionId, session] of this.memoryStore.entries()) {
            if (session.requestToken && session.requestToken.key === requestToken) {
                // Check if session has expired
                if (session.expiresAt && session.expiresAt < Date.now()) {
                    this.memoryStore.delete(sessionId);
                    continue;
                }
                return { sessionId, session };
            }
        }

        return null;
    }

    // Store request token -> session mapping for KV
    async setTokenMapping(requestToken, sessionId, ttlSeconds = 3600) {
        if (this.kvStore) {
            try {
                await this.kvStore.set(`token:${requestToken}`, sessionId, {
                    ex: ttlSeconds
                });
            } catch (error) {
                console.error('KV token mapping error:', error);
            }
        }
    }

    // Clean up expired sessions from memory store
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.memoryStore.entries()) {
            if (session.expiresAt && session.expiresAt < now) {
                this.memoryStore.delete(sessionId);
            }
        }
    }

    // Get all active sessions (for debugging)
    async getAllSessions() {
        const sessions = [];
        
        if (this.kvStore) {
            console.log('KV store does not support listing all sessions');
        }
        
        // From memory store
        for (const [sessionId, session] of this.memoryStore.entries()) {
            if (!session.expiresAt || session.expiresAt > Date.now()) {
                sessions.push({ sessionId, ...session });
            }
        }
        
        return sessions;
    }
}

// Create singleton instance
const sessionStorage = new SessionStorage();

module.exports = sessionStorage; 