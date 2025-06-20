const { ENDPOINTS, makeOAuthRequest, getCorsHeaders, sessions } = require('./_utils/oauth');

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
        
        // Get session data using the new storage
        const sessionData = await sessions.get(sessionId);
        
        if (!sessionData || !sessionData.authenticated) {
            throw new Error('Invalid or expired session');
        }
        
        // Update last activity
        await sessions.set(sessionId, {
            ...sessionData,
            lastActivity: Date.now()
        });
        
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