// Import anthropic if needed in future
// const { ClaudeClient } = require('claude-sdk');

// Global variables
let currentSessionId = null;
let isLoading = false;
let isSplitMode = false;
let claudeCodeAvailable = false;

// DOM Elements
let chatContainer, promptInput, sendButton, modelSelect, fileInput, fileButton, fileInfo, filePreview;
let mainContainer, responseArea, responseContent, closeResponseBtn, modalOverlay, voiceButton;
let imageModal, imagePanelBtn, generateImageBtn, setupReplicateBtn;
let videoModal, videoPanelBtn, generateVideoBtn, setupVideoBtn;

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    initializeElements();
    initializeEventListeners();
    loadModels();
    initializeHamburgerMenu();
    showWelcomeMessage(); // Add welcome message on page load
    updateExportButtonStates(); // Initialize export button states
    initializeMobileOptimizations(); // Initialize mobile-specific features

    // Check Claude Code status
    checkClaudeCodeStatus();


});

function initializeElements() {
    chatContainer = document.getElementById('chat-container');
    promptInput = document.getElementById('prompt-input');
    sendButton = document.getElementById('send-button');
    modelSelect = document.getElementById('model-select');
    fileInput = document.getElementById('file-input');
    fileButton = document.getElementById('file-button');
    fileInfo = document.getElementById('file-info');
    filePreview = document.getElementById('file-preview');
    voiceButton = document.getElementById('voice-button');

    // Split mode elements
    mainContainer = document.getElementById('main-container');
    responseArea = document.getElementById('response-area');
    responseContent = document.getElementById('response-content');

    // Modal overlay elements
    modalOverlay = document.getElementById('modal-overlay');
    
    // Image generation elements
    imageModal = document.getElementById('image-modal');
    imagePanelBtn = document.getElementById('image-panel-btn');
    generateImageBtn = document.getElementById('generate-image-btn');
    setupReplicateBtn = document.getElementById('setup-replicate-btn');
    
    // Video generation elements
    videoModal = document.getElementById('video-modal');
    videoPanelBtn = document.getElementById('video-panel-btn');
    generateVideoBtn = document.getElementById('generate-video-btn');
    setupVideoBtn = document.getElementById('setup-video-btn');
}

function initializeEventListeners() {
    // Send button and enter key
    sendButton.addEventListener('click', sendMessage);
    promptInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // File upload
    fileButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // File drag and drop
    const fileUploadArea = document.getElementById('file-upload-area');
    fileUploadArea.addEventListener('dragover', handleDragOver);
    fileUploadArea.addEventListener('dragleave', handleDragLeave);
    fileUploadArea.addEventListener('drop', handleFileDrop);

    // Remove file button
    document.getElementById('remove-file').addEventListener('click', clearFileSelection);

    // Control buttons
    document.getElementById('new-session-btn').addEventListener('click', createNewSession);
    document.getElementById('clear-btn').addEventListener('click', clearChat);
    
    // Export buttons
    document.getElementById('export-word-btn').addEventListener('click', () => exportSession('word'));
    document.getElementById('export-excel-btn').addEventListener('click', () => exportSession('excel'));
    document.getElementById('export-pdf-btn').addEventListener('click', () => exportSession('pdf'));
    
    // Voice button
    voiceButton.addEventListener('click', toggleVoiceRecording);
    
    // Image generation buttons
    imagePanelBtn.addEventListener('click', showImageModal);
    generateImageBtn.addEventListener('click', generateImage);
    setupReplicateBtn.addEventListener('click', setupReplicateApiKey);
    document.getElementById('close-image-modal').addEventListener('click', hideImageModal);
    
    // Video generation buttons
    videoPanelBtn.addEventListener('click', showVideoModal);
    generateVideoBtn.addEventListener('click', generateVideo);
    setupVideoBtn.addEventListener('click', setupReplicateApiKey);
    document.getElementById('close-video-modal').addEventListener('click', hideVideoModal);

    // Split mode controls - removed close button functionality

    // Model selection handling
    modelSelect.addEventListener('change', function (e) {
        const selectedModel = e.target.value;
        if (!handleClaudeCodeModelSelection(selectedModel)) {
            // If Claude Code selection was invalid, prevent the change
            e.preventDefault();
        }
    });
}

// Hamburger menu functionality
function initializeHamburgerMenu() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navMenu = document.getElementById('nav-menu');
    const menuOverlay = document.getElementById('menu-overlay');

    function toggleMenu() {
        hamburgerMenu.classList.toggle('active');
        navMenu.classList.toggle('active');
        menuOverlay.classList.toggle('active');

        // Prevent body scroll when menu is open
        if (navMenu.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    function closeMenu() {
        hamburgerMenu.classList.remove('active');
        navMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Toggle menu when hamburger is clicked
    hamburgerMenu.addEventListener('click', toggleMenu);

    // Close menu when overlay is clicked
    menuOverlay.addEventListener('click', closeMenu);

    // Close menu when a menu item is clicked (on mobile)
    navMenu.addEventListener('click', function (e) {
        if (e.target.classList.contains('control-btn') || 
            e.target.classList.contains('export-btn') || 
            e.target.id === 'image-panel-btn') {
            closeMenu();
        }
    });

    // Close menu on window resize if screen becomes larger
    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });

    // Close menu on escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeMenu();
        }
    });
}

