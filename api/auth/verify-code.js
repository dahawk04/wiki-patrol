const { ENDPOINTS, makeOAuthRequest, getCorsHeaders, sessions } = require('../_utils/oauth');

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
        const { sessionId, verificationCode } = req.body;
        
        if (!sessionId || !verificationCode) {
            throw new Error('Missing sessionId or verificationCode');
        }
        
        console.log('Processing OAuth verification code');
        
        // Get session data
        const sessionData = sessions.get(sessionId);
        
        if (!sessionData) {
            throw new Error('Invalid or expired session');
        }
        
        // Exchange for access token
        const response = await makeOAuthRequest(ENDPOINTS.accessToken, 'POST', sessionData.requestToken, {
            oauth_verifier: verificationCode.trim()
        });
        
        // Parse access token response
        const params = new URLSearchParams(response);
        const accessToken = {
            key: params.get('oauth_token'),
            secret: params.get('oauth_token_secret')
        };
        
        if (!accessToken.key || !accessToken.secret) {
            throw new Error('Failed to get access token');
        }
        
        // Get user information
        const userResponse = await makeOAuthRequest(ENDPOINTS.api, 'GET', accessToken, {
            action: 'query',
            meta: 'userinfo',
            format: 'json'
        });
        
        const user = {
            id: userResponse.query.userinfo.id,
            name: userResponse.query.userinfo.name,
            groups: userResponse.query.userinfo.groups || []
        };
        
        // Update session with access token and user info
        sessions.set(sessionId, {
            ...sessionData,
            accessToken,
            user,
            authenticated: true,
            lastActivity: Date.now()
        });
        
        console.log('OAuth verification successful for user:', user.name);
        
        res.status(200).json({
            success: true,
            user,
            sessionId
        });
        
    } catch (error) {
        console.error('OAuth verification error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Failed to verify code'
        });
    }
}; 