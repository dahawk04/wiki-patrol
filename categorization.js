/*
 * Wikipedia Article Categorization System
 * Integrates with existing AI providers for intelligent category suggestions
 */

// Global state for categorization
let categorizationState = {
    currentArticles: [],
    currentArticleIndex: 0,
    selectedCategories: new Map(), // articleId -> [categories]
    processing: false,
    stats: {
        found: 0,
        processed: 0,
        categorized: 0
    }
};

// Configuration for categorization
const categorizationConfig = {
    maxArticlesPerRequest: 50,
    suggestionConfidenceThreshold: 0.7,
    commonCategoryPatterns: [
        'Living people',
        'American',
        'British',
        'Canadian',
        'Australian',
        'German',
        'French',
        'Italian',
        'Japanese',
        'births',
        'deaths',
        'establishments',
        'companies',
        'organizations',
        'schools',
        'universities',
        'films',
        'albums',
        'songs',
        'books',
        'novels',
        'cities',
        'towns',
        'villages',
        'rivers',
        'mountains',
        'islands'
    ]
};

/**
 * Switch between patrol and categorization modes
 */
function switchMode(mode) {
    const patrolTab = document.getElementById('patrolTab');
    const categorizationTab = document.getElementById('categorizationTab');
    const patrolControls = document.getElementById('patrolControls');
    const categorizationControls = document.getElementById('categorizationControls');
    const changesContainer = document.getElementById('changesContainer');
    const categorizationContainer = document.getElementById('categorizationContainer');
    
    if (mode === 'patrol') {
        // Activate patrol mode
        patrolTab.classList.add('active');
        categorizationTab.classList.remove('active');
        patrolControls.style.display = 'flex';
        categorizationControls.style.display = 'none';
        changesContainer.style.display = 'block';
        categorizationContainer.style.display = 'none';
        
        // Update shortcuts help
        updateShortcutsHelp('patrol');
    } else if (mode === 'categorization') {
        // Activate categorization mode
        patrolTab.classList.remove('active');
        categorizationTab.classList.add('active');
        patrolControls.style.display = 'none';
        categorizationControls.style.display = 'flex';
        changesContainer.style.display = 'none';
        categorizationContainer.style.display = 'block';
        
        // Update shortcuts help
        updateShortcutsHelp('categorization');
        
        // Initialize categorization if not already done
        if (categorizationState.currentArticles.length === 0) {
            initializeCategorization();
        }
    }
}

/**
 * Initialize categorization system
 */
function initializeCategorization() {
    // Set up confidence threshold slider
    const confidenceSlider = document.getElementById('categoryConfidenceThreshold');
    const confidenceValue = document.getElementById('confidenceValue');
    
    if (confidenceSlider && confidenceValue) {
        confidenceSlider.addEventListener('input', (e) => {
            confidenceValue.textContent = e.target.value;
        });
    }
    
    // Clear previous state
    categorizationState.currentArticles = [];
    categorizationState.currentArticleIndex = 0;
    categorizationState.selectedCategories.clear();
    
    showStatus('Categorization mode initialized. Click "Find Articles" to start.', 'info');
}

/**
 * Find uncategorized articles using Wikipedia API
 */
async function findUncategorizedArticles() {
    if (categorizationState.processing) {
        showStatus('Already processing articles...', 'warning');
        return;
    }
    
    categorizationState.processing = true;
    showCategoryLoading(true);
    
    try {
        const articlesPerBatch = parseInt(document.getElementById('articlesPerBatch').value) || 10;
        const namespaceFilter = document.getElementById('categoryNamespaceFilter').value;
        
        showStatus('Searching for uncategorized articles...', 'info');
        
        // Use multiple methods to find uncategorized articles
        const methods = [
            findFromUncategorizedCategory,
            findFromRecentChanges,
            findFromSpecialPages
        ];
        
        const allArticles = [];
        
        for (const method of methods) {
            try {
                const articles = await method(articlesPerBatch, namespaceFilter);
                allArticles.push(...articles);
                
                if (allArticles.length >= articlesPerBatch) {
                    break;
                }
            } catch (error) {
                console.warn('One search method failed:', error);
            }
        }
        
        // Remove duplicates and limit results
        const uniqueArticles = allArticles.filter((article, index, self) => 
            index === self.findIndex(a => a.title === article.title)
        ).slice(0, articlesPerBatch);
        
        if (uniqueArticles.length === 0) {
            showStatus('No uncategorized articles found. Try adjusting your settings.', 'warning');
            return;
        }
        
        // Get additional article info (extracts, etc.)
        await enrichArticleData(uniqueArticles);
        
        categorizationState.currentArticles = uniqueArticles;
        categorizationState.currentArticleIndex = 0;
        categorizationState.stats.found = uniqueArticles.length;
        
        displayUncategorizedArticles();
        showStatus(`Found ${uniqueArticles.length} uncategorized articles.`, 'success');
        
    } catch (error) {
        console.error('Error finding uncategorized articles:', error);
        showStatus('Failed to find uncategorized articles: ' + error.message, 'error');
    } finally {
        categorizationState.processing = false;
        showCategoryLoading(false);
    }
}

/**
 * Find articles from the "Uncategorized" category
 */
async function findFromUncategorizedCategory(limit, namespace) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'categorymembers',
        cmtitle: 'Category:All uncategorized articles',
        cmlimit: limit,
        cmnamespace: namespace === 'all' ? '' : namespace,
        origin: '*'
    });
    
    const response = await fetch(`${API_URL}?${params}`);
    const data = await response.json();
    
    if (data.query && data.query.categorymembers) {
        return data.query.categorymembers.map(article => ({
            title: article.title,
            pageid: article.pageid,
            ns: article.ns,
            source: 'uncategorized_category'
        }));
    }
    
    return [];
}

/**
 * Find articles from recent changes that might be uncategorized
 */
