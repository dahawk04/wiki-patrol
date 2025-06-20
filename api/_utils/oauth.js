const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const axios = require('axios');

// Wikipedia OAuth endpoints
const ENDPOINTS = {
    requestToken: 'https://meta.wikimedia.org/w/index.php?title=Special:OAuth/initiate',
    authorize: 'https://meta.wikimedia.org/wiki/Special:OAuth/authorize',
    accessToken: 'https://meta.wikimedia.org/w/index.php?title=Special:OAuth/token',
    api: 'https://en.wikipedia.org/w/api.php'
};

// OAuth configuration
const consumerKey = process.env.WIKIPEDIA_CONSUMER_KEY?.trim();
const consumerSecret = process.env.WIKIPEDIA_CONSUMER_SECRET?.trim();

const oauth = OAuth({
    consumer: {
        key: consumerKey,
        secret: consumerSecret
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    }
});

// Log OAuth configuration (without secrets)
console.log('OAuth configured with:', {
    hasConsumerKey: !!consumerKey,
    hasConsumerSecret: !!consumerSecret,
    consumerKeyLength: consumerKey?.length || 0,
    consumerKeyPrefix: consumerKey?.substring(0, 6) || 'NOT_SET'
});

// Session storage (using a simple Map for now - in production use Redis/Database)
const sessions = new Map();

// Helper function to make OAuth requests
async function makeOAuthRequest(url, method, token = null, data = {}) {
    console.log('Making OAuth request:', {
        url,
        method,
        hasToken: !!token,
        data
    });

    const requestData = {
        url: url,
        method: method,
        data: data
    };

    const oauthHeaders = oauth.toHeader(oauth.authorize(requestData, token));

    // Build axios config dynamically to ensure we always send the correct body/params format
    const axiosConfig = {
        method,
        url,
        headers: {
            ...oauthHeaders,
            'User-Agent': 'Wikipedia-Patrol-Tool/1.0 (https://github.com/dahawk04/wikipedia-patrol)'
        }
    };

    if (method === 'POST') {
        // Wikipedia expects the body in application/x-www-form-urlencoded format
        // Modified by Cursor: ensure correct content type and encoding to avoid 400 errors
        axiosConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        axiosConfig.data = new URLSearchParams(data).toString();
    } else if (method === 'GET') {
        axiosConfig.params = data;
    }

    try {
        const response = await axios(axiosConfig);
        
        console.log('OAuth request successful:', {
            url,
            status: response.status,
            dataLength: JSON.stringify(response.data).length
        });
        
        return response.data;
    } catch (error) {
        console.error('OAuth request failed:', {
            url,
            error: error.message,
            response: error.response?.data,
            status: error.response?.status,
            headers: error.response?.headers,
            // Additional debug info
            requestHeaders: oauthHeaders,
            consumerKeyPresent: !!process.env.WIKIPEDIA_CONSUMER_KEY,
            consumerSecretPresent: !!process.env.WIKIPEDIA_CONSUMER_SECRET
        });
        
        // Provide more specific error message
        if (error.response?.status === 401) {
            throw new Error('OAuth authentication failed - check consumer key/secret');
        } else if (error.response?.status === 400) {
            throw new Error('Bad OAuth request - check callback URL configuration');
        }
        
        throw error;
    }
}

// CORS headers
function getCorsHeaders(origin) {
    const allowedOrigins = [
        process.env.FRONTEND_URL,
        'https://localhost:3000',
        'http://localhost:3000',
        'https://localhost:8080',
        'http://localhost:8080'
    ].filter(Boolean);

    const isAllowed = allowedOrigins.some(allowed => 
        origin === allowed || 
        (allowed.includes('vercel.app') && origin?.includes('vercel.app'))
    );

    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
    };
}

module.exports = {
    ENDPOINTS,
    oauth,
    sessions,
    makeOAuthRequest,
    getCorsHeaders
}; 