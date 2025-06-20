const { getCorsHeaders } = require('../_utils/oauth');

module.exports = async (req, res) => {
    const origin = req.headers.origin;
    const corsHeaders = getCorsHeaders(origin);
    
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            throw new Error('Session ID required');
        }
        
        const { sessions } = require('../_utils/oauth');
        const sessionData = sessions.get(sessionId);
        
        if (!sessionData || !sessionData.authenticated) {
            throw new Error('Invalid or expired session');
        }
        
        // Check if session is too old (24 hours)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (Date.now() - sessionData.lastActivity > maxAge) {
            sessions.delete(sessionId);
            throw new Error('Session expired');
        }
        
        // Update last activity
        sessionData.lastActivity = Date.now();
        sessions.set(sessionId, sessionData);
        
        console.log('Session verified for user:', sessionData.user.name);
        
        res.status(200).json({
            success: true,
            user: sessionData.user
        });
        
    } catch (error) {
        console.error('Session verification error:', error);
        res.status(401).json({
            success: false,
            error: error.message || 'Session verification failed'
        });
    }
}; 