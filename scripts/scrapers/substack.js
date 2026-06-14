// Article to Markdown Converter
// Paste this into browser console to extract article content as markdown

(function() {
    function extractArticleMarkdown() {
        let markdown = '';
        
        // Find the main article container
        const article = document.querySelector('article.typography') || 
                       document.querySelector('article') || 
                       document.querySelector('.post-content') ||
                       document.querySelector('[role="article"]') ||
                       document.querySelector('main');
        
        if (!article) {
            console.warn('Could not find article container');
            return 'Article not found';
        }
        
        // Extract title
        const titleElement = article.querySelector('h1.post-title, h1, .post-title, .title') ||
                            document.querySelector('h1');
        
        if (titleElement) {
            markdown += `# ${titleElement.textContent.trim()}\n\n`;
        }
        
        // Extract subtitle if exists
        const subtitleElement = article.querySelector('h3.subtitle, .subtitle, h2') ||
                               titleElement?.nextElementSibling;
        
        if (subtitleElement && subtitleElement.tagName.match(/^H[2-6]$/)) {
            markdown += `## ${subtitleElement.textContent.trim()}\n\n`;
        }
        
        // Process all content elements in document order
        const walker = document.createTreeWalker(
            article,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function(node) {
                    // Accept headings, paragraphs, lists, quotes, images, tables, etc.
                    if (node.tagName && node.tagName.match(/^(H[1-6]|P|UL|OL|BLOCKQUOTE|PRE|IMG|TABLE|DIV)$/)) {
                        // Skip if it's a UI element
                        if (isUIElement(node)) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );
        
        const elementsToProcess = [];
        let node;
        while (node = walker.nextNode()) {
            // For DIVs, only process if they contain significant text content
            if (node.tagName === 'DIV') {
                const textContent = node.textContent.trim();
                const hasSignificantContent = textContent.length > 50;
                const hasNoBlockChildren = !node.querySelector('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, table');
                
                if (hasSignificantContent && hasNoBlockChildren) {
                    elementsToProcess.push(node);
                }
            } else {
                elementsToProcess.push(node);
            }
        }
        
        elementsToProcess.forEach(element => {
            const tagName = element.tagName.toLowerCase();
            const text = element.textContent.trim();
            
            // Skip if element is part of UI (navigation, buttons, etc.)
            if (isUIElement(element)) {
                return;
            }
            
            switch (tagName) {
                case 'h1':
                    if (!titleElement || element !== titleElement) {
                        markdown += `# ${text}\n\n`;
                    }
                    break;
                case 'h2':
                    if (!subtitleElement || element !== subtitleElement) {
                        markdown += `## ${text}\n\n`;
                    }
                    break;
                case 'h3':
                    if (!subtitleElement || element !== subtitleElement) {
                        markdown += `### ${text}\n\n`;
                    }
                    break;
                case 'h4':
                    markdown += `#### ${text}\n\n`;
                    break;
                case 'h5':
                    markdown += `##### ${text}\n\n`;
                    break;
                case 'h6':
                    markdown += `###### ${text}\n\n`;
                    break;
                case 'p':
                    if (text.length > 0) {
                        // Handle paragraphs with inline formatting
                        const formattedText = processInlineFormatting(element);
                        markdown += `${formattedText}\n\n`;
                    }
                    break;
                case 'ul':
                    markdown += processList(element, false) + '\n\n';
                    break;
                case 'ol':
                    markdown += processList(element, true) + '\n\n';
                    break;
                case 'blockquote':
                    const quoteLines = text.split('\n').map(line => `> ${line}`).join('\n');
                    markdown += `${quoteLines}\n\n`;
                    break;
                case 'pre':
                    markdown += `\`\`\`\n${text}\n\`\`\`\n\n`;
                    break;
                case 'img':
                    const alt = element.alt || 'Image';
                    let src = element.src || '';
                    
                    // Handle different image sources (src, data-src, srcset)
                    if (!src && element.dataset.src) {
                        src = element.dataset.src;
                    }
                    if (!src && element.srcset) {
                        // Extract the first URL from srcset
                        const srcsetMatch = element.srcset.match(/^\s*([^\s,]+)/);
                        if (srcsetMatch) {
                            src = srcsetMatch[1];
                        }
                    }
                    
                    if (src) {
                        // Convert relative URLs to absolute
                        if (src.startsWith('//')) {
                            src = window.location.protocol + src;
                        } else if (src.startsWith('/')) {
                            src = window.location.origin + src;
                        }
                        
                        markdown += `![${alt}](${src})\n\n`;
                    }
                    break;
                case 'div':
                    // Handle DIVs with significant text content
                    if (text.length > 0) {
                        const formattedText = processInlineFormatting(element);
                        markdown += `${formattedText}\n\n`;
                    }
                    break;
                case 'table':
                    markdown += processTable(element) + '\n\n';
                    break;
            }
        });
        
        // Also look for images in figure elements or picture elements
        const additionalImages = article.querySelectorAll('figure img, picture img, .image img');
        additionalImages.forEach(img => {
            if (!elementsToProcess.includes(img) && !isUIElement(img)) {
                const alt = img.alt || 'Image';
                let src = img.src || '';
                
                // Handle different image sources
                if (!src && img.dataset.src) {
                    src = img.dataset.src;
                }
                if (!src && img.srcset) {
                    const srcsetMatch = img.srcset.match(/^\s*([^\s,]+)/);
                    if (srcsetMatch) {
                        src = srcsetMatch[1];
                    }
                }
                
                if (src) {
                    // Convert relative URLs to absolute
                    if (src.startsWith('//')) {
                        src = window.location.protocol + src;
                    } else if (src.startsWith('/')) {
                        src = window.location.origin + src;
                    }
                    
                    markdown += `![${alt}](${src})\n\n`;
                }
            }
        });
        
        return markdown.trim();
    }
    
    function isUIElement(element) {
        // Check for common UI classes and roles
        const uiSelectors = [
            '.modal', '.popup', '.dropdown', '.menu', '.nav', '.header', '.footer',
            '.button', '.btn', '.subscribe', '.share', '.social', '.advertisement',
            '.sidebar', '.widget', '.form', '.search', '.pagination', '.breadcrumb',
            '[role="button"]', '[role="navigation"]', '[role="complementary"]',
            '[aria-hidden="true"]', '.hidden', '.sr-only'
        ];
        
        return uiSelectors.some(selector => {
            try {
                return element.matches(selector) || element.closest(selector);
            } catch (e) {
                return false;
            }
        });
    }
    
    function processInlineFormatting(element) {
        let html = element.innerHTML;
        
        // Convert common inline formatting
        html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
        html = html.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
        html = html.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
        html = html.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
        html = html.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
        html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
        
        // Remove remaining HTML tags
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }
    
    function processList(listElement, isOrdered) {
        let listMarkdown = '';
        const items = listElement.querySelectorAll('li');
        
        items.forEach((item, index) => {
            const text = processInlineFormatting(item);
            const prefix = isOrdered ? `${index + 1}. ` : '- ';
            listMarkdown += `${prefix}${text}\n`;
        });
        
        return listMarkdown;
    }
    
    function processTable(table) {
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) return '';
        
        let tableMarkdown = '';
        let headerProcessed = false;
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
            
            tableMarkdown += '| ' + cellTexts.join(' | ') + ' |\n';
            
            // Add separator after header row
            if (!headerProcessed) {
                tableMarkdown += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
                headerProcessed = true;
            }
        });
        
        return tableMarkdown;
    }
    
    function createModal(markdown) {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('markdown-converter-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'markdown-converter-modal';

        const API_URL = 'https://curator.midttom.me/api/content';
        const apiKey = localStorage.getItem('curator_api_key') || '';
        const hasApiKey = apiKey.length > 0;

        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    background: white;
                    border-radius: 8px;
                    width: 90%;
                    max-width: 800px;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                ">
                    <div style="
                        padding: 20px;
                        border-bottom: 1px solid #e1e5e9;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 8px;
                    ">
                        <h2 style="margin: 0; color: #1a1a1a; font-size: 18px;">Article Markdown</h2>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <button id="copy-markdown-btn" style="
                                background: #007cba;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Copy</button>
                            <button id="download-markdown-btn" style="
                                background: #28a745;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Download</button>
                            <button id="ss-post-api-btn" style="
                                background: ${hasApiKey ? '#8b5cf6' : '#6b7280'};
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Post to Curator</button>
                            <button id="close-modal-btn" style="
                                background: #6c757d;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Close</button>
                        </div>
                    </div>
                    <div id="ss-api-status" style="
                        display: none;
                        padding: 10px 20px;
                        font-size: 13px;
                        border-bottom: 1px solid #e1e5e9;
                    "></div>
                    <div style="
                        padding: 20px;
                        overflow-y: auto;
                        flex: 1;
                    ">
                        <input id="ss-title-input" type="text" value="${document.title.replace(/"/g, '&quot;')}" style="
                            width: 100%;
                            padding: 10px 12px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                            font-weight: 600;
                            box-sizing: border-box;
                            margin-bottom: 10px;
                        ">
                        <textarea id="markdown-content" style="
                            width: 100%;
                            height: 400px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            padding: 12px;
                            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                            font-size: 12px;
                            line-height: 1.4;
                            resize: vertical;
                            box-sizing: border-box;
                        ">${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                        <div style="
                            margin-top: 12px;
                            color: #666;
                            font-size: 12px;
                        ">
                            ${markdown.split(/\s+/).filter(w => w).length} words |
                            ${markdown.length} characters
                            ${hasApiKey ? '' : ' | Click "Post to Curator" to set your API key'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const getContent = () => modal.querySelector('#markdown-content').value;

        // Copy
        modal.querySelector('#copy-markdown-btn').addEventListener('click', async function() {
            const btn = this;
            try {
                await navigator.clipboard.writeText(getContent());
            } catch (err) {
                modal.querySelector('#markdown-content').select();
                document.execCommand('copy');
            }
            btn.textContent = 'Copied!';
            btn.style.background = '#28a745';
            setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = '#007cba'; }, 2000);
        });

        // Download
        modal.querySelector('#download-markdown-btn').addEventListener('click', function() {
            const btn = this;
            const titleElement = document.querySelector('h1.post-title, h1, .post-title, .title') ||
                                 document.querySelector('h1');
            let filename = 'article.md';

            if (titleElement) {
                let title = titleElement.textContent.trim()
                    .replace(/[<>:"/\\|?*]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/^-+|-+$/g, '')
                    .substring(0, 100);
                if (title.length === 0) title = 'article';
                const timestamp = new Date().toISOString().slice(0, 10);
                filename = `${title}-${timestamp}.md`;
            }

            const blob = new Blob([getContent()], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            btn.textContent = 'Downloaded!';
            btn.style.background = '#218838';
            setTimeout(() => { btn.textContent = 'Download'; btn.style.background = '#28a745'; }, 2000);
        });

        // Post to Curator API
        modal.querySelector('#ss-post-api-btn').addEventListener('click', async function() {
            const btn = this;
            const statusEl = modal.querySelector('#ss-api-status');
            const currentApiKey = localStorage.getItem('curator_api_key') || '';

            if (!currentApiKey) {
                statusEl.style.display = 'block';
                statusEl.style.background = '#fffbeb';
                statusEl.style.color = '#92400e';
                statusEl.innerHTML = `
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="white-space:nowrap; font-weight:600;">API Key:</label>
                        <input id="ss-api-key-input" type="password" placeholder="Paste your API key" style="
                            flex:1; padding:6px 10px; border:1px solid #d1d5db; border-radius:4px;
                            font-size:13px; font-family:monospace;
                        ">
                        <button id="ss-save-key-btn" style="
                            background:#8b5cf6; color:white; border:none; padding:6px 14px;
                            border-radius:4px; cursor:pointer; font-size:13px; white-space:nowrap;
                        ">Save</button>
                    </div>`;
                const keyInput = statusEl.querySelector('#ss-api-key-input');
                keyInput.focus();
                const saveKey = () => {
                    const key = keyInput.value.trim();
                    if (key) {
                        localStorage.setItem('curator_api_key', key);
                        statusEl.style.background = '#dcfce7';
                        statusEl.style.color = '#166534';
                        statusEl.textContent = 'API key saved! Click "Post to Curator" again.';
                        btn.style.background = '#8b5cf6';
                    }
                };
                statusEl.querySelector('#ss-save-key-btn').addEventListener('click', saveKey);
                keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKey(); });
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Posting...';
            btn.style.opacity = '0.7';
            statusEl.style.display = 'block';
            statusEl.style.background = '#eff6ff';
            statusEl.style.color = '#1e40af';
            statusEl.textContent = 'Sending to Curator...';

            try {
                const descMeta = document.querySelector('meta[property="og:description"]') ||
                                document.querySelector('meta[name="description"]');
                const payload = {
                    url: window.location.href,
                    title: modal.querySelector('#ss-title-input').value.trim(),
                    description: descMeta ? descMeta.content.trim() : null,
                    content_text: getContent()
                };

                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentApiKey}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const body = await response.text();
                    throw new Error(`HTTP ${response.status}: ${body}`);
                }

                statusEl.style.background = '#dcfce7';
                statusEl.style.color = '#166534';
                statusEl.textContent = `Saved to Curator (${response.status})`;
                btn.textContent = 'Saved!';
                btn.style.background = '#28a745';
                setTimeout(() => {
                    btn.textContent = 'Post to Curator';
                    btn.style.background = '#8b5cf6';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }, 3000);
            } catch (err) {
                statusEl.style.background = '#fef2f2';
                statusEl.style.color = '#991b1b';
                statusEl.textContent = `Error: ${err.message}`;
                btn.textContent = 'Failed';
                btn.style.background = '#dc2626';
                setTimeout(() => {
                    btn.textContent = 'Post to Curator';
                    btn.style.background = '#8b5cf6';
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }, 3000);
            }
        });

        // Close
        modal.querySelector('#close-modal-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal.firstElementChild) modal.remove(); });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }
    
    // Execute the extraction
    const markdown = extractArticleMarkdown();
    
    // Show modal with results
    createModal(markdown);
    
    // Also log to console for debugging
    console.log('✅ Article markdown extracted and displayed in modal');
    
    // Return the markdown for programmatic access
    return markdown;
})();