// Show welcome message - Updated to be a simple AI greeting
function showWelcomeMessage(hasError = false) {
    if (hasError) {
        const errorMessage = `⚠️ **Connection Issue**

I'm having trouble connecting to Ollama. Please make sure:
- Ollama is running (\`ollama serve\`)
- You have at least one model installed (\`ollama pull llama2\`)

Once that's sorted, I'll be ready to help! 😊`;

        addMessage(errorMessage, 'assistant');
        return;
    }

    const welcomeMessage = `👋 **Hi! I'm Sypha, your AI assistant.**

I'm here to help you with questions, analyze files, write code, and much more. 

Drop a file below or ask me anything to get started!`;

    addMessage(welcomeMessage, 'assistant');
}

// Update welcome message with available models - Simplified
function updateWelcomeWithModels(models) {
    // Find the welcome message and add model info subtly
    const messages = chatContainer.querySelectorAll('.assistant-message');
    const welcomeMessage = messages[messages.length - 1]; // Get the last assistant message (should be welcome)

    if (welcomeMessage && models.length > 0) {
        const modelInfo = document.createElement('div');
        modelInfo.className = 'model-info-subtle';
        modelInfo.innerHTML = `✅ ${models.length} model${models.length > 1 ? 's' : ''} available`;

        // Insert before the timestamp
        const timestamp = welcomeMessage.querySelector('.message-timestamp');
        if (timestamp) {
            welcomeMessage.insertBefore(modelInfo, timestamp);
        } else {
            welcomeMessage.appendChild(modelInfo);
        }
    }
}

// Load models function - Updated with simpler error handling
async function loadModels() {
    const modelSelect = document.getElementById('model-select');

    try {
        console.log('Loading models from Ollama...');
        modelSelect.innerHTML = '<option value="">Loading models...</option>';

        const response = await fetch('/api/models', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        console.log('Models API response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Models API response data:', data);

        if (data.success && data.models && data.models.length > 0) {
            modelSelect.innerHTML = '';

            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });

            // Select the first model by default
            modelSelect.value = data.models[0];
            console.log(`Loaded ${data.models.length} models:`, data.models);

            // Update welcome message with available models
            updateWelcomeWithModels(data.models);

        } else {
            throw new Error('No models found in response');
        }

    } catch (error) {
        console.error('Error loading models:', error);

        // Fallback: Add some common models manually
        const fallbackModels = ['llama2', 'llama2:7b', 'llama2:13b', 'codellama', 'mistral', 'phi', 'neural-chat'];

        modelSelect.innerHTML = '<option value="">Select a model</option>';

        fallbackModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });

        // Show error in a simple way - replace the welcome message
        chatContainer.innerHTML = ''; // Clear the welcome message
        showWelcomeMessage(true); // Show error version
    }
}

// Send message function with model selection check
async function sendMessage() {
    const promptInput = document.getElementById('prompt-input');
    const sendButton = document.getElementById('send-button');
    const modelSelect = document.getElementById('model-select');
    const fileInput = document.getElementById('file-input');

    const message = promptInput.value.trim();
    const selectedModel = modelSelect.value;
    const selectedFile = fileInput.files[0];

    // Check if model is selected
    if (!selectedModel) {
        alert('Please select a model first. If no models are available, make sure Ollama is running and you have models installed.');
        return;
    }

    if (!message && !selectedFile) {
        alert('Please enter a message or select a file.');
        return;
    }

    // Disable send button and show loading state
    sendButton.disabled = true;
    sendButton.textContent = 'Sending...';

    try {
        // Add user message to chat
        if (selectedFile) {
            addMessage(message || 'File uploaded', 'user', selectedModel, true, selectedFile.name);
        } else {
            addMessage(message, 'user', selectedModel);
        }

        // Prepare form data
        const formData = new FormData();
        formData.append('message', message);
        formData.append('model', selectedModel);

        if (selectedFile) {
            formData.append('file', selectedFile);
        }

        console.log('Sending message with model:', selectedModel);

        // Send to backend
        const response = await fetch('/api/chat', {
            method: 'POST',
            body: formData
        });

        console.log('Chat API response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Chat API response data:', data);

        if (data.success) {
            // Enter split mode when AI responds
            enterSplitMode();

            // Add assistant response ONLY to split view (not main chat)
            // Use formatted_content if available, otherwise fall back to content
            const responseContent = data.message.formatted_content || data.message.content;
            addResponseToSplitView(responseContent, selectedModel);
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }

    } catch (error) {
        console.error('Error sending message:', error);
        addMessage(`❌ Error: ${error.message}`, 'system');
    } finally {
        // Reset form
        promptInput.value = '';
        clearFileSelection();
        sendButton.disabled = false;
        sendButton.textContent = 'Send';
        promptInput.focus();
    }
}

// Add message to chat with enhanced formatting support
function addMessage(content, role, model = null, hasFile = false, fileName = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    let messageContent = '';

    // Enhanced file indicator with type detection
    if (hasFile && fileName) {
        const fileType = getFileType(fileName);
        const fileIcon = getFileIcon(fileType);
        messageContent += `<div class="file-indicator ${fileType}">
            <span class="file-icon">${fileIcon}</span>
            <span class="file-name">${fileName}</span>
            <span class="file-type">${fileType.toUpperCase()}</span>
        </div>`;
    }

    // Enhanced message content with proper HTML rendering
    const formattedContent = enhanceMessageContent(content, role);
    messageContent += `<div class="message-content">${formattedContent}</div>`;

    if (model) {
        messageContent += `<div class="model-info">
            <span class="model-label">Model:</span>
            <span class="model-name">${model}</span>
        </div>`;
    }

    messageContent += `<div class="message-timestamp">${new Date().toLocaleTimeString()}</div>`;

    messageDiv.innerHTML = messageContent;
    chatContainer.appendChild(messageDiv);

    // Enhanced scrolling with table handling
    scrollToBottom();

    // Post-process tables for better mobile experience
    enhanceTablesInMessage(messageDiv);

    // Add modal functionality to code blocks
    enhanceCodeBlocksWithModal(messageDiv);
}

