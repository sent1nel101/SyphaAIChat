# Ollama Chat Web Interface

A modern, feature-rich web interface for interacting with Ollama language models. This application provides a clean, responsive chat interface with file upload capabilities, session management, and support for multiple LLM models.

## ✨ Features

- **🤖 Multi-Model Support**: Automatically detects and loads all available Ollama models
- **💬 Interactive Chat**: Clean, modern chat interface with real-time messaging
- **📎 File Upload**: Support for text files, PDFs, images, and code files
- **📱 Responsive Design**: Mobile-friendly interface with hamburger menu
- **💾 Session Management**: Save, load, and manage multiple chat sessions
- **🎨 Rich Formatting**: Markdown support with syntax highlighting for code
- **🔄 Drag & Drop**: Easy file uploads with drag-and-drop functionality
- **🌙 Dark Mode**: Automatic dark mode support based on system preferences

## 🚀 Quick Start

### Prerequisites

- Python 3.7 or higher
- [Ollama](https://ollama.ai/) installed and running
- At least one Ollama model installed

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sent1nel101/SyphaAIChat.git
   cd ollama-chat-web
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Ollama** (if not already installed)
   ```bash
   # On macOS
   brew install ollama
   
   # On Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # On Windows - download from https://ollama.ai/download
   ```

4. **Start Ollama service**
   ```bash
   ollama serve
   ```

5. **Install at least one model**
   ```bash
   # Install Llama 2 (7B parameters)
   ollama pull llama2
   
   # Or install other models
   ollama pull mistral
   ollama pull codellama
   ollama pull phi
   ```

6. **Run the application**
   ```bash
   python app.py
   ```

7. **Open your browser**
   Navigate to `http://localhost:5000`

## 📋 Requirements

Create a `requirements.txt` file with the following dependencies:
Alternatively, install these one by one on the command line.

```txt
Flask==2.3.3
requests==2.31.0
Werkzeug==2.3.7

# Optional dependencies for enhanced features
markdown==3.5.1
pypdf==3.17.0
Pillow==10.0.1
```

### Optional Dependencies

- **markdown**: Enables rich text formatting and syntax highlighting
- **pypdf** or **PyPDF2**: Enables PDF file processing
- **Pillow**: Enables image file processing and metadata extraction

Install optional dependencies:
```bash
pip install markdown pypdf Pillow
```

## 🎯 Usage

### Basic Chat
1. Select a model from the dropdown menu
2. Type your message in the input field
3. Press Enter or click Send
4. View the AI's response in the chat area

### File Upload
1. Click the "Choose File" button or drag & drop a file
2. Supported formats: `.txt`, `.md`, `.py`, `.js`, `.html`, `.css`, `.json`, `.xml`, `.csv`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`
3. Add a message describing what you want to do with the file
4. Send the message - the AI will analyze the file content

### Session Management
1. Click the "Sessions" button to view saved conversations
2. Click "New Chat" to start a fresh conversation
3. Click on any previous session to reload it
4. Delete sessions you no longer need

### Mobile Usage
- On mobile devices, use the hamburger menu (☰) to access controls
- All features are fully functional on mobile browsers
- Touch-friendly interface with proper button sizing

## 🛠️ Configuration

### Environment Variables

You can customize the application using environment variables:

```bash
# Ollama server URL (default: http://localhost:11434)
export OLLAMA_BASE_URL=http://localhost:11434

# Upload folder (default: uploads)
export UPLOAD_FOLDER=uploads

# Maximum file size in bytes (default: 16MB)
export MAX_FILE_SIZE=16777216

# Database file (default: chat_app.db)
export DATABASE=chat_app.db
```

### File Upload Limits

- **Maximum file size**: 16MB
- **Allowed extensions**: txt, md, py, js, html, css, json, xml, csv, pdf, png, jpg, jpeg, gif, bmp, webp
- **Storage**: Files are stored in the `uploads/` directory

## 🔧 Troubleshooting

### Models Not Loading
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if not running
ollama serve

# Install a model if none are available
ollama pull llama2
```

### Connection Issues
- Ensure Ollama is running on port 11434
- Check firewall settings
- Verify Ollama installation: `ollama --version`

### File Upload Issues
- Check file size (must be under 16MB)
- Verify file extension is supported
- Ensure `uploads/` directory has write permissions

### Performance Issues
- Larger models require more RAM and processing time
- Consider using smaller models like `phi` or `mistral:7b` for faster responses
- Close unused browser tabs to free up memory

## 📁 Project Structure

```
ollama-chat-web/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── chat_app.db           # SQLite database (created automatically)
├── uploads/              # File upload directory
├── static/
│   ├── css/
│   │   └── style.css     # Application styles
│   └── js/
│       └── script.js     # Frontend JavaScript
└── templates/
    └── index.html        # Main HTML template
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ollama](https://ollama.ai/) for providing the excellent local LLM runtime
- [Flask](https://flask.palletsprojects.com/) for the web framework
- The open-source community for various dependencies and inspiration

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Search existing [GitHub Issues](https://github.com/yourusername/ollama-chat-web/issues)
3. Create a new issue with detailed information about your problem

## 🔮 Roadmap

- [ ] Real-time streaming responses
- [ ] Custom model parameters (temperature, top_p, etc.)
- [ ] Export chat sessions to various formats
- [ ] Plugin system for custom file processors
- [ ] Multi-user support with authentication
- [ ] API endpoints for programmatic access
- [ ] Docker containerization
- [ ] Kubernetes deployment manifests

---

**Made with ❤️ for the Ollama community**

**Text Files**:

* `.txt`
* `.log`

These files contain plain text and are often used for storing notes or logging data.

**Markup Languages**:

* `.html`
* `.xml`
* `.json`

These file types are used to structure and format content on the web, store data in a structured way, and provide a common language for machine-readable data exchange.

**Programming Languages**:

* **C++**
* **JavaScript**
* **Python**
* **Ruby**
* **PHP**

These programming languages are used to develop software applications, games, websites, and more. I can understand and respond to code snippets in these languages using triple backticks ````.

**Image Files**:

* `.png`
* `.jpg`
* `.jpeg`
* `.gif`

These files contain graphical images for use on the web or in documents.

**Video Files**:

* `.mp4`
* `.avi`
* `.mov`

These file types store video content, often used for multimedia presentations or streaming.

**Audio Files**:

* `.mp3`
* `.wav`
* `.aac`

These files contain audio data for music and other sounds.

**Archive Files**:

* `.zip`
* `.rar`

These file types are used to compress and store multiple files together, making them easier to transfer or save space.

**Microsoft Office Files**:

* `.docx`
* `.xlsx`
* `.pptx`

These files contain word processing documents, spreadsheets, and presentations created with the Microsoft Office suite.

**Adobe Creative Suite Files**:

* `.ai`
* `.psd`
* `.indd`
* `.eps`
