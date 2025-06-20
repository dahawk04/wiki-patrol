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

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        console.log('Starting OAuth flow');
        
        // Check if we should use callback URL or OOB based on environment
        const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
        const callbackUrl = process.env.OAUTH_CALLBACK_URL || 'https://wikipedia-patrol.vercel.app/api/auth/callback';
        
        // Use callback URL for production, OOB for local development
        const useOob = !isProduction && !process.env.FORCE_CALLBACK_URL;
        const oauthCallbackValue = useOob ? 'oob' : callbackUrl;

        console.log('OAuth callback configuration:', {
            useOob,
            oauthCallbackValue,
            isProduction,
            env: process.env.VERCEL_ENV || process.env.NODE_ENV,
            registeredCallback: callbackUrl,
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
        const sessionId = sessions.generateSessionId();
        
        // Store session data
        await sessions.set(sessionId, {
            requestToken,
            isOob: useOob
        });
        
        // Store reverse mapping for token lookup
        await sessions.setTokenMapping(requestToken.key, sessionId);
        
        // Build authorization URL
        const authUrl = `${ENDPOINTS.authorize}?oauth_token=${requestToken.key}&oauth_consumer_key=${process.env.WIKIPEDIA_CONSUMER_KEY}`;
        
        console.log('OAuth flow started successfully');
        
        res.status(200).json({
            success: true,
            authUrl,
            sessionId,
            isOutOfBand: useOob,
            instructions: useOob ?
                'Visit the authUrl, authorize the application, and you will receive a verification code. Use this code with the /api/auth/verify-code endpoint.' :
                'Visit the authUrl to authorize the application. You will be redirected back automatically.'
        });
        
    } catch (error) {
        console.error('OAuth login error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start OAuth flow'
        });
    }
}; 