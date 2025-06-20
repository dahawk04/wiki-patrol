const { ENDPOINTS, makeOAuthRequest, getCorsHeaders } = require('../_utils/oauth');

module.exports = async (req, res) => {
    const origin = req.headers.origin;
    const corsHeaders = getCorsHeaders(origin);
    
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { oauth_token, oauth_verifier } = req.query;
        
        if (!oauth_token || !oauth_verifier) {
            throw new Error('Missing OAuth parameters');
        }
        
        console.log('Processing OAuth callback');
        
        // Find session by request token
        const { sessions } = require('../_utils/oauth');
        let sessionId = null;
        let sessionData = null;
        
        for (const [id, data] of sessions.entries()) {
            if (data.requestToken.key === oauth_token) {
                sessionId = id;
                sessionData = data;
                break;
            }
        }
        
        if (!sessionData) {
            throw new Error('Invalid or expired session');
        }
        
        // Exchange for access token
        const response = await makeOAuthRequest(ENDPOINTS.accessToken, 'POST', sessionData.requestToken, {
            oauth_verifier
        });
        
        // Parse access token response
        const params = new URLSearchParams(response);
        const accessToken = {
            key: params.get('oauth_token'),
            secret: params.get('oauth_token_secret')
        };
        
        if (!accessToken.key || !accessToken.secret) {
            throw new Error('Failed to get access token');
        }
        
        // Get user information
        const userResponse = await makeOAuthRequest(ENDPOINTS.api, 'GET', accessToken, {
            action: 'query',
            meta: 'userinfo',
            format: 'json'
        });
        
        const user = {
            id: userResponse.query.userinfo.id,
            name: userResponse.query.userinfo.name,
            groups: userResponse.query.userinfo.groups || []
        };
        
        // Update session with access token and user info
        sessions.set(sessionId, {
            ...sessionData,
            accessToken,
            user,
            authenticated: true,
            lastActivity: Date.now()
        });
        
        console.log('OAuth callback successful for user:', user.name);
        
        // Redirect back to frontend with success
        // Since we're in a popup window, we'll use JavaScript to close it
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Complete</title>
            </head>
            <body>
                <h2>Authorization successful!</h2>
                <p>You can close this window.</p>
                <script>
                    // Try to close the window
                    setTimeout(() => {
                        window.close();
                    }, 1000);
                </script>
            </body>
            </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        
        // Show error in the popup window
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Failed</title>
            </head>
            <body>
                <h2>Authorization failed</h2>
                <p>Error: ${error.message}</p>
                <p>You can close this window and try again.</p>
                <script>
                    // Try to close the window after a delay
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                </script>
            </body>
            </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);
    }
}; 