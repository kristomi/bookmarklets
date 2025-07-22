(function() {
    'use strict';
    
    // Base URL for your GitHub repo
    var baseUrl = 'https://raw.githubusercontent.com/kristomi/bookmarklets/main/scripts/';
    
    // Available scripts organized by category
    var scriptCategories = {
        'Scrapers': {
            'Kindle Highlights': baseUrl + 'scrapers/kindle-highlights.js'
        },
        'LLMs': {
            'Claude Export': baseUrl + 'llms/claude.js',
            'ChatGPT Export': baseUrl + 'llms/chatgpt.js'
        }
    };
    
    // Check if menu already exists and remove it
    var existingMenu = document.getElementById('bookmarklet-menu-overlay');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'bookmarklet-menu-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        backdrop-filter: blur(5px);
    `;
    
    // Create menu container
    var menu = document.createElement('div');
    menu.style.cssText = `
        background: #ffffff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 450px; width: 90%; max-height: 80vh; overflow-y: auto;
        animation: menuSlideIn 0.3s ease-out;
    `;
    
    // Add CSS animation
    var style = document.createElement('style');
    style.textContent = `
        @keyframes menuSlideIn {
            from { transform: scale(0.9) translateY(-20px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .script-button:hover { transform: translateY(-1px); }
        .script-button:active { transform: translateY(0); }
    `;
    document.head.appendChild(style);
    
    // Create header
    var header = document.createElement('div');
    header.style.cssText = `
        padding: 24px 24px 16px; border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white; border-radius: 12px 12px 0 0;
    `;
    header.innerHTML = `
        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">Bookmarklet Scripts</h2>
        <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Select a script to run on this page</p>
    `;
    
    // Create content area
    var content = document.createElement('div');
    content.style.cssText = 'padding: 20px 24px;';
    
    // Add script categories and buttons
    Object.keys(scriptCategories).forEach(function(categoryName) {
        var category = scriptCategories[categoryName];
        
        // Category header
        var categoryHeader = document.createElement('div');
        categoryHeader.style.cssText = `
            font-weight: 600; font-size: 14px; color: #374151;
            margin: 16px 0 12px 0; text-transform: uppercase;
            letter-spacing: 0.5px;
        `;
        if (Object.keys(scriptCategories).indexOf(categoryName) === 0) {
            categoryHeader.style.marginTop = '0';
        }
        categoryHeader.textContent = categoryName;
        content.appendChild(categoryHeader);
        
        // Script buttons for this category
        Object.keys(category).forEach(function(scriptName) {
            var scriptUrl = category[scriptName];
            
            var button = document.createElement('button');
            button.className = 'script-button';
            button.textContent = scriptName;
            button.style.cssText = `
                display: block; width: 100%; margin: 8px 0; padding: 14px 16px;
                border: 1px solid #d1d5db; background: #ffffff; color: #374151;
                border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;
                transition: all 0.2s ease; text-align: left;
            `;
            
            // Hover effects
            button.onmouseover = function() { 
                this.style.background = '#f3f4f6'; 
                this.style.borderColor = '#9ca3af';
                this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            };
            button.onmouseout = function() { 
                this.style.background = '#ffffff'; 
                this.style.borderColor = '#d1d5db';
                this.style.boxShadow = 'none';
            };
            
            // Click handler
            button.onclick = function() {
                loadScript(scriptUrl, scriptName);
                closeMenu();
            };
            
            content.appendChild(button);
        });
    });
    
    // Add footer with close button
    var footer = document.createElement('div');
    footer.style.cssText = 'padding: 16px 24px; border-top: 1px solid #e5e7eb; background: #f9fafb;';
    
    var closeButton = document.createElement('button');
    closeButton.textContent = 'Cancel';
    closeButton.style.cssText = `
        width: 100%; padding: 12px; border: 1px solid #d1d5db;
        background: #ffffff; color: #6b7280; border-radius: 8px;
        cursor: pointer; font-size: 14px; font-weight: 500;
        transition: all 0.2s ease;
    `;
    closeButton.onmouseover = function() { 
        this.style.background = '#f3f4f6'; 
        this.style.color = '#374151';
    };
    closeButton.onmouseout = function() { 
        this.style.background = '#ffffff'; 
        this.style.color = '#6b7280';
    };
    closeButton.onclick = closeMenu;
    
    footer.appendChild(closeButton);
    
    // Assemble menu
    menu.appendChild(header);
    menu.appendChild(content);
    menu.appendChild(footer);
    overlay.appendChild(menu);
    
    // Add to page
    document.body.appendChild(overlay);
    
    // Close menu function
    function closeMenu() {
        if (overlay && overlay.parentNode) {
            overlay.remove();
        }
        if (style && style.parentNode) {
            style.remove();
        }
    }
    
    // Load script function
    function loadScript(url, name) {
        var script = document.createElement('script');
        script.src = url;
        script.onerror = function() { 
            alert('Error loading script: ' + name + '\n\nURL: ' + url);
        };
        script.onload = function() {
            console.log('Successfully loaded script: ' + name);
        };
        document.head.appendChild(script);
    }
    
    // Close on overlay click
    overlay.onclick = function(e) {
        if (e.target === overlay) {
            closeMenu();
        }
    };
    
    // Close on Escape key
    var escapeHandler = function(e) {
        if (e.key === 'Escape') {
            closeMenu();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
})();