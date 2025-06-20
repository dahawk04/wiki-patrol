# Wikipedia Patrol Tool

A modern web application for efficiently patrolling recent changes on Wikipedia using OAuth authentication and AI-powered analysis.

<!-- Last deployment trigger: 2024 -->

## Features

### 🔍 **Recent Changes Monitoring**
- Real-time fetching of Wikipedia recent changes
- Enhanced ORES integration (damaging + goodfaith models)
- Configurable risk threshold filtering
- Namespace filtering (Main, Talk, User, etc.)
- Comprehensive content and pattern analysis

### 🛡️ **Advanced Vandalism Protection**
- **Multi-Layer Detection**: Combines ORES, content analysis, pattern detection, and user analysis
- **Content Analysis**: Detects profanity, gibberish, spam, nonsense patterns, excessive caps/punctuation
- **Pattern Detection**: Identifies blanking, mass deletions, category/template/reference removal, link spam
- **User Analysis**: Evaluates user experience, edit count, registration date, IP vs registered users
- **Risk Scoring**: Weighted combination of all factors with confidence meters and detailed breakdowns
- **Configurable Thresholds**: Fine-tune sensitivity for different detection methods

### 🤖 **AI-Powered Context Analysis**
- **OpenAI Moderation API**: **FREE** professional-grade content safety detection (13+ categories including harassment, hate, violence, sexual content)
- **Hugging Face Integration**: Free tier toxicity and sentiment analysis using state-of-the-art models
- **OpenAI GPT Analysis**: Optional context understanding with natural language reasoning (API key required)
- **Google AI Support**: PaLM 2 integration for advanced semantic analysis (API key required)
- **Local Models**: Client-side pattern recognition and heuristic analysis (always available)
- **Multi-Provider Consensus**: Combines results from multiple AI services for maximum accuracy
- **Intelligent Rate Limiting**: Respects API limits with configurable request throttling (generous limits for free APIs)
- **Contextual Reasoning**: Provides human-readable explanations for each AI verdict

### 🔐 **Wikipedia Authentication**
- Secure Wikipedia login integration
- Session management and authentication status tracking
- Real editing capabilities (not just simulation)

### ⚡ **Patrol Actions**
- **Revert**: Automatically revert problematic edits with proper edit summaries
- **Warn Users**: Add graduated warning templates to user talk pages
- **Mark as Good**: Mark edits as reviewed and acceptable
- **View Diffs**: Open detailed diff views in new tabs

### ⌨️ **Keyboard Shortcuts**
- `↓` or `J`: Navigate to next change
- `↑` or `K`: Navigate to previous change
- `V`: Revert current change
- `G`: Mark current change as good
- `S`: Skip current change
- `D`: View diff of current change
- `W`: Warn user for current change
- `R`: Refresh changes list

### 🎯 **Enhanced Features**
- **Risk Indicators**: Clear visual badges (Critical, High, Medium, Low) with confidence meters
- **Detection Details**: Detailed breakdown of what triggered each risk factor
- **Comprehensive Analysis**: Shows ORES scores, content issues, pattern problems, and user factors
- **Smart Prioritization**: Changes automatically sorted by combined risk score
- **Custom Configuration**: Adjustable thresholds for all detection methods
- **Real-time Analysis**: Live updates when changing detection settings

## 🚀 Quick Deploy (Choose One)

### **🌟 GitHub Pages (Recommended - Free & Auto-updates)**
1. Fork this repository or upload files to your GitHub repo
2. Go to **Settings** → **Pages** → Select **"GitHub Actions"**
3. Access at: `https://[username].github.io/[repo-name]/`

