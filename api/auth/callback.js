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
        
        // Send HTML response that handles both popup and redirect scenarios
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}?oauth_success=true&session=${sessionId}`;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Complete</title>
                <script>
                    // Check if we're in a popup window
                    if (window.opener && window.opener !== window) {
                        // We're in a popup - send message to parent and close
                        try {
                            window.opener.postMessage({
                                type: 'oauth_callback',
                                success: true,
                                sessionId: '${sessionId}'
                            }, '${frontendUrl}');
                            
                            // Show success message briefly before closing
                            document.body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: sans-serif;"><h2>Authorization successful!</h2><p>This window will close automatically...</p></div>';
                            
                            setTimeout(() => {
                                window.close();
                            }, 1500);
                        } catch (e) {
                            console.error('Failed to communicate with parent window:', e);
                            // Fall back to redirect
                            window.location.href = '${redirectUrl}';
                        }
                    } else {
                        // Not in a popup - redirect normally
                        window.location.href = '${redirectUrl}';
                    }
                </script>
            </head>
            <body>
                <div style="text-align: center; padding: 50px; font-family: sans-serif;">
                    <h2>Authorization successful!</h2>
                    <p>Redirecting...</p>
                </div>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        
        // Send HTML response for error case too
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const redirectUrl = `${frontendUrl}?oauth_error=${encodeURIComponent(error.message)}`;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Authorization Failed</title>
                <script>
                    // Check if we're in a popup window
                    if (window.opener && window.opener !== window) {
                        // We're in a popup - send error message to parent and close
                        try {
                            window.opener.postMessage({
                                type: 'oauth_callback',
                                success: false,
                                error: '${error.message.replace(/'/g, "\\'").replace(/"/g, '\\"')}'
                            }, '${frontendUrl}');
                            
                            // Show error message briefly before closing
                            document.body.innerHTML = '<div style="text-align: center; padding: 50px; font-family: sans-serif; color: #d32f2f;"><h2>Authorization failed</h2><p>${error.message.replace(/'/g, "\\'").replace(/"/g, '\\"')}</p><p>This window will close automatically...</p></div>';
                            
                            setTimeout(() => {
                                window.close();
                            }, 3000);
                        } catch (e) {
                            console.error('Failed to communicate with parent window:', e);
                            // Fall back to redirect
                            window.location.href = '${redirectUrl}';
                        }
                    } else {
                        // Not in a popup - redirect normally
                        window.location.href = '${redirectUrl}';
                    }
                </script>
            </head>
            <body>
                <div style="text-align: center; padding: 50px; font-family: sans-serif; color: #d32f2f;">
                    <h2>Authorization failed</h2>
                    <p>${error.message}</p>
                    <p>Redirecting...</p>
                </div>
            </body>
            </html>
        `);
    }
}; 