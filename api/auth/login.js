const { ENDPOINTS, makeOAuthRequest, getCorsHeaders } = require('../_utils/oauth');

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

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        console.log('Starting OAuth flow');
        
        // Use the registered callback URL for this OAuth application
        const useOob = false;
        const callbackUrl = 'https://wikipedia-patrol.vercel.app/api/auth/callback';
        const oauthCallbackValue = callbackUrl;

        console.log('OAuth callback configuration:', {
            useOob,
            oauthCallbackValue,
            // The registered callback URL is not used in OOB flow, but we log it for debugging.
            registeredCallback: 'https://wikipedia-patrol.vercel.app/api/auth/callback',
            consumerKey: process.env.WIKIPEDIA_CONSUMER_KEY?.trim()?.substring(0, 8) + '...'
        });

        // Get request token
        const response = await makeOAuthRequest(ENDPOINTS.requestToken, 'POST', null, {
            oauth_callback: oauthCallbackValue
        });
        
        // Parse response (URL encoded)
        const params = new URLSearchParams(response);
        const requestToken = {
            key: params.get('oauth_token'),
            secret: params.get('oauth_token_secret')
        };
        
        if (!requestToken.key || !requestToken.secret) {
            console.error('Request token response:', response);
            throw new Error('Failed to get request token');
        }
        
        // Generate session ID
        const sessionId = require('crypto').randomBytes(32).toString('hex');
        
        // Store request token (in production, use Redis/Database)
        const { sessions } = require('../_utils/oauth');
        sessions.set(sessionId, {
            requestToken,
            createdAt: Date.now()
        });
        
        // Build authorization URL (callback was already specified in the request token step)
        const authUrl = `${ENDPOINTS.authorize}?oauth_token=${requestToken.key}`;
        
        console.log('OAuth flow started successfully');
        
        res.status(200).json({
            success: true,
            authUrl,
            sessionId,
            isOutOfBand: useOob,
            instructions: useOob ?
                'Visit the authUrl, authorize the application, and you will receive a verification code. Use this code with the /api/auth/verify-code endpoint.' :
                'Visit the authUrl and authorize the application. You will be redirected back automatically.'
        });
        
    } catch (error) {
        console.error('OAuth login error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start OAuth flow'
        });
    }
}; 