async function findFromRecentChanges(limit, namespace) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'recentchanges',
        rctype: 'new',
        rcnamespace: namespace === 'all' ? '' : namespace,
        rclimit: limit * 3, // Get more to filter
        rcprop: 'title|ids|timestamp|user|comment',
        origin: '*'
    });
    
    const response = await fetch(`${API_URL}?${params}`);
    const data = await response.json();
    
    if (data.query && data.query.recentchanges) {
        // Filter for articles that might be uncategorized
        const candidates = data.query.recentchanges
            .filter(change => change.type === 'new')
            .map(change => ({
                title: change.title,
                pageid: change.pageid,
                ns: change.ns,
                source: 'recent_changes',
                timestamp: change.timestamp,
                user: change.user
            }));
        
        // Check which ones are actually uncategorized
        return await filterUncategorizedArticles(candidates.slice(0, limit));
    }
    
    return [];
}

/**
 * Find articles from special pages
 */
async function findFromSpecialPages(limit, namespace) {
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'querypage',
        qppage: 'Uncategorizedpages',
        qplimit: limit,
        origin: '*'
    });
    
    const response = await fetch(`${API_URL}?${params}`);
    const data = await response.json();
    
    if (data.query && data.query.querypage && data.query.querypage.results) {
        return data.query.querypage.results
            .filter(page => namespace === 'all' || page.ns == namespace)
            .map(page => ({
                title: page.title,
                pageid: page.pageid || 0,
                ns: page.ns,
                source: 'special_pages'
            }));
    }
    
    return [];
}

/**
 * Filter articles to only include uncategorized ones
 */
async function filterUncategorizedArticles(articles) {
    if (articles.length === 0) return [];
    
    const titles = articles.map(a => a.title).join('|');
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        titles: titles,
        prop: 'categories',
        cllimit: 10,
        origin: '*'
    });
    
    const response = await fetch(`${API_URL}?${params}`);
    const data = await response.json();
    
    if (data.query && data.query.pages) {
        const uncategorized = [];
        
        for (const article of articles) {
            const page = Object.values(data.query.pages).find(p => p.title === article.title);
            if (page && (!page.categories || page.categories.length === 0)) {
                uncategorized.push(article);
            }
        }
        
        return uncategorized;
    }
    
    return articles; // Return all if filtering fails
}

/**
 * Enrich article data with extracts and additional info
 */
async function enrichArticleData(articles) {
    if (articles.length === 0) return;
    
    const titles = articles.map(a => a.title).join('|');
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        titles: titles,
        prop: 'extracts|info|pageimages',
        exintro: true,
        explaintext: true,
        exlimit: articles.length,
        inprop: 'url|watchers|length',
        piprop: 'thumbnail',
        pithumbsize: 150,
        origin: '*'
    });
    
    const response = await fetch(`${API_URL}?${params}`);
    const data = await response.json();
    
    if (data.query && data.query.pages) {
        for (const article of articles) {
            const page = Object.values(data.query.pages).find(p => p.title === article.title);
            if (page) {
                article.extract = page.extract || '';
                article.url = page.fullurl || '';
                article.length = page.length || 0;
                article.watchers = page.watchers || 0;
                article.thumbnail = page.thumbnail?.source || '';
            }
        }
    }
}

/**
 * Display uncategorized articles in the UI
 */
