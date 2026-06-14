// Webpage to Markdown Converter
// Extracts title and content from any webpage as markdown, with optional API posting

(function() {
    function findMainContent() {
        // Try increasingly broad selectors to find the main content area
        const selectors = [
            'article[role="main"]',
            'main article',
            '[role="main"] article',
            'article',
            '[role="main"]',
            'main',
            '.post-content',
            '.article-content',
            '.entry-content',
            '.content-body',
            '.story-body',
            '#content',
            '.content'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim().length > 200) {
                return el;
            }
        }

        // Fallback: find the element with the most paragraph text
        const candidates = document.querySelectorAll('div, section');
        let best = null;
        let bestScore = 0;

        candidates.forEach(el => {
            if (isUIElement(el)) return;
            const paragraphs = el.querySelectorAll('p');
            let score = 0;
            paragraphs.forEach(p => { score += p.textContent.trim().length; });
            if (score > bestScore) {
                bestScore = score;
                best = el;
            }
        });

        return best || document.body;
    }

    function extractTitle() {
        // Try multiple sources for the best title
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content) return ogTitle.content.trim();

        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent.trim().length > 0) return h1.textContent.trim();

        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle && twitterTitle.content) return twitterTitle.content.trim();

        return document.title.trim();
    }

    function extractMeta() {
        const meta = {};

        // Author
        const authorMeta = document.querySelector('meta[name="author"]') ||
                          document.querySelector('meta[property="article:author"]');
        if (authorMeta && authorMeta.content) meta.author = authorMeta.content.trim();

        // Published date
        const dateMeta = document.querySelector('meta[property="article:published_time"]') ||
                        document.querySelector('meta[name="date"]') ||
                        document.querySelector('time[datetime]');
        if (dateMeta) {
            meta.date = dateMeta.content || dateMeta.getAttribute('datetime');
        }

        // Description
        const descMeta = document.querySelector('meta[property="og:description"]') ||
                        document.querySelector('meta[name="description"]');
        if (descMeta && descMeta.content) meta.description = descMeta.content.trim();

        // Site name
        const siteMeta = document.querySelector('meta[property="og:site_name"]');
        if (siteMeta && siteMeta.content) meta.siteName = siteMeta.content.trim();

        return meta;
    }

    function isUIElement(element) {
        const uiSelectors = [
            '.modal', '.popup', '.dropdown', '.menu', '.nav', '.header', '.footer',
            '.button', '.btn', '.subscribe', '.share', '.social', '.advertisement',
            '.sidebar', '.widget', '.form', '.search', '.pagination', '.breadcrumb',
            '.comments', '.comment', '.related', '.recommended', '.newsletter',
            '.cookie', '.banner', '.alert', '.toast', '.toolbar', '.tabs',
            '[role="button"]', '[role="navigation"]', '[role="complementary"]',
            '[role="banner"]', '[role="contentinfo"]',
            '[aria-hidden="true"]', '.hidden', '.sr-only',
            'nav', 'aside', 'footer', 'header'
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

        html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
        html = html.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
        html = html.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
        html = html.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
        html = html.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
        html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

        // Strip remaining HTML tags
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    function processList(listElement, isOrdered) {
        let result = '';
        const items = listElement.querySelectorAll(':scope > li');

        items.forEach((item, index) => {
            const text = processInlineFormatting(item);
            const prefix = isOrdered ? `${index + 1}. ` : '- ';
            result += `${prefix}${text}\n`;
        });

        return result;
    }

    function processTable(table) {
        const rows = table.querySelectorAll('tr');
        if (rows.length === 0) return '';

        let result = '';
        let headerProcessed = false;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());

            result += '| ' + cellTexts.join(' | ') + ' |\n';

            if (!headerProcessed) {
                result += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
                headerProcessed = true;
            }
        });

        return result;
    }

    function extractMarkdown() {
        const title = extractTitle();
        const meta = extractMeta();
        const content = findMainContent();

        let markdown = '';

        // Title
        markdown += `# ${title}\n\n`;

        // Metadata block
        const metaParts = [];
        if (meta.author) metaParts.push(`**Author:** ${meta.author}`);
        if (meta.date) metaParts.push(`**Date:** ${meta.date}`);
        if (meta.siteName) metaParts.push(`**Source:** ${meta.siteName}`);
        metaParts.push(`**URL:** ${window.location.href}`);

        if (metaParts.length > 0) {
            markdown += metaParts.join('  \n') + '\n\n---\n\n';
        }

        if (!content) {
            markdown += '*Could not extract page content.*\n';
            return markdown;
        }

        // Walk the content tree
        const walker = document.createTreeWalker(
            content,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function(node) {
                    if (node.tagName && node.tagName.match(/^(H[1-6]|P|UL|OL|BLOCKQUOTE|PRE|IMG|TABLE|FIGURE|DIV)$/)) {
                        if (isUIElement(node)) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        const elements = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.tagName === 'DIV') {
                const text = node.textContent.trim();
                const hasBlockChildren = node.querySelector('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, table');
                if (text.length > 50 && !hasBlockChildren) {
                    elements.push(node);
                }
            } else if (node.tagName === 'FIGURE') {
                const img = node.querySelector('img');
                if (img) elements.push(img);
                const caption = node.querySelector('figcaption');
                if (caption) elements.push(caption);
            } else {
                elements.push(node);
            }
        }

        // Track the first h1 so we don't duplicate the title
        const firstH1 = content.querySelector('h1');
        const titleNormalized = title.toLowerCase().trim();

        elements.forEach(element => {
            const tag = element.tagName.toLowerCase();
            const text = element.textContent.trim();

            if (isUIElement(element)) return;

            switch (tag) {
                case 'h1':
                    // Skip if it matches the title we already added
                    if (text.toLowerCase().trim() === titleNormalized) return;
                    markdown += `# ${text}\n\n`;
                    break;
                case 'h2':
                    markdown += `## ${text}\n\n`;
                    break;
                case 'h3':
                    markdown += `### ${text}\n\n`;
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
                case 'figcaption':
                    if (text.length > 0) {
                        markdown += `${processInlineFormatting(element)}\n\n`;
                    }
                    break;
                case 'ul':
                    markdown += processList(element, false) + '\n';
                    break;
                case 'ol':
                    markdown += processList(element, true) + '\n';
                    break;
                case 'blockquote':
                    const lines = text.split('\n').map(l => `> ${l.trim()}`).filter(l => l !== '> ');
                    markdown += lines.join('\n') + '\n\n';
                    break;
                case 'pre':
                    const codeEl = element.querySelector('code');
                    const lang = codeEl ? (codeEl.className.match(/language-(\w+)/) || [])[1] || '' : '';
                    markdown += `\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
                    break;
                case 'img':
                    const alt = element.alt || 'Image';
                    let src = element.src || element.dataset.src || '';
                    if (!src && element.srcset) {
                        const m = element.srcset.match(/^\s*([^\s,]+)/);
                        if (m) src = m[1];
                    }
                    if (src) {
                        if (src.startsWith('//')) src = window.location.protocol + src;
                        else if (src.startsWith('/')) src = window.location.origin + src;
                        markdown += `![${alt}](${src})\n\n`;
                    }
                    break;
                case 'div':
                    if (text.length > 0) {
                        markdown += `${processInlineFormatting(element)}\n\n`;
                    }
                    break;
                case 'table':
                    markdown += processTable(element) + '\n';
                    break;
            }
        });

        return markdown.trim();
    }

    function createModal(markdown) {
        const existingModal = document.getElementById('webpage-md-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'webpage-md-modal';

        const API_URL = 'https://curator.midttom.me/api/content';
        const apiKey = localStorage.getItem('curator_api_key') || '';
        const hasApiKey = apiKey.length > 0;
        const meta = extractMeta();
        const pageTitle = extractTitle();
        const siteName = meta.siteName || window.location.hostname;
        const defaultTitle = `${pageTitle} | ${siteName}`;

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
                        <h2 style="margin: 0; color: #1a1a1a; font-size: 18px;">Webpage Markdown</h2>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <button id="wm-copy-btn" style="
                                background: #007cba;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Copy</button>
                            <button id="wm-download-btn" style="
                                background: #28a745;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Download</button>
                            <button id="wm-post-api-btn" style="
                                background: ${hasApiKey ? '#8b5cf6' : '#6b7280'};
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Post to Curator</button>
                            <button id="wm-close-btn" style="
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
                    <div id="wm-api-status" style="
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
                        <input id="wm-title-input" type="text" value="${defaultTitle.replace(/"/g, '&quot;')}" style="
                            width: 100%;
                            padding: 10px 12px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            font-size: 14px;
                            font-weight: 600;
                            box-sizing: border-box;
                            margin-bottom: 10px;
                        ">
                        <textarea id="wm-content" style="
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

        // --- Event listeners ---

        const getContent = () => modal.querySelector('#wm-content').value;

        // Copy
        modal.querySelector('#wm-copy-btn').addEventListener('click', async function() {
            const btn = this;
            try {
                await navigator.clipboard.writeText(getContent());
            } catch (e) {
                modal.querySelector('#wm-content').select();
                document.execCommand('copy');
            }
            btn.textContent = 'Copied!';
            btn.style.background = '#28a745';
            setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = '#007cba'; }, 2000);
        });

        // Download
        modal.querySelector('#wm-download-btn').addEventListener('click', function() {
            const btn = this;
            const title = extractTitle()
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, '-')
                .replace(/^-+|-+$/g, '')
                .substring(0, 100) || 'webpage';
            const date = new Date().toISOString().slice(0, 10);
            const filename = `${title}-${date}.md`;

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
        modal.querySelector('#wm-post-api-btn').addEventListener('click', async function() {
            const btn = this;
            const statusEl = modal.querySelector('#wm-api-status');
            const currentApiKey = localStorage.getItem('curator_api_key') || '';

            if (!currentApiKey) {
                statusEl.style.display = 'block';
                statusEl.style.background = '#fffbeb';
                statusEl.style.color = '#92400e';
                statusEl.innerHTML = `
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="white-space:nowrap; font-weight:600;">API Key:</label>
                        <input id="wm-api-key-input" type="password" placeholder="Paste your API key" style="
                            flex:1; padding:6px 10px; border:1px solid #d1d5db; border-radius:4px;
                            font-size:13px; font-family:monospace;
                        ">
                        <button id="wm-save-key-btn" style="
                            background:#8b5cf6; color:white; border:none; padding:6px 14px;
                            border-radius:4px; cursor:pointer; font-size:13px; white-space:nowrap;
                        ">Save</button>
                    </div>`;
                const saveBtn = statusEl.querySelector('#wm-save-key-btn');
                const keyInput = statusEl.querySelector('#wm-api-key-input');
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
                saveBtn.addEventListener('click', saveKey);
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
                const payload = {
                    url: window.location.href,
                    title: modal.querySelector('#wm-title-input').value.trim(),
                    description: meta.description || null,
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
        modal.querySelector('#wm-close-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal.firstElementChild) modal.remove(); });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }

    // Run
    const markdown = extractMarkdown();
    createModal(markdown);
    console.log('Webpage markdown extracted and displayed in modal');
    return markdown;
})();
