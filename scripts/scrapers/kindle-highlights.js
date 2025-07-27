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
        downloadMarkdown(results);
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

    function downloadMarkdown(bookHighlights) {
        let md = '';
        for (const [title, data] of Object.entries(bookHighlights)) {
            md += `# ${title}\n`;
            md += `${data.author}\n${data.date}\n\n`;
            data.highlights.forEach(h => {
                md += `- ${h}\n`;
            });
            md += '\n';
        }

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'kindle-highlights.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
})();