// File handling functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        showFilePreview(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function handleFileDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        showFilePreview(files[0]);
    }
}

function showFilePreview(file) {
    const fileType = getFileType(file.name);
    const fileIcon = getFileIcon(fileType);
    const fileSizeKB = (file.size / 1024).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const displaySize = file.size > 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;

    // Enhanced file preview with type-specific information
    document.getElementById('file-preview-name').innerHTML = `
        <span class="file-icon">${fileIcon}</span>
        <span class="file-name">${file.name}</span>
    `;

    filePreview.style.display = 'block';
    filePreview.className = `file-preview ${fileType}`;

    // Enhanced file info with processing hints
    const processingHints = getProcessingHints(fileType);
    fileInfo.innerHTML = `
        <div class="file-details">
            <span class="file-size">Size: ${displaySize}</span>
            <span class="file-type-label">Type: ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}</span>
        </div>
        ${processingHints ? `<div class="processing-hint">${processingHints}</div>` : ''}
    `;
}

function getProcessingHints(fileType) {
    const hints = {
        'word': 'Will extract text, headings, and tables from the document',
        'excel': 'Will extract data from all sheets (up to 50 rows per sheet)',
        'powerpoint': 'Will extract text content from all slides',
        'pdf': 'Will extract text content from the PDF',
        'image': 'Will analyze image metadata (use vision-capable models for content analysis)',
        'csv': 'Will parse and display the data in table format',
        'json': 'Will format and validate the JSON structure',
        'javascript': 'Will analyze the code structure and functionality',
        'python': 'Will analyze the code structure and functionality'
    };

    return hints[fileType] || null;
}

function clearFileSelection() {
    fileInput.value = '';
    filePreview.style.display = 'none';
    fileInfo.textContent = 'No file selected';
}

// Enhanced file and content handling functions
function getFileType(fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    const typeMap = {
        // Office documents
        'docx': 'word',
        'doc': 'word',
        'xlsx': 'excel',
        'xls': 'excel',
        'pptx': 'powerpoint',
        'ppt': 'powerpoint',

        // Code files
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'xml': 'xml',

        // Text files
        'txt': 'text',
        'md': 'markdown',
        'csv': 'csv',

        // Media files
        'pdf': 'pdf',
        'png': 'image',
        'jpg': 'image',
        'jpeg': 'image',
        'gif': 'image',
        'bmp': 'image',
        'webp': 'image'
    };

    return typeMap[extension] || 'file';
}

function getFileIcon(fileType) {
    const iconMap = {
        'word': '📄',
        'excel': '📊',
        'powerpoint': '📽️',
        'pdf': '📕',
        'image': '🖼️',
        'javascript': '🟨',
        'typescript': '🔷',
        'python': '🐍',
        'html': '🌐',
        'css': '🎨',
        'json': '📋',
        'xml': '📄',
        'text': '📝',
        'markdown': '📝',
        'csv': '📊',
        'file': '📎'
    };

    return iconMap[fileType] || '📎';
}

function enhanceMessageContent(content, role) {
    // If content is already HTML (from backend formatting), return as-is
    if (content.includes('<') && content.includes('>')) {
        return content;
    }

    // Basic client-side enhancement for unformatted content
    let enhanced = content;

    // Convert URLs to links
    enhanced = enhanced.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Convert line breaks to proper HTML
    enhanced = enhanced.replace(/\n/g, '<br>');

    return enhanced;
}

function scrollToBottom() {
    // Smooth scroll to bottom with animation
    chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}

function enhanceTablesInMessage(messageDiv) {
    const tables = messageDiv.querySelectorAll('table, .formatted-table');

    tables.forEach(table => {
        // Add responsive wrapper for mobile
        if (!table.parentElement.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }

        // Add hover effects to rows
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            row.addEventListener('mouseenter', () => {
                row.style.backgroundColor = getComputedStyle(row).getPropertyValue('--hover-color') || '#f1f3f5';
            });

            row.addEventListener('mouseleave', () => {
                row.style.backgroundColor = '';
            });
        });

        // Add click-to-copy functionality for table cells
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
            cell.addEventListener('dblclick', () => {
                copyToClipboard(cell.textContent);
                showTooltip(cell, 'Copied!');
            });
        });
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
    }
}

function showTooltip(element, message) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = message;
    tooltip.style.cssText = `
        position: absolute;
        background: #333;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
    `;

    document.body.appendChild(tooltip);

    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';

    setTimeout(() => tooltip.style.opacity = '1', 10);

    setTimeout(() => {
        tooltip.style.opacity = '0';
        setTimeout(() => tooltip.remove(), 300);
    }, 2000);
}

