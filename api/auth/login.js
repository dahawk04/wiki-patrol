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
        
        // Get the base URL for callback
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;
        const callbackUrl = `${baseUrl}/api/auth/callback`;
        
        console.log(`Using callback URL: ${callbackUrl}`);
        
        // Decide which callback style to use – standard redirect or out-of-band (verification code).
        // If WIKIPEDIA_OAUTH_USE_OOB env var is "true" we force OOB, otherwise we send the actual callback URL registered with the consumer.
        const useOob = process.env.WIKIPEDIA_OAUTH_USE_OOB === 'true';
        const oauthCallbackValue = useOob ? 'oob' : callbackUrl;

        console.log('OAuth callback configuration:', {
            useOob,
            oauthCallbackValue,
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
                undefined
        });
        
    } catch (error) {
        console.error('OAuth login error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to start OAuth flow'
        });
    }
}; 