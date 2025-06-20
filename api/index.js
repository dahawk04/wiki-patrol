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

    res.status(200).json({
        status: 'Wikipedia OAuth Server Running on Vercel',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /api/auth/login - Start OAuth flow',
            'GET /api/auth/callback - Handle OAuth callback',
            'POST /api/auth/verify - Verify user session',
            'POST /api/proxy - Proxy Wikipedia API calls'
        ],
        environment: {
            hasConsumerKey: !!process.env.WIKIPEDIA_CONSUMER_KEY,
            hasConsumerSecret: !!process.env.WIKIPEDIA_CONSUMER_SECRET,
            frontendUrl: process.env.FRONTEND_URL || 'Not set'
        }
    });
}; 