function displayUncategorizedArticles() {
    const container = document.getElementById('uncategorizedArticles');
    
    // Add stats display
    const statsHtml = `
        <div class="category-stats">
            <strong>📊 Progress:</strong> 
            ${categorizationState.stats.processed}/${categorizationState.stats.found} articles processed, 
            ${categorizationState.stats.categorized} categorized
            <div class="progress-indicator">
                <div class="progress-fill" style="width: ${(categorizationState.stats.processed / categorizationState.stats.found * 100)}%"></div>
            </div>
        </div>
    `;
    
    const articlesHtml = categorizationState.currentArticles.map((article, index) => {
        const isSelected = index === categorizationState.currentArticleIndex;
        const isCategorized = categorizationState.selectedCategories.has(article.pageid);
        
        return `
            <div class="article-card ${isSelected ? 'current' : ''} ${isCategorized ? 'categorized' : ''}" 
                 data-article-index="${index}">
                <div class="article-header">
                    <div class="article-info">
                        <a href="${article.url}" target="_blank" class="article-title">${article.title}</a>
                        <div class="article-meta">
                            📄 ${article.length || 0} chars • 
                            👁️ ${article.watchers || 0} watchers • 
                            📁 Source: ${article.source}
                            ${article.timestamp ? ' • 🕒 ' + new Date(article.timestamp).toLocaleDateString() : ''}
                        </div>
                    </div>
                    ${article.thumbnail ? `<img src="${article.thumbnail}" alt="Thumbnail" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">` : ''}
                </div>
                
                ${article.extract ? `
                    <div class="article-extract">
                        ${article.extract.substring(0, 300)}${article.extract.length > 300 ? '...' : ''}
                    </div>
                ` : ''}
                
                <div class="category-suggestions" id="suggestions-${article.pageid}">
                    <h4>🤖 AI-Suggested Categories <span class="spinner-small" id="spinner-${article.pageid}" style="display: none;"></span></h4>
                    <div class="suggested-categories" id="categories-${article.pageid}">
                        <!-- Categories will be populated by AI -->
                    </div>
                    <div class="ai-analysis-card" id="analysis-${article.pageid}" style="display: none;">
                        <!-- AI analysis will be shown here -->
                    </div>
                </div>
                
                <div class="category-input-section">
                    <input type="text" id="custom-category-${article.pageid}" 
                           placeholder="Add custom category..." 
                           onkeypress="if(event.key==='Enter') addCustomCategory(${article.pageid})">
                    <button class="btn-secondary" onclick="addCustomCategory(${article.pageid})">Add Custom</button>
                </div>
                
                <div class="category-actions">
                    <button class="btn-success" onclick="suggestCategoriesForArticle(${index})">🤖 AI Suggest</button>
                    <button class="btn-primary" onclick="addSelectedCategories(${index})">📁 Add Categories</button>
                    <button class="btn-secondary" onclick="skipArticle(${index})">⏭️ Skip</button>
                    <button class="btn-secondary" onclick="viewArticle('${article.url}')">👁️ View</button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = statsHtml + articlesHtml;
    
    // Scroll to current article
    if (categorizationState.currentArticleIndex >= 0) {
        const currentCard = container.querySelector('.article-card.current');
        if (currentCard) {
            currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

/**
 * Use AI to suggest categories for current articles
 */
async function suggestCategories() {
    if (categorizationState.currentArticles.length === 0) {
        showStatus('No articles loaded. Please find articles first.', 'warning');
        return;
    }
    
    showStatus('Generating AI category suggestions for all articles...', 'info');
    
    // Process articles in batches to respect rate limits
    const batchSize = 3;
    for (let i = 0; i < categorizationState.currentArticles.length; i += batchSize) {
        const batch = categorizationState.currentArticles.slice(i, i + batchSize);
        
        // Process batch in parallel
        const promises = batch.map((article, index) => 
            suggestCategoriesForArticle(i + index, false)
        );
        
        await Promise.all(promises);
        
        // Brief pause between batches
        if (i + batchSize < categorizationState.currentArticles.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    showStatus('AI category suggestions completed for all articles.', 'success');
}

/**
 * Suggest categories for a specific article
 */
async function suggestCategoriesForArticle(articleIndex, scrollToArticle = true) {
    if (articleIndex < 0 || articleIndex >= categorizationState.currentArticles.length) {
        return;
    }
    
    const article = categorizationState.currentArticles[articleIndex];
    const spinnerEl = document.getElementById(`spinner-${article.pageid}`);
    const categoriesEl = document.getElementById(`categories-${article.pageid}`);
    const analysisEl = document.getElementById(`analysis-${article.pageid}`);
    
    if (spinnerEl) spinnerEl.style.display = 'inline-block';
    
    try {
        // Set current article index
        categorizationState.currentArticleIndex = articleIndex;
        
        if (scrollToArticle) {
            displayUncategorizedArticles();
        }
        
        // Prepare text for analysis
        const analysisText = `${article.title}\n\n${article.extract || ''}`;
        
        // Run AI analysis
        const aiAnalysis = await performCategoryAIAnalysis(analysisText, article);
        
        if (aiAnalysis && aiAnalysis.categories) {
            displayCategorySuggestions(article.pageid, aiAnalysis);
        } else {
            if (categoriesEl) {
                categoriesEl.innerHTML = '<div class="ai-error">Failed to generate category suggestions</div>';
            }
        }
        
    } catch (error) {
        console.error('Error suggesting categories:', error);
        if (categoriesEl) {
            categoriesEl.innerHTML = `<div class="ai-error">Error: ${error.message}</div>`;
        }
    } finally {
        if (spinnerEl) spinnerEl.style.display = 'none';
    }
}

/**
 * Perform AI analysis to suggest categories using Wikipedia's APIs and AI providers
 */
async function performCategoryAIAnalysis(text, article) {
    const analyses = [];
    
    // Run all analysis methods in parallel
    const promises = [];
    
    // 1. Wikipedia-based analysis (most reliable)
    promises.push(analyzeWithWikipediaAPIs(text, article));
    
    // 2. AI providers (supplementary)
    if (aiConfig.enableOpenAI) {
        promises.push(analyzeWithOpenAIForCategories(text, article));
    }
    
    if (aiConfig.enableHuggingFace) {
        promises.push(analyzeWithHuggingFaceForCategories(text, article));
    }
    
    // 3. Local pattern matching (always available)
    promises.push(analyzeWithLocalModelsForCategories(text, article));
    
    const results = await Promise.allSettled(promises);
    
    // Process results
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value && !result.value.error) {
            analyses.push(result.value);
        }
    });
    
    if (analyses.length === 0) {
        return null;
    }
    
    // Combine analyses with Wikipedia APIs given highest priority
    return combineCategoryAnalyses(analyses);
}

/**
 * Analyze with Wikipedia APIs for category suggestions
 * This is the most reliable method as it uses actual Wikipedia categorization patterns
 */
async function analyzeWithWikipediaAPIs(text, article) {
    try {
        const categories = [];
        
        // Method 1: Find similar articles and use their categories
        const similarArticles = await findSimilarArticles(article.title, text);
        const similarCategories = await getCategoriesFromSimilarArticles(similarArticles);
        categories.push(...similarCategories);
        
        // Method 2: Search for relevant categories by topic
        const topicCategories = await searchCategoriesByTopic(article.title, text);
        categories.push(...topicCategories);
        
        // Method 3: Template-based category suggestions
        const templateCategories = await suggestCategoriesFromTemplates(article.title);
        categories.push(...templateCategories);
        
        // Method 4: Category hierarchy exploration
        const hierarchyCategories = await exploreCategoryHierarchy(article.title, text);
        categories.push(...hierarchyCategories);
        
        // Remove duplicates and sort by confidence
        const uniqueCategories = removeDuplicateCategories(categories);
        
        return {
            provider: 'Wikipedia APIs',
            categories: uniqueCategories,
            reasoning: 'Suggestions based on similar articles, category search, templates, and category hierarchy analysis',
            confidence: 0.9 // Wikipedia data is highly reliable
        };
        
    } catch (error) {
        console.error('Wikipedia API category analysis error:', error);
        return {
            provider: 'Wikipedia APIs',
            error: 'Analysis failed: ' + error.message
        };
    }
}

/**
 * Find articles similar to the given article using Wikipedia search
 */
async function findSimilarArticles(title, content) {
    try {
        // Extract key terms from title and content
        const searchTerms = extractKeyTermsForSearch(title, content);
        
        const similarArticles = [];
        
        // Search for articles with similar terms
        for (const term of searchTerms.slice(0, 3)) { // Limit to avoid too many requests
            const params = new URLSearchParams({
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: term,
                srlimit: 5,
                srnamespace: 0, // Main namespace only
                srprop: 'title|snippet',
                origin: '*'
            });
            
            const response = await fetch(`${API_URL}?${params}`);
            const data = await response.json();
            
            if (data.query && data.query.search) {
                similarArticles.push(...data.query.search
                    .filter(result => result.title !== title) // Exclude the current article
                    .map(result => ({
                        title: result.title,
                        snippet: result.snippet,
                        relevance: calculateRelevance(title, result.title, content, result.snippet)
                    }))
                );
            }
        }
        
        // Sort by relevance and return top results
        return similarArticles
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, 8) // Top 8 most relevant
            .map(article => article.title);
        
    } catch (error) {
        console.warn('Error finding similar articles:', error);
        return [];
    }
}

/**
 * Get categories from similar articles
 */
async function getCategoriesFromSimilarArticles(similarTitles) {
    if (similarTitles.length === 0) return [];
    
    try {
        const titles = similarTitles.join('|');
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            titles: titles,
            prop: 'categories',
            cllimit: 20, // Get up to 20 categories per article
            clprop: 'hidden', // Include hidden categories info
            origin: '*'
        });
        
        const response = await fetch(`${API_URL}?${params}`);
        const data = await response.json();
        
        const categories = [];
        const categoryFrequency = new Map();
        
        if (data.query && data.query.pages) {
            Object.values(data.query.pages).forEach(page => {
                if (page.categories) {
                    page.categories.forEach(cat => {
                        // Skip maintenance categories
                        if (isMaintenanceCategory(cat.title)) return;
                        
                        const categoryName = cat.title.replace('Category:', '');
                        const count = categoryFrequency.get(categoryName) || 0;
                        categoryFrequency.set(categoryName, count + 1);
                    });
                }
            });
        }
        
        // Convert to category objects with confidence based on frequency
        categoryFrequency.forEach((frequency, categoryName) => {
            const confidence = Math.min(0.95, 0.5 + (frequency / similarTitles.length) * 0.4);
            categories.push({
                name: categoryName,
                confidence: confidence,
                source: 'similar_articles',
                frequency: frequency,
                total_articles: similarTitles.length
            });
        });
        
        // Sort by confidence
        return categories.sort((a, b) => b.confidence - a.confidence);
        
    } catch (error) {
        console.warn('Error getting categories from similar articles:', error);
        return [];
    }
}

/**
 * Search for relevant categories by topic using Wikipedia's category search
 */
async function searchCategoriesByTopic(title, content) {
    try {
        const categories = [];
        const searchTerms = extractKeyTermsForSearch(title, content);
        
        for (const term of searchTerms.slice(0, 2)) { // Limit searches
            // Search in category namespace
            const params = new URLSearchParams({
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: `incategory:"${term}" OR intitle:"${term}"`,
                srnamespace: 14, // Category namespace
                srlimit: 5,
                srprop: 'title',
                origin: '*'
            });
            
            const response = await fetch(`${API_URL}?${params}`);
            const data = await response.json();
            
            if (data.query && data.query.search) {
                data.query.search.forEach(result => {
                    const categoryName = result.title.replace('Category:', '');
                    // Skip overly broad or maintenance categories
                    if (!isOverlyBroadCategory(categoryName) && !isMaintenanceCategory(result.title)) {
                        categories.push({
                            name: categoryName,
                            confidence: 0.7,
                            source: 'topic_search',
                            search_term: term
                        });
                    }
                });
            }
        }
        
        return categories;
        
    } catch (error) {
        console.warn('Error searching categories by topic:', error);
        return [];
    }
}

/**
 * Suggest categories based on templates that might be in the article
 */
async function suggestCategoriesFromTemplates(title) {
    try {
        // Get templates used in the article
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            titles: title,
            prop: 'templates',
            tllimit: 20,
            origin: '*'
        });
        
        const response = await fetch(`${API_URL}?${params}`);
        const data = await response.json();
        
        const categories = [];
        
        if (data.query && data.query.pages) {
            const page = Object.values(data.query.pages)[0];
            if (page.templates) {
                // Map common templates to likely categories
                page.templates.forEach(template => {
                    const templateName = template.title.replace('Template:', '');
                    const suggestedCategories = mapTemplateToCategories(templateName);
                    categories.push(...suggestedCategories);
                });
            }
        }
        
        return categories;
        
    } catch (error) {
        console.warn('Error suggesting categories from templates:', error);
        return [];
    }
}

