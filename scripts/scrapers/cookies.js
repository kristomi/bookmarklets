// Cookies Export
// Export cookies for a chosen URL as a Netscape-format cookies.txt file.
// Lets the user pick the URL and whether to export all cookies (default) or a subset.
// Cookies (incl. HttpOnly) are fetched from the background service worker via chrome.cookies.

(function() {
    // Ask the background service worker for the cookies that apply to a URL.
    // chrome.cookies is not available in the injected content-script world, so we
    // proxy the request through background.js.
    function fetchCookies(url) {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage({ action: 'getCookies', url }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (!response || !response.success) {
                        reject(new Error(response && response.error ? response.error : 'Ukjent feil ved henting av cookies'));
                        return;
                    }
                    resolve(response.cookies || []);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    // Convert chrome.cookies objects to the Netscape cookies.txt format
    // (the format used by curl, wget, yt-dlp, etc.).
    function toNetscape(cookies) {
        const lines = [
            '# Netscape HTTP Cookie File',
            '# Exported by Kristomi\'s Scripts',
            ''
        ];

        cookies.forEach(c => {
            const includeSubdomains = !c.hostOnly;
            const flag = includeSubdomains ? 'TRUE' : 'FALSE';
            const path = c.path || '/';
            const secure = c.secure ? 'TRUE' : 'FALSE';
            const expiry = c.session || !c.expirationDate ? 0 : Math.floor(c.expirationDate);
            // yt-dlp / curl convention for marking HttpOnly cookies
            const domain = (c.httpOnly ? '#HttpOnly_' : '') + c.domain;
            lines.push([domain, flag, path, secure, expiry, c.name, c.value].join('\t'));
        });

        return lines.join('\n') + '\n';
    }

    function sanitizeFilename(url) {
        let host = 'cookies';
        try {
            host = new URL(url).hostname || 'cookies';
        } catch (e) { /* keep default */ }
        return host.replace(/[^a-zA-Z0-9.-]/g, '_');
    }

    function download(content, url) {
        const date = new Date().toISOString().slice(0, 10);
        const filename = `${sanitizeFilename(url)}-cookies-${date}.txt`;
        const blob = new Blob([content], { type: 'text/plain' });
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function createModal() {
        const existing = document.getElementById('cookies-export-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'cookies-export-modal';

        modal.innerHTML = `
            <div style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.7); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    background: white; border-radius: 8px; width: 90%; max-width: 640px;
                    max-height: 85vh; display: flex; flex-direction: column;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                ">
                    <div style="
                        padding: 20px; border-bottom: 1px solid #e1e5e9;
                        display: flex; justify-content: space-between; align-items: center;
                        flex-wrap: wrap; gap: 8px;
                    ">
                        <h2 style="margin: 0; color: #1a1a1a; font-size: 18px;">Eksporter cookies</h2>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <button id="ce-download-btn" style="
                                background: #28a745; color: white; border: none;
                                padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;
                            ">Last ned cookies.txt</button>
                            <button id="ce-copy-btn" style="
                                background: #007cba; color: white; border: none;
                                padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;
                            ">Kopier</button>
                            <button id="ce-close-btn" style="
                                background: #6c757d; color: white; border: none;
                                padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;
                            ">Lukk</button>
                        </div>
                    </div>

                    <div style="padding: 20px; overflow-y: auto; flex: 1;">
                        <label style="display: block; font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 6px;">
                            URL å eksportere cookies for
                        </label>
                        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                            <input id="ce-url-input" type="text" value="${escapeHtml(window.location.href)}" style="
                                flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px;
                                font-size: 13px; font-family: 'Monaco', 'Menlo', monospace; box-sizing: border-box;
                            ">
                            <button id="ce-load-btn" style="
                                background: #4f46e5; color: white; border: none; padding: 8px 16px;
                                border-radius: 4px; cursor: pointer; font-size: 14px; white-space: nowrap;
                            ">Hent</button>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <label style="display: inline-flex; align-items: center; gap: 6px; margin-right: 20px; font-size: 14px; cursor: pointer;">
                                <input type="radio" name="ce-scope" value="all" checked> Alle cookies
                            </label>
                            <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer;">
                                <input type="radio" name="ce-scope" value="some"> Velg cookies
                            </label>
                        </div>

                        <div id="ce-status" style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">Henter cookies…</div>

                        <div id="ce-list" style="
                            display: none; border: 1px solid #e1e5e9; border-radius: 4px;
                            max-height: 260px; overflow-y: auto; padding: 8px;
                        "></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let cookies = [];

        const urlInput = modal.querySelector('#ce-url-input');
        const statusEl = modal.querySelector('#ce-status');
        const listEl = modal.querySelector('#ce-list');

        const getScope = () => modal.querySelector('input[name="ce-scope"]:checked').value;

        function renderList() {
            if (getScope() === 'all' || cookies.length === 0) {
                listEl.style.display = 'none';
                return;
            }
            listEl.style.display = 'block';
            listEl.innerHTML = `
                <div style="display:flex; gap:12px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #eee;">
                    <button id="ce-select-all" style="background:none; border:none; color:#4f46e5; cursor:pointer; font-size:12px; padding:0;">Velg alle</button>
                    <button id="ce-select-none" style="background:none; border:none; color:#4f46e5; cursor:pointer; font-size:12px; padding:0;">Fjern alle</button>
                </div>
            ` + cookies.map((c, i) => `
                <label style="display:flex; align-items:center; gap:8px; padding:4px 2px; font-size:13px; cursor:pointer;">
                    <input type="checkbox" class="ce-cookie-cb" data-index="${i}" checked>
                    <span style="font-family:'Monaco','Menlo',monospace; color:#111;">${escapeHtml(c.name)}</span>
                    <span style="color:#9ca3af; font-size:11px; margin-left:auto;">${escapeHtml(c.domain)}</span>
                </label>
            `).join('');

            listEl.querySelector('#ce-select-all').addEventListener('click', () => {
                listEl.querySelectorAll('.ce-cookie-cb').forEach(cb => cb.checked = true);
            });
            listEl.querySelector('#ce-select-none').addEventListener('click', () => {
                listEl.querySelectorAll('.ce-cookie-cb').forEach(cb => cb.checked = false);
            });
        }

        function selectedCookies() {
            if (getScope() === 'all') return cookies;
            const indices = Array.from(listEl.querySelectorAll('.ce-cookie-cb:checked'))
                .map(cb => parseInt(cb.dataset.index, 10));
            return indices.map(i => cookies[i]);
        }

        async function load() {
            const url = urlInput.value.trim();
            if (!url) {
                statusEl.textContent = 'Skriv inn en URL.';
                statusEl.style.color = '#991b1b';
                return;
            }
            statusEl.textContent = 'Henter cookies…';
            statusEl.style.color = '#6b7280';
            listEl.style.display = 'none';
            try {
                cookies = await fetchCookies(url);
                cookies.sort((a, b) => a.name.localeCompare(b.name));
                statusEl.textContent = `Fant ${cookies.length} cookie${cookies.length === 1 ? '' : 's'} for ${new URL(url).hostname}.`;
                statusEl.style.color = cookies.length ? '#166534' : '#92400e';
                renderList();
            } catch (e) {
                cookies = [];
                statusEl.textContent = `Feil: ${e.message}`;
                statusEl.style.color = '#991b1b';
                listEl.style.display = 'none';
            }
        }

        modal.querySelector('#ce-load-btn').addEventListener('click', load);
        urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') load(); });
        modal.querySelectorAll('input[name="ce-scope"]').forEach(r => r.addEventListener('change', renderList));

        modal.querySelector('#ce-download-btn').addEventListener('click', function() {
            const chosen = selectedCookies();
            if (!chosen.length) {
                statusEl.textContent = 'Ingen cookies valgt.';
                statusEl.style.color = '#991b1b';
                return;
            }
            download(toNetscape(chosen), urlInput.value.trim());
            const btn = this;
            btn.textContent = 'Lastet ned!';
            btn.style.background = '#218838';
            setTimeout(() => { btn.textContent = 'Last ned cookies.txt'; btn.style.background = '#28a745'; }, 2000);
        });

        modal.querySelector('#ce-copy-btn').addEventListener('click', async function() {
            const chosen = selectedCookies();
            if (!chosen.length) {
                statusEl.textContent = 'Ingen cookies valgt.';
                statusEl.style.color = '#991b1b';
                return;
            }
            const text = toNetscape(chosen);
            try {
                await navigator.clipboard.writeText(text);
            } catch (e) {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            const btn = this;
            btn.textContent = 'Kopiert!';
            btn.style.background = '#28a745';
            setTimeout(() => { btn.textContent = 'Kopier'; btn.style.background = '#007cba'; }, 2000);
        });

        modal.querySelector('#ce-close-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal.firstElementChild) modal.remove(); });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });

        // Load cookies for the current URL immediately.
        load();
    }

    createModal();
    console.log('Cookies export modal opened');
})();
