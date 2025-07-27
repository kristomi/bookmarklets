#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class ExtensionBuilder {
    constructor() {
        this.rootDir = __dirname;
        this.scriptsDir = path.join(this.rootDir, 'scripts');
        this.extensionDir = path.join(this.rootDir, 'extension');
        this.configPath = path.join(this.rootDir, 'config.json');
        this.buildDir = path.join(this.rootDir, 'build');
    }

    async build() {
        console.log('🚀 Building Kristomi\'s Scripts Extension...\n');

        try {
            // Clean and create build directory
            this.cleanBuildDir();
            this.createBuildDir();

            // Load config
            const config = this.loadConfig();
            console.log(`📋 Loaded config v${config.version}`);

            // Bundle scripts
            const bundledScripts = this.bundleScripts(config);
            console.log(`📦 Bundled ${Object.keys(bundledScripts).length} scripts`);

            // Copy extension files
            this.copyExtensionFiles();
            console.log('📁 Copied extension files');

            // Generate bundled script files
            this.generateBundledScripts(bundledScripts);
            console.log('🔗 Generated bundled script files');

            // Update manifest
            this.updateManifest(config);
            console.log('📝 Updated manifest.json');

            // Update popup files
            this.updatePopupFiles(config, bundledScripts);
            console.log('🎨 Updated popup files');

            console.log(`\n✅ Build complete! Extension ready in: ${this.buildDir}`);
            console.log('\n📦 To install:');
            console.log('1. Open Chrome and go to chrome://extensions/');
            console.log('2. Enable "Developer mode"');
            console.log('3. Click "Load unpacked" and select the build folder');

        } catch (error) {
            console.error('❌ Build failed:', error.message);
            process.exit(1);
        }
    }

    cleanBuildDir() {
        if (fs.existsSync(this.buildDir)) {
            fs.rmSync(this.buildDir, { recursive: true, force: true });
        }
    }

    createBuildDir() {
        fs.mkdirSync(this.buildDir, { recursive: true });
    }

    loadConfig() {
        const configContent = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configContent);
    }

    bundleScripts(config) {
        const bundledScripts = {};

        for (const [scriptId, scriptConfig] of Object.entries(config.scripts)) {
            // Derive filename from script key name (e.g., "substack-export" -> "substack.js")
            const filename = this.deriveFilename(scriptId);
            const scriptPath = this.findScriptFile(filename);

            if (scriptPath) {
                const scriptContent = fs.readFileSync(scriptPath, 'utf8');
                bundledScripts[scriptId] = {
                    ...scriptConfig,
                    content: scriptContent,
                    filename: filename
                };
                console.log(`  ✓ ${scriptConfig.name} (${filename})`);
            } else {
                console.warn(`  ⚠️  Script file not found: ${filename}`);
            }
        }

        return bundledScripts;
    }

    deriveFilename(scriptId) {
        // Convert script key to filename automatically
        // e.g., "substack-export" -> "substack.js"
        // e.g., "kindle-highlights" -> "kindle-highlights.js"
        // e.g., "claude-export" -> "claude.js"
        // e.g., "chatgpt-export" -> "chatgpt.js"
        
        // For *-export scripts, remove the "-export" suffix
        if (scriptId.endsWith('-export')) {
            return scriptId.replace('-export', '.js');
        }
        
        // For all other scripts, just add .js
        return `${scriptId}.js`;
    }

    findScriptFile(filename) {
        // Search for the script file in the scripts directory
        const searchDirs = [
            this.scriptsDir,
            path.join(this.scriptsDir, 'llms'),
            path.join(this.scriptsDir, 'scrapers')
        ];

        for (const dir of searchDirs) {
            const filePath = path.join(dir, filename);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }

        return null;
    }

    copyExtensionFiles() {
        // Copy all files from extension directory except those we'll regenerate
        const filesToCopy = ['background.js'];
        
        for (const file of filesToCopy) {
            const srcPath = path.join(this.extensionDir, file);
            const destPath = path.join(this.buildDir, file);
            
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    generateBundledScripts(bundledScripts) {
        // Create individual script files for each script
        Object.entries(bundledScripts).forEach(([scriptId, script]) => {
            const fileName = `script_${scriptId.replace(/[^a-zA-Z0-9]/g, '_')}.js`;
            const scriptContent = `// Auto-generated script: ${script.name}
${script.content}
`;
            fs.writeFileSync(path.join(this.buildDir, fileName), scriptContent);
        });

        // Also create the bundled-scripts.js for metadata (in case we need it later)
        const scriptMetadata = Object.fromEntries(
            Object.entries(bundledScripts).map(([scriptId, script]) => [
                scriptId, 
                {
                    name: script.name,
                    category: script.category,
                    description: script.description,
                    filename: script.filename,
                    scriptFile: `script_${scriptId.replace(/[^a-zA-Z0-9]/g, '_')}.js`
                }
            ])
        );

        const bundleContent = `// Auto-generated script metadata
window.SCRIPT_METADATA = ${JSON.stringify(scriptMetadata, null, 2)};
`;

        fs.writeFileSync(path.join(this.buildDir, 'bundled-scripts.js'), bundleContent);
    }

    updateManifest(config) {
        const manifestPath = path.join(this.extensionDir, 'manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        // Update version and description
        manifest.version = config.version;
        manifest.description = config.description;

        // Ensure bundled-scripts.js is included in content scripts
        const contentScript = manifest.content_scripts[0];
        if (!contentScript.js.includes('bundled-scripts.js')) {
            contentScript.js.unshift('bundled-scripts.js');
        }

        fs.writeFileSync(
            path.join(this.buildDir, 'manifest.json'), 
            JSON.stringify(manifest, null, 2)
        );
    }

    updatePopupFiles(config, bundledScripts) {
        // Create simplified popup.html
        const popupHtml = this.generatePopupHtml(config);
        fs.writeFileSync(path.join(this.buildDir, 'popup.html'), popupHtml);

        // Create simplified popup.js
        const popupJs = this.generatePopupJs(config, bundledScripts);
        fs.writeFileSync(path.join(this.buildDir, 'popup.js'), popupJs);
    }

    generatePopupHtml(config) {
        const { colors, fonts, spacing } = config.theme;
        
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {
            width: 350px;
            padding: 0;
            margin: 0;
            font-family: ${fonts.primary};
        }
        
        .header {
            background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);
            color: white;
            padding: ${spacing.headerPadding};
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .header p {
            margin: 4px 0 0;
            opacity: 0.9;
            font-size: 12px;
        }
        
        .content {
            padding: ${spacing.contentPadding};
        }
        
        .category {
            margin-bottom: 16px;
        }
        
        .category-title {
            font-weight: 600;
            font-size: 12px;
            color: ${colors.textLight};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        
        .script-button {
            width: 100%;
            padding: ${spacing.buttonPadding};
            border: 1px solid ${colors.border};
            border-radius: ${spacing.buttonRadius};
            background: white;
            cursor: pointer;
            text-align: left;
            margin-bottom: 8px;
            transition: ${config.theme.animations.buttonTransition};
            display: block;
        }
        
        .script-button:hover {
            background: ${colors.buttonHover};
            border-color: ${colors.buttonHoverBorder};
        }
        
        .script-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .script-name {
            font-weight: 600;
            color: ${colors.text};
            font-size: 14px;
        }
        
        .script-description {
            color: ${colors.textLight};
            font-size: 12px;
            margin-top: 2px;
        }
        
        .script-sites {
            color: ${colors.textLight};
            font-size: 11px;
            font-family: ${fonts.mono};
            margin-top: 4px;
        }
        
        .status {
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            margin-bottom: 16px;
            text-align: center;
        }
        
        .status.success {
            background: #dcfce7;
            color: #166534;
        }
        
        .status.error {
            background: #fef2f2;
            color: #991b1b;
        }
        
        .status.info {
            background: #eff6ff;
            color: #1e40af;
        }
        
        .footer {
            padding: ${spacing.footerPadding};
            border-top: 1px solid ${colors.border};
            text-align: center;
            color: ${colors.textLight};
            font-size: 11px;
        }
        
        .current-site {
            font-family: ${fonts.mono};
            font-size: 11px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${config.title}</h1>
        <p>${config.description}</p>
        <div class="current-site" id="current-site">Loading...</div>
    </div>
    
    <div class="content">
        <div id="status" class="status info" style="display: none;">Ready</div>
        <div id="scripts-container">Loading scripts...</div>
    </div>
    
    <div class="footer">
        Version ${config.version} • Built ${new Date().toLocaleDateString()}
    </div>
    
    <script src="popup.js"></script>
</body>
</html>`;
    }

    generatePopupJs(config, bundledScripts) {
        // Generate script metadata with script file names
        const scriptsWithFiles = Object.fromEntries(
            Object.entries(bundledScripts).map(([scriptId, script]) => [
                scriptId, 
                {
                    name: script.name,
                    category: script.category,
                    description: script.description,
                    filename: script.filename,
                    scriptFile: `script_${scriptId.replace(/[^a-zA-Z0-9]/g, '_')}.js`
                }
            ])
        );

        return `// Simplified popup script for bundled extension
class ScriptManager {
    constructor() {
        this.config = ${JSON.stringify(config, null, 4)};
        this.scripts = ${JSON.stringify(scriptsWithFiles, null, 4)};
        this.currentTab = null;
        this.init();
    }
    
    async init() {
        await this.getCurrentTab();
        this.updateUI();
        this.showStatus('Ready', 'success');
    }
    
    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
        
        const siteInfo = document.getElementById('current-site');
        if (tab) {
            const domain = new URL(tab.url).hostname;
            siteInfo.textContent = \`Current site: \${domain}\`;
        }
    }
    
    updateUI() {
        const container = document.getElementById('scripts-container');
        container.innerHTML = '';
        
        // Group scripts by category
        const categories = {};
        for (const [scriptId, script] of Object.entries(this.scripts)) {
            const category = script.category || 'Other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({ id: scriptId, ...script });
        }
        
        // Render categories
        for (const [categoryName, scripts] of Object.entries(categories)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'category-title';
            titleDiv.textContent = categoryName;
            categoryDiv.appendChild(titleDiv);
            
            scripts.forEach(script => {
                const button = this.createScriptButton(script);
                categoryDiv.appendChild(button);
            });
            
            container.appendChild(categoryDiv);
        }
    }
    
    createScriptButton(script) {
        const button = document.createElement('button');
        button.className = 'script-button';
        
        const isCompatible = this.isScriptCompatible(script);
        button.disabled = !isCompatible;
        
        button.innerHTML = \`
            <div class="script-name">\${script.name}</div>
            <div class="script-description">\${script.description}</div>
        \`;
        
        if (isCompatible) {
            button.addEventListener('click', () => this.runScript(script));
        }
        
        return button;
    }
    
    isScriptCompatible(script) {
        // Allow all scripts to run on any site
        return true;
    }
    
    async runScript(script) {
        try {
            this.showStatus(\`Running \${script.name}...\`, 'info');
            
            const results = await chrome.scripting.executeScript({
                target: { tabId: this.currentTab.id },
                files: [script.scriptFile]
            });
            
            this.showStatus(\`\${script.name} executed successfully\`, 'success');
            
            // Close popup after a delay
            setTimeout(() => {
                window.close();
            }, 1500);
            
        } catch (error) {
            console.error('Script execution failed:', error);
            this.showStatus(\`Error running \${script.name}: \${error.message}\`, 'error');
        }
    }
    
    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = \`status \${type}\`;
        statusElement.style.display = 'block';
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }
}

// Initialize when popup loads
document.addEventListener('DOMContentLoaded', () => {
    new ScriptManager();
});`;
    }
}

// Run the build
if (require.main === module) {
    const builder = new ExtensionBuilder();
    builder.build();
}

module.exports = ExtensionBuilder;