function enhanceCodeBlocksWithModal(messageDiv) {
    const codeBlocks = messageDiv.querySelectorAll('pre, code');

    codeBlocks.forEach(block => {
        // Only add modal to larger code blocks (pre elements)
        if (block.tagName === 'PRE') {
            block.style.cursor = 'pointer';
            block.title = 'Click to view in modal';

            block.addEventListener('click', (e) => {
                e.preventDefault();
                showCodeModal(block);
            });
        }
    });
}

function showCodeModal(codeBlock) {
    // Clone the code block
    const modalCode = codeBlock.cloneNode(true);
    modalCode.classList.add('modal-active');

    // Show overlay
    modalOverlay.classList.add('active');

    // Add code block to body for modal display
    document.body.appendChild(modalCode);

    // Add close functionality
    const closeModal = () => {
        modalOverlay.classList.remove('active');
        document.body.removeChild(modalCode);
        document.removeEventListener('keydown', escapeHandler);
        modalOverlay.removeEventListener('click', closeModal);
    };

    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };

    // Event listeners for closing
    modalOverlay.addEventListener('click', closeModal);
    document.addEventListener('keydown', escapeHandler);

    // Add close button to code block
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1002;
    `;

    closeBtn.addEventListener('click', closeModal);
    modalCode.appendChild(closeBtn);
}

// Split mode functionality
function enterSplitMode() {
    if (isSplitMode) return;

    isSplitMode = true;
    mainContainer.classList.add('split-mode');
    responseArea.style.display = 'block';

    // Force visibility - ensure it's shown
    setTimeout(() => {
        responseArea.style.visibility = 'visible';
        responseArea.style.opacity = '1';
    }, 100);

    // Add smooth transition
    mainContainer.style.transition = 'all 0.3s ease';
}

function exitSplitMode() {
    if (!isSplitMode) return;

    isSplitMode = false;
    mainContainer.classList.remove('split-mode');

    // Hide response area after transition
    setTimeout(() => {
        if (!isSplitMode) {
            responseArea.style.display = 'none';
            responseContent.innerHTML = '';
        }
    }, 300);
}

function addResponseToSplitView(content, model = null, isLatest = true) {
    if (!isSplitMode || !responseContent) {
        return;
    }

    const responseDiv = document.createElement('div');
    responseDiv.className = `response-message ${isLatest ? 'latest' : ''}`;

    let messageContent = '';

    // Use formatted content directly if it contains HTML, otherwise enhance it
    const formattedContent = content.includes('<') ? content : enhanceMessageContent(content, 'assistant');
    messageContent += `<div class="message-content">${formattedContent}</div>`;

    if (model) {
        messageContent += `<div class="model-info">
            <span class="model-label">Model:</span>
            <span class="model-name">${model}</span>
        </div>`;
    }

    messageContent += `<div class="message-timestamp">${new Date().toLocaleTimeString()}</div>`;

    responseDiv.innerHTML = messageContent;

    // Remove 'latest' class from previous responses
    const previousLatest = responseContent.querySelector('.response-message.latest');
    if (previousLatest && isLatest) {
        previousLatest.classList.remove('latest');
    }

    // Clear any existing content and add the new response
    responseContent.innerHTML = '';
    responseContent.appendChild(responseDiv);

    // Post-process tables and code blocks for better display
    enhanceTablesInMessage(responseDiv);
    enhanceCodeBlocksWithModal(responseDiv);

    // Scroll to the latest response
    responseDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Session management - Updated to handle welcome message
async function createNewSession() {
    try {
        const response = await fetch('/api/session/new', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();
        if (data.success) {
            currentSessionId = data.session_id;
            exitSplitMode(); // Exit split mode for new session
            clearChat();
            addMessage('🎉 New chat session started!', 'system');
            updateExportButtonStates(); // Update export button states
        }
    } catch (error) {
        console.error('Error creating new session:', error);
        addMessage('❌ Error creating new session', 'system');
    }
}

// Clear chat - Updated to show welcome message after clearing
function clearChat() {
    chatContainer.innerHTML = '';
    clearFileSelection();
    exitSplitMode(); // Exit split mode when starting new conversation
    showWelcomeMessage(); // Show welcome message after clearing
    updateExportButtonStates(); // Update export button states
}

// Session loading removed - sessions panel no longer available

async function deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session?')) {
        return;
    }

    try {
        const response = await fetch(`/api/session/${sessionId}/delete`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.success) {
            // Session deleted successfully
        }
    } catch (error) {
        console.error('Error deleting session:', error);
    }
}

// Clear chat without welcome message (for loading sessions)
function clearChatForSession() {
    chatContainer.innerHTML = '';
}

// Claude Code integration functions
async function checkClaudeCodeStatus() {
    try {
        const response = await fetch('/api/claude-code/status');
        const data = await response.json();

        if (data.success) {
            claudeCodeAvailable = data.available;
            return data;
        }
        return { available: false, sdk_installed: false, has_api_key: false };
    } catch (error) {
        console.error('Error checking Claude Code status:', error);
        return { available: false, sdk_installed: false, has_api_key: false };
    }
}

async function setupClaudeCodeApiKey() {
    const apiKey = prompt('Enter your Claude Code API key:');

    if (!apiKey || !apiKey.trim()) {
        return false;
    }

    try {
        const response = await fetch('/api/claude-code/api-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ api_key: apiKey.trim() })
        });

        const data = await response.json();

        if (data.success) {
            claudeCodeAvailable = data.available;
            addMessage(`✅ Claude Code API key set successfully! You can now use Claude Code model.`, 'system');
            // Reload models to show Claude Code as available
            loadModels();
            return true;
        } else {
            addMessage(`❌ Failed to set Claude Code API key: ${data.error}`, 'system');
            return false;
        }
    } catch (error) {
        console.error('Error setting Claude Code API key:', error);
        addMessage(`❌ Error setting Claude Code API key: ${error.message}`, 'system');
        return false;
    }
}

function handleClaudeCodeModelSelection(selectedModel) {
    // If Claude Code model is selected but not available, prompt for API key
    if (selectedModel === 'claude-code' && !claudeCodeAvailable) {
        const message = `Claude Code requires an API key. Would you like to set it up now?`;

        if (confirm(message)) {
            setupClaudeCodeApiKey();
        } else {
            // Reset to first available model
            const firstModel = modelSelect.options[0]?.value || '';
            if (firstModel && firstModel !== 'claude-code') {
                modelSelect.value = firstModel;
            }
        }
        return false;
    }
    return true;
}

// =============================================================================
// EXPORT FUNCTIONALITY
// =============================================================================

async function exportSession(format) {
    if (!currentSessionId) {
        addMessage('⚠️ No active session to export. Please start a conversation first.', 'system');
        return;
    }

    // Disable export buttons during export
    const exportButtons = document.querySelectorAll('.export-btn');
    exportButtons.forEach(btn => btn.disabled = true);

    try {
        const response = await fetch(`/api/export/${format}/${currentSessionId}`);
        
        if (response.ok) {
            // Get filename from response headers or create default
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `chat_session_${currentSessionId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.${format === 'word' ? 'docx' : format === 'excel' ? 'xlsx' : 'pdf'}`;
            
            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match && match[1]) {
                    filename = match[1].replace(/['"]/g, '');
                }
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            addMessage(`✅ Chat exported to ${format.toUpperCase()} successfully!`, 'system');
        } else {
            const errorData = await response.json();
            addMessage(`❌ Export failed: ${errorData.error}`, 'system');
        }
    } catch (error) {
        console.error('Export error:', error);
        addMessage(`❌ Export failed: ${error.message}`, 'system');
    } finally {
        // Re-enable export buttons
        exportButtons.forEach(btn => btn.disabled = false);
    }
}

// Initialize export button states
function updateExportButtonStates() {
    const exportButtons = document.querySelectorAll('.export-btn');
    const hasSession = currentSessionId !== null;
    
    exportButtons.forEach(btn => {
        btn.disabled = !hasSession;
        btn.title = hasSession ? btn.title : 'Start a conversation to enable export';
    });
}

// =============================================================================
// SPEECH RECOGNITION FUNCTIONALITY
// =============================================================================

// Speech recognition variables
let recognition = null;
let isRecording = false;
let speechSupported = false;

// Initialize speech recognition
function initializeSpeechRecognition() {
    // Check if speech recognition is supported
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        speechSupported = true;
    } else if ('SpeechRecognition' in window) {
        recognition = new SpeechRecognition();
        speechSupported = true;
    } else {
        speechSupported = false;
        voiceButton.disabled = true;
        voiceButton.title = 'Speech recognition not supported in this browser';
        console.warn('Speech recognition not supported');
        return;
    }

    // Configure speech recognition
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // Event handlers
    recognition.onstart = function() {
        isRecording = true;
        voiceButton.classList.add('recording');
        voiceButton.title = 'Recording... Click to stop';
        console.log('Speech recognition started');
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        console.log('Speech recognition result:', transcript);
        
        // Add the transcribed text to the input
        if (transcript.trim()) {
            const currentText = promptInput.value.trim();
            const newText = currentText ? currentText + ' ' + transcript : transcript;
            promptInput.value = newText;
            promptInput.focus();
            
            // Auto-resize textarea if needed
            promptInput.style.height = 'auto';
            promptInput.style.height = promptInput.scrollHeight + 'px';
            
            addMessage(`🎤 Voice input captured: "${transcript}"`, 'system');
        }
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        
        let errorMessage = 'Voice recognition error';
        switch(event.error) {
            case 'network':
                errorMessage = 'Network error during voice recognition';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
                break;
            case 'no-speech':
                errorMessage = 'No speech detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage = 'Microphone not found or not working';
                break;
            default:
                errorMessage = `Voice recognition error: ${event.error}`;
        }
        
        addMessage(`❌ ${errorMessage}`, 'system');
        stopVoiceRecording();
    };

    recognition.onend = function() {
        console.log('Speech recognition ended');
        stopVoiceRecording();
    };
}

// Toggle voice recording
function toggleVoiceRecording() {
    if (!speechSupported) {
        addMessage('❌ Speech recognition is not supported in this browser', 'system');
        return;
    }

    if (isRecording) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
}

// Start voice recording
function startVoiceRecording() {
    if (!recognition || isRecording) return;

    try {
        recognition.start();
        addMessage('🎤 Listening... Speak now', 'system');
    } catch (error) {
        console.error('Error starting speech recognition:', error);
        addMessage('❌ Failed to start voice recording', 'system');
    }
}

// Stop voice recording
function stopVoiceRecording() {
    if (recognition && isRecording) {
        recognition.stop();
    }
    
    isRecording = false;
    voiceButton.classList.remove('recording', 'processing');
    voiceButton.title = 'Voice input';
}

// Initialize speech recognition when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeSpeechRecognition, 100); // Small delay to ensure all elements are loaded
    checkHuggingFaceStatus(); // Check Hugging Face API status on load
});

// =============================================================================
// IMAGE GENERATION FUNCTIONALITY
// =============================================================================

// Image generation variables
let huggingFaceAvailable = false;

// Check Hugging Face API status
async function checkHuggingFaceStatus() {
    try {
        const response = await fetch('/api/huggingface/status');
        const data = await response.json();
        
        huggingFaceAvailable = data.available;
        
        if (!data.sdk_installed) {
            imagePanelBtn.disabled = true;
            imagePanelBtn.title = 'Image generation not available - Hugging Face SDK not installed';
        } else if (data.token_required) {
            // Token is required for image generation
            setupReplicateBtn.style.display = data.has_api_key ? 'none' : 'inline-block';
            setupReplicateBtn.textContent = '⚙️ Setup HF Token (Required)';
            setupReplicateBtn.title = 'Hugging Face token required for image generation';
            generateImageBtn.disabled = !data.has_api_key;
            
            if (data.has_api_key) {
                imagePanelBtn.title = 'Generate AI images via Hugging Face';
                imagePanelBtn.disabled = false;
            } else {
                imagePanelBtn.title = 'Setup Hugging Face token first to generate images';
                imagePanelBtn.disabled = true;
            }
        } else {
            setupReplicateBtn.style.display = 'none';
            generateImageBtn.disabled = false;
            imagePanelBtn.title = 'Generate AI images';
        }
        
        return data;
    } catch (error) {
        console.error('Error checking Hugging Face status:', error);
        imagePanelBtn.disabled = true;
        imagePanelBtn.title = 'Image generation service unavailable';
        return { available: false, sdk_installed: false, has_api_key: false };
    }
}

// Setup Hugging Face API key
async function setupReplicateApiKey() {
    const apiKey = prompt('Enter your Hugging Face API token (REQUIRED for image generation):\n\nGet your free token at: https://huggingface.co/settings/tokens\n\n1. Sign up/login to Hugging Face\n2. Go to Settings > Access Tokens\n3. Create a new token\n4. Copy and paste it here');

    if (!apiKey || !apiKey.trim()) {
        addMessage('❌ Hugging Face API token is required for image generation. Please get one at https://huggingface.co/settings/tokens', 'system');
        return false;
    }

    try {
        const response = await fetch('/api/huggingface/api-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ api_key: apiKey.trim() })
        });

        const data = await response.json();

        if (data.success) {
            huggingFaceAvailable = data.available;
            addMessage(`✅ Hugging Face API token set successfully! You now have improved rate limits.`, 'system');
            setupReplicateBtn.style.display = 'none';
            generateImageBtn.disabled = false;
            return true;
        } else {
            addMessage(`❌ Failed to set Hugging Face API token: ${data.error}`, 'system');
            return false;
        }
    } catch (error) {
        console.error('Error setting Hugging Face API token:', error);
        addMessage(`❌ Error setting Hugging Face API token: ${error.message}`, 'system');
        return false;
    }
}

// Show image generation modal
function showImageModal() {
    if (!huggingFaceAvailable) {
        const status = checkHuggingFaceStatus();
        if (!status.available) {
            addMessage('❌ Image generation is not available. Please check your Hugging Face configuration.', 'system');
            return;
        }
    }
    
    imageModal.classList.add('show');
    imageModal.style.display = 'flex';
    
    // Focus on the prompt input
    setTimeout(() => {
        document.getElementById('image-prompt').focus();
    }, 300);
}

// Hide image generation modal
function hideImageModal() {
    imageModal.classList.remove('show');
    // Reset any mobile transform/opacity changes
    imageModal.style.transform = '';
    imageModal.style.opacity = '';
    setTimeout(() => {
        imageModal.style.display = 'none';
    }, 300);
}

// Generate image
async function generateImage() {
    console.log('Generate image function called');
    
    const prompt = document.getElementById('image-prompt').value.trim();
    const model = document.getElementById('image-model').value;
    
    console.log('Prompt:', prompt, 'Model:', model);
    
    if (!prompt) {
        addMessage('❌ Please enter a prompt for image generation', 'system');
        return;
    }
    
    if (!huggingFaceAvailable) {
        addMessage('❌ Hugging Face API not available. Please check the service status.', 'system');
        return;
    }
    
    // Disable generate button during generation
    generateImageBtn.disabled = true;
    generateImageBtn.textContent = '🎨 Generating...';
    
    // Show gallery placeholder
    const gallery = document.getElementById('image-gallery');
    gallery.innerHTML = `
        <div class="gallery-placeholder">
            <p>🎨 Generating image... This may take 30-60 seconds</p>
        </div>
    `;
    
    try {
        const response = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                model: model
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayGeneratedImages(data.images, data.prompt);
            addMessage(`✅ Image generated successfully: "${data.prompt}"`, 'system');
        } else {
            addMessage(`❌ Image generation failed: ${data.error}`, 'system');
            gallery.innerHTML = `
                <div class="gallery-placeholder">
                    <p>❌ Generation failed. Try again.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error generating image:', error);
        addMessage(`❌ Image generation error: ${error.message}`, 'system');
        gallery.innerHTML = `
            <div class="gallery-placeholder">
                <p>❌ Generation failed. Try again.</p>
            </div>
        `;
    } finally {
        // Re-enable generate button
        generateImageBtn.disabled = false;
        generateImageBtn.textContent = '🎨 Generate Image';
    }
}

