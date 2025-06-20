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
        
        console.log('OAuth callback received:', {
            oauth_token,
            oauth_verifier: oauth_verifier ? 'present' : 'missing',
            query: req.query
        });
        
        if (!oauth_token || !oauth_verifier) {
            throw new Error('Missing OAuth parameters');
        }
        
        console.log('Processing OAuth callback for token:', oauth_token);
        
        // Find session by request token using the new storage
        console.log('Looking up session for token:', oauth_token);
        const result = await sessions.findByRequestToken(oauth_token);
        
        if (!result) {
            console.error('No session found for token:', oauth_token);
            
            // Debug: List all active sessions
            try {
                const allSessions = await sessions.getAllSessions();
                console.log('All active sessions:', allSessions.length);
                allSessions.forEach((session, index) => {
                    console.log(`Session ${index}:`, {
                        sessionId: session.sessionId?.substring(0, 8) + '...',
                        hasRequestToken: !!session.requestToken,
                        requestTokenKey: session.requestToken?.key?.substring(0, 8) + '...' || 'none',
                        isOob: session.isOob,
                        createdAt: session.createdAt ? new Date(session.createdAt).toISOString() : 'unknown',
                        expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : 'unknown'
                    });
                });
            } catch (debugError) {
                console.error('Debug session listing failed:', debugError);
            }
            
            throw new Error('Invalid or expired session');
        }
        
        const { sessionId, session: sessionData } = result;
        console.log('Found session:', {
            sessionId: sessionId.substring(0, 8) + '...',
            isOob: sessionData.isOob,
            hasRequestToken: !!sessionData.requestToken
        });
        
        // Exchange for access token
        console.log('Exchanging for access token...');
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
            console.error('Access token response:', response);
            throw new Error('Failed to get access token');
        }
        
        console.log('Access token obtained successfully');
        
        // Get user information
        console.log('Fetching user information...');
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
        
        // For OOB flow, show a message that they should use the verification code instead
        if (sessionData.isOob) {
            const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
    <title>Wikipedia OAuth - Use Verification Code</title>
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
            max-width: 500px;
        }
        h2 { color: #1976d2; }
        p { color: #666; margin: 15px 0; }
        .code-instruction {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            font-weight: bold;
        }
        button {
            margin-top: 20px;
            padding: 10px 20px;
            background: #1976d2;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover { background: #1565c0; }
    </style>
</head>
<body>
    <div class="message">
        <h2>🔐 Authorization Complete</h2>
        <p>You have successfully authorized the Wikipedia Patrol application!</p>
        <div class="code-instruction">
            Please copy the verification code shown on this page and enter it in the Wikipedia Patrol application to complete the login process.
        </div>
        <p><strong>Note:</strong> This application uses out-of-band authentication for security. You should see a verification code on this page that you need to enter in the main application.</p>
        <button onclick="closeWindow()">Close Window</button>
    </div>
    <script>
        function closeWindow() {
            if (window.opener) {
                // Try to send success message to opener
                window.opener.postMessage({
                    type: 'oauth_success',
                    status: 'success',
                    sessionId: '${sessionId}',
                    user: ${JSON.stringify(user)},
                    message: 'Please use the verification code shown on the Wikipedia page'
                }, '*');
                window.close();
            } else {
                window.location.href = '${process.env.FRONTEND_URL || 'http://localhost:3000'}?oauth_success=true&session=${sessionId}';
            }
        }
        
        // Auto-close after a delay
        setTimeout(() => {
            closeWindow();
        }, 5000);
    </script>
</body>
</html>`;
            
            res.setHeader('Content-Type', 'text/html');
            res.status(200).send(htmlResponse);
            return;
        }
        
        // For regular callback flow (non-OOB)
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
        console.error('Error stack:', error.stack);
        
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
        <p><small>If you're using out-of-band authentication, please use the verification code from Wikipedia instead of this callback URL.</small></p>
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