/**
 * Explore category hierarchy to find relevant categories
 */
async function exploreCategoryHierarchy(title, content) {
    try {
        const categories = [];
        const keyTerms = extractKeyTermsForSearch(title, content);
        
        // Look for category trees related to key terms
        for (const term of keyTerms.slice(0, 2)) {
            try {
                // Search for parent categories
                const parentCategories = await findParentCategories(term);
                categories.push(...parentCategories);
                
                // Brief pause to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn(`Error exploring hierarchy for ${term}:`, error);
            }
        }
        
        return categories;
        
    } catch (error) {
        console.warn('Error exploring category hierarchy:', error);
        return [];
    }
}

/**
 * Extract key terms from title and content for search
 */
function extractKeyTermsForSearch(title, content) {
    const terms = new Set();
    
    // Extract from title
    const titleWords = title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !isStopWord(word));
    
    titleWords.forEach(word => terms.add(word));
    
    // Extract from content (first 200 words)
    if (content) {
        const contentWords = content.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .slice(0, 200)
            .filter(word => word.length > 3 && !isStopWord(word));
        
        // Get most frequent content words
        const wordFreq = {};
        contentWords.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
        
        Object.entries(wordFreq)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .forEach(([word]) => terms.add(word));
    }
    
    return Array.from(terms).slice(0, 5); // Limit to 5 most relevant terms
}

/**
 * Calculate relevance between two articles
 */
