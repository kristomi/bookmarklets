// Substack Audio Export
// Finds the audio and video files behind a Substack post - podcast episodes,
// human voiceovers, AI text-to-speech and video uploads - and lets you copy or
// download them, or hand them to yt-dlp.
//
// Substack keeps the media URLs in window._preloads.post. An injected content
// script lives in an isolated world and cannot read that variable, so we parse
// the inline <script> tag out of the DOM instead. If the page has been
// client-side navigated the inline data describes the wrong post, so we fall
// back to the public post API.

(function() {
    // File extensions we consider audio/video. Substack serves mp3 (podcasts,
    // TTS), m4a (voiceover) and mp4/m3u8 (video uploads via Mux).
    const MEDIA_EXT = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac|mp4|m4v|mov|webm|m3u8|mpd)(\?|#|$)/i;
    const URL_IN_TEXT = /https?:\/\/[^\s"'<>\\)]+/g;
    // Playlists cannot be saved as a single file by chrome.downloads.
    const IS_PLAYLIST = /\.(m3u8|mpd)(\?|#|$)/i;

    // ---------------------------------------------------------------- preloads

    // Read a double-quoted JS string literal starting at `start`, honouring
    // backslash escapes, and return its decoded value plus the end index.
    function readStringLiteral(src, start) {
        let i = start + 1;
        while (i < src.length) {
            const ch = src[i];
            if (ch === '\\') {
                i += 2;
                continue;
            }
            if (ch === '"') {
                return { raw: src.slice(start, i + 1), end: i };
            }
            i++;
        }
        return null;
    }

    // Read a balanced {...} literal starting at `start`, skipping over strings
    // so that braces inside them do not confuse the depth counter.
    function readObjectLiteral(src, start) {
        let depth = 0;
        let i = start;
        while (i < src.length) {
            const ch = src[i];
            if (ch === '"' || ch === "'") {
                let j = i + 1;
                while (j < src.length) {
                    if (src[j] === '\\') { j += 2; continue; }
                    if (src[j] === ch) break;
                    j++;
                }
                i = j + 1;
                continue;
            }
            if (ch === '{') depth++;
            if (ch === '}') {
                depth--;
                if (depth === 0) return src.slice(start, i + 1);
            }
            i++;
        }
        return null;
    }

    // Pull window._preloads out of the inline scripts in the document.
    // Substack normally writes it as JSON.parse("...") but has also shipped a
    // plain object literal, so handle both.
    function extractPreloads(doc) {
        const scripts = Array.from(doc.querySelectorAll('script'));

        for (const script of scripts) {
            const src = script.textContent || '';
            const marker = src.indexOf('_preloads');
            if (marker === -1) continue;

            const eq = src.indexOf('=', marker);
            if (eq === -1) continue;

            const rest = src.slice(eq + 1);
            const offset = eq + 1;

            const parseCall = rest.indexOf('JSON.parse(');
            if (parseCall !== -1 && parseCall < 40) {
                const quote = src.indexOf('"', offset + parseCall);
                const literal = quote === -1 ? null : readStringLiteral(src, quote);
                if (literal) {
                    try {
                        return JSON.parse(JSON.parse(literal.raw));
                    } catch (e) {
                        console.warn('Could not parse _preloads JSON string:', e);
                    }
                }
            }

            const brace = src.indexOf('{', offset);
            if (brace !== -1) {
                const literal = readObjectLiteral(src, brace);
                if (literal) {
                    try {
                        return JSON.parse(literal);
                    } catch (e) {
                        console.warn('Could not parse _preloads object literal:', e);
                    }
                }
            }
        }

        return null;
    }

    // The inline _preloads belongs to whichever page was loaded first. After a
    // client-side navigation it describes a different post than the one on
    // screen, so verify it against the current URL before trusting it.
    function preloadsMatchUrl(post, pageUrl) {
        if (!post) return false;
        const path = (() => {
            try { return new URL(pageUrl).pathname; } catch (e) { return pageUrl; }
        })();
        if (!post.slug) return true;
        return path.indexOf(post.slug) !== -1;
    }

    // Substack exposes the post as JSON at /api/v1/posts/<slug> on the
    // publication's own origin, so this is a same-origin request.
    async function fetchPostFromApi(pageUrl) {
        let slug = null;
        try {
            const path = new URL(pageUrl).pathname;
            const match = path.match(/\/p\/([^/?#]+)/);
            slug = match ? match[1] : null;
        } catch (e) {
            return null;
        }
        if (!slug) return null;

        try {
            const response = await fetch(`/api/v1/posts/${encodeURIComponent(slug)}`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.warn('Post API lookup failed:', e);
            return null;
        }
    }

    // ----------------------------------------------------------------- helpers

    function absolute(url, base) {
        const pageUrl = typeof window !== 'undefined' ? window.location.href : undefined;
        try {
            return new URL(url, base || pageUrl).href;
        } catch (e) {
            return null;
        }
    }

    function isMediaUrl(value) {
        return typeof value === 'string' && /^https?:\/\//i.test(value) && MEDIA_EXT.test(value);
    }

    function formatDuration(seconds) {
        const total = Math.round(Number(seconds));
        if (!isFinite(total) || total <= 0) return null;
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = (n) => String(n).padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    }

    function extensionOf(url) {
        const match = String(url).match(MEDIA_EXT);
        return match ? match[1].toLowerCase() : 'bin';
    }

    function kindOf(url) {
        const ext = extensionOf(url);
        if (/^(mp4|m4v|mov|webm|m3u8|mpd)$/.test(ext)) return 'video';
        return 'audio';
    }

    function sanitizeFilename(name) {
        return String(name || 'substack')
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 100) || 'substack';
    }

    // Add an item unless we already have that URL. Earlier finds win, because
    // the explicitly labelled fields are collected before the generic sweep.
    function addItem(items, item) {
        const url = absolute(item.url);
        if (!url) return;
        if (items.some(existing => existing.url === url)) return;
        items.push({
            url: url,
            label: item.label || 'Media',
            source: item.source || '',
            duration: item.duration || null,
            kind: item.kind || kindOf(url),
            note: item.note || null
        });
    }

    // ---------------------------------------------------------------- collect

    // Mux (Substack's video backend) plays anything by playback id. The HLS
    // playlist always works; the static renditions only exist if they were
    // enabled on the asset, so they are marked as such.
    function addMuxItem(items, playbackId, label, source) {
        if (!playbackId || typeof playbackId !== 'string') return;
        addItem(items, {
            url: `https://stream.mux.com/${playbackId}.m3u8`,
            label: `${label} (HLS)`,
            source: source,
            kind: 'video',
            note: 'Streaming playlist - download with yt-dlp, not the browser'
        });
        addItem(items, {
            url: `https://stream.mux.com/${playbackId}/audio.m4a`,
            label: `${label} (audio only)`,
            source: source,
            kind: 'audio',
            note: 'Static rendition - only exists if enabled on the asset'
        });
    }

    // Walk an arbitrary value looking for media URLs, remembering the JSON path
    // so unknown or newly added Substack fields still show up with a useful
    // label. Long strings (body_html) are scanned for embedded URLs too.
    function deepScan(value, path, items, seen) {
        if (value === null || value === undefined) return;

        if (typeof value === 'string') {
            if (isMediaUrl(value)) {
                addItem(items, { url: value, label: 'Media', source: path });
            } else if (value.length > 200) {
                const matches = value.match(URL_IN_TEXT) || [];
                matches.forEach(candidate => {
                    const cleaned = candidate.replace(/[.,;)\]}]+$/, '');
                    if (isMediaUrl(cleaned)) {
                        addItem(items, { url: cleaned, label: 'Media in post body', source: path });
                    }
                });
            }
            return;
        }

        if (typeof value !== 'object') return;
        if (seen.has(value)) return;
        seen.add(value);

        if (Array.isArray(value)) {
            value.forEach((entry, i) => deepScan(entry, `${path}[${i}]`, items, seen));
            return;
        }

        Object.keys(value).forEach(key => {
            if (/^(playback_?id)$/i.test(key)) {
                addMuxItem(items, value[key], 'Video', `${path}.${key}`);
            }
            deepScan(value[key], `${path}.${key}`, items, seen);
        });
    }

    // Known media fields first, so they get proper labels and durations.
    function collectFromPost(post, items) {
        if (!post) return;

        const named = [
            { value: post.podcast_url, label: 'Podcast episode', source: 'post.podcast_url', duration: post.podcast_duration },
            { value: post.podcastFields && post.podcastFields.free_podcast_url, label: 'Podcast (free preview)', source: 'post.podcastFields.free_podcast_url', duration: post.podcastFields && post.podcastFields.free_podcast_duration }
        ];

        named.forEach(entry => {
            if (isMediaUrl(entry.value)) {
                addItem(items, {
                    url: entry.value,
                    label: entry.label,
                    source: entry.source,
                    duration: formatDuration(entry.duration)
                });
            }
        });

        (post.audio_items || []).forEach((audio, i) => {
            if (!audio || !isMediaUrl(audio.audio_url)) return;
            const isTts = audio.type === 'tts';
            const voice = audio.voice_id ? ` - ${audio.voice_id}` : '';
            addItem(items, {
                url: audio.audio_url,
                label: (isTts ? 'AI text-to-speech' : 'Audio') + voice,
                source: `post.audio_items[${i}].audio_url`,
                note: audio.status && audio.status !== 'completed' ? `Status: ${audio.status}` : null
            });
        });

        const uploads = [
            { value: post.podcastUpload, label: 'Podcast upload', source: 'post.podcastUpload' },
            { value: post.podcastPreviewUpload, label: 'Podcast preview', source: 'post.podcastPreviewUpload' },
            { value: post.voiceoverUpload, label: 'Voiceover', source: 'post.voiceoverUpload' },
            { value: post.videoUpload, label: 'Video', source: 'post.videoUpload' }
        ];

        uploads.forEach(upload => {
            if (!upload.value || typeof upload.value !== 'object') return;
            const found = [];
            deepScan(upload.value, upload.source, found, new WeakSet());
            found.forEach(item => addItem(items, {
                url: item.url,
                // deepScan only labels what it recognises, so keep its label
                // when it found something specific (e.g. a Mux rendition).
                label: item.label === 'Media' ? upload.label : item.label,
                source: item.source,
                kind: item.kind,
                note: item.note
            }));
        });

        // Everything else anywhere in the post payload.
        deepScan(post, 'post', items, new WeakSet());
    }

    // Media that only exists in the rendered page, e.g. a player that built its
    // <audio> element after the reader pressed play.
    function collectFromDom(doc, items) {
        const elements = Array.from(doc.querySelectorAll('audio, video, audio source, video source'));

        elements.forEach(el => {
            const tag = el.tagName.toLowerCase();
            const parent = el.parentElement ? el.parentElement.tagName.toLowerCase() : '';
            const kind = tag === 'source' ? parent : tag;
            const src = el.getAttribute('src') || el.currentSrc || '';
            if (!src) return;
            const url = absolute(src);
            if (!url || !/^https?:/i.test(url)) return;
            addItem(items, {
                url: url,
                label: kind === 'video' ? 'Video (on page)' : 'Audio (on page)',
                source: `<${tag}> in page`,
                kind: kind === 'video' ? 'video' : 'audio'
            });
        });
    }

    function collectFromMeta(doc, items) {
        const selectors = [
            ['meta[property="og:audio"]', 'Audio (og:audio)', 'audio'],
            ['meta[property="og:video"]', 'Video (og:video)', 'video'],
            ['meta[property="og:video:secure_url"]', 'Video (og:video)', 'video'],
            ['meta[name="twitter:player:stream"]', 'Video (twitter:player)', 'video']
        ];

        selectors.forEach(([selector, label, kind]) => {
            Array.from(doc.querySelectorAll(selector)).forEach(meta => {
                const url = meta.getAttribute('content');
                if (isMediaUrl(url)) {
                    addItem(items, { url: url, label: label, source: selector, kind: kind });
                }
            });
        });
    }

    function collectFromJsonLd(doc, items) {
        Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).forEach((script, i) => {
            try {
                deepScan(JSON.parse(script.textContent || 'null'), `ld+json[${i}]`, items, new WeakSet());
            } catch (e) { /* malformed JSON-LD is not our problem */ }
        });
    }

    // ------------------------------------------------------------------ output

    function buildMarkdown(items, meta) {
        const lines = [`# ${meta.title}`, '', meta.url, ''];
        if (!items.length) {
            lines.push('No audio or video found on this post.');
            return lines.join('\n');
        }
        items.forEach(item => {
            const bits = [item.kind, item.duration].filter(Boolean).join(', ');
            lines.push(`- **${item.label}**${bits ? ` (${bits})` : ''}`);
            lines.push(`  - ${item.url}`);
            if (item.source) lines.push(`  - source: \`${item.source}\``);
            if (item.note) lines.push(`  - note: ${item.note}`);
        });
        return lines.join('\n');
    }

    // The cookies-export script writes a cookies.txt in exactly this format,
    // which is what subscriber-only media needs.
    function buildYtDlpCommand(items, meta) {
        if (!items.length) return '';
        const name = sanitizeFilename(meta.title);
        return `yt-dlp --cookies cookies.txt -o "${name}.%(ext)s" "${items[0].url}"`;
    }

    // chrome.downloads runs in the background service worker, which has host
    // permissions for every origin. A cross-origin <a download> in the page
    // would be ignored by the browser and just navigate away instead.
    function downloadViaBackground(url, filename) {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                reject(new Error('Extension APIs unavailable'));
                return;
            }
            try {
                chrome.runtime.sendMessage({ action: 'downloadMedia', url, filename }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (!response || !response.success) {
                        reject(new Error(response && response.error ? response.error : 'Unknown download error'));
                        return;
                    }
                    resolve(response);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    // --------------------------------------------------------------------- UI

    function createModal(items, meta) {
        const existing = document.getElementById('substack-audio-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'substack-audio-modal';

        const markdown = buildMarkdown(items, meta);
        const ytDlp = buildYtDlpCommand(items, meta);

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
                        <h2 style="margin: 0; color: #1a1a1a; font-size: 18px;">Substack Audio</h2>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            <button id="sa-copy-all-btn" style="
                                background: #007cba;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Copy list</button>
                            <button id="sa-copy-ytdlp-btn" style="
                                background: #8b5cf6;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Copy yt-dlp</button>
                            <button id="sa-close-btn" style="
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
                    <div id="sa-status" style="
                        display: none;
                        padding: 10px 20px;
                        font-size: 13px;
                        border-bottom: 1px solid #e1e5e9;
                    "></div>
                    <div id="sa-body" style="
                        padding: 20px;
                        overflow-y: auto;
                        flex: 1;
                    "></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const body = modal.querySelector('#sa-body');
        const statusEl = modal.querySelector('#sa-status');

        function showStatus(text, type) {
            const palette = {
                info: ['#eff6ff', '#1e40af'],
                success: ['#dcfce7', '#166534'],
                error: ['#fef2f2', '#991b1b']
            };
            const [background, color] = palette[type] || palette.info;
            statusEl.style.display = 'block';
            statusEl.style.background = background;
            statusEl.style.color = color;
            statusEl.textContent = text;
        }

        if (!items.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#666; font-size:14px; line-height:1.6;';
            empty.innerHTML = `
                <p style="margin:0 0 12px;">No audio or video found on this post.</p>
                <p style="margin:0 0 12px;">If the post does have a player, press play once and run the
                script again - some players only create the media element on demand.</p>
                <p style="margin:0;">Subscriber-only audio may also require you to be logged in.</p>
            `;
            body.appendChild(empty);
        }

        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.style.cssText = `
                border: 1px solid #e1e5e9;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 12px;
            `;

            const heading = document.createElement('div');
            heading.style.cssText = 'display:flex; justify-content:space-between; gap:8px; align-items:baseline; margin-bottom:8px;';

            const title = document.createElement('div');
            title.style.cssText = 'font-weight:600; color:#1a1a1a; font-size:14px;';
            title.textContent = item.label;
            heading.appendChild(title);

            const badges = document.createElement('div');
            badges.style.cssText = 'color:#666; font-size:12px; white-space:nowrap;';
            badges.textContent = [item.kind, extensionOf(item.url), item.duration].filter(Boolean).join(' · ');
            heading.appendChild(badges);

            row.appendChild(heading);

            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.readOnly = true;
            urlInput.value = item.url;
            urlInput.style.cssText = `
                width: 100%;
                padding: 8px 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 12px;
                box-sizing: border-box;
                margin-bottom: 8px;
            `;
            urlInput.addEventListener('focus', () => urlInput.select());
            row.appendChild(urlInput);

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px; align-items:center;';

            const copyBtn = document.createElement('button');
            copyBtn.textContent = 'Copy URL';
            copyBtn.style.cssText = 'background:#007cba; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:13px;';
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(item.url);
                } catch (e) {
                    urlInput.select();
                    document.execCommand('copy');
                }
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, 2000);
            });
            actions.appendChild(copyBtn);

            const playlist = IS_PLAYLIST.test(item.url);
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = playlist ? 'Use yt-dlp' : 'Download';
            downloadBtn.disabled = playlist;
            downloadBtn.style.cssText = `background:${playlist ? '#9ca3af' : '#28a745'}; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:${playlist ? 'not-allowed' : 'pointer'}; font-size:13px;`;
            if (!playlist) {
                downloadBtn.addEventListener('click', async () => {
                    const suffix = items.length > 1 ? `-${index + 1}` : '';
                    const filename = `${sanitizeFilename(meta.title)}${suffix}.${extensionOf(item.url)}`;
                    downloadBtn.disabled = true;
                    downloadBtn.textContent = 'Downloading...';
                    try {
                        // The worker corrects the extension when the URL did
                        // not reveal the file type, so report what it saved.
                        const result = await downloadViaBackground(item.url, filename);
                        downloadBtn.textContent = 'Downloaded!';
                        showStatus(`Saved ${(result && result.filename) || 'file'}`, 'success');
                    } catch (e) {
                        downloadBtn.textContent = 'Download';
                        showStatus(`Download failed (${e.message}). Opening in a new tab instead.`, 'error');
                        window.open(item.url, '_blank', 'noopener');
                    } finally {
                        setTimeout(() => {
                            downloadBtn.disabled = false;
                            downloadBtn.textContent = 'Download';
                        }, 2500);
                    }
                });
            }
            actions.appendChild(downloadBtn);

            const openLink = document.createElement('a');
            openLink.href = item.url;
            openLink.target = '_blank';
            openLink.rel = 'noopener';
            openLink.textContent = 'Open';
            openLink.style.cssText = 'color:#007cba; font-size:13px; text-decoration:none;';
            actions.appendChild(openLink);

            const source = document.createElement('span');
            source.style.cssText = "color:#999; font-size:11px; font-family:'Monaco','Menlo',monospace; margin-left:auto;";
            source.textContent = item.source;
            actions.appendChild(source);

            row.appendChild(actions);

            if (item.note) {
                const note = document.createElement('div');
                note.style.cssText = 'color:#92400e; background:#fffbeb; font-size:12px; padding:6px 8px; border-radius:4px; margin-top:8px;';
                note.textContent = item.note;
                row.appendChild(note);
            }

            body.appendChild(row);
        });

        if (meta.feedUrl) {
            const feed = document.createElement('div');
            feed.style.cssText = 'color:#666; font-size:12px; margin-top:4px;';
            feed.textContent = `Podcast feed: ${meta.feedUrl}`;
            body.appendChild(feed);
        }

        modal.querySelector('#sa-copy-all-btn').addEventListener('click', async function() {
            try {
                await navigator.clipboard.writeText(markdown);
                showStatus('List copied as markdown', 'success');
            } catch (e) {
                showStatus(`Copy failed: ${e.message}`, 'error');
            }
        });

        const ytDlpBtn = modal.querySelector('#sa-copy-ytdlp-btn');
        if (!ytDlp) {
            ytDlpBtn.disabled = true;
            ytDlpBtn.style.background = '#9ca3af';
            ytDlpBtn.style.cursor = 'not-allowed';
        } else {
            ytDlpBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(ytDlp);
                    showStatus('yt-dlp command copied - export cookies.txt first for subscriber-only media', 'success');
                } catch (e) {
                    showStatus(`Copy failed: ${e.message}`, 'error');
                }
            });
        }

        modal.querySelector('#sa-close-btn').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal.firstElementChild) modal.remove(); });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }

    // -------------------------------------------------------------- collection

    // Gather everything from a parsed page. Kept free of DOM-modal code so it
    // can be exercised against the saved fixtures in test_sites/.
    function collectMediaItems(preloads, post, doc) {
        const items = [];
        collectFromPost(post, items);
        collectFromDom(doc, items);
        collectFromMeta(doc, items);
        collectFromJsonLd(doc, items);
        return items;
    }

    function buildMeta(preloads, post, doc) {
        const pub = (preloads && preloads.pub) || {};
        const titleEl = doc.querySelector('h1.post-title, h1');
        return {
            title: (post && post.title) || (titleEl && titleEl.textContent.trim()) || doc.title || 'substack',
            url: (post && post.canonical_url) || (typeof window !== 'undefined' ? window.location.href : ''),
            feedUrl: pub.podcast_feed_url || null
        };
    }

    // Node test harness: expose the pure parts instead of running the UI.
    if (typeof document === 'undefined') {
        module.exports = { extractPreloads, collectMediaItems, buildMeta, buildMarkdown, preloadsMatchUrl };
        return;
    }

    // -------------------------------------------------------------------- run

    (async function run() {
        const preloads = extractPreloads(document);
        let post = preloads && preloads.post;

        if (!preloadsMatchUrl(post, window.location.href)) {
            console.log('Inline post data is for another post, fetching from the API...');
            const fresh = await fetchPostFromApi(window.location.href);
            if (fresh) post = fresh;
        }

        if (!post) {
            const fresh = await fetchPostFromApi(window.location.href);
            if (fresh) post = fresh;
        }

        const items = collectMediaItems(preloads, post, document);
        const meta = buildMeta(preloads, post, document);

        createModal(items, meta);

        console.log(`✅ Substack audio export: found ${items.length} media file(s)`);
        console.table(items.map(i => ({ label: i.label, kind: i.kind, url: i.url })));

        return items;
    })();
})();
