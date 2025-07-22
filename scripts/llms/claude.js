(function() {
    'use strict';
    
    // Check if we're on claude.ai
    if (!window.location.href.includes('claude.ai')) {
        alert('⚠️ Dette scriptet fungerer kun på claude.ai');
        return;
    }
    
    // Check if script is already running
    if (window.claudeExportRunning) {
        alert('📝 Claude export er allerede i gang...');
        return;
    }
    
    // Show confirmation
    const userConfirmed = confirm(`📝 Claude Conversation Export
    
Dette scriptet vil:
• Samle alle meldinger fra denne samtalen
• Formatere som markdown
• Laste ned som .md-fil

Vil du fortsette?`);
    
    if (!userConfirmed) {
        return;
    }
    
    // Set running flag
    window.claudeExportRunning = true;
    
    // Create progress indicator
    const progressIndicator = createProgressIndicator();
    document.body.appendChild(progressIndicator);
    
    try {
        updateProgress('📖 Leser samtale...', 20);
        
        // Find all message containers
        const userMessages = document.querySelectorAll('.user-message');
        const claudeMessages = document.querySelectorAll('.font-claude-message');
        
        if (userMessages.length === 0 && claudeMessages.length === 0) {
            throw new Error('Ingen meldinger funnet på siden. Sørg for at samtalen er lastet.');
        }
        
        updateProgress('🔍 Analyserer meldinger...', 40);
        
        // Collect all messages with timestamps if available
        const allMessages = [];
        
        // Process user messages
        userMessages.forEach(element => {
            const content = extractMessageContent(element);
            if (content.trim()) {
                allMessages.push({
                    sender: 'human',
                    content: content,
                    element: element,
                    timestamp: extractTimestamp(element)
                });
            }
        });
        
        // Process Claude messages
        claudeMessages.forEach(element => {
            const content = extractMessageContent(element);
            if (content.trim()) {
                allMessages.push({
                    sender: 'assistant',
                    content: content,
                    element: element,
                    timestamp: extractTimestamp(element)
                });
            }
        });
        
        if (allMessages.length === 0) {
            throw new Error('Ingen meldingsinnhold funnet. Meldingene kan ha en annen struktur enn forventet.');
        }
        
        // Sort messages by their position in DOM (more reliable than timestamps)
        allMessages.sort((a, b) => {
            const aRect = a.element.getBoundingClientRect();
            const bRect = b.element.getBoundingClientRect();
            return aRect.top - bRect.top;
        });
        
        updateProgress('📝 Genererer markdown...', 70);
        
        // Generate markdown
        const markdown = generateMarkdown(allMessages);
        
        updateProgress('💾 Laster ned fil...', 90);
        
        // Download as file
        downloadMarkdown(markdown);
        
        updateProgress('✅ Ferdig!', 100);
        
        setTimeout(() => {
            progressIndicator.remove();
            window.claudeExportRunning = false;
            
            alert(`🎉 Export fullført!
            
📊 Resultat:
• ${allMessages.length} meldinger eksportert
• Fil lastet ned som markdown

Sjekk nedlastingsmappen din!`);
        }, 1500);
        
    } catch (error) {
        progressIndicator.remove();
        window.claudeExportRunning = false;
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
            <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
            <h3 style="margin: 0 0 16px 0; color: #333;">Eksporterer Claude Samtale</h3>
            <div id="progress-text" style="color: #666; margin-bottom: 20px;">Starter...</div>
            <div style="background: #f0f0f0; border-radius: 10px; overflow: hidden; margin-bottom: 16px;">
                <div id="progress-bar" style="width: 0%; height: 8px; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s ease;"></div>
            </div>
            <div style="font-size: 12px; color: #999;">Ikke lukk fanen mens scriptet kjører</div>
        `;
        
        overlay.appendChild(progressBox);
        return overlay;
    }
    
    function updateProgress(text, percentage) {
        const progressText = document.getElementById('progress-text');
        const progressBar = document.getElementById('progress-bar');
        if (progressText) progressText.textContent = text;
        if (progressBar) progressBar.style.width = percentage + '%';
    }
    
    function extractMessageContent(element) {
        // Clone element to avoid modifying the original
        const clone = element.cloneNode(true);
        
        // Remove any unwanted elements (buttons, metadata, etc.)
        const unwantedSelectors = [
            '.copy-button',
            '.message-actions',
            '.timestamp',
            'button',
            '.edit-button',
            '.regenerate-button'
        ];
        
        unwantedSelectors.forEach(selector => {
            const unwanted = clone.querySelectorAll(selector);
            unwanted.forEach(el => el.remove());
        });
        
        // Get text content
        let content = clone.textContent || clone.innerText || '';
        
        // Clean up whitespace
        content = content.replace(/\s+/g, ' ').trim();
        
        return content;
    }
    
    function extractTimestamp(element) {
        // Try to find timestamp in various ways
        const timestampSelectors = [
            '.timestamp',
            '[data-timestamp]',
            'time',
            '.message-time'
        ];
        
        for (const selector of timestampSelectors) {
            const timestampEl = element.querySelector(selector) || element.closest('*').querySelector(selector);
            if (timestampEl) {
                return timestampEl.textContent || timestampEl.getAttribute('data-timestamp') || timestampEl.getAttribute('datetime');
            }
        }
        
        // Fallback to current time
        return new Date().toISOString();
    }
    
    function generateMarkdown(messages) {
        const now = new Date();
        const title = getConversationTitle() || 'Claude Samtale';
        
        const markdown = [`# ${title}`, ''];
        
        // Add metadata
        markdown.push(`**Eksportert:** ${now.toLocaleDateString('no-NO')} ${now.toLocaleTimeString('no-NO')}`);
        markdown.push(`**Antall meldinger:** ${messages.length}`);
        markdown.push(`**URL:** ${window.location.href}`);
        markdown.push('', '---', '');
        
        // Add messages
        messages.forEach((message, index) => {
            const senderName = message.sender === 'human' ? 'Bruker' : 'Claude';
            const timestamp = formatTimestamp(message.timestamp);
            
            markdown.push(`## ${senderName} ${timestamp ? `(${timestamp})` : ''}`);
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
            '.conversation-title',
            '[data-testid="conversation-title"]',
            '.chat-title',
            'title'
        ];
        
        for (const selector of titleSelectors) {
            const titleEl = document.querySelector(selector);
            if (titleEl && titleEl.textContent.trim()) {
                let title = titleEl.textContent.trim();
                // Clean up title
                if (title !== 'Claude' && title !== 'Anthropic Claude' && title.length > 3) {
                    return title;
                }
            }
        }
        
        return null;
    }
    
    function formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return timestamp; // Return original if can't parse
            }
            
            return date.toLocaleString('no-NO', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return timestamp; // Return original on error
        }
    }
    
    function downloadMarkdown(content) {
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const filename = `claude-samtale-${timestamp}.md`;
        
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