const { getCorsHeaders } = require('./_utils/oauth');

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

    // Debug information
    const debug = {
        environment: {
            hasConsumerKey: !!process.env.WIKIPEDIA_CONSUMER_KEY,
            hasConsumerSecret: !!process.env.WIKIPEDIA_CONSUMER_SECRET,
            hasFrontendUrl: !!process.env.FRONTEND_URL,
            frontendUrl: process.env.FRONTEND_URL || 'NOT_SET',
            nodeEnv: process.env.NODE_ENV || 'NOT_SET',
            vercelEnv: process.env.VERCEL_ENV || 'NOT_SET'
        },
        oauth: {
            consumerKeyLength: process.env.WIKIPEDIA_CONSUMER_KEY?.length || 0,
            consumerKeyPrefix: process.env.WIKIPEDIA_CONSUMER_KEY?.substring(0, 8) || 'NOT_SET',
            consumerSecretLength: process.env.WIKIPEDIA_CONSUMER_SECRET?.length || 0,
            consumerSecretPrefix: process.env.WIKIPEDIA_CONSUMER_SECRET?.substring(0, 8) || 'NOT_SET',
            // Check if using example values
            usingExampleKey: process.env.WIKIPEDIA_CONSUMER_KEY === '45df59aa36a33b2afacc4f0dac6d7d7c',
            usingExampleSecret: process.env.WIKIPEDIA_CONSUMER_SECRET === '1de804cfea0d00c418e57e78cfc6f4fdb699f4d3',
            // Check key format (should be 32 hex chars)
            keyFormatValid: /^[a-fA-F0-9]{32}$/.test(process.env.WIKIPEDIA_CONSUMER_KEY || ''),
            // Check secret format (should be 40 hex chars)  
            secretFormatValid: /^[a-fA-F0-9]{40}$/.test(process.env.WIKIPEDIA_CONSUMER_SECRET || '')
        },
        urls: {
            protocol: req.headers['x-forwarded-proto'] || 'https',
            host: req.headers.host,
            callbackUrl: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/callback`,
            requestTokenUrl: 'https://meta.wikimedia.org/w/index.php?title=Special:OAuth/initiate',
            authorizeUrl: 'https://meta.wikimedia.org/wiki/Special:OAuth/authorize',
            accessTokenUrl: 'https://meta.wikimedia.org/w/index.php?title=Special:OAuth/token'
        },
        timestamp: new Date().toISOString()
    };

    res.status(200).json({
        success: true,
        debug,
        message: 'Use this information to verify your OAuth setup'
    });
}; 