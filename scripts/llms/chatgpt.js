(function() {
    'use strict';
    
    // Check if we're on ChatGPT
    if (!window.location.href.includes('chatgpt.com') && !window.location.href.includes('chat.openai.com')) {
        alert('⚠️ Dette scriptet fungerer kun på ChatGPT (chatgpt.com eller chat.openai.com)');
        return;
    }
    
    // Check if script is already running
    if (window.chatgptExportRunning) {
        alert('📝 ChatGPT export er allerede i gang...');
        return;
    }
    
    // Show confirmation
    const userConfirmed = confirm(`📝 ChatGPT Conversation Export
    
Dette scriptet vil:
• Samle hele HTML-innholdet fra denne samtalen
• Konvertere til markdown med footnotes for kilder
• Laste ned som .md-fil

Vil du fortsette?`);
    
    if (!userConfirmed) {
        return;
    }
    
    // Set running flag
    window.chatgptExportRunning = true;
    
    // Create progress indicator
    const progressIndicator = createProgressIndicator();
    document.body.appendChild(progressIndicator);
    
    try {
        updateProgress('📖 Henter samtaledata...', 20);
        
        // Get the full HTML content of the page
        const fullHTML = document.documentElement.outerHTML;
        
        updateProgress('🔍 Analyserer meldinger...', 40);
        
        // Parse the HTML content
        const messages = parseHTMLContent(fullHTML);
        
        if (messages.length === 0) {
            throw new Error('Ingen meldinger funnet. Sørg for at samtalen er lastet.');
        }
        
        updateProgress('📝 Genererer markdown...', 70);
        
        // Generate markdown
        const markdown = generateMarkdown(messages);
        
        updateProgress('💾 Laster ned fil...', 90);
        
        // Download as file
        downloadMarkdown(markdown);
        
        updateProgress('✅ Ferdig!', 100);
        
        setTimeout(() => {
            progressIndicator.remove();
            window.chatgptExportRunning = false;
            
            alert(`🎉 Export fullført!
            
📊 Resultat:
• ${messages.length} meldinger eksportert
• Kilder konvertert til footnotes
• Fil lastet ned som markdown

Sjekk nedlastingsmappen din!`);
        }, 1500);
        
    } catch (error) {
        progressIndicator.remove();
        window.chatgptExportRunning = false;
        console.error('Export failed:', error);
        alert(`❌ En feil oppstod under exporten:
        
${error.message}

Prøv å:
• Oppdatere siden og prøv igjen
• Sørg for at samtalen er helt lastet
• Sjekk at det er meldinger synlige på siden`);
    }
    
    function createProgressIndicator() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.8); z-index: 999999;
            display: flex; align-items: center; justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        const progressBox = document.createElement('div');
        progressBox.style.cssText = `
            background: white; padding: 30px; border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center; min-width: 300px;
        `;
        
        progressBox.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 16px;">🤖</div>
            <h3 style="margin: 0 0 16px 0; color: #333;">Eksporterer ChatGPT Samtale</h3>
            <div id="chatgpt-progress-text" style="color: #666; margin-bottom: 20px;">Starter...</div>
            <div style="background: #f0f0f0; border-radius: 10px; overflow: hidden; margin-bottom: 16px;">
                <div id="chatgpt-progress-bar" style="width: 0%; height: 8px; background: linear-gradient(90deg, #10a37f, #1a7f64); transition: width 0.3s ease;"></div>
            </div>
            <div style="font-size: 12px; color: #999;">Ikke lukk fanen mens scriptet kjører</div>
        `;
        
        overlay.appendChild(progressBox);
        return overlay;
    }
    
    function updateProgress(text, percentage) {
        const progressText = document.getElementById('chatgpt-progress-text');
        const progressBar = document.getElementById('chatgpt-progress-bar');
        if (progressText) progressText.textContent = text;
        if (progressBar) progressBar.style.width = percentage + '%';
    }
    
    // URL cleaning function
    function cleanUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // Remove UTM parameters and other tracking parameters
            const paramsToRemove = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'fbclid', 'gclid', 'mc_cid', 'mc_eid', '_ga', '_gl'
            ];
            paramsToRemove.forEach(param => {
                urlObj.searchParams.delete(param);
            });
            
            // Remove scroll-to-text fragments (#:~:text=...)
            if (urlObj.hash.includes(':~:text=')) {
                urlObj.hash = '';
            }
            
            // Clean up empty query string
            if (urlObj.search === '?') {
                urlObj.search = '';
            }
            
            return urlObj.toString();
        } catch (e) {
            // If URL parsing fails, try basic cleaning with regex
            let cleanedUrl = url;
            
            // Remove common tracking parameters with regex
            cleanedUrl = cleanedUrl.replace(/[?&](utm_[^&=]*=[^&]*)/gi, '');
            cleanedUrl = cleanedUrl.replace(/[?&](fbclid=[^&]*)/gi, '');
            cleanedUrl = cleanedUrl.replace(/[?&](gclid=[^&]*)/gi, '');
            
            // Remove scroll-to-text fragments
            cleanedUrl = cleanedUrl.replace(/#:~:text=[^#]*/gi, '');
            
            // Clean up leftover query separators
            cleanedUrl = cleanedUrl.replace(/[?&]&/g, '?');
            cleanedUrl = cleanedUrl.replace(/[?]$/g, '');
            cleanedUrl = cleanedUrl.replace(/[&]$/g, '');
            
            return cleanedUrl;
        }
    }
    
    function decodeHTMLEntities(text) {
        const entities = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&nbsp;': ' ',
            '&mdash;': '—',
            '&ndash;': '–',
            '&hellip;': '…',
            '&copy;': '©',
            '&reg;': '®',
            '&trade;': '™'
        };
        
        for (const [entity, char] of Object.entries(entities)) {
            text = text.replace(new RegExp(entity, 'g'), char);
        }
        
        text = text.replace(/&#(\d+);/g, (match, dec) => {
            return String.fromCharCode(dec);
        });
        
        text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
        });
        
        return text;
    }
    
    function parseHTMLContent(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const messages = [];
        
        // ChatGPT specific selectors
        const selectors = [
            '[data-message-author-role]',
            '.text-message',
            '.message-content',
            '[class*="message"]',
            'div[class*="prose"]'
        ];
        
        let messageElements = null;
        for (const selector of selectors) {
            messageElements = doc.querySelectorAll(selector);
            if (messageElements.length > 0) break;
        }
        
        // Fallback to content analysis
        if (!messageElements || messageElements.length === 0) {
            const allDivs = doc.querySelectorAll('div');
            const potentialMessages = [];
            
            allDivs.forEach(div => {
                const text = div.textContent.trim();
                if (text.length > 50 && text.length < 50000) {
                    const hasCodeBlocks = div.querySelector('pre') || div.querySelector('code');
                    const hasLinks = div.querySelector('a');
                    const hasFormatting = div.querySelector('strong') || div.querySelector('em');
                    
                    if (hasCodeBlocks || hasLinks || hasFormatting || text.includes('\n')) {
                        potentialMessages.push(div);
                    }
                }
            });
            
            messageElements = potentialMessages;
        }
        
        messageElements.forEach((el, index) => {
            let role = 'Unknown';
            const roleAttr = el.getAttribute('data-message-author-role');
            if (roleAttr) {
                role = roleAttr === 'user' ? 'User' : 'Assistant';
            } else {
                role = index % 2 === 0 ? 'User' : 'Assistant';
            }
            
            // Extract content
            let content = '';
            const contentContainers = [
                '.markdown',
                '[data-message-content]',
                '.prose',
                '.content',
                '.text'
            ];
            
            let contentEl = null;
            for (const selector of contentContainers) {
                contentEl = el.querySelector(selector);
                if (contentEl) break;
            }
            
            if (!contentEl) {
                contentEl = el;
            }
            
            // Get content HTML
            if (contentEl === el && el.children.length > 0) {
                const clone = contentEl.cloneNode(true);
                const uiSelectors = ['button', 'nav', '[class*="toolbar"]', '[class*="actions"]'];
                uiSelectors.forEach(selector => {
                    clone.querySelectorAll(selector).forEach(elem => elem.remove());
                });
                content = clone.innerHTML;
            } else {
                content = contentEl.innerHTML || contentEl.textContent || '';
            }
            
            // Convert to markdown
            content = htmlToMarkdown(content);
            
            if (content.trim()) {
                messages.push({
                    role: role,
                    content: content
                });
            }
        });
        
        return messages;
    }
    
    function htmlToMarkdown(html) {
        const footnoteLinks = new Map();
        let footnoteCounter = 1;
        
        // Handle code blocks first
        const codeBlocks = [];
        let codeCounter = 0;
        html = html.replace(/<pre[^>]*><code(?:\s+class=["']language-(\w+)["'])?[^>]*>([\s\S]*?)<\/code><\/pre>/gi, 
            (match, lang, code) => {
                code = code.replace(/<[^>]*>/g, '');
                code = decodeHTMLEntities(code);
                const placeholder = `[CODEBLOCK${codeCounter}]`;
                codeBlocks[codeCounter] = '```' + (lang || '') + '\n' + code + '\n```';
                codeCounter++;
                return placeholder;
            }
        );
        
        // Handle inline code
        html = html.replace(/<code[^>]*>([^<]*)<\/code>/g, '`$1`');
        
        // Process footnote-style links
        const footnotePattern = /<span[^>]*data-state="closed"[^>]*>.*?<a[^>]*href=["']([^"']*)["'][^>]*>.*?<\/a>.*?<\/span>/gi;
        
        const footnoteReplacements = [];
        let tempHtml = html;
        let match;
        
        while ((match = footnotePattern.exec(html)) !== null) {
            footnoteReplacements.push({
                fullMatch: match[0],
                href: match[1],
                index: match.index
            });
        }
        
        footnoteReplacements.reverse().forEach(replacement => {
            const cleanedHref = cleanUrl(replacement.href);
            const footnoteRef = `[^${footnoteCounter}]`;
            footnoteLinks.set(footnoteCounter, cleanedHref);
            footnoteCounter++;
            
            tempHtml = tempHtml.substring(0, replacement.index) + 
                       footnoteRef + 
                       tempHtml.substring(replacement.index + replacement.fullMatch.length);
        });
        
        html = tempHtml;
        
        // Clean up leftover file- references
        html = html.replace(/file-l[a-z0-9]{20,}/gi, '');
        
        // Process regular links and clean URLs
        html = html.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi, (match, href, text) => {
            const cleanedHref = cleanUrl(href);
            return `[${text}](${cleanedHref})`;
        });
        
        // Convert headers
        html = html.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (match, level, text) => {
            const hashes = '#'.repeat(parseInt(level));
            return `\n${hashes} ${text}\n`;
        });
        
        // Convert emphasis and strong
        html = html.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
        html = html.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
        html = html.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
        html = html.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
        
        // Convert tables
        html = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, tableContent) => {
            let markdown = '\n';
            let hasHeader = false;
            let columnCount = 0;
            
            // Extract table rows
            const rows = [];
            const rowMatches = tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
            
            for (const rowMatch of rowMatches) {
                const rowContent = rowMatch[1];
                const cells = [];
                
                // Check if this is a header row
                const isHeaderRow = /<th[^>]*>/i.test(rowContent);
                if (isHeaderRow) hasHeader = true;
                
                // Extract cells (both th and td)
                const cellMatches = rowContent.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi);
                
                for (const cellMatch of cellMatches) {
                    let cellContent = cellMatch[1];
                    // Clean cell content - remove nested HTML but keep formatting
                    cellContent = cellContent.replace(/<br[^>]*>/gi, ' ');
                    cellContent = cellContent.replace(/<[^>]*>/g, '');
                    cellContent = decodeHTMLEntities(cellContent.trim());
                    // Escape pipe characters in cell content
                    cellContent = cellContent.replace(/\|/g, '\\|');
                    cells.push(cellContent);
                }
                
                if (cells.length > 0) {
                    columnCount = Math.max(columnCount, cells.length);
                    rows.push({ cells, isHeader: isHeaderRow });
                }
            }
            
            if (rows.length === 0) return match; // Return original if no rows found
            
            // Build markdown table
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                
                // Pad row to have same number of columns
                while (row.cells.length < columnCount) {
                    row.cells.push('');
                }
                
                // Build row
                markdown += '| ' + row.cells.join(' | ') + ' |\n';
                
                // Add header separator after first row if it's a header, or after any first row
                if (i === 0 && (hasHeader || rows.length > 1)) {
                    markdown += '|' + ' --- |'.repeat(columnCount) + '\n';
                }
            }
            
            return markdown + '\n';
        });
        
        // Convert lists
        html = html.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
            let listContent = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, item) => {
                item = item.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1');
                item = item.trim();
                return `- ${item}\n`;
            });
            return '\n' + listContent + '\n';
        });
        
        html = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
            let counter = 1;
            let listContent = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (match, item) => {
                item = item.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1');
                item = item.trim();
                return `${counter++}. ${item}\n`;
            });
            return '\n' + listContent + '\n';
        });
        
        // Convert paragraphs and line breaks
        html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
        html = html.replace(/<br[^>]*>/gi, '\n');
        
        // Remove remaining HTML tags
        html = html.replace(/<[^>]*>/g, '');
        
        // Decode HTML entities
        html = decodeHTMLEntities(html);
        
        // Restore code blocks
        codeBlocks.forEach((code, i) => {
            html = html.replace(`[CODEBLOCK${i}]`, code);
        });
        
        // Clean up excessive newlines
        html = html.replace(/\n{3,}/g, '\n\n');
        
        // Add commas between consecutive footnote references
        html = html.replace(/(\[\^\d+\])(\[\^\d+\])/g, '$1, $2');
        html = html.replace(/(\[\^\d+\])(\[\^\d+\])/g, '$1, $2');
        
        // Trim result
        html = html.trim();
        
        // Add footnotes at the end
        if (footnoteLinks.size > 0) {
            html += '\n\n---\n\n';
            footnoteLinks.forEach((href, num) => {
                html += `[^${num}]: ${href}\n`;
            });
        }
        
        return html;
    }
    
    function generateMarkdown(messages) {
        const now = new Date();
        const title = getConversationTitle() || 'ChatGPT Samtale';
        
        const markdown = [`# ${title}`, ''];
        
        // Add metadata
        markdown.push(`**Eksportert:** ${now.toLocaleDateString('no-NO')} ${now.toLocaleTimeString('no-NO')}`);
        markdown.push(`**Antall meldinger:** ${messages.length}`);
        markdown.push(`**URL:** ${window.location.href}`);
        markdown.push('', '---', '');
        
        // Add messages
        messages.forEach((message, index) => {
            const senderName = message.role === 'user' ? 'Bruker' : 'ChatGPT';
            
            markdown.push(`## ${senderName}`);
            markdown.push('');
            markdown.push(message.content);
            markdown.push('');
            
            // Add separator between messages (except last)
            if (index < messages.length - 1) {
                markdown.push('---');
                markdown.push('');
            }
        });
        
        return markdown.join('\n');
    }
    
    function getConversationTitle() {
        // Try to find conversation title
        const titleSelectors = [
            'h1',
            '[data-testid="conversation-title"]',
            '.conversation-title',
            '.chat-title',
            'title'
        ];
        
        for (const selector of titleSelectors) {
            const titleEl = document.querySelector(selector);
            if (titleEl && titleEl.textContent.trim()) {
                let title = titleEl.textContent.trim();
                // Clean up title
                if (title !== 'ChatGPT' && title !== 'OpenAI ChatGPT' && title.length > 3) {
                    return title;
                }
            }
        }
        
        return null;
    }
    
    function downloadMarkdown(content) {
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const filename = `chatgpt-samtale-${timestamp}.md`;
        
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
})();