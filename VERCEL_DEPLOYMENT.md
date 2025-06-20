# Wikipedia Patrol Tool - Vercel Deployment Guide

This guide will help you deploy your Wikipedia Patrol Tool to Vercel with a serverless backend.

## 🚀 Quick Deployment Steps

### 1. **Prepare Your Repository**
Your repository is already set up with:
- ✅ Serverless API functions in `/api/` directory
- ✅ Frontend files in root directory
- ✅ Vercel configuration in `vercel.json`
- ✅ Package.json with dependencies

### 2. **Get Wikipedia OAuth Credentials**
1. Go to [Wikipedia OAuth Registration](https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration/propose)
2. Fill out the form:
   - **Name**: `Wikipedia Patrol Tool`
   - **Description**: `Tool for patrolling recent changes on Wikipedia`
   - **OAuth callback URL**: `https://YOUR-APP-NAME.vercel.app/api/auth/callback`
   - **Grants**: Select `Edit existing pages` and `Create, edit, and move pages`
3. Submit and wait for approval
4. Save your **Consumer Key** and **Consumer Secret**

### 3. **Deploy to Vercel**

#### Option A: Using Vercel CLI (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from your project directory
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: wikipedia-patrol-tool (or your choice)
# - Directory: ./ (current directory)
```

#### Option B: Using Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: ./
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)

### 4. **Set Environment Variables**
In your Vercel dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add these variables:
   - `WIKIPEDIA_CONSUMER_KEY`: Your OAuth consumer key
   - `WIKIPEDIA_CONSUMER_SECRET`: Your OAuth consumer secret
   - `FRONTEND_URL`: Your Vercel app URL (e.g., `https://your-app.vercel.app`)

### 5. **Update OAuth Callback URL**
1. Go back to [Wikipedia OAuth Management](https://meta.wikimedia.org/wiki/Special:OAuthListConsumers)
2. Find your application and edit it
3. Update the callback URL to: `https://YOUR-APP-NAME.vercel.app/api/auth/callback`

### 6. **Test Your Deployment**
1. Visit your Vercel URL
2. Click "Login to Wikipedia"
3. Complete the OAuth flow
4. Start patrolling! 🎉

## 🔧 **API Endpoints**

Your Vercel deployment provides these endpoints:

- `GET /api` - Health check
- `GET /api/auth/login` - Start OAuth flow
- `GET /api/auth/callback` - OAuth callback
- `POST /api/auth/verify` - Verify session
- `POST /api/proxy` - Wikipedia API proxy

## 🛠️ **Local Development**

To test locally:

```bash
# Install dependencies
npm install

# Install Vercel CLI
npm i -g vercel

# Run local development server
vercel dev

# Your app will be available at http://localhost:3000
```

## 🔒 **Security Notes**

- Environment variables are automatically encrypted by Vercel
- Sessions are stored in memory (consider Redis for production)
- CORS is configured for your specific domain
- All API calls are authenticated through OAuth

## 📊 **Monitoring**

Vercel provides:
- ✅ **Automatic deployments** from Git
- ✅ **Function logs** in the dashboard
- ✅ **Performance metrics**
- ✅ **Error tracking**

## 🎯 **Benefits of This Setup**

- **Free hosting** with generous limits
- **Automatic HTTPS** and SSL certificates
- **Global CDN** for fast loading
- **Serverless scaling** - only pay for what you use
- **No server maintenance** required
- **Automatic deployments** from Git

## 🚨 **Troubleshooting**

### OAuth Issues:
- Check that callback URL matches exactly
- Verify environment variables are set
- Check Vercel function logs

### API Issues:
- Visit `/api` endpoint to check health
- Check function logs in Vercel dashboard
- Verify Wikipedia OAuth credentials

### CORS Issues:
- Ensure FRONTEND_URL environment variable is set correctly
- Check browser console for detailed error messages

## 📞 **Support**

If you encounter issues:
1. Check Vercel function logs
2. Test the `/api` health endpoint
3. Verify your OAuth credentials
4. Check browser console for errors

Your Wikipedia Patrol Tool is now running on Vercel! 🎉 