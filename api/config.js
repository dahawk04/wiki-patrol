const { getCorsHeaders } = require('./_utils/oauth');

module.exports = async (req, res) => {
    // Set CORS headers
    const corsHeaders = getCorsHeaders(req.headers.origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        // Only expose safe environment variables to the frontend
        const config = {
            huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY || '',
            // Add other safe config variables here as needed
            // Never expose sensitive secrets like WIKIPEDIA_CONSUMER_SECRET
        };

        res.status(200).json({
            success: true,
            config
        });
    } catch (error) {
        console.error('Config endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load configuration'
        });
    }
}; 