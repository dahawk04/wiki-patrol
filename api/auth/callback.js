const { ENDPOINTS, makeOAuthRequest, getCorsHeaders } = require('../_utils/oauth');

module.exports = async (req, res) => {
    const origin = req.headers.origin;
    const corsHeaders = getCorsHeaders(origin);
    
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { oauth_token, oauth_verifier } = req.query;
        
        if (!oauth_token || !oauth_verifier) {
            throw new Error('Missing OAuth parameters');
        }
        
        console.log('Processing OAuth callback');
        
        // Find session by request token
        const { sessions } = require('../_utils/oauth');
        let sessionId = null;
        let sessionData = null;
        
        for (const [id, data] of sessions.entries()) {
            if (data.requestToken.key === oauth_token) {
                sessionId = id;
                sessionData = data;
                break;
            }
        }
        
        if (!sessionData) {
            throw new Error('Invalid or expired session');
        }
        
        // Exchange for access token
        const response = await makeOAuthRequest(ENDPOINTS.accessToken, 'POST', sessionData.requestToken, {
            oauth_verifier
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
        
        console.log('OAuth callback successful for user:', user.name);
        
        // Redirect back to frontend with success
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}?oauth_success=true&session=${sessionId}`;
        
        res.redirect(302, redirectUrl);
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        
        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}?oauth_error=${encodeURIComponent(error.message)}`;
        
        res.redirect(302, redirectUrl);
    }
}; 