// Display generated images in gallery
function displayGeneratedImages(imageUrls, prompt) {
    const gallery = document.getElementById('image-gallery');
    
    if (!imageUrls || imageUrls.length === 0) {
        gallery.innerHTML = `
            <div class="gallery-placeholder">
                <p>No images were generated</p>
            </div>
        `;
        return;
    }
    
    const imagesHtml = imageUrls.map((url, index) => `
        <div class="gallery-image">
            <img src="${url}" alt="Generated image: ${prompt}" loading="lazy">
            <div class="image-actions">
                <button class="image-action-btn" onclick="downloadImage('${url}', '${prompt}_${index + 1}')" title="Download">
                    💾
                </button>
                <button class="image-action-btn" onclick="copyImageUrl('${url}')" title="Copy URL">
                    📋
                </button>
            </div>
            <div class="image-info">
                <div class="image-prompt">${prompt}</div>
            </div>
        </div>
    `).join('');
    
    gallery.innerHTML = `<div class="gallery-images">${imagesHtml}</div>`;
}

// Download image
function downloadImage(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addMessage('💾 Image download started', 'system');
}

// Copy image URL
function copyImageUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        addMessage('📋 Image URL copied to clipboard', 'system');
    }).catch(err => {
        console.error('Error copying URL:', err);
        addMessage('❌ Failed to copy URL', 'system');
    });
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    if (event.target === imageModal) {
        hideImageModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && imageModal.classList.contains('show')) {
        hideImageModal();
    }
});

