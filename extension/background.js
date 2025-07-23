// Background service worker for the extension
class BackgroundService {
    constructor() {
        this.init();
    }
    
    init() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.handleFirstInstall();
            } else if (details.reason === 'update') {
                this.handleUpdate(details.previousVersion);
            }
        });
        
        // Handle extension startup
        chrome.runtime.onStartup.addListener(() => {
            this.checkForUpdates();
        });
        
        // Listen for messages from popup or content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep channel open for async responses
        });
        
        // Set up periodic update checks
        this.setupPeriodicUpdates();
        
        // Handle context menu (optional feature)
        this.setupContextMenu();
    }
    
    async handleFirstInstall() {
        console.log('Extension installed for the first time');
        
        // Set default configuration
        const defaultConfig = {
            "title": "Kristomi's Scripts",
            "description": "Collection of useful scripts",
            "version": "1.0.0",
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
        
        await chrome.storage.local.set({
            config: defaultConfig,
            lastUpdate: Date.now(),
            autoUpdateEnabled: true,
            scriptCache: {} // Initialize script cache
        });
        
        // Try to fetch fresh config immediately
        await this.checkForUpdates();
        
        // Show welcome notification
        this.showNotification(
            'Kristomi\'s Scripts installert!',
            'Extensionen er klar til bruk. Scripts hentes automatisk fra GitHub.'
        );
    }
    
    async handleUpdate(previousVersion) {
        console.log(`Extension updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);
        
        // Clear script cache on extension update to force fresh downloads
        await chrome.storage.local.set({ scriptCache: {} });
        
        // Check for breaking changes and migrate if necessary
        await this.migrateSettings(previousVersion);
        
        // Fetch fresh configuration
        await this.checkForUpdates();
        
        // Show update notification
        this.showNotification(
            'Extension oppdatert!',
            `Scripts oppdateres automatisk fra GitHub. Versjon ${chrome.runtime.getManifest().version}`
        );
    }
    
    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'checkForUpdates':
                    const updateResult = await this.checkForUpdates();
                    sendResponse({ success: true, updated: updateResult });
                    break;
                    
                case 'getConfig':
                    const config = await this.getStoredConfig();
                    sendResponse({ success: true, config });
                    break;
                    
                case 'logScriptExecution':
                    await this.logScriptExecution(
                        message.scriptId, 
                        message.success, 
                        message.error,
                        message.url
                    );
                    sendResponse({ success: true });
                    break;
                    
                case 'clearScriptCache':
                    await chrome.storage.local.set({ scriptCache: {} });
                    sendResponse({ success: true });
                    break;
                    
                case 'getScriptCache':
                    const cache = await chrome.storage.local.get(['scriptCache']);
                    sendResponse({ success: true, cache: cache.scriptCache || {} });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background message handling error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async checkForUpdates() {
        try {
            console.log('Checking for configuration updates from GitHub...');
            
            const response = await fetch('https://raw.githubusercontent.com/kristomi/bookmarklets/refs/heads/main/config.json', {
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const freshConfig = await response.json();
            const stored = await chrome.storage.local.get(['config', 'lastUpdate']);
            
            // Check if we have a new version
            const currentVersion = stored.config?.version || '0.0.0';
            const newVersion = freshConfig.version || '1.0.0';
            
            if (this.isNewerVersion(newVersion, currentVersion)) {
                console.log(`Configuration update available: ${currentVersion} → ${newVersion}`);
                
                await chrome.storage.local.set({
                    config: freshConfig,
                    lastUpdate: Date.now()
                });
                
                // Clear script cache to force fresh downloads
                await chrome.storage.local.set({ scriptCache: {} });
                
                // Show update notification
                this.showNotification(
                    'Scripts oppdatert!',
                    `Nye scripts og funksjoner er tilgjengelige (v${newVersion}). Script cache er tømt.`
                );
                
                return true;
            } else {
                console.log('Configuration is up to date');
                
                // Update last check time even if no updates
                await chrome.storage.local.set({ lastUpdate: Date.now() });
                return false;
            }
            
        } catch (error) {
            console.warn('Failed to check for updates:', error);
            return false;
        }
    }
    
    async getStoredConfig() {
        const stored = await chrome.storage.local.get(['config']);
        return stored.config || this.getDefaultConfig();
    }
    
    getDefaultConfig() {
        return {
            "title": "Kristomi's Scripts",
            "description": "Collection of useful scripts",
            "version": "1.0.0",
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
        
        return false; // Versions are equal
    }
    
    async migrateSettings(previousVersion) {
        console.log(`Migrating settings from version ${previousVersion}`);
        
        // Add any version-specific migration logic here
        // For example, if we change the config structure in the future
        
        const stored = await chrome.storage.local.get(['config']);
        if (stored.config) {
            // Ensure all required fields exist
            const updatedConfig = {
                ...this.getDefaultConfig(),
                ...stored.config
            };
            
            await chrome.storage.local.set({ config: updatedConfig });
        }
    }
    
    async logScriptExecution(scriptId, success, error) {
        try {
            const logs = await chrome.storage.local.get(['executionLogs']);
            const currentLogs = logs.executionLogs || [];
            
            const logEntry = {
                scriptId,
                success,
                error,
                timestamp: Date.now(),
                url: 'background' // Will be updated by content script
            };
            
            // Keep only last 100 log entries
            const updatedLogs = [logEntry, ...currentLogs].slice(0, 100);
            
            await chrome.storage.local.set({ executionLogs: updatedLogs });
        } catch (error) {
            console.error('Failed to log script execution:', error);
        }
    }
    
    setupPeriodicUpdates() {
        // Check for updates every 6 hours
        setInterval(() => {
            this.checkForUpdates();
        }, 6 * 60 * 60 * 1000);
        
        // Also check when browser starts after being idle
        chrome.idle.onStateChanged.addListener((state) => {
            if (state === 'active') {
                this.checkForUpdatesIfStale();
            }
        });
    }
    
    async checkForUpdatesIfStale() {
        const stored = await chrome.storage.local.get(['lastUpdate']);
        const lastUpdate = stored.lastUpdate || 0;
        const now = Date.now();
        
        // Check if it's been more than 2 hours since last update
        if (now - lastUpdate > 2 * 60 * 60 * 1000) {
            await this.checkForUpdates();
        }
    }
    
    setupContextMenu() {
        // Create context menu items for quick access
        chrome.contextMenus.create({
            id: 'kristomi-scripts-main',
            title: 'Kristomi\'s Scripts',
            contexts: ['page']
        });
        
        chrome.contextMenus.create({
            id: 'extract-kindle',
            parentId: 'kristomi-scripts-main',
            title: 'Extract Kindle Highlights',
            contexts: ['page'],
            documentUrlPatterns: ['*://read.amazon.com/kp/notebook*']
        });
        
        chrome.contextMenus.create({
            id: 'export-claude',
            parentId: 'kristomi-scripts-main',
            title: 'Export Claude Conversation',
            contexts: ['page'],
            documentUrlPatterns: ['*://claude.ai/*']
        });
        
        chrome.contextMenus.create({
            id: 'export-chatgpt',
            parentId: 'kristomi-scripts-main',
            title: 'Export ChatGPT Conversation',
            contexts: ['page'],
            documentUrlPatterns: ['*://chatgpt.com/*', '*://chat.openai.com/*']
        });
        
        // Handle context menu clicks
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }
    
    async handleContextMenuClick(info, tab) {
        const scriptMap = {
            'extract-kindle': 'kindle-highlights',
            'export-claude': 'claude-export', 
            'export-chatgpt': 'chatgpt-export'
        };
        
        const scriptId = scriptMap[info.menuItemId];
        if (scriptId) {
            try {
                // Send message to content script to run the script
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'runScript',
                    scriptId: scriptId,
                    scriptName: info.selectionText || scriptId
                });
            } catch (error) {
                console.error('Failed to run script from context menu:', error);
                this.showNotification(
                    'Script fejlet',
                    `Kunne ikke køre ${scriptId}: ${error.message}`
                );
            }
        }
    }
    
    showNotification(title, message) {
        // Check if we have notification permission
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: title,
            message: message
        }, (notificationId) => {
            if (chrome.runtime.lastError) {
                console.log('Notification failed:', chrome.runtime.lastError);
            }
        });
    }
    
    // Handle browser action (extension icon) click
    setupBrowserAction() {
        chrome.action.onClicked.addListener((tab) => {
            // Open popup (this is handled automatically by manifest.json)
            // This method is here for any additional click handling if needed
        });
    }
    
    // Analytics (optional) - track script usage anonymously
    async trackScriptUsage(scriptId, domain) {
        try {
            const stats = await chrome.storage.local.get(['usageStats']);
            const currentStats = stats.usageStats || {};
            
            const key = `${scriptId}_${domain}`;
            currentStats[key] = (currentStats[key] || 0) + 1;
            currentStats.lastUsed = Date.now();
            
            await chrome.storage.local.set({ usageStats: currentStats });
        } catch (error) {
            console.error('Failed to track usage:', error);
        }
    }
    
    // Clean up old data periodically
    async cleanupStorage() {
        try {
            const data = await chrome.storage.local.get(['executionLogs', 'usageStats']);
            
            // Clean execution logs older than 30 days
            if (data.executionLogs) {
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                const filteredLogs = data.executionLogs.filter(log => log.timestamp > thirtyDaysAgo);
                await chrome.storage.local.set({ executionLogs: filteredLogs });
            }
            
            console.log('Storage cleanup completed');
        } catch (error) {
            console.error('Storage cleanup failed:', error);
        }
    }
}

// Initialize background service
new BackgroundService();

// Clean up storage weekly
setInterval(() => {
    new BackgroundService().cleanupStorage();
}, 7 * 24 * 60 * 60 * 1000);