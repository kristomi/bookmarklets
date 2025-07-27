# Kristomi's Scripts - Chrome Extension

A Chrome extension that provides useful JavaScript utilities for web scraping and data export. Originally designed as a collection of bookmarklets, this has evolved into a browser extension that offers a clean, user-friendly interface for running specialized scripts on any website.

## 🚀 What is this?

This extension provides a curated collection of JavaScript utilities that can be executed on web pages with a single click. It's particularly useful for:

- **Data Export**: Extract and download conversations from AI platforms like ChatGPT and Claude
- **Web Scraping**: Collect structured data from websites (like Kindle highlights, Substack articles)
- **Content Management**: Process and format web content for personal use

The extension features a popup interface with all scripts available on any website - no site restrictions!

## 📦 Installation

1. Clone this repository
2. Run `npm run build` to build the extension
3. Load the `build/` folder as an unpacked extension in Chrome
4. The extension icon will appear in your browser toolbar

## 🛠️ Available Scripts

### 📚 Kindle Highlights Extractor

Extracts highlights from your Amazon Kindle notebook and exports them as a formatted Markdown file.

**Features:**
- **Book Selection Interface**: Choose which books to export from an interactive overlay
- **Bulk Selection**: Select all books at once or pick individual titles
- **Rich Metadata**: Includes book title, author, and annotation date
- **Interactive Modal**: Copy to clipboard or download with smart filename generation
- **Duplicate Filtering**: Automatically removes duplicate highlights

**How to use:**
1. Navigate to your Kindle notebook page (`read.amazon.com/kp/notebook`)
2. Click the extension icon and select "Kindle Highlights"
3. Choose which books you want to export
4. The script will automatically scroll through your highlights and show a modal with the results
5. Copy to clipboard or download as a `.md` file

### 📰 Substack Article Export

**NEW!** Converts Substack articles (and other blog posts) to clean Markdown format with smart content extraction.

**Features:**
- **Smart Content Detection**: Automatically finds and extracts article content
- **Rich Formatting**: Preserves headings, paragraphs, lists, quotes, images, and tables
- **Inline Formatting**: Converts bold, italic, code, and links to Markdown
- **UI Element Filtering**: Skips navigation, buttons, and other non-content elements
- **Interactive Modal**: Copy to clipboard or download with article title as filename
- **Image Handling**: Converts images to Markdown with absolute URLs

**How to use:**
1. Navigate to any Substack article (or other blog post)
2. Click the extension icon and select "Substack Article Export"
3. The script will extract the article content and show it in a modal
4. Copy to clipboard or download as a `.md` file with the article title

### 🤖 ChatGPT Conversation Exporter

Exports entire ChatGPT conversations as well-formatted Markdown files with proper source attribution.

**Features:**
- **Complete HTML Processing**: Captures the full conversation including rich formatting
- **Smart Link Handling**: Converts references to clean footnotes with URL cleaning
- **Code Block Preservation**: Maintains syntax highlighting information in exported code
- **Source Attribution**: Converts inline citations to numbered footnotes
- **Progress Tracking**: Visual progress indicator during export process

**How to use:**
1. Open any ChatGPT conversation
2. Click the extension icon and select "ChatGPT Export"
3. Confirm the export in the dialog
4. A markdown file will be downloaded with the full conversation

### 💬 Claude Conversation Exporter

Exports Claude conversations with clean formatting and proper message attribution.

**Features:**
- **Message Detection**: Automatically identifies user and assistant messages
- **Timestamp Handling**: Preserves conversation timing when available
- **Clean Formatting**: Removes UI elements and focuses on content
- **Progress Indication**: Shows export progress with detailed status updates
- **Error Handling**: Robust error detection with helpful troubleshooting tips

**How to use:**
1. Open any Claude conversation
2. Click the extension icon and select "Claude Export"
3. Wait for the export to complete
4. Download the generated markdown file

## 🔧 Development

### Adding New Scripts

1. Create your script file in the appropriate subfolder under `scripts/`
   - Use `scripts/scrapers/` for content extraction scripts
   - Use `scripts/llms/` for AI platform scripts
2. Add the script configuration to `config.json`
3. Run `npm run build` to update the extension
4. Reload the extension in Chrome

### Script Configuration

Each script in `config.json` should include:
```json
{
  "name": "Display Name",
  "category": "Scrapers|LLMs",
  "description": "Brief description of what the script does"
}
```

**That's it!** The build system automatically:
- Derives the filename from the script key using simple rules:
  - `"script-name-export"` → `script-name.js` (removes `-export` suffix)
  - `"script-name"` → `script-name.js` (adds `.js` extension)
- Finds the script in the appropriate folder
- Bundles it into the extension

**Examples:**
- `"substack-export"` → looks for `substack.js`
- `"kindle-highlights"` → looks for `kindle-highlights.js`
- `"claude-export"` → looks for `claude.js`

### Recent Improvements

- ✅ **No Site Restrictions**: All scripts now work on any website
- ✅ **Simplified Configuration**: No more URLs or site lists needed
- ✅ **Smart Filename Detection**: Automatic mapping from script keys to files
- ✅ **Interactive Modals**: Copy/download interfaces for better UX
- ✅ **Local-Only Build**: No external dependencies, all files are bundled locally

## 📄 License

MIT License - Feel free to use and modify as needed.

