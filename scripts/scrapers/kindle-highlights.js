(function() {
    'use strict';
    
    // Check if we're on the correct page
    if (!window.location.href.includes('read.amazon.com/kp/notebook')) {
        alert('⚠️ Dette scriptet fungerer kun på Amazon Kindle notebook-siden.\n\nGå til: https://read.amazon.com/kp/notebook');
        return;
    }
    
    // Check if script is already running
    if (window.kindleExtractorRunning) {
        alert('📚 Kindle highlights extraction er allerede i gang...');
        return;
    }
    
    // Show explanation and confirmation
    const userConfirmed = confirm(`📚 Kindle Highlights Extractor
    
Dette scriptet vil:
• Finne alle bøkene dine med highlights
• Automatisk klikke gjennom hver bok 
• Samle alle highlights fra hver bok
• Laste ned en JSON-fil med alle highlights

⏱️ Dette kan ta noen minutter avhengig av antall bøker.

Vil du fortsette?`);
    
    if (!userConfirmed) {
        return;
    }
    
    // Set running flag
    window.kindleExtractorRunning = true;
    
    // Create progress overlay
    const progressOverlay = createProgressOverlay();
    document.body.appendChild(progressOverlay);
    
    // Start extraction
    extractHighlights()
        .then(highlights => {
            updateProgress('✅ Ferdig! Laster ned fil...', 100);
            setTimeout(() => {
                progressOverlay.remove();
                window.kindleExtractorRunning = false;
                
                const highlightCount = Object.values(highlights).reduce((sum, bookHighlights) => sum + bookHighlights.length, 0);
                const bookCount = Object.keys(highlights).length;
                
                alert(`🎉 Extraction fullført!
                
📊 Resultat:
• ${bookCount} bøker prosessert
• ${highlightCount} highlights ekstrahert
• Fil lastet ned: kindle-highlights.json

Sjekk nedlastingsmappen din!`);
            }, 1500);
        })
        .catch(error => {
            progressOverlay.remove();
            window.kindleExtractorRunning = false;
            console.error('Extraction failed:', error);
            alert(`❌ En feil oppstod under ekstraksjonen:
            
${error.message}

Prøv å:
• Oppdatere siden og prøv igjen
• Sjekk at du er logget inn
• Kontroller at du har highlights tilgjengelig`);
        });
    
    function createProgressOverlay() {
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
            <div style="font-size: 48px; margin-bottom: 16px;">📚</div>
            <h3 style="margin: 0 0 16px 0; color: #333;">Ekstraherer Kindle Highlights</h3>
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
    
    async function extractHighlights() {
        const bookHighlights = {};
        
        // Get all book titles (h2 elements)
        updateProgress('Finner bøker...', 5);
        const bookElements = document.querySelectorAll('h2');
        const books = Array.from(bookElements).map(h2 => h2.textContent.trim()).filter(title => title.length > 0);
        
        if (books.length === 0) {
            throw new Error('Ingen bøker funnet. Sjekk at du har highlights tilgjengelig på siden.');
        }
        
        updateProgress(`Fant ${books.length} bøker. Starter ekstraksjonen...`, 10);
        
        for (let i = 0; i < books.length; i++) {
            const book = books[i];
            const progress = 10 + (i / books.length) * 80;
            
            updateProgress(`Prosesserer: ${book} (${i + 1}/${books.length})`, progress);
            
            try {
                // Find and click the book element
                const bookElement = Array.from(bookElements).find(h2 => h2.textContent.trim() === book);
                if (bookElement) {
                    // Scroll to element to ensure it's visible
                    bookElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    bookElement.click();
                    
                    // Wait for highlights to load with longer timeout
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    // Extract highlights with better selector
                    const highlightElements = document.querySelectorAll('[id="highlight"], .kp-notebook-highlight');
                    const highlights = Array.from(highlightElements)
                        .map(el => el.textContent.trim())
                        .filter(text => text.length > 0);
                    
                    bookHighlights[book] = highlights;
                    
                    console.log(`✅ Extracted ${highlights.length} highlights from: ${book}`);
                } else {
                    console.warn(`⚠️ Could not find book element for: ${book}`);
                }
            } catch (error) {
                console.error(`❌ Could not extract highlights for: ${book}`, error);
                bookHighlights[book] = []; // Add empty array for failed books
            }
            
            // Small delay between books
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Convert to JSON and download
        updateProgress('Forbereder nedlasting...', 95);
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `kindle-highlights-${timestamp}.json`;
        
        const json = JSON.stringify({
            extracted_at: new Date().toISOString(),
            total_books: books.length,
            total_highlights: Object.values(bookHighlights).reduce((sum, highlights) => sum + highlights.length, 0),
            books: bookHighlights
        }, null, 2);
        
        // Create and trigger download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`🎉 Extraction complete! Downloaded: ${filename}`);
        return bookHighlights;
    }
    
})();