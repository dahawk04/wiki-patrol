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
        
        // Determine OAuth callback based on environment and app configuration
        const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
        const frontendUrl = process.env.FRONTEND_URL || (isProduction ? 'https://wikipedia-patrol.vercel.app' : 'http://localhost:3000');
        const registeredCallback = `${frontendUrl}/api/auth/callback`;
        
        // Try callback-based authentication first since the app seems configured for it
        const useOob = false;
        const oauthCallbackValue = registeredCallback;

        console.log('OAuth callback configuration:', {
            useOob,
            oauthCallbackValue,
            isProduction,
            env: process.env.NODE_ENV || process.env.VERCEL_ENV || 'development',
            registeredCallback,
            consumerKey: process.env.WIKIPEDIA_CONSUMER_KEY?.trim()?.substring(0, 8) + '...'
        });

        // Get request token
        console.log('Making OAuth request:', {
            url: ENDPOINTS.requestToken,
            method: 'POST',
            hasToken: false,
            data: { oauth_callback: oauthCallbackValue }
        });
        
        const response = await makeOAuthRequest(ENDPOINTS.requestToken, 'POST', null, {
            oauth_callback: oauthCallbackValue
        });
        
        console.log('OAuth request successful:', {
            url: ENDPOINTS.requestToken,
            status: 200,
            dataLength: response?.length || 0
        });
        
        console.log('Request token response:', response);
        
        // Check if response is an error message
        if (typeof response === 'string' && response.includes('Error:')) {
            console.error('OAuth service returned error:', response);
            throw new Error(response);
        }
        
        // Parse response (URL encoded)
        const params = new URLSearchParams(response);
        const requestToken = {
            key: params.get('oauth_token'),
            secret: params.get('oauth_token_secret')
        };
        
        console.log('Parsed request token:', {
            hasKey: !!requestToken.key,
            hasSecret: !!requestToken.secret,
            keyLength: requestToken.key?.length || 0,
            secretLength: requestToken.secret?.length || 0
        });
        
        // Check for oauth_callback_confirmed as required by OAuth 1.0a
        const callbackConfirmed = params.get('oauth_callback_confirmed');
        console.log('Callback confirmed:', callbackConfirmed);
        
        if (!requestToken.key || !requestToken.secret) {
            console.error('Request token response:', response);
            console.error('Parsed params:', Object.fromEntries(params.entries()));
            throw new Error('Failed to get request token - missing oauth_token or oauth_token_secret');
        }
        
        if (callbackConfirmed !== 'true') {
            console.error('OAuth callback not confirmed by service provider');
            throw new Error('Service provider did not confirm OAuth callback (OAuth 1.0a requirement)');
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
        
        // Build authorization URL - OAuth 1.0a only requires oauth_token parameter
        const authUrl = `${ENDPOINTS.authorize}?oauth_token=${requestToken.key}`;
        
        console.log('OAuth flow started successfully');
        
        res.status(200).json({
            success: true,
            authUrl,
            sessionId,
            isOutOfBand: useOob,
            instructions: useOob 
                ? 'Visit the authUrl, authorize the application, and you will receive a verification code. Use this code with the /api/auth/verify-code endpoint.'
                : 'Visit the authUrl and authorize the application. You will be redirected back to complete the login.'
        });
        
    } catch (error) {
        console.error('OAuth login error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start OAuth flow'
        });
    }
}; 