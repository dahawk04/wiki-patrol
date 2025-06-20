const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const axios = require('axios');
const sessionStorage = require('./session-storage');

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
    },
    version: '1.0'
});

// Log OAuth configuration (without secrets)
console.log('OAuth configured with:', {
    hasConsumerKey: !!consumerKey,
    hasConsumerSecret: !!consumerSecret,
    consumerKeyLength: consumerKey?.length || 0,
    consumerSecretLength: consumerSecret?.length || 0,
    consumerKeyPrefix: consumerKey?.substring(0, 6) || 'NOT_SET'
});

// Helper function to make OAuth requests
async function makeOAuthRequest(url, method, token = null, data = {}) {
    console.log('Making OAuth request:', {
        url,
        method,
        hasToken: !!token,
        data
    });

    // For MediaWiki OAuth endpoints, we need to use the base URL without query parameters
    // to prevent the oauth-1.0a library from auto-extracting query parameters for signing
    let baseUrl = url;
    let titleParam = null;
    
    if (url.includes('?')) {
        const urlParts = url.split('?');
        baseUrl = urlParts[0];
        
        // Extract title parameter from URL query string for MediaWiki routing
        const queryParams = new URLSearchParams(urlParts[1]);
        titleParam = queryParams.get('title');
    }

    // Clean the data to remove any URL-based parameters that shouldn't be in the signature
    const cleanData = { ...data };
    
    // Remove 'title' parameter if present since it's part of the URL path, not a parameter to sign
    if (cleanData.title) {
        delete cleanData.title;
    }

    // For MediaWiki, include title in POST body for routing (not in signature)
    const postData = titleParam ? { ...cleanData, title: titleParam } : cleanData;

    const requestData = {
        url: baseUrl,
        method: method,
        data: {
            ...cleanData,
            oauth_version: '1.0'
        }
    };

    console.log('Request data before OAuth authorization:', requestData);

    const oauthData = oauth.authorize(requestData, token);
    console.log('OAuth authorization data:', oauthData);
    
    const oauthHeaders = oauth.toHeader(oauthData);
    console.log('OAuth headers:', oauthHeaders);

    // Build axios config dynamically to ensure we always send the correct body/params format
    const axiosConfig = {
        method,
        url: url, // Use the original URL for the actual request (MediaWiki needs title in URL)
        headers: {
            ...oauthHeaders,
            'User-Agent': 'Wikipedia-Patrol-Tool/1.0 (https://github.com/dahawk04/wikipedia-patrol)'
        }
    };

    if (method === 'POST') {
        // Wikipedia expects the body in application/x-www-form-urlencoded format
        // Modified by Cursor: ensure correct content type and encoding to avoid 400 errors
        axiosConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        // For MediaWiki, don't include title in POST body since it's in the URL
        axiosConfig.data = new URLSearchParams(cleanData).toString();
        console.log('POST data being sent:', axiosConfig.data);
    } else if (method === 'GET') {
        axiosConfig.params = cleanData;
        console.log('GET params being sent:', axiosConfig.params);
    }

    console.log('Final axios config:', {
        method: axiosConfig.method,
        url: axiosConfig.url,
        headers: axiosConfig.headers,
        data: axiosConfig.data || 'none',
        params: axiosConfig.params || 'none'
    });

    try {
        const response = await axios(axiosConfig);
        
        console.log('OAuth request successful:', {
            url,
            status: response.status,
            headers: response.headers,
            dataType: typeof response.data,
            dataLength: JSON.stringify(response.data).length,
            dataPreview: typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200)
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
        
        // Log the full error response if it's HTML (likely an error page)
        if (error.response?.data && typeof error.response.data === 'string' && error.response.data.includes('<html>')) {
            console.error('HTML error response received:', error.response.data.substring(0, 500));
        }
        
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
    sessions: sessionStorage, // Export the session storage for backward compatibility
    makeOAuthRequest,
    getCorsHeaders
}; 