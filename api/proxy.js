const { ENDPOINTS, makeOAuthRequest, getCorsHeaders } = require('./_utils/oauth');

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
        const { sessionId, action, params } = req.body;
        
        if (!sessionId) {
            throw new Error('Session ID required');
        }
        
        const { sessions } = require('./_utils/oauth');
        const sessionData = sessions.get(sessionId);
        
        if (!sessionData || !sessionData.authenticated) {
            throw new Error('Invalid or expired session');
        }
        
        // Check if session is too old
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (Date.now() - sessionData.lastActivity > maxAge) {
            sessions.delete(sessionId);
            throw new Error('Session expired');
        }
        
        // Update last activity
        sessionData.lastActivity = Date.now();
        sessions.set(sessionId, sessionData);
        
        // Prepare API parameters
        const apiParams = {
            action: action,
            format: 'json',
            ...params
        };
        
        console.log('Making Wikipedia API call:', {
            action,
            user: sessionData.user.name,
            paramsCount: Object.keys(params).length
        });
        
        // Make authenticated API call
        const response = await makeOAuthRequest(
            ENDPOINTS.api, 
            'POST', 
            sessionData.accessToken, 
            apiParams
        );
        
        console.log('Wikipedia API call successful');
        
        res.status(200).json({
            success: true,
            data: response
        });
        
    } catch (error) {
        console.error('API proxy error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'API call failed'
        });
    }
}; 