function calculateRelevance(title1, title2, content1, content2) {
    let score = 0;
    
    // Title similarity
    const title1Words = new Set(title1.toLowerCase().split(/\s+/));
    const title2Words = new Set(title2.toLowerCase().split(/\s+/));
    const titleIntersection = new Set([...title1Words].filter(x => title2Words.has(x)));
    score += (titleIntersection.size / Math.max(title1Words.size, title2Words.size)) * 0.6;
    
    // Content similarity (basic word overlap)
    if (content1 && content2) {
        const content1Words = new Set(content1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const content2Words = new Set(content2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const contentIntersection = new Set([...content1Words].filter(x => content2Words.has(x)));
        score += (contentIntersection.size / Math.max(content1Words.size, content2Words.size)) * 0.4;
    }
    
    return score;
}

/**
 * Check if a category is a maintenance category
 */
function isMaintenanceCategory(categoryTitle) {
    const maintenancePatterns = [
        /articles? (with|needing|lacking)/i,
        /wikipedia/i,
        /pages? (with|needing|lacking)/i,
        /stub/i,
        /cleanup/i,
        /maintenance/i,
        /dated/i,
        /cs1/i,
        /citation/i,
        /unreferenced/i
    ];
    
    return maintenancePatterns.some(pattern => pattern.test(categoryTitle));
}

/**
 * Check if a category is overly broad
 */
function isOverlyBroadCategory(categoryName) {
    const broadCategories = [
        'articles',
        'pages',
        'wikipedia',
        'people',
        'places',
        'things',
        'concepts',
        'terms',
        'words'
    ];
    
    return broadCategories.some(broad => categoryName.toLowerCase().includes(broad));
}

/**
 * Check if a word is a stop word
 */
function isStopWord(word) {
    const stopWords = new Set([
        'the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'as', 'are', 'was', 'were',
        'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'can', 'of', 'in', 'for', 'with',
        'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
        'above', 'below', 'between', 'among', 'an', 'but', 'or', 'nor', 'so', 'yet'
    ]);
    
    return stopWords.has(word.toLowerCase());
}

/**
 * Map template names to likely categories
 */
function mapTemplateToCategories(templateName) {
    const categories = [];
    const template = templateName.toLowerCase();
    
    // Common template patterns
    const templateMappings = {
        'infobox person': ['Living people', 'People'],
        'infobox biography': ['People', 'Biography'],
        'infobox company': ['Companies', 'Organizations'],
        'infobox university': ['Universities and colleges', 'Educational institutions'],
        'infobox school': ['Schools', 'Educational institutions'],
        'infobox film': ['Films'],
        'infobox book': ['Books'],
        'infobox album': ['Albums'],
        'infobox song': ['Songs'],
        'infobox television': ['Television'],
        'infobox website': ['Websites'],
        'infobox video game': ['Video games'],
        'infobox sports team': ['Sports teams'],
        'infobox athlete': ['Athletes', 'Sports'],
        'infobox politician': ['Politicians'],
        'infobox actor': ['Actors'],
        'infobox musician': ['Musicians'],
        'infobox writer': ['Writers'],
        'infobox scientist': ['Scientists']
    };
    
    Object.entries(templateMappings).forEach(([pattern, cats]) => {
        if (template.includes(pattern)) {
            cats.forEach(cat => {
                categories.push({
                    name: cat,
                    confidence: 0.8,
                    source: 'template_mapping',
                    template: templateName
                });
            });
        }
    });
    
    return categories;
}

/**
 * Find parent categories for a term
 */
async function findParentCategories(term) {
    try {
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            list: 'search',
            srsearch: `${term} incategory:`,
            srnamespace: 14,
            srlimit: 3,
            origin: '*'
        });
        
        const response = await fetch(`${API_URL}?${params}`);
        const data = await response.json();
        
        const categories = [];
        
        if (data.query && data.query.search) {
            data.query.search.forEach(result => {
                const categoryName = result.title.replace('Category:', '');
                if (!isMaintenanceCategory(result.title) && !isOverlyBroadCategory(categoryName)) {
                    categories.push({
                        name: categoryName,
                        confidence: 0.6,
                        source: 'hierarchy_exploration',
                        search_term: term
                    });
                }
            });
        }
        
        return categories;
        
    } catch (error) {
        console.warn('Error finding parent categories:', error);
        return [];
    }
}

/**
 * Remove duplicate categories and combine confidence scores
 */
function removeDuplicateCategories(categories) {
    const categoryMap = new Map();
    
    categories.forEach(category => {
        const key = category.name.toLowerCase();
        if (categoryMap.has(key)) {
            const existing = categoryMap.get(key);
            // Combine confidence scores (weighted average)
            const totalWeight = existing.weight + 1;
            existing.confidence = (existing.confidence * existing.weight + category.confidence) / totalWeight;
            existing.weight = totalWeight;
            existing.sources.push(category.source);
        } else {
            categoryMap.set(key, {
                name: category.name,
                confidence: category.confidence,
                source: category.source,
                sources: [category.source],
                weight: 1
            });
        }
    });
    
    // Convert back to array and sort by confidence
    return Array.from(categoryMap.values())
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10); // Limit to top 10 suggestions
}

/**
 * Analyze with OpenAI for category suggestions
 */