### **🔥 Netlify (2-minute setup)**
1. Visit [netlify.com](https://netlify.com)
2. Drag and drop this project folder
3. Done! Live at `https://[random-name].netlify.app`

### **⚡ Vercel (3-minute setup)**
1. Visit [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Deploy automatically

[📖 **Full Deployment Guide**](DEPLOYMENT.md) - Detailed instructions for all platforms

---

## Setup Instructions

### 1. **Download and Setup**
1. Download the `index.html` file
2. Open it in a modern web browser  
3. The tool will work immediately for viewing changes

### 2. **Wikipedia Authentication**
To perform actual edits (reverts, warnings), you need to log in:

1. Click "Login to Wikipedia" button
2. A popup window will open to Wikipedia's login page
3. Log in with your Wikipedia credentials
4. Close the popup window
5. The tool will automatically detect your login status

### 3. **AI Enhancement Setup (Optional)**
To unlock advanced AI analysis capabilities:

1. **OpenAI Moderation (Recommended)**: Works immediately, completely free
   - Professional-grade content safety detection
   - No API key required, but adding one increases rate limits
   - Detects harassment, hate speech, violence, sexual content, and more

2. **Hugging Face**: Works immediately with free tier
   - Get API key at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) for higher limits
   - Click "🔑 Configure API Keys" in the tool to add it

3. **OpenAI GPT (Premium)**: For advanced context analysis
   - Sign up at [platform.openai.com](https://platform.openai.com)
   - Get $5 free credits for new accounts
   - Add API key via the configuration modal

3. **Google AI (Optional)**: For additional semantic analysis
   - Get free API key at [makersuite.google.com](https://makersuite.google.com/app/apikey)

### 4. **Important Notes**

⚠️ **CORS Limitations**: Due to browser security policies, some features may require:
- Running a local web server instead of opening the file directly
- Using a CORS proxy for certain API calls
- For production use, consider hosting on a web server

⚠️ **Responsible Use**: This tool performs real edits on Wikipedia:
- Always verify edits before reverting
- Follow Wikipedia's guidelines and policies
- Use appropriate warning levels
- Be respectful and constructive

🤖 **AI Analysis**: AI verdicts are suggestions only - human judgment is always required

## Usage Guide

### Getting Started
1. Open the tool in your browser
2. Log in to Wikipedia (required for editing)
3. Adjust ORES threshold and namespace filters as needed
4. Click "Refresh" to load recent changes

### Reviewing Changes
1. Changes are automatically sorted by combined risk score (not just ORES)
2. Risk levels are clearly displayed: **Critical** (red), **High** (orange), **Medium** (yellow), **Low** (green)
3. Use keyboard shortcuts or buttons to navigate
4. Current change is highlighted with a blue border
5. Review detailed analysis including:
   - **ORES Scores**: Both damaging and goodfaith predictions
   - **Content Issues**: Profanity, gibberish, spam detection results
   - **Pattern Problems**: Blanking, deletions, structural changes
   - **User Factors**: Account age, edit count, IP status

### Taking Actions
1. **For obviously bad edits**: Press `V` to revert
2. **For borderline cases**: Press `D` to view full diff first
3. **For good edits**: Press `G` to mark as reviewed
4. **For user education**: Press `W` to add appropriate warning

### Custom Edit Summaries
- When logged in, you can add custom reasons for reverts
- Use the "Custom Revert Summary" field for additional context
- The tool automatically includes proper attribution and links

### Enhanced Detection Configuration
The tool provides fine-grained control over vandalism detection:

#### **ORES Thresholds**
- **Damaging Threshold**: Minimum score for considering edits as potentially damaging (0.0-1.0)
- **Goodfaith Threshold**: Maximum score for considering edits as made in good faith (0.0-1.0)

#### **Pattern Detection**
- **Size Change Sensitivity**: How sensitive to large additions/deletions
  - High: ±500 characters
  - Medium: ±2000 characters (default)
  - Low: ±5000 characters

#### **User Analysis**
- **Disabled**: No user experience analysis
- **Enabled**: Flag users with <10 edits (default)
- **Strict**: Flag users with <100 edits

#### **Content & Pattern Toggles**
- **Content Analysis**: Enable/disable profanity, spam, and gibberish detection
- **Pattern Detection**: Enable/disable structural vandalism detection

### AI Analysis Configuration

#### **AI Providers**
- **🤗 Hugging Face**: Always available (free tier: 1000 requests/month)
  - Toxicity detection using `unitary/toxic-bert`
  - Sentiment analysis using `cardiffnlp/twitter-roberta-base-sentiment-latest`
  - No API key required for basic use
- **🧠 OpenAI**: Free + Premium options
  - **FREE Moderation API**: Professional content safety (no API key needed)
    - 13 detection categories: harassment, hate, violence, sexual content, self-harm, etc.
    - Generous rate limits (20-60 requests/minute depending on settings)
  - **Premium GPT Analysis**: Context understanding (API key required, $5 free credits)
    - Natural language reasoning about edit quality
- **🔍 Google AI**: Requires API key (free tier available)
  - PaLM 2 semantic understanding
- **💻 Local Models**: Always enabled
  - Client-side pattern recognition
  - No API calls or rate limits

#### **Analysis Modes**
- **Fast**: Basic classification using primary models only
- **Comprehensive**: Multi-model analysis with cross-validation (default)
- **Deep**: Includes semantic coherence and detailed reasoning

#### **Rate Limiting**
- **Conservative**: 5 requests/minute, 100/hour (default)
- **Moderate**: 10 requests/minute, 200/hour
- **Aggressive**: 20 requests/minute, 400/hour

### AI Context Interpretation
Each edit receives an AI analysis card showing:
- **Overall Verdict**: Legitimate/Suspicious/Vandalism
- **Confidence Score**: Percentage confidence in the assessment
- **Provider Results**: Individual analysis from each enabled AI service
- **Reasoning**: Human-readable explanation of the decision
- **Risk Factors**: Specific issues identified by AI models

### Warning System
- Select appropriate warning level (1-4) before warning users
- Level 1: First-time gentle warning
- Level 2: Second warning with stronger language
- Level 3: Third warning with clear consequences
- Level 4: Final warning before blocking

## Technical Details

### APIs Used
- **Wikipedia API**: For fetching changes, page content, and performing edits
- **ORES API**: For damage probability scoring
- **MediaWiki Authentication**: For secure login and session management

### Browser Compatibility
- Modern browsers with ES6+ support
- Chrome 60+, Firefox 60+, Safari 12+, Edge 79+

### Security
- Uses Wikipedia's CSRF tokens for secure editing
- Maintains session cookies for authentication
- All API calls use HTTPS

### API Key Security
- **Encrypted Storage**: API keys are encrypted using browser fingerprint-based encryption
- **Key Validation**: Format validation prevents invalid keys from being stored
- **Expiration**: Keys automatically expire after 24 hours
- **Session Storage Option**: Choose session-only storage for maximum security
- **Secure UI**: Keys are masked in interfaces and cleared from forms after saving
- **Local Only**: Keys never leave your browser except for direct API calls to providers
- **Testing**: Built-in key testing to verify functionality without exposing keys
- **Easy Clearing**: One-click option to securely clear all stored keys

## Development

### File Structure
```
wiki/
├── index.html          # Main application file
└── README.md          # This documentation
```

### Customization
The tool can be customized by modifying the CSS and JavaScript sections in `index.html`:
- Adjust styling in the `<style>` section
- Modify functionality in the `<script>` section
- Add new features by extending the existing functions

## Contributing

To improve this tool:
1. Test thoroughly on Wikipedia's test wiki first
2. Follow Wikipedia's bot and tool guidelines
3. Ensure all edits include proper edit summaries
4. Respect rate limits and server resources

## License

This tool is provided as-is for educational and productive use in Wikipedia maintenance. Please use responsibly and follow all Wikipedia policies and guidelines.

## Disclaimer

This tool performs real edits on Wikipedia. Users are responsible for ensuring their actions comply with Wikipedia's policies. Always verify edits before taking action, and be prepared to explain your actions if questioned by other editors. 