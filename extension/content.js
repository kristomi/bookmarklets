// Content script - downloads and executes scripts from GitHub
class ScriptRunner {
    constructor() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'runScript') {
                this.executeScript(message.scriptUrl, message.scriptName)
                    .then(result => sendResponse({ success: true, result }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Indicate async response
            }
        });
    }
    
    async executeScript(scriptUrl, scriptName) {
        console.log(`Executing script: ${scriptName} from URL: ${scriptUrl}`);
        
        try {
            // Show loading indicator
            const loadingIndicator = this.createLoadingIndicator(scriptName);
            document.body.appendChild(loadingIndicator);
            
            // Download and execute script
            const scriptCode = await this.downloadScript(scriptUrl, scriptName);
            const result = await this.runScriptCode(scriptCode, scriptName);
            
            // Remove loading indicator
            if (loadingIndicator.parentNode) {
                document.body.removeChild(loadingIndicator);
            }
            
            console.log(`Script ${scriptName} completed successfully`);
            return result;
            
        } catch (error) {
            // Remove loading indicator on error
            const loadingIndicator = document.getElementById('extension-loading-indicator');
            if (loadingIndicator && loadingIndicator.parentNode) {
                document.body.removeChild(loadingIndicator);
            }
            
            console.error(`Script ${scriptName} failed:`, error);
            throw error;
        }
    }
    
    async downloadScript(url, scriptName) {
        console.log(`Downloading script from: ${url}`);
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const scriptCode = await response.text();
            console.log(`Successfully downloaded script: ${scriptName} (${scriptCode.length} chars)`);
            return scriptCode;
            
        } catch (error) {
            throw new Error(`Failed to download script ${scriptName}: ${error.message}`);
        }
    }
    
    async runScriptCode(scriptCode, scriptName) {
        try {
            // Create a safe execution context
            const scriptFunction = new Function(
                'document', 'window', 'console', 'alert', 'confirm', 'prompt',
                scriptCode
            );
            
            // Execute the script with limited globals
            const result = await scriptFunction.call(
                null, // this context
                document,
                window, 
                console,
                alert.bind(window),
                confirm.bind(window), 
                prompt.bind(window)
            );
            
            return result;
            
        } catch (error) {
            throw new Error(`Script execution error in ${scriptName}: ${error.message}`);
        }
    }
    
    createLoadingIndicator(scriptName) {
        const existing = document.getElementById('extension-loading-indicator');
        if (existing) {
            existing.remove();
        }
        
        const indicator = document.createElement('div');
        indicator.id = 'extension-loading-indicator';
        indicator.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; padding: 12px 16px; 
            border-radius: 8px; z-index: 999999; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            font-size: 14px; font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            display: flex; align-items: center; gap: 8px;
            animation: slideIn 0.3s ease-out;
        `;
        
        indicator.innerHTML = `
            <div style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <span>Loading ${scriptName}...</span>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            </style>
        `;
        
        return indicator;
    }
    
    // Cache management
    clearCache() {
        this.scriptCache.clear();
        console.log('Script cache cleared');
    }
    
    getCacheInfo() {
        const cacheInfo = [];
        this.scriptCache.forEach((value, key) => {
            cacheInfo.push({
                url: key,
                size: value.code.length,
                age: Math.round((Date.now() - value.timestamp) / 1000),
                expired: (Date.now() - value.timestamp) > this.cacheTimeout
            });
        });
        return cacheInfo;
    }
}

// Initialize script runner
new ScriptRunner();