async function analyzeWithOpenAIForCategories(text, article) {
    if (!aiConfig.enableOpenAI || !aiConfig.apiKeys.openai) {
        return null;
    }
    
    if (!rateLimiter.canMakeRequest('openai')) {
        return null;
    }
    
    try {
        rateLimiter.recordRequest('openai');
        
        const prompt = `Analyze this Wikipedia article and suggest appropriate categories:

TITLE: ${article.title}
CONTENT: ${text.substring(0, 1000)}

Suggest 3-7 relevant Wikipedia categories for this article. Consider:
1. Topic/subject matter
2. Geographic location (if applicable)
3. Time period (if applicable)
4. Type of entity (person, place, organization, etc.)
5. Broader subject areas

Respond with categories in this format:
CATEGORIES: Category1|Category2|Category3
REASONING: Brief explanation of suggestions`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${aiConfig.apiKeys.openai}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a Wikipedia categorization expert. Suggest accurate, existing Wikipedia categories.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 300,
                temperature: 0.3
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse response
        const categoriesMatch = content.match(/CATEGORIES:\s*(.+)/);
        const reasoningMatch = content.match(/REASONING:\s*(.+)/);
        
        if (categoriesMatch) {
            const categories = categoriesMatch[1].split('|').map(cat => cat.trim());
            
            return {
                provider: 'OpenAI GPT-3.5',
                categories: categories.map(cat => ({
                    name: cat,
                    confidence: 0.8,
                    source: 'ai_generated'
                })),
                reasoning: reasoningMatch ? reasoningMatch[1] : 'AI-generated suggestions',
                confidence: 0.8
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('OpenAI category analysis error:', error);
        return {
            provider: 'OpenAI',
            error: 'Analysis failed: ' + error.message
        };
    }
}

/**
 * Analyze with Hugging Face for category suggestions
 */
async function analyzeWithHuggingFaceForCategories(text, article) {
    if (!aiConfig.enableHuggingFace) {
        return null;
    }
    
    if (!rateLimiter.canMakeRequest('huggingface')) {
        return null;
    }
    
    try {
        rateLimiter.recordRequest('huggingface');
        
        // Use text classification to identify topics
        const classificationResult = await callHuggingFaceAPI(
            'microsoft/DialoGPT-medium',
            text.substring(0, 500),
            'text-classification'
        );
        
        // Generate categories based on classification
        const categories = generateCategoriesFromClassification(classificationResult, article);
        
        return {
            provider: 'Hugging Face',
            categories: categories,
            reasoning: 'Generated from text classification analysis',
            confidence: 0.7,
            raw_analysis: classificationResult
        };
        
    } catch (error) {
        console.error('Hugging Face category analysis error:', error);
        return {
            provider: 'Hugging Face',
            error: 'Analysis failed: ' + error.message
        };
    }
}

/**
 * Analyze with local models for category suggestions
 */
async function analyzeWithLocalModelsForCategories(text, article) {
    try {
        const categories = [];
        
        // Pattern-based category detection
        const title = article.title.toLowerCase();
        const content = text.toLowerCase();
        
        // Geographic categories
        const countries = ['american', 'british', 'canadian', 'australian', 'german', 'french', 'italian', 'japanese', 'chinese', 'indian'];
        for (const country of countries) {
            if (title.includes(country) || content.includes(country)) {
                categories.push({
                    name: country.charAt(0).toUpperCase() + country.slice(1) + ' people',
                    confidence: 0.8,
                    source: 'pattern_matching'
                });
                break;
            }
        }
        
        // Birth/death year patterns
        const yearMatch = title.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            const year = yearMatch[0];
            if (title.includes('born') || content.includes('born')) {
                categories.push({
                    name: `${year} births`,
                    confidence: 0.9,
                    source: 'pattern_matching'
                });
            }
            if (title.includes('died') || content.includes('died')) {
                categories.push({
                    name: `${year} deaths`,
                    confidence: 0.9,
                    source: 'pattern_matching'
                });
            }
        }
        
        // Profession/occupation patterns
        const professions = {
            'actor': 'Actors',
            'actress': 'Actresses', 
            'musician': 'Musicians',
            'singer': 'Singers',
            'writer': 'Writers',
            'author': 'Authors',
            'politician': 'Politicians',
            'athlete': 'Athletes',
            'scientist': 'Scientists',
            'doctor': 'Physicians',
            'teacher': 'Educators',
            'professor': 'Academics'
        };
        
        for (const [term, category] of Object.entries(professions)) {
            if (title.includes(term) || content.includes(term)) {
                categories.push({
                    name: category,
                    confidence: 0.7,
                    source: 'pattern_matching'
                });
            }
        }
        
        // Add "Living people" for recent people
        if (categories.some(cat => cat.name.includes('births')) && 
            !categories.some(cat => cat.name.includes('deaths'))) {
            categories.push({
                name: 'Living people',
                confidence: 0.8,
                source: 'pattern_matching'
            });
        }
        
        return {
            provider: 'Local Pattern Analysis',
            categories: categories,
            reasoning: 'Generated from pattern matching and heuristics',
            confidence: 0.6
        };
        
    } catch (error) {
        console.error('Local category analysis error:', error);
        return {
            provider: 'Local Analysis',
            error: 'Analysis failed: ' + error.message
        };
    }
}

/**
 * Generate categories from Hugging Face classification results
 */
function generateCategoriesFromClassification(classification, article) {
    const categories = [];
    
    // This is a simplified example - in practice, you'd have more sophisticated mapping
    if (Array.isArray(classification)) {
        classification.forEach(result => {
            if (result.label && result.score > 0.5) {
                // Map classification labels to Wikipedia categories
                const categoryMap = {
                    'POSITIVE': 'Living people',
                    'NEGATIVE': 'Deceased people',
                    'PERSON': 'People',
                    'ORGANIZATION': 'Organizations',
                    'LOCATION': 'Places'
                };
                
                const category = categoryMap[result.label];
                if (category) {
                    categories.push({
                        name: category,
                        confidence: result.score,
                        source: 'ai_classification'
                    });
                }
            }
        });
    }
    
    return categories;
}

/**
 * Combine category analyses from multiple providers
 */
function combineCategoryAnalyses(analyses) {
    const combinedCategories = new Map();
    let reasoning = [];
    
    // Combine all suggested categories
    analyses.forEach(analysis => {
        if (analysis.categories) {
            analysis.categories.forEach(category => {
                const key = category.name.toLowerCase();
                if (combinedCategories.has(key)) {
                    // Increase confidence if multiple providers suggest the same category
                    const existing = combinedCategories.get(key);
                    existing.confidence = Math.min(0.95, existing.confidence + 0.1);
                    existing.providers.push(analysis.provider);
                } else {
                    combinedCategories.set(key, {
                        name: category.name,
                        confidence: category.confidence,
                        source: category.source,
                        providers: [analysis.provider]
                    });
                }
            });
        }
        
        if (analysis.reasoning) {
            reasoning.push(`${analysis.provider}: ${analysis.reasoning}`);
        }
    });
    
    // Sort by confidence
    const sortedCategories = Array.from(combinedCategories.values())
        .sort((a, b) => b.confidence - a.confidence);
    
    return {
        categories: sortedCategories,
        reasoning: reasoning.join('\n'),
        providers: analyses.map(a => a.provider),
        confidence: sortedCategories.length > 0 ? 
            sortedCategories.reduce((sum, cat) => sum + cat.confidence, 0) / sortedCategories.length : 0
    };
}

/**
 * Display category suggestions in the UI
 */
function displayCategorySuggestions(articleId, analysis) {
    const categoriesEl = document.getElementById(`categories-${articleId}`);
    const analysisEl = document.getElementById(`analysis-${articleId}`);
    
    if (!categoriesEl || !analysis.categories) return;
    
    const categoriesHtml = analysis.categories.map(category => {
        const sourceInfo = getSourceInfo(category.source);
        return `
        <div class="category-tag suggested" 
             data-category="${category.name}" 
             onclick="toggleCategorySelection(this, ${articleId}, '${category.name}')"
             title="${sourceInfo.desc} (${Math.round(category.confidence * 100)}% confidence)">
            <span class="category-source">${sourceInfo.icon}</span>
            ${category.name}
            <span class="category-confidence">${Math.round(category.confidence * 100)}%</span>
        </div>
    `}).join('');
    
    categoriesEl.innerHTML = categoriesHtml;
    
    // Show analysis details with source breakdown
    if (analysisEl && analysis.reasoning) {
        // Group categories by source
        const sourceGroups = {};
        analysis.categories.forEach(cat => {
            const source = cat.source || 'unknown';
            if (!sourceGroups[source]) sourceGroups[source] = [];
            sourceGroups[source].push(cat);
        });
        
        const sourceBreakdown = Object.entries(sourceGroups)
            .map(([source, cats]) => {
                const sourceInfo = getSourceInfo(source);
                return `
                    <div class="source-group">
                        <span class="source-label">${sourceInfo.icon} ${sourceInfo.desc}</span>
                        <span class="source-count">${cats.length} categories</span>
                    </div>
                `;
            }).join('');
        
        analysisEl.innerHTML = `
            <div class="ai-context-header">
                <span>🤖 Category Analysis</span>
                <span class="ai-score legitimate">Overall: ${Math.round(analysis.confidence * 100)}%</span>
            </div>
            <div class="ai-reasoning">${analysis.reasoning}</div>
            <div class="source-breakdown">
                <strong>Sources:</strong>
                ${sourceBreakdown}
            </div>
            <div style="font-size: 11px; color: #666; margin-top: 5px;">
                Provider: ${analysis.provider || 'Multiple'}
            </div>
        `;
        analysisEl.style.display = 'block';
    }
}

/**
 * Get source icon and description for category suggestions
 */
function getSourceInfo(source) {
    const sourceMap = {
        'similar_articles': { icon: '🔗', desc: 'Similar articles' },
        'topic_search': { icon: '🔍', desc: 'Category search' },
        'template_mapping': { icon: '📋', desc: 'Article templates' },
        'hierarchy_exploration': { icon: '🌳', desc: 'Category hierarchy' },
        'openai': { icon: '🤖', desc: 'OpenAI GPT' },
        'huggingface': { icon: '🤗', desc: 'Hugging Face' },
        'local': { icon: '💻', desc: 'Local patterns' },
        'wikipedia_apis': { icon: '📚', desc: 'Wikipedia APIs' }
    };
    
    return sourceMap[source] || { icon: '❓', desc: 'Unknown source' };
}

/**
 * Toggle category selection
 */
function toggleCategorySelection(element, articleId, categoryName) {
    element.classList.toggle('selected');
    
    if (!categorizationState.selectedCategories.has(articleId)) {
        categorizationState.selectedCategories.set(articleId, []);
    }
    
    const selectedCategories = categorizationState.selectedCategories.get(articleId);
    
    if (element.classList.contains('selected')) {
        if (!selectedCategories.includes(categoryName)) {
            selectedCategories.push(categoryName);
        }
    } else {
        const index = selectedCategories.indexOf(categoryName);
        if (index > -1) {
            selectedCategories.splice(index, 1);
        }
    }
}

/**
 * Add custom category
 */
function addCustomCategory(articleId) {
    const input = document.getElementById(`custom-category-${articleId}`);
    const categoryName = input.value.trim();
    
    if (!categoryName) return;
    
    // Add to selected categories
    if (!categorizationState.selectedCategories.has(articleId)) {
        categorizationState.selectedCategories.set(articleId, []);
    }
    
    const selectedCategories = categorizationState.selectedCategories.get(articleId);
    if (!selectedCategories.includes(categoryName)) {
        selectedCategories.push(categoryName);
        
        // Add visual indicator
        const categoriesEl = document.getElementById(`categories-${articleId}`);
        if (categoriesEl) {
            const customTag = document.createElement('div');
            customTag.className = 'category-tag suggested selected';
            customTag.setAttribute('data-category', categoryName);
            customTag.onclick = () => toggleCategorySelection(customTag, articleId, categoryName);
            customTag.innerHTML = `${categoryName} <span class="category-confidence">Custom</span>`;
            categoriesEl.appendChild(customTag);
        }
    }
    
    input.value = '';
    showStatus(`Added custom category: ${categoryName}`, 'success');
}

/**
 * Add selected categories to an article
 */
async function addSelectedCategories(articleIndex) {
    if (articleIndex === undefined) {
        articleIndex = categorizationState.currentArticleIndex;
    }
    
    if (articleIndex < 0 || articleIndex >= categorizationState.currentArticles.length) {
        showStatus('No article selected', 'warning');
        return;
    }
    
    const article = categorizationState.currentArticles[articleIndex];
    const selectedCategories = categorizationState.selectedCategories.get(article.pageid);
    
    if (!selectedCategories || selectedCategories.length === 0) {
        showStatus('No categories selected for this article', 'warning');
        return;
    }
    
    if (!authState.isLoggedIn) {
        showStatus('Please log in to add categories', 'error');
        return;
    }
    
    try {
        showStatus(`Adding ${selectedCategories.length} categories to "${article.title}"...`, 'info');
        
        // Add categories to the article
        const success = await addCategoriesToArticle(article, selectedCategories);
        
        if (success) {
            categorizationState.stats.categorized++;
            showStatus(`Successfully added categories to "${article.title}"`, 'success');
            
            // Mark article as categorized
            const articleCard = document.querySelector(`[data-article-index="${articleIndex}"]`);
            if (articleCard) {
                articleCard.classList.add('categorized');
            }
            
            // Move to next article
            nextUncategorizedArticle();
        } else {
            showStatus('Failed to add categories. Please try again.', 'error');
        }
        
    } catch (error) {
        console.error('Error adding categories:', error);
        showStatus('Error adding categories: ' + error.message, 'error');
    }
}

/**
 * Add categories to a Wikipedia article
 */
async function addCategoriesToArticle(article, categories) {
    try {
        // First, get the current article content
        const getParams = new URLSearchParams({
            action: 'query',
            format: 'json',
            titles: article.title,
            prop: 'revisions',
            rvprop: 'content',
            rvslots: 'main',
            origin: '*'
        });
        
        const getResponse = await fetch(`${API_URL}?${getParams}`);
        const getData = await getResponse.json();
        
        if (!getData.query || !getData.query.pages) {
            throw new Error('Could not retrieve article content');
        }
        
        const page = Object.values(getData.query.pages)[0];
        if (!page.revisions || !page.revisions[0]) {
            throw new Error('Could not retrieve article content');
        }
        
        const currentContent = page.revisions[0].slots.main['*'];
        
        // Add categories to the content
        const categoryWikitext = categories.map(cat => `[[Category:${cat}]]`).join('\n');
        const newContent = currentContent + '\n' + categoryWikitext;
        
        // Edit the article
        const editParams = new URLSearchParams({
            action: 'edit',
            format: 'json',
            title: article.title,
            text: newContent,
            summary: `Added categories: ${categories.join(', ')} (via Wikipedia Patrol Tool)`,
            minor: true,
            origin: '*'
        });
        
        // Get edit token
        const tokenResponse = await oauthClient.makeAuthenticatedRequest(
            `${API_URL}?action=query&format=json&meta=tokens&type=csrf&origin=*`
        );
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.query || !tokenData.query.tokens) {
            throw new Error('Could not get edit token');
        }
        
        editParams.append('token', tokenData.query.tokens.csrftoken);
        
        // Make the edit
        const editResponse = await oauthClient.makeAuthenticatedRequest(
            API_URL,
            {
                method: 'POST',
                body: editParams
            }
        );
        
        const editData = await editResponse.json();
        
        if (editData.edit && editData.edit.result === 'Success') {
            return true;
        } else {
            console.error('Edit failed:', editData);
            return false;
        }
        
    } catch (error) {
        console.error('Error adding categories to article:', error);
        throw error;
    }
}

