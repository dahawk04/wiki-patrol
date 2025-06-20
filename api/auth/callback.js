const { ENDPOINTS, makeOAuthRequest, getCorsHeaders, sessions } = require('../_utils/oauth');

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
        
        console.log('Processing OAuth callback for token:', oauth_token);
        
        // Find session by request token using the new storage
        const result = await sessions.findByRequestToken(oauth_token);
        
        if (!result) {
            console.error('No session found for token:', oauth_token);
            throw new Error('Invalid or expired session');
        }
        
        const { sessionId, session: sessionData } = result;
        console.log('Found session:', sessionId);
        
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
        await sessions.set(sessionId, {
            ...sessionData,
            accessToken,
            user,
            authenticated: true,
            lastActivity: Date.now()
        });
        
        console.log('OAuth callback successful for user:', user.name);
        
        // Return HTML page that communicates with the opener window
        const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
    <title>Wikipedia OAuth - Success</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f2f5;
        }
        .message {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h2 { color: #388e3c; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="message">
        <h2>✓ Authorization Successful</h2>
        <p>You have successfully logged in as <strong>${user.name}</strong></p>
        <p>This window will close automatically...</p>
    </div>
    <script>
        // Send success message to opener window
        if (window.opener) {
            window.opener.postMessage({
                type: 'oauth_success',
                status: 'success',
                sessionId: '${sessionId}',
                user: ${JSON.stringify(user)}
            }, '*');
            
            // Close window after a short delay
            setTimeout(() => {
                window.close();
            }, 1500);
        } else {
            // If no opener, redirect to main app
            setTimeout(() => {
                window.location.href = '${process.env.FRONTEND_URL || 'http://localhost:3000'}?oauth_success=true&session=${sessionId}';
            }, 2000);
        }
    </script>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(htmlResponse);
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        
        // Return HTML page with error
        const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
    <title>Wikipedia OAuth - Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f2f5;
        }
        .message {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            max-width: 400px;
        }
        h2 { color: #d32f2f; }
        p { color: #666; margin: 10px 0; }
        .error-details { 
            font-size: 14px; 
            background: #ffebee; 
            padding: 10px; 
            border-radius: 4px;
            margin-top: 20px;
        }
        button {
            margin-top: 20px;
            padding: 10px 20px;
            background: #0066cc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover { background: #0052a3; }
    </style>
</head>
<body>
    <div class="message">
        <h2>✗ Authorization Failed</h2>
        <p>We couldn't complete the authorization process.</p>
        <div class="error-details">${error.message}</div>
        <button onclick="closeWindow()">Close Window</button>
    </div>
    <script>
        // Send error message to opener window
        if (window.opener) {
            window.opener.postMessage({
                type: 'oauth_error',
                status: 'error',
                error: '${error.message.replace(/'/g, "\\'")}'
            }, '*');
        }
        
        function closeWindow() {
            if (window.opener) {
                window.close();
            } else {
                window.location.href = '${process.env.FRONTEND_URL || 'http://localhost:3000'}?oauth_error=${encodeURIComponent(error.message)}';
            }
        }
    </script>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(htmlResponse);
    }
}; 