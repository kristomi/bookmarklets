javascript:(function() {
    'use strict';
    
    var configUrl = 'https://raw.githubusercontent.com/kristomi/bookmarklets/main/config.json';
    
    // Check if menu already exists and remove it
    var existingMenu = document.getElementById('bookmarklet-menu-overlay');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    // Show loading indicator
    var loader = document.createElement('div');
    loader.id = 'bookmarklet-loader';
    loader.style.cssText = `
        position: fixed; top: 20px; right: 20px; 
        background: #333; color: #fff; padding: 10px 15px; 
        border-radius: 5px; z-index: 999999; 
        font-family: Arial, sans-serif; font-size: 12px;
    `;
    loader.textContent = 'Loading...'; // Will be updated from config
    document.body.appendChild(loader);

    // Fetch configuration from GitHub
    fetch(configUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(config => {
            loader.textContent = config.ui.loadingText || '⏳ Loading scripts...';
            setTimeout(() => {
                document.body.removeChild(loader);
                showMenu(config);
            }, 200);
        })
        .catch(error => {
            document.body.removeChild(loader);
            console.error('Failed to load config:', error);
            alert('Failed to load script configuration: ' + error.message);
        });

    function showMenu(config) {
        var theme = config.theme || {};
        var colors = theme.colors || {};
        var spacing = theme.spacing || {};
        var ui = config.ui || {};
        
        // Create CSS animations
        var style = document.createElement('style');
        style.textContent = `
            @keyframes menuSlideIn {
                from { transform: scale(0.9) translateY(-20px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
            .bookmarklet-script-button:hover { 
                transform: translateY(-1px); 
                transition: ${theme.animations?.buttonTransition || 'all 0.2s ease'};
            }
            .bookmarklet-script-button:active { transform: translateY(0); }
        `;
        document.head.appendChild(style);

        // Create overlay
        var overlay = document.createElement('div');
        overlay.id = 'bookmarklet-menu-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: ${colors.overlay || 'rgba(0, 0, 0, 0.8)'}; z-index: 999999;
            display: flex; align-items: center; justify-content: center;
            font-family: ${theme.fonts?.primary || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
            ${ui.blurEffect ? 'backdrop-filter: blur(5px);' : ''}
        `;

        // Create menu container
        var menu = document.createElement('div');
        menu.style.cssText = `
            background: ${colors.background || '#ffffff'}; 
            border-radius: ${spacing.borderRadius || '12px'}; 
            box-shadow: ${theme.shadows?.menu || '0 20px 60px rgba(0, 0, 0, 0.3)'};
            max-width: ${ui.maxWidth || '450px'}; width: 90%; 
            max-height: ${ui.maxHeight || '80vh'}; 
            overflow-y: auto; 
            animation: ${theme.animations?.menuSlideIn || 'menuSlideIn 0.3s ease-out'};
        `;

        // Create header
        var header = document.createElement('div');
        header.style.cssText = `
            padding: ${spacing.headerPadding || '24px 24px 16px'}; 
            border-bottom: 1px solid ${colors.border || '#e5e7eb'};
            background: linear-gradient(135deg, ${colors.primary || '#667eea'} 0%, ${colors.secondary || '#764ba2'} 100%);
            color: white; 
            border-radius: ${spacing.borderRadius || '12px'} ${spacing.borderRadius || '12px'} 0 0;
        `;
        
        var headerContent = `
            <h2 style="margin: 0; font-size: 20px; font-weight: 600;">${config.title || 'Bookmarklet Scripts'}</h2>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${config.description || 'Select a script to run'}</p>
        `;
        
        if (ui.showVersion && config.version) {
            headerContent += `<p style="margin: 4px 0 0; opacity: 0.7; font-size: 12px;">v${config.version}</p>`;
        }
        
        header.innerHTML = headerContent;

        // Create content area
        var content = document.createElement('div');
        content.style.cssText = `padding: ${spacing.contentPadding || '20px 24px'};`;

        // Add script categories and buttons
        Object.keys(config.categories).forEach(function(categoryName) {
            var category = config.categories[categoryName];
            
            // Category header
            var categoryHeader = document.createElement('div');
            categoryHeader.style.cssText = `
                font-weight: 600; font-size: 14px; 
                color: ${colors.categoryText || '#374151'};
                margin: 16px 0 12px 0; text-transform: uppercase;
                letter-spacing: 0.5px;
            `;
            if (Object.keys(config.categories).indexOf(categoryName) === 0) {
                categoryHeader.style.marginTop = '0';
            }
            categoryHeader.textContent = categoryName;
            content.appendChild(categoryHeader);
            
            // Script buttons for this category
            Object.keys(category).forEach(function(scriptName) {
                var scriptUrl = category[scriptName];
                
                var button = document.createElement('button');
                button.className = 'bookmarklet-script-button';
                button.textContent = scriptName;
                button.style.cssText = `
                    display: block; width: 100%; margin: 8px 0; 
                    padding: ${spacing.buttonPadding || '14px 16px'};
                    border: 1px solid ${colors.border || '#d1d5db'}; 
                    background: ${colors.background || '#ffffff'}; 
                    color: ${colors.text || '#374151'};
                    border-radius: ${spacing.buttonRadius || '8px'}; 
                    cursor: pointer; font-size: 14px; font-weight: 500;
                    transition: ${theme.animations?.buttonTransition || 'all 0.2s ease'}; 
                    text-align: left;
                `;
                
                // Hover effects
                button.onmouseover = function() { 
                    this.style.background = colors.buttonHover || '#f3f4f6'; 
                    this.style.borderColor = colors.buttonHoverBorder || '#9ca3af';
                    this.style.boxShadow = theme.shadows?.button || '0 2px 8px rgba(0, 0, 0, 0.1)';
                };
                button.onmouseout = function() { 
                    this.style.background = colors.background || '#ffffff'; 
                    this.style.borderColor = colors.border || '#d1d5db';
                    this.style.boxShadow = 'none';
                };
                
                // Click handler
                button.onclick = function() {
                    loadScript(scriptUrl, scriptName, config);
                    closeMenu();
                };
                
                content.appendChild(button);
            });
        });

        // Add footer with close button
        var footer = document.createElement('div');
        footer.style.cssText = `
            padding: ${spacing.footerPadding || '16px 24px'}; 
            border-top: 1px solid ${colors.border || '#e5e7eb'}; 
            background: ${colors.buttonHover || '#f9fafb'}; 
            border-radius: 0 0 ${spacing.borderRadius || '12px'} ${spacing.borderRadius || '12px'};
        `;
        
        var closeButton = document.createElement('button');
        closeButton.textContent = ui.cancelText || 'Cancel';
        closeButton.style.cssText = `
            width: 100%; padding: 12px; 
            border: 1px solid ${colors.border || '#d1d5db'};
            background: ${colors.background || '#ffffff'}; 
            color: ${colors.textLight || '#6b7280'}; 
            border-radius: ${spacing.buttonRadius || '8px'};
            cursor: pointer; font-size: 14px; font-weight: 500;
            transition: ${theme.animations?.buttonTransition || 'all 0.2s ease'};
        `;
        closeButton.onmouseover = function() { 
            this.style.background = colors.buttonHover || '#f3f4f6'; 
            this.style.color = colors.text || '#374151';
        };
        closeButton.onmouseout = function() { 
            this.style.background = colors.background || '#ffffff'; 
            this.style.color = colors.textLight || '#6b7280';
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

        // Close on overlay click
        if (ui.showClickOutsideToClose !== false) {
            overlay.onclick = function(e) {
                if (e.target === overlay) {
                    closeMenu();
                }
            };
        }
        
        // Close on Escape key
        if (ui.showCloseOnEscape !== false) {
            var escapeHandler = function(e) {
                if (e.key === 'Escape') {
                    closeMenu();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        }
    }

    // Load script function using fetch + eval (bypasses CSP script-src)
    function loadScript(url, name, config) {
        var ui = config.ui || {};
        console.log('Attempting to load script:', name, 'from:', url);
        
        // Show loading indicator
        var loadingIndicator = document.createElement('div');
        loadingIndicator.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: ${config.theme?.colors?.primary || '#007cba'}; 
            color: white; padding: 8px 12px; 
            border-radius: 4px; z-index: 999999; 
            font-family: ${config.theme?.fonts?.primary || 'Arial, sans-serif'}; 
            font-size: 12px;
        `;
        loadingIndicator.textContent = `⏳ Loading ${name}...`;
        document.body.appendChild(loadingIndicator);
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(scriptContent => {
                // Remove loading indicator
                if (loadingIndicator.parentNode) {
                    document.body.removeChild(loadingIndicator);
                }
                
                console.log(ui.successPrefix || 'Successfully loaded script:', name);
                
                // Execute the script content
                try {
                    eval(scriptContent);
                    console.log('Successfully executed script:', name);
                } catch (execError) {
                    console.error('Script execution error:', execError);
                    alert('Script execution error in ' + name + ':\n\n' + execError.message);
                }
            })
            .catch(error => {
                // Remove loading indicator
                if (loadingIndicator.parentNode) {
                    document.body.removeChild(loadingIndicator);
                }
                
                console.error('Script load error for:', name, error);
                alert((ui.errorPrefix || 'Error loading script:') + ' ' + name + '\n\n' + error.message + '\n\nURL: ' + url);
            });
    }

})();