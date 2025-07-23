// Extension popup logic with enhanced GitHub integration
class ScriptManager {
    constructor() {
        this.config = null;
        this.currentTab = null;
        this.configUrl = 'https://raw.githubusercontent.com/kristomi/bookmarklets/main/config.json';
        this.init();
    }
    
    async init() {
        await this.getCurrentTab();
        await this.loadConfig();
        this.updateUI();
        this.bindEvents();
    }
    
    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
        
        // Update current site display
        const siteInfo = document.getElementById('current-site');
        if (tab) {
            const domain = new URL(tab.url).hostname;
            siteInfo.textContent = `Current site: ${domain}`;
        }
    }
    
    async loadConfig() {
        try {
            this.showStatus('Checking for updates...', 'info');
            
            // Try to get fresh config from GitHub
            const response = await fetch(this.configUrl, { 
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });
            
            if (response.ok) {
                const freshConfig = await response.json();
                
                // Compare with cached version
                const cached = await chrome.storage.local.get(['config', 'lastUpdate']);
                const isUpdate = !cached.config || 
                    this.isNewerVersion(freshConfig.version || '1.0.0', cached.config.version || '0.0.0');
                
                this.config = freshConfig;
                
                // Cache the fresh config
                await chrome.storage.local.set({ 
                    config: freshConfig, 
                    lastUpdate: Date.now() 
                });
                
                if (isUpdate) {
                    this.showStatus(`Updated to v${freshConfig.version || '1.0.0'}`, 'success');
                } else {
                    this.showStatus('Configuration up to date', 'success');
                }
                
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.warn('Failed to fetch fresh config, using cached:', error);
            
            // Fallback to cached config
            const cached = await chrome.storage.local.get(['config']);
            if (cached.config) {
                this.config = cached.config;
                this.showStatus('Using cached configuration (offline)', 'info');
            } else {
                // Ultimate fallback to embedded config
                this.config = this.getDefaultConfig();
                this.showStatus('Using default configuration', 'info');
            }
        }
    }
    
    getDefaultConfig() {
        return {
            "title": "Kristomi's Scripts",
            "description": "Collection of useful scripts",
            "version": "1.0.0",
            "theme": {
                "colors": {
                    "primary": "#667eea",
                    "secondary": "#764ba2"
                }
            },
            "categories": {
                "Scrapers": {
                    "Kindle Highlights": "kindle-highlights"
                },
                "LLMs": {
                    "Claude Export": "claude-export",
                    "ChatGPT Export": "chatgpt-export"
                }
            }
        };
    }
    
    isNewerVersion(newVersion, currentVersion) {
        const parseVersion = (version) => version.split('.').map(n => parseInt(n, 10));
        const newParts = parseVersion(newVersion);
        const currentParts = parseVersion(currentVersion);
        
        for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
            const newPart = newParts[i] || 0;
            const currentPart = currentParts[i] || 0;
            
            if (newPart > currentPart) return true;
            if (newPart < currentPart) return false;
        }
        
        return false;
    }
    
    updateUI() {
        if (!this.config) return;
        
        // Update version
        document.getElementById('version').textContent = `v${this.config.version || '1.0.0'}`;
        
        // Apply theme colors if available
        if (this.config.theme?.colors) {
            const colors = this.config.theme.colors;
            document.documentElement.style.setProperty('--primary-color', colors.primary || '#667eea');
            document.documentElement.style.setProperty('--secondary-color', colors.secondary || '#764ba2');
        }
        
        // Build script categories from new structure
        const container = document.getElementById('script-categories');
        container.innerHTML = '';
        
        // Group scripts by category
        const categorizedScripts = {};
        Object.entries(this.config.scripts || {}).forEach(([scriptId, scriptInfo]) => {
            const category = scriptInfo.category || 'Other';
            if (!categorizedScripts[category]) {
                categorizedScripts[category] = {};
            }
            categorizedScripts[category][scriptId] = scriptInfo;
        });
        
        // Create UI for each category
        Object.entries(categorizedScripts).forEach(([categoryName, scripts]) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'category-title';
            titleDiv.textContent = categoryName;
            categoryDiv.appendChild(titleDiv);
            
            Object.entries(scripts).forEach(([scriptId, scriptInfo]) => {
                const button = document.createElement('button');
                button.className = 'script-button';
                button.textContent = scriptInfo.name;
                button.dataset.scriptId = scriptId;
                button.dataset.scriptUrl = scriptInfo.url;
                
                // Check if script is applicable to current site
                const isApplicable = this.isScriptApplicableToSite(scriptInfo, this.currentTab?.url);
                if (!isApplicable) {
                    button.disabled = true;
                    const allowedSites = scriptInfo.sites ? scriptInfo.sites.join(', ') : 'specific sites';
                    button.title = `This script only works on: ${allowedSites}`;
                }
                
                button.addEventListener('click', () => this.runScript(scriptInfo.url, scriptInfo.name));
                categoryDiv.appendChild(button);
            });
            
            container.appendChild(categoryDiv);
        });
    }
    
    isScriptApplicableToSite(scriptInfo, url) {
        if (!url || !scriptInfo.sites) return true; // No restrictions if sites not specified
        
        const domain = new URL(url).hostname;
        return scriptInfo.sites.some(site => domain.includes(site));
    }
    
    isScriptApplicableToSite(scriptId, url) {
        if (!url) return false;
        
        const siteRules = {
            'kindle-highlights': ['read.amazon.com'],
            'claude-export': ['claude.ai'],
            'chatgpt-export': ['chatgpt.com', 'chat.openai.com']
        };
        
        const domain = new URL(url).hostname;
        const rules = siteRules[scriptId];
        
        return rules ? rules.some(rule => domain.includes(rule)) : true;
    }
    
    async runScript(scriptId, scriptName) {
        try {
            this.showStatus(`Running ${scriptName}...`, 'info');
            
            // Disable all buttons during execution
            document.querySelectorAll('.script-button').forEach(btn => {
                btn.disabled = true;
            });
            
            // Try to send message to content script
            let response;
            try {
                response = await chrome.tabs.sendMessage(this.currentTab.id, {
                    action: 'runScript',
                    scriptId: scriptId,
                    scriptName: scriptName
                });
            } catch (connectionError) {
                console.warn('Content script not available, injecting...', connectionError);
                
                // Inject content script if it's not available
                await chrome.scripting.executeScript({
                    target: { tabId: this.currentTab.id },
                    files: ['content.js']
                });
                
                // Wait a bit for script to initialize
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Try again
                response = await chrome.tabs.sendMessage(this.currentTab.id, {
                    action: 'runScript',
                    scriptId: scriptId,
                    scriptName: scriptName
                });
            }
            
            if (response && response.success) {
                this.showStatus(`${scriptName} completed successfully`, 'success');
                
                // Log successful execution
                await chrome.runtime.sendMessage({
                    action: 'logScriptExecution',
                    scriptId: scriptId,
                    success: true,
                    url: this.currentTab.url
                });
                
            } else {
                throw new Error(response?.error || 'Script execution failed');
            }
        } catch (error) {
            console.error('Script execution error:', error);
            this.showStatus(`Error running ${scriptName}: ${error.message}`, 'error');
            
            // Log failed execution
            try {
                await chrome.runtime.sendMessage({
                    action: 'logScriptExecution',
                    scriptId: scriptId,
                    success: false,
                    error: error.message,
                    url: this.currentTab.url
                });
            } catch (logError) {
                console.warn('Failed to log execution:', logError);
            }
            
        } finally {
            // Re-enable buttons
            setTimeout(() => {
                document.querySelectorAll('.script-button').forEach(btn => {
                    const scriptId = btn.dataset.scriptId;
                    const isApplicable = this.isScriptApplicableToSite(scriptId, this.currentTab?.url);
                    btn.disabled = !isApplicable;
                });
            }, 1000);
        }
    }
    
    showStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        if (type !== 'error') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
    }
    
    bindEvents() {
        // Update now button
        document.getElementById('update-now').addEventListener('click', async () => {
            await this.loadConfig();
            this.updateUI();
        });
        
        // Add cache management button
        const cacheBtn = document.createElement('button');
        cacheBtn.textContent = 'Clear Cache';
        cacheBtn.className = 'update-button';
        cacheBtn.style.marginLeft = '4px';
        cacheBtn.addEventListener('click', async () => {
            try {
                // Clear script cache via content script
                await chrome.tabs.sendMessage(this.currentTab.id, {
                    action: 'clearCache'
                });
                this.showStatus('Script cache cleared', 'success');
            } catch (error) {
                console.error('Failed to clear cache:', error);
            }
        });
        
        document.querySelector('.footer').appendChild(cacheBtn);
    }
}

// Add CSS custom properties for theming
const style = document.createElement('style');
style.textContent = `
    :root {
        --primary-color: #667eea;
        --secondary-color: #764ba2;
    }
    
    .header {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
    }
    
    .script-button:hover {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 1px var(--primary-color);
    }
    
    .update-button {
        background: var(--primary-color);
    }
    
    .update-button:hover {
        background: var(--secondary-color);
    }
`;
document.head.appendChild(style);

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
    new ScriptManager();
});