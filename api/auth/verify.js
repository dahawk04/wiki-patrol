const { getCorsHeaders, sessions } = require('../_utils/oauth');

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
            return res.status(200).json({
                success: false,
                error: 'No session ID provided'
            });
        }
        
        // Get session data using the new storage
        const sessionData = await sessions.get(sessionId);
        
        if (!sessionData || !sessionData.authenticated) {
            return res.status(200).json({
                success: false,
                error: 'Invalid or unauthenticated session'
            });
        }
        
        // Update last activity
        await sessions.set(sessionId, {
            ...sessionData,
            lastActivity: Date.now()
        });
        
        res.status(200).json({
            success: true,
            user: sessionData.user
        });
        
    } catch (error) {
        console.error('Session verification error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to verify session'
        });
    }
}; 