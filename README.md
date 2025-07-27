# Kristomi's Scripts - Chrome Extension

A Chrome extension that provides useful JavaScript utilities for web scraping and data export. Originally designed as a collection of bookmarklets, this has evolved into a browser extension that offers a clean, user-friendly interface for running specialized scripts on various websites.

## 🚀 What is this?

This extension provides a curated collection of JavaScript utilities that can be executed on web pages with a single click. It's particularly useful for:

- **Data Export**: Extract and download conversations from AI platforms like ChatGPT and Claude
- **Web Scraping**: Collect structured data from websites (like Kindle highlights)
- **Content Management**: Process and format web content for personal use

The extension uses a popup interface that dynamically shows relevant scripts based on the current website you're visiting.

## 📦 Installation

1. Clone this repository
2. Run `npm run build` to build the extension
3. Load the `build/` folder as an unpacked extension in Chrome
4. The extension icon will appear in your browser toolbar

## 🛠️ Available Scripts

### 📚 Kindle Highlights Extractor

**Target Site**: `read.amazon.com/kp/notebook`

Extracts highlights from your Amazon Kindle notebook and exports them as a formatted Markdown file.

**Features:**
- **Book Selection Interface**: Choose which books to export from an interactive overlay
- **Bulk Selection**: Select all books at once or pick individual titles
- **Rich Metadata**: Includes book title, author, and annotation date
- **Markdown Export**: Clean, readable format perfect for note-taking apps
- **Duplicate Filtering**: Automatically removes duplicate highlights

**How to use:**
1. Navigate to your Kindle notebook page
2. Click the extension icon and select "Kindle Highlights"
3. Choose which books you want to export
4. The script will automatically scroll through your highlights and download a `.md` file

### 🤖 ChatGPT Conversation Exporter

**Target Sites**: `chatgpt.com`, `chat.openai.com`

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

**Target Site**: `claude.ai`

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
2. Add the script configuration to `config.json`
3. Run `npm run build` to update the extension
4. Reload the extension in Chrome

### Script Configuration

Each script in `config.json` should include:
```json
{
  "name": "Display Name",
  "category": "Category",
  "url": "path/to/script.js",
  "sites": ["domain1.com", "domain2.com"],
  "description": "Brief description"
}
```

## 📄 License

MIT License - Feel free to use and modify as needed.