/**
 * Skip current article
 */
function skipArticle(articleIndex) {
    if (articleIndex === undefined) {
        articleIndex = categorizationState.currentArticleIndex;
    }
    
    categorizationState.stats.processed++;
    nextUncategorizedArticle();
    showStatus('Article skipped', 'info');
}

/**
 * Move to next uncategorized article
 */
function nextUncategorizedArticle() {
    if (categorizationState.currentArticleIndex < categorizationState.currentArticles.length - 1) {
        categorizationState.currentArticleIndex++;
        categorizationState.stats.processed++;
        displayUncategorizedArticles();
    } else {
        showStatus('All articles processed! Click "Find Articles" to get more.', 'success');
    }
}

/**
 * Refresh category search
 */
async function refreshCategorySearch() {
    categorizationState.currentArticles = [];
    categorizationState.currentArticleIndex = 0;
    categorizationState.selectedCategories.clear();
    categorizationState.stats = { found: 0, processed: 0, categorized: 0 };
    
    document.getElementById('uncategorizedArticles').innerHTML = '';
    
    await findUncategorizedArticles();
}

/**
 * View article in new tab
 */
function viewArticle(url) {
    window.open(url, '_blank');
}

/**
 * Show/hide category loading indicator
 */
function showCategoryLoading(show) {
    const loadingEl = document.getElementById('categoryLoading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

/**
 * Update shortcuts help for different modes
 */
function updateShortcutsHelp(mode) {
    const shortcutsHelp = document.querySelector('.shortcuts-help');
    if (!shortcutsHelp) return;
    
    if (mode === 'categorization') {
        shortcutsHelp.innerHTML = `
            <h3>Keyboard Shortcuts</h3>
            <div class="shortcut-item">
                <span>Find articles</span>
                <span class="shortcut-key">F</span>
            </div>
            <div class="shortcut-item">
                <span>AI suggest</span>
                <span class="shortcut-key">A</span>
            </div>
            <div class="shortcut-item">
                <span>Add categories</span>
                <span class="shortcut-key">C</span>
            </div>
            <div class="shortcut-item">
                <span>Skip article</span>
                <span class="shortcut-key">S</span>
            </div>
            <div class="shortcut-item">
                <span>Next article</span>
                <span class="shortcut-key">↓ / J</span>
            </div>
            <div class="shortcut-item">
                <span>Previous article</span>
                <span class="shortcut-key">↑ / K</span>
            </div>
        `;
    } else {
        // Restore original patrol shortcuts
        shortcutsHelp.innerHTML = `
            <h3>Keyboard Shortcuts</h3>
            <div class="shortcut-item">
                <span>Next change</span>
                <span class="shortcut-key">↓ / J</span>
            </div>
            <div class="shortcut-item">
                <span>Previous change</span>
                <span class="shortcut-key">↑ / K</span>
            </div>
            <div class="shortcut-item">
                <span>Revert</span>
                <span class="shortcut-key">V</span>
            </div>
            <div class="shortcut-item">
                <span>Mark as good</span>
                <span class="shortcut-key">G</span>
            </div>
            <div class="shortcut-item">
                <span>Skip</span>
                <span class="shortcut-key">S</span>
            </div>
            <div class="shortcut-item">
                <span>View diff</span>
                <span class="shortcut-key">D</span>
            </div>
            <div class="shortcut-item">
                <span>Warn user</span>
                <span class="shortcut-key">W</span>
            </div>
            <div class="shortcut-item">
                <span>Refresh</span>
                <span class="shortcut-key">R</span>
            </div>
        `;
    }
}

// Add keyboard shortcuts for categorization mode
document.addEventListener('keydown', (event) => {
    // Only handle shortcuts when categorization is active
    const categorizationContainer = document.getElementById('categorizationContainer');
    if (!categorizationContainer || categorizationContainer.style.display === 'none') {
        return;
    }
    
    // Avoid interfering with input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch (event.key.toLowerCase()) {
        case 'f':
            event.preventDefault();
            findUncategorizedArticles();
            break;
        case 'a':
            event.preventDefault();
            suggestCategories();
            break;
        case 'c':
            event.preventDefault();
            addSelectedCategories();
            break;
        case 's':
            event.preventDefault();
            skipArticle();
            break;
        case 'arrowdown':
        case 'j':
            event.preventDefault();
            if (categorizationState.currentArticleIndex < categorizationState.currentArticles.length - 1) {
                categorizationState.currentArticleIndex++;
                displayUncategorizedArticles();
            }
            break;
        case 'arrowup':
        case 'k':
            event.preventDefault();
            if (categorizationState.currentArticleIndex > 0) {
                categorizationState.currentArticleIndex--;
                displayUncategorizedArticles();
            }
            break;
    }
}); 