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
const oauth = OAuth({
    consumer: {
        key: process.env.WIKIPEDIA_CONSUMER_KEY,
        secret: process.env.WIKIPEDIA_CONSUMER_SECRET
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    }
});

// Log OAuth configuration (without secrets)
console.log('OAuth configured with:', {
    hasConsumerKey: !!process.env.WIKIPEDIA_CONSUMER_KEY,
    hasConsumerSecret: !!process.env.WIKIPEDIA_CONSUMER_SECRET,
    consumerKeyLength: process.env.WIKIPEDIA_CONSUMER_KEY?.length || 0,
    consumerKeyPrefix: process.env.WIKIPEDIA_CONSUMER_KEY?.substring(0, 6) || 'NOT_SET'
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

    const headers = oauth.toHeader(oauth.authorize(requestData, token));
    
    try {
        const response = await axios({
            method: method,
            url: url,
            headers: {
                ...headers,
                'User-Agent': 'Wikipedia-Patrol-Tool/1.0 (https://github.com/dahawk04/wikipedia-patrol)'
            },
            data: method === 'POST' ? data : undefined,
            params: method === 'GET' ? data : undefined
        });
        
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
            requestHeaders: headers,
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