// Add swipe down to close on mobile - wrapped in DOM ready check
document.addEventListener('DOMContentLoaded', function() {
    const imageModal = document.getElementById('image-modal');
    
    if (!imageModal) {
        console.warn('Image modal not found, skipping touch event setup');
        return;
    }
    
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    imageModal.addEventListener('touchstart', function(e) {
        if (e.target === imageModal) {
            startY = e.touches[0].clientY;
            isDragging = true;
        }
    });

    imageModal.addEventListener('touchmove', function(e) {
        if (!isDragging || e.target !== imageModal) return;
        
        currentY = e.touches[0].clientY;
        const diffY = currentY - startY;
        
        // Only allow downward swipes
        if (diffY > 0) {
            e.preventDefault();
            // Add visual feedback for the swipe
            imageModal.style.transform = `translateY(${Math.min(diffY * 0.5, 100)}px)`;
            imageModal.style.opacity = Math.max(1 - (diffY / 300), 0.5);
        }
    });

    imageModal.addEventListener('touchend', function(e) {
        if (!isDragging) return;
        
        const diffY = currentY - startY;
        
        // Close modal if swiped down enough
        if (diffY > 100) {
            hideImageModal();
        } else {
            // Reset position
            imageModal.style.transform = '';
            imageModal.style.opacity = '';
        }
        
        isDragging = false;
        startY = 0;
        currentY = 0;
    });
});

