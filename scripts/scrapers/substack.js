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
                    max-height: 80vh;
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
                    ">
                        <h2 style="margin: 0; color: #1a1a1a; font-size: 18px;">Article Markdown</h2>
                        <div>
                            <button id="copy-markdown-btn" style="
                                background: #007cba;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                margin-right: 8px;
                                font-size: 14px;
                            ">Copy to Clipboard</button>
                            <button id="download-markdown-btn" style="
                                background: #28a745;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                margin-right: 8px;
                                font-size: 14px;
                            ">Download</button>
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
                    <div style="
                        padding: 20px;
                        overflow-y: auto;
                        flex: 1;
                    ">
                        <textarea id="markdown-content" readonly style="
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
                        ">${markdown}</textarea>
                        <div style="
                            margin-top: 12px;
                            color: #666;
                            font-size: 12px;
                        ">
                            Word count: ${markdown.split(/\s+/).length} words | 
                            Character count: ${markdown.length} characters
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        const copyBtn = modal.querySelector('#copy-markdown-btn');
        const downloadBtn = modal.querySelector('#download-markdown-btn');
        const closeBtn = modal.querySelector('#close-modal-btn');
        const textarea = modal.querySelector('#markdown-content');
        
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(markdown);
                copyBtn.textContent = 'Copied!';
                copyBtn.style.background = '#28a745';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy to Clipboard';
                    copyBtn.style.background = '#007cba';
                }, 2000);
            } catch (err) {
                // Fallback: select text
                textarea.select();
                document.execCommand('copy');
                copyBtn.textContent = 'Copied!';
                copyBtn.style.background = '#28a745';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy to Clipboard';
                    copyBtn.style.background = '#007cba';
                }, 2000);
            }
        });
        
        downloadBtn.addEventListener('click', () => {
            // Get the page title for filename
            const titleElement = document.querySelector('h1.post-title, h1, .post-title, .title') ||
                                 document.querySelector('h1');
            let filename = 'article.md';
            
            if (titleElement) {
                // Clean the title for use as filename
                let title = titleElement.textContent.trim()
                    .replace(/[<>:"/\\|?*]/g, '') // Remove only illegal filename characters
                    .replace(/\s+/g, '-') // Replace spaces with hyphens
                    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
                    .substring(0, 100); // Limit length to 100 characters
                
                // Ensure we have a valid filename
                if (title.length === 0) {
                    title = 'article';
                }
                
                // Add timestamp for uniqueness
                const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
                filename = `${title}-${timestamp}.md`;
            }
            
            // Create blob and download
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Visual feedback
            downloadBtn.textContent = 'Downloaded!';
            downloadBtn.style.background = '#218838';
            setTimeout(() => {
                downloadBtn.textContent = 'Download';
                downloadBtn.style.background = '#28a745';
            }, 2000);
        });
        
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Close on Escape key
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