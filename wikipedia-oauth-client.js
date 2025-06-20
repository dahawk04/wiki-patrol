/**
 * Wikipedia OAuth Client
 * Frontend library for interacting with the Wikipedia OAuth backend
 */
class WikipediaOAuthClient {
    constructor(backendUrl) {
        console.log('Initializing WikipediaOAuthClient with backend URL:', backendUrl);
        this.backendUrl = backendUrl.replace(/\/$/, ''); // Remove trailing slash
        this.sessionId = localStorage.getItem('wikipedia_oauth_session');
        console.log('Existing session ID from localStorage:', this.sessionId);
        this.user = null;
        
        // Check for OAuth callback parameters
        this.handleOAuthCallback();
    }
    
    /**
     * Handle OAuth callback parameters from URL
     */
    handleOAuthCallback() {
        console.log('Handling OAuth callback, checking URL parameters...');
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.has('oauth_success') && urlParams.has('session')) {
            console.log('OAuth callback successful, processing session...');
            this.sessionId = urlParams.get('session');
            localStorage.setItem('wikipedia_oauth_session', this.sessionId);
            console.log('Stored new session ID:', this.sessionId);
            
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            console.log('Cleaned up URL parameters');
            
            // Verify the session
            console.log('Verifying session...');
            this.verifySession().then(user => {
                if (user) {
                    console.log('Session verified successfully for user:', user);
                    this.onLoginSuccess(user);
                } else {
                    console.error('Session verification returned no user');
                }
            }).catch(error => {
                console.error('Session verification failed:', error);
            });
        } else if (urlParams.has('oauth_error')) {
            const error = urlParams.get('oauth_error');
            console.error('OAuth error from callback:', error);
            this.onLoginError(error);
            
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            console.log('Cleaned up error URL parameters');
        } else {
            console.log('No OAuth callback parameters found in URL');
        }
    }
    
    /**
     * Start the OAuth login flow
     */
    async login() {
        console.log('Starting OAuth login flow...');
        try {
            console.log('Fetching from login endpoint:', `${this.backendUrl}/auth/login`);
            const response = await fetch(`${this.backendUrl}/auth/login`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: errorText
                });
                throw new Error(`Server error (${response.status}): ${errorText || 'Failed to get request token'}`);
            }
            
            console.log('Login endpoint response received, parsing JSON...');
            const data = await response.json();
            console.log('Login endpoint data:', { ...data, authUrl: data.authUrl });
            
            if (data.success) {
                // Store session ID for when we return
                console.log('Storing pending session ID:', data.sessionId);
                localStorage.setItem('wikipedia_oauth_session_pending', data.sessionId);
                
                if (data.isOutOfBand) {
                    // Handle out-of-band flow
                    console.log('Out-of-band authentication detected');
                    this.sessionId = data.sessionId;
                    localStorage.setItem('wikipedia_oauth_session', data.sessionId);
                    
                    // Open authorization URL in new window
                    const authWindow = window.open(data.authUrl, 'wikipedia_oauth', 'width=600,height=700');
                    
                    // Show instructions to user
                    this.onOAuthVerificationNeeded(data.authUrl, data.sessionId);
                } else {
                    // Redirect to Wikipedia for authorization
                    console.log('Redirecting to Wikipedia authorization URL:', data.authUrl);
                    window.location.href = data.authUrl;
                }
            } else {
                console.error('Login endpoint returned error:', data.error);
                throw new Error(data.error || 'Failed to start OAuth flow');
            }
        } catch (error) {
            console.error('Login failed:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            this.onLoginError(error.message);
        }
    }
    
    /**
     * Verify the current session
     */
    async verifySession() {
        console.log('Verifying session with ID:', this.sessionId);
        if (!this.sessionId) {
            console.log('No session ID found, skipping verification');
            return null;
        }
        
        try {
            console.log('Making verify request to:', `${this.backendUrl}/auth/verify`);
            const response = await fetch(`${this.backendUrl}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId: this.sessionId })
            });
            
            console.log('Verify response received, status:', response.status);
            const data = await response.json();
            console.log('Verify response data:', data);
            
            if (data.success) {
                this.user = data.user;
                console.log('Session verified successfully for user:', this.user);
                return this.user;
            } else {
                console.error('Session verification failed:', data.error);
                localStorage.removeItem('wikipedia_oauth_session');
                this.sessionId = null;
                this.user = null;
                return null;
            }
        } catch (error) {
            console.error('Session verification error:', error);
            localStorage.removeItem('wikipedia_oauth_session');
            this.sessionId = null;
            this.user = null;
            throw error;
        }
    }
    
    /**
     * Logout and clear session
     */
    logout() {
        this.sessionId = null;
        this.user = null;
        localStorage.removeItem('wikipedia_oauth_session');
        localStorage.removeItem('wikipedia_oauth_session_pending');
        this.onLogout();
    }
    
    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return this.user !== null;
    }
    
    /**
     * Get current user info
     */
    getUser() {
        return this.user;
    }
    
    /**
     * Make an authenticated API call to Wikipedia
     */
    async apiCall(action, params = {}) {
        console.log('Making API call:', { action, params });
        if (!this.sessionId) {
            console.error('API call attempted without session');
            throw new Error('Not logged in');
        }
        
        try {
            console.log('Sending API request to:', `${this.backendUrl}/api/proxy`);
            const response = await fetch(`${this.backendUrl}/api/proxy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    action: action,
                    params: params
                })
            });
            
            console.log('API response received, status:', response.status);
            const data = await response.json();
            console.log('API response data:', data);
            
            if (data.success) {
                return data.data;
            } else {
                console.error('API call failed:', data.error);
                throw new Error(data.error || 'API call failed');
            }
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    }
    
    /**
     * Get user info
     */
    async getUserInfo() {
        return await this.apiCall('query', {
            meta: 'userinfo'
        });
    }
    
    /**
     * Get recent changes
     */
    async getRecentChanges(options = {}) {
        return await this.apiCall('query', {
            list: 'recentchanges',
            rcprop: 'title|ids|sizes|flags|user|timestamp|comment',
            rclimit: options.limit || 50,
            rctype: 'edit|new',
            rcnamespace: options.namespace
        });
    }
    
    /**
     * Get page revisions
     */
    async getPageRevisions(title, options = {}) {
        return await this.apiCall('query', {
            prop: 'revisions',
            titles: title,
            rvprop: 'content|ids',
            rvlimit: options.limit || 2,
            rvstartid: options.startId
        });
    }
    
    /**
     * Revert a page to a previous revision
     */
    async revertPage(title, toRevId, summary) {
        // Get the content of the revision to revert to
        const revisionData = await this.apiCall('query', {
            prop: 'revisions',
            revids: toRevId,
            rvprop: 'content'
        });
        
        const pages = revisionData.query.pages;
        const page = Object.values(pages)[0];
        
        if (!page || !page.revisions) {
            throw new Error('Could not find revision to revert to');
        }
        
        const content = page.revisions[0]['*'];
        
        // Get edit token
        const tokenData = await this.apiCall('query', {
            meta: 'tokens'
        });
        
        const token = tokenData.query.tokens.csrftoken;
        
        // Perform the edit
        return await this.apiCall('edit', {
            title: title,
            text: content,
            summary: summary,
            token: token
        });
    }
    
    /**
     * Edit a user's talk page (for warnings)
     */
    async editUserTalkPage(username, content, summary) {
        const title = `User talk:${username}`;
        
        // Get edit token
        const tokenData = await this.apiCall('query', {
            meta: 'tokens'
        });
        
        const token = tokenData.query.tokens.csrftoken;
        
        // Add to the page (append)
        return await this.apiCall('edit', {
            title: title,
            appendtext: `\n\n${content}`,
            summary: summary,
            token: token
        });
    }
    
    /**
     * Submit verification code for out-of-band OAuth
     */
    async submitVerificationCode(verificationCode) {
        console.log('Submitting verification code...');
        if (!this.sessionId) {
            throw new Error('No session ID found');
        }
        
        try {
            const response = await fetch(`${this.backendUrl}/auth/verify-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    verificationCode: verificationCode
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.user = data.user;
                console.log('Verification successful for user:', this.user);
                this.onLoginSuccess(this.user);
                return this.user;
            } else {
                console.error('Verification failed:', data.error);
                throw new Error(data.error || 'Verification failed');
            }
        } catch (error) {
            console.error('Verification error:', error);
            this.onLoginError(error.message);
            throw error;
        }
    }
    
    // Event handlers (override these in your app)
    onLoginSuccess(user) {
        console.log('Default onLoginSuccess handler called with user:', user);
    }
    
    onLoginError(error) {
        console.error('Default onLoginError handler called with error:', error);
    }
    
    onLogout() {
        console.log('Logged out');
    }
    
    onOAuthVerificationNeeded(authUrl, sessionId) {
        console.log('OAuth verification needed. Visit:', authUrl);
        console.log('Session ID:', sessionId);
    }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WikipediaOAuthClient;
} else if (typeof window !== 'undefined') {
    window.WikipediaOAuthClient = WikipediaOAuthClient;
} 