// =============================================================================
// VIDEO GENERATION FUNCTIONALITY
// =============================================================================

// Show video generation modal
function showVideoModal() {
    // Video generation is temporarily disabled
    addMessage('⚠️ Video generation is temporarily disabled while we work on API compatibility issues. Image generation is fully working!', 'system');
    return;
    
    if (!huggingFaceAvailable) {
        addMessage('❌ Video generation is not available. Please set up your Hugging Face token first.', 'system');
        return;
    }
    
    videoModal.classList.add('show');
    videoModal.style.display = 'flex';
    
    // Focus on the prompt input
    setTimeout(() => {
        document.getElementById('video-prompt').focus();
    }, 300);
}

// Hide video generation modal
function hideVideoModal() {
    videoModal.classList.remove('show');
    setTimeout(() => {
        videoModal.style.display = 'none';
    }, 300);
}

// Generate video
async function generateVideo() {
    console.log('Generate video function called');
    
    const prompt = document.getElementById('video-prompt').value.trim();
    
    console.log('Video Prompt:', prompt);
    
    if (!prompt) {
        addMessage('❌ Please enter a prompt for video generation', 'system');
        return;
    }
    
    if (!huggingFaceAvailable) {
        addMessage('❌ Hugging Face API not available. Please check the service status.', 'system');
        return;
    }
    
    // Disable generate button during generation
    generateVideoBtn.disabled = true;
    generateVideoBtn.textContent = '🎬 Generating...';
    
    // Show gallery placeholder
    const gallery = document.getElementById('video-gallery');
    gallery.innerHTML = `
        <div class="gallery-placeholder">
            <p>🎬 Generating video... This may take 2-3 minutes</p>
        </div>
    `;
    
    try {
        const response = await fetch('/api/generate-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt,
                duration: 3,
                fps: 8
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayGeneratedVideos([data.video_url], data.prompt);
            addMessage(`✅ Video generated successfully: "${data.prompt}" (${data.method})`, 'system');
        } else {
            addMessage(`❌ Video generation failed: ${data.error}`, 'system');
            gallery.innerHTML = `
                <div class="gallery-placeholder">
                    <p>❌ Generation failed. Try again.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error generating video:', error);
        addMessage(`❌ Video generation error: ${error.message}`, 'system');
        gallery.innerHTML = `
            <div class="gallery-placeholder">
                <p>❌ Generation failed. Try again.</p>
            </div>
        `;
    } finally {
        // Re-enable generate button
        generateVideoBtn.disabled = false;
        generateVideoBtn.textContent = '🎬 Generate Video';
    }
}

// Display generated videos in gallery
function displayGeneratedVideos(videoUrls, prompt) {
    const gallery = document.getElementById('video-gallery');
    
    if (!videoUrls || videoUrls.length === 0) {
        gallery.innerHTML = `
            <div class="gallery-placeholder">
                <p>No videos were generated</p>
            </div>
        `;
        return;
    }
    
    const videosHtml = videoUrls.map((url, index) => `
        <div class="gallery-video">
            <video controls style="width: 100%; max-width: 400px;">
                <source src="${url}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
            <div class="video-actions">
                <button class="video-action-btn" onclick="downloadVideo('${url}', '${prompt}_${index + 1}')" title="Download">
                    💾
                </button>
            </div>
            <div class="video-info">
                <div class="video-prompt">${prompt}</div>
            </div>
        </div>
    `).join('');
    
    gallery.innerHTML = `<div class="gallery-videos">${videosHtml}</div>`;
}

// Download video
function downloadVideo(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addMessage('💾 Video download started', 'system');
}

// =============================================================================
// HAMBURGER MENU FUNCTIONALITY
// =============================================================================

function initializeHamburgerMenu() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const navMenu = document.getElementById('nav-menu');
    
    if (!hamburgerMenu || !navMenu) {
        console.warn('Hamburger menu elements not found');
        return;
    }
    
    // Simple toggle function
    hamburgerMenu.addEventListener('click', function() {
        navMenu.classList.toggle('active');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!navMenu.contains(e.target) && !hamburgerMenu.contains(e.target)) {
            navMenu.classList.remove('active');
        }
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            navMenu.classList.remove('active');
        }
    });
}

// =============================================================================
// MOBILE OPTIMIZATION FUNCTIONALITY
// =============================================================================

function initializeMobileOptimizations() {
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isMobile || isTouch) {
        // Add mobile class to body
        document.body.classList.add('mobile-device');
        
        // Optimize speech recognition for mobile
        optimizeSpeechForMobile();
        
        // Optimize image generation for mobile
        optimizeImageGenerationForMobile();
        
        // Add touch-specific event listeners
        addTouchOptimizations();
        
        console.log('Mobile optimizations enabled');
    }
}

function optimizeSpeechForMobile() {
    // Check if speech recognition works on this mobile device
    if (!speechSupported) {
        voiceButton.style.display = 'none';
        console.log('Speech recognition not supported on this mobile device');
        return;
    }
    
    // Mobile-specific speech recognition settings
    if (recognition) {
        // Shorter timeout for mobile
        recognition.continuous = false;
        recognition.interimResults = false;
        
        // Add mobile-specific error handling
        recognition.addEventListener('error', function(event) {
            if (event.error === 'not-allowed') {
                addMessage('❌ Please allow microphone access in your browser settings for voice input to work.', 'system');
            }
        });
    }
}

function optimizeImageGenerationForMobile() {
    // Set default model for mobile (faster model)
    const modelSelect = document.getElementById('image-model');
    
    if (modelSelect) {
        // Default to recommended model on mobile
        modelSelect.value = 'stabilityai/stable-diffusion-2-1';
    }
    
    // Add swipe gestures for image gallery
    addSwipeGestureToImageGallery();
}

function addTouchOptimizations() {
    // Prevent double-tap zoom on buttons but allow proper click events
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        let touchStartTime = 0;
        
        button.addEventListener('touchstart', function(e) {
            touchStartTime = Date.now();
        });
        
        button.addEventListener('touchend', function(e) {
            const touchDuration = Date.now() - touchStartTime;
            // Only prevent default for quick taps (not long presses)
            if (touchDuration < 300) {
                e.preventDefault();
                // Small delay to ensure proper button state
                setTimeout(() => this.click(), 10);
            }
        });
    });
    
    // Improve scrolling performance
    const scrollableElements = document.querySelectorAll('.chat-container, .response-content, .image-modal-body, .nav-menu');
    scrollableElements.forEach(element => {
        element.style.webkitOverflowScrolling = 'touch';
        element.style.overscrollBehavior = 'contain';
    });
    
    // Add haptic feedback for supported devices
    if ('vibrate' in navigator) {
        const actionButtons = document.querySelectorAll('.control-btn, .export-btn, .voice-btn, .generate-btn, .hamburger-menu');
        actionButtons.forEach(button => {
            button.addEventListener('click', function() {
                navigator.vibrate(30); // Short vibration for feedback
            });
        });
    }
    
    // Improve select dropdown on mobile
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        select.addEventListener('touchstart', function() {
            this.focus();
        });
    });
}

function addSwipeGestureToImageGallery() {
    let startX = 0;
    let startY = 0;
    
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchmove', function(e) {
        if (!startX || !startY) return;
        
        const diffX = startX - e.touches[0].clientX;
        const diffY = startY - e.touches[0].clientY;
        
        // Check if this is a horizontal swipe in the image gallery
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            const galleryImages = document.querySelectorAll('.gallery-image');
            if (galleryImages.length > 1 && e.target.closest('.gallery-image')) {
                // Handle swipe navigation between images
                e.preventDefault();
            }
        }
        
        startX = 0;
        startY = 0;
    });
}

// Viewport height fix for mobile browsers
function setMobileViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Update viewport height on resize (for mobile browser toolbar changes)
window.addEventListener('resize', setMobileViewportHeight);
window.addEventListener('orientationchange', setMobileViewportHeight);

// Initialize mobile viewport height
setMobileViewportHeight();

