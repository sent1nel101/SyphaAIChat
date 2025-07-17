# Setup Guide - Claude Code Integration

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Claude Code API Key

Create a `.env` file in the project root:
```bash
CLAUDE_CODE_API_KEY=your_anthropic_api_key_here
```

**Note:** The `.env` file is already added to `.gitignore` for security.

### 3. Run the Application
```bash
python app.py
```

### 4. Open in Browser
Navigate to `http://localhost:5000`

## Features

### 🚀 Split-Screen Interface
- Interface automatically splits when AI responds
- Chat interface on left (400px)
- AI responses on right (larger panel)
- Smooth transitions and mobile-responsive

### 🤖 Dual AI Support
- **Ollama Models**: Local LLM support (llama2, mistral, codellama, etc.)
- **Claude Code**: Cloud-based AI with advanced code analysis tools

### 📁 Office Document Support
- **Word Documents** (.docx): Extracts text, headings, and tables
- **Excel Files** (.xlsx, .xls): Extracts spreadsheet data with limits
- **PowerPoint** (.pptx): Extracts text from all slides
- **Plus**: PDF, images, code files, and more

### 🎨 Rich Formatting
- Tables with hover effects and copy-to-clipboard
- Enhanced typography with bold, italic, links
- Code syntax highlighting
- Responsive design for all screen sizes

## Usage

### Selecting Models
1. Choose from available Ollama models OR
2. Select "claude-code" for advanced AI capabilities

### File Processing
1. Click "📎 Attach File" or drag & drop
2. Supported: Word, Excel, PowerPoint, PDF, images, code files
3. AI will analyze and respond with structured data

### Split-Screen Mode
- Automatically activates when AI responds
- Close with "×" button to return to normal view
- Mobile-friendly with stacked layout

## Configuration

### Environment Variables (.env)
```bash
# Required for Claude Code
CLAUDE_CODE_API_KEY=your_key_here

# Optional Flask settings
SECRET_KEY=your-secret-key
OLLAMA_BASE_URL=http://localhost:11434
MAX_FILE_SIZE=16777216
```

### Ollama Setup (for local models)
```bash
# Install Ollama
# Download from: https://ollama.ai

# Install models
ollama pull llama2
ollama pull mistral
ollama pull codellama

# Start Ollama service
ollama serve
```

## Troubleshooting

### Claude Code Issues
- **"API key required"**: Add CLAUDE_CODE_API_KEY to .env file
- **Import errors**: Run `pip install claude-code-sdk`
- **No response**: Check API key validity

### Ollama Issues
- **No models found**: Install Ollama and pull models
- **Connection error**: Start Ollama with `ollama serve`

### File Upload Issues
- **File too large**: Max 16MB (configurable)
- **Unsupported type**: Check ALLOWED_EXTENSIONS
- **Processing errors**: Check file permissions

## Development

### Project Structure
```
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── .env               # Environment variables (create this)
├── .env.example       # Environment template
├── static/
│   ├── css/style.css  # Enhanced styling
│   └── js/app.js      # Split-screen & Claude integration
├── templates/
│   └── index.html     # Responsive UI
└── uploads/           # File upload directory
```

### Adding New Features
1. Backend: Add routes to `app.py`
2. Frontend: Update `static/js/app.js`
3. Styling: Modify `static/css/style.css`
4. Dependencies: Update `requirements.txt`

## Security Notes

- ✅ API keys stored in `.env` (not committed to git)
- ✅ File uploads validated and size-limited
- ✅ Secure file processing with error handling
- ✅ SQL injection protection with parameterized queries

## Support

For issues or questions:
1. Check this setup guide
2. Verify environment variables in `.env`
3. Test with simple text messages before file uploads
4. Check browser console for JavaScript errors

---

**Enjoy your enhanced AI chat experience with split-screen interface and Office document support!** 🎉
