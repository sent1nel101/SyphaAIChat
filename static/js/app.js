// Import anthropic if needed in future
// const { ClaudeClient } = require('claude-sdk');

// Global variables
let currentSessionId = null;
let isLoading = false;
let isSplitMode = false;
let claudeCodeAvailable = false;

// DOM Elements
let chatContainer, promptInput, sendButton, modelSelect, fileInput, fileButton, fileInfo, filePreview;
let mainContainer, responseArea, responseContent, closeResponseBtn;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeEventListeners();
    loadModels();
    initializeHamburgerMenu();
    showWelcomeMessage(); // Add welcome message on page load
    
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
    
    // Split mode elements
    mainContainer = document.getElementById('main-container');
    responseArea = document.getElementById('response-area');
    responseContent = document.getElementById('response-content');
    closeResponseBtn = document.getElementById('close-response');
}

function initializeEventListeners() {
    // Send button and enter key
    sendButton.addEventListener('click', sendMessage);
    promptInput.addEventListener('keydown', function(e) {
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
    document.getElementById('sessions-btn').addEventListener('click', toggleSessionsPanel);
    document.getElementById('clear-btn').addEventListener('click', clearChat);
    document.getElementById('close-sessions').addEventListener('click', closeSessionsPanel);
    
    // Split mode controls
    if (closeResponseBtn) {
        closeResponseBtn.addEventListener('click', exitSplitMode);
    }
    
    // Model selection handling
    modelSelect.addEventListener('change', function(e) {
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
    navMenu.addEventListener('click', function(e) {
        if (e.target.classList.contains('control-btn')) {
            closeMenu();
        }
    });
    
    // Close menu on window resize if screen becomes larger
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
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
            
            // Add assistant response to both chat and split view
            addMessage(data.message.content, 'assistant', selectedModel);
            addResponseToSplitView(data.message.formatted_content || data.message.content);
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

// Split mode functionality
function enterSplitMode() {
    if (isSplitMode) return;
    
    isSplitMode = true;
    mainContainer.classList.add('split-mode');
    responseArea.style.display = 'block';
    
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

function addResponseToSplitView(content, isLatest = true) {
    if (!isSplitMode) return;
    
    const responseDiv = document.createElement('div');
    responseDiv.className = `response-message ${isLatest ? 'latest' : ''}`;
    
    // Use the same enhanced content formatting
    const formattedContent = enhanceMessageContent(content, 'assistant');
    responseDiv.innerHTML = formattedContent;
    
    // Remove 'latest' class from previous responses
    const previousLatest = responseContent.querySelector('.response-message.latest');
    if (previousLatest && isLatest) {
        previousLatest.classList.remove('latest');
    }
    
    responseContent.appendChild(responseDiv);
    
    // Post-process tables for better display
    enhanceTablesInMessage(responseDiv);
    
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
        }
    } catch (error) {
        console.error('Error creating new session:', error);
        addMessage('❌ Error creating new session', 'system');
    }
}

// Clear chat - Updated to show welcome message after clearing
function clearChat() {
    chatContainer.innerHTML = '';
    exitSplitMode(); // Exit split mode when clearing chat
    showWelcomeMessage(); // Show welcome message after clearing
}

// Sessions panel
async function toggleSessionsPanel() {
    const sessionsPanel = document.getElementById('sessions-panel');
    const isActive = sessionsPanel.classList.contains('active');
    
    if (isActive) {
        closeSessionsPanel();
    } else {
        await loadSessions();
        sessionsPanel.classList.add('active');
    }
}

function closeSessionsPanel() {
    document.getElementById('sessions-panel').classList.remove('active');
}

async function loadSessions() {
    const sessionsList = document.getElementById('sessions-list');
    sessionsList.innerHTML = '<div class="loading">Loading sessions...</div>';
    
    try {
        const response = await fetch('/api/sessions');
        const data = await response.json();
        
        if (data.success && data.sessions.length > 0) {
            sessionsList.innerHTML = '';
            
            data.sessions.forEach(session => {
                const sessionDiv = document.createElement('div');
                sessionDiv.className = 'session-item';
                sessionDiv.innerHTML = `
                    <div class="session-info">
                        <div class="session-title">${session.title}</div>
                        <div class="session-meta">${new Date(session.created_at).toLocaleDateString()} • ${session.message_count} messages</div>
                        <div class="session-preview">${session.last_message}</div>
                    </div>
                    <div class="session-actions">
                        <button class="session-delete" onclick="deleteSession('${session.session_id}')">Delete</button>
                    </div>
                `;
                
                sessionDiv.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('session-delete')) {
                        loadSession(session.session_id);
                    }
                });
                
                sessionsList.appendChild(sessionDiv);
            });
        } else {
            sessionsList.innerHTML = '<div class="loading">No sessions found</div>';
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        sessionsList.innerHTML = '<div class="loading">Error loading sessions</div>';
    }
}

async function loadSession(sessionId) {
    try {
        const response = await fetch(`/api/session/${sessionId}/load`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const data = await response.json();
        if (data.success) {
            currentSessionId = sessionId;
            clearChatForSession(); // Use different clear function for loading sessions
            
            data.messages.forEach(msg => {
                addMessage(
                    msg.formatted_content || msg.content,
                    msg.role,
                    msg.model,
                    msg.has_file,
                    msg.file_name
                );
            });
            
            closeSessionsPanel();
            addMessage('📂 Session loaded successfully!', 'system');
        }
    } catch (error) {
        console.error('Error loading session:', error);
        addMessage('❌ Error loading session', 'system');
    }
}

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
            loadSessions(); // Refresh the sessions list
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

