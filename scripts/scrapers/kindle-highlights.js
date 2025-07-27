(function() {
    'use strict';

    if (!window.location.href.includes('read.amazon.com/kp/notebook')) {
        alert('⚠️ Dette scriptet fungerer kun på Amazon Kindle notebook-siden.\n\nGå til: https://read.amazon.com/kp/notebook');
        return;
    }

    const bookElements = document.querySelectorAll('h2');
    const books = Array.from(bookElements)
        .map(h2 => h2.textContent.trim())
        .filter(title => title.length > 0);

    if (books.length === 0) {
        alert('Ingen bøker funnet. Sjekk at du har highlights tilgjengelig på siden.');
        return;
    }

    // Opprett overlay for bokvalg
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
        background: white; padding: 20px; border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-height: 80%; overflow-y: auto;
        width: 400px; text-align: left;
    `;
    container.innerHTML = `<h3>Velg bøker som skal scrapes</h3>`;

    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginBottom = '10px';
    buttonContainer.innerHTML = `
        <button id="selectAll">Velg alle</button>
        <button id="selectNone">Velg ingen</button>
        <button id="startScraping">Start</button>
    `;

    container.appendChild(buttonContainer);

    // Liste med checkbokser
    books.forEach(book => {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.innerHTML = `<input type="checkbox" class="bookCheckbox" value="${book}"> ${book}`;
        container.appendChild(label);
    });

    overlay.appendChild(container);
    document.body.appendChild(overlay);

    document.getElementById('selectAll').onclick = () => {
        document.querySelectorAll('.bookCheckbox').forEach(cb => cb.checked = true);
    };
    document.getElementById('selectNone').onclick = () => {
        document.querySelectorAll('.bookCheckbox').forEach(cb => cb.checked = false);
    };

    document.getElementById('startScraping').onclick = async () => {
        const selectedBooks = Array.from(document.querySelectorAll('.bookCheckbox'))
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        if (selectedBooks.length === 0) {
            alert('Du må velge minst én bok for å fortsette.');
            return;
        }

        overlay.remove();
        const results = await scrapeSelectedBooks(selectedBooks);
        createModal(results);
    };

    async function scrapeSelectedBooks(selectedBooks) {
        const bookHighlights = {};

        for (let book of selectedBooks) {
            const bookElement = Array.from(bookElements).find(h2 => h2.textContent.trim() === book);
            if (!bookElement) continue;

            bookElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 500));
            bookElement.click();
            await new Promise(r => setTimeout(r, 2000));

            // Finn metadata-containeren
            const metaContainer = document.querySelector('div.a-column.a-span5');
            const title = metaContainer?.querySelector('h3.kp-notebook-metadata')?.textContent.trim() || book;
            const author = metaContainer?.querySelector('p.a-size-base.kp-notebook-metadata')?.textContent.trim() || 'Ukjent forfatter';
            const date = metaContainer?.querySelector('#kp-notebook-annotated-date')?.textContent.trim() || 'Ukjent dato';

            const highlightElements = document.querySelectorAll('[id="highlight"], .kp-notebook-highlight');
            const highlights = Array.from(highlightElements)
                .map(el => el.textContent.trim())
                .filter((text, i, arr) => text && arr.indexOf(text) === i);

            bookHighlights[title] = { author, date, highlights };
        }

        return bookHighlights;
    }

    function createModal(bookHighlights) {
        let markdown = '';
        for (const [title, data] of Object.entries(bookHighlights)) {
            markdown += `# ${title}\n`;
            markdown += `${data.author}\n${data.date}\n\n`;
            data.highlights.forEach(h => {
                markdown += `- ${h}\n`;
            });
            markdown += '\n';
        }

        // Remove existing modal if it exists
        const existingModal = document.getElementById('kindle-highlights-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML
        const modal = document.createElement('div');
        modal.id = 'kindle-highlights-modal';
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
                        <h2 style="margin: 0; color: #1a1a1a; font-size: 18px;">Kindle Highlights</h2>
                        <div>
                            <button id="copy-highlights-btn" style="
                                background: #007cba;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                margin-right: 8px;
                                font-size: 14px;
                            ">Copy to Clipboard</button>
                            <button id="download-highlights-btn" style="
                                background: #28a745;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                margin-right: 8px;
                                font-size: 14px;
                            ">Download</button>
                            <button id="close-highlights-modal-btn" style="
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
                        <textarea id="highlights-content" readonly style="
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
        const copyBtn = modal.querySelector('#copy-highlights-btn');
        const downloadBtn = modal.querySelector('#download-highlights-btn');
        const closeBtn = modal.querySelector('#close-highlights-modal-btn');
        const textarea = modal.querySelector('#highlights-content');
        
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
            // Generate filename with book titles and timestamp
            const bookTitles = Object.keys(bookHighlights);
            let filename = 'kindle-highlights.md';
            
            if (bookTitles.length > 0) {
                // Use first book title (or combination if multiple)
                let title = bookTitles.length === 1 
                    ? bookTitles[0]
                    : `${bookTitles[0]}-and-${bookTitles.length - 1}-others`;
                
                // Clean the title for use as filename
                title = title
                    .replace(/[<>:"/\\|?*]/g, '') // Remove only illegal filename characters
                    .replace(/\s+/g, '-') // Replace spaces with hyphens
                    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
                    .substring(0, 80); // Limit length
                
                // Ensure we have a valid filename
                if (title.length === 0) {
                    title = 'kindle-highlights';
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
})();