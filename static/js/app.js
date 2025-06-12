// Global variables
let currentSessionId = null;
let isLoading = false;

// DOM Elements
let chatContainer, promptInput, sendButton, modelSelect, fileInput, fileButton, fileInfo, filePreview;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeEventListeners();
    loadModels(); // This is the crucial call that was missing!
    initializeHamburgerMenu();
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

// Load models function with better error handling and debugging
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
        
        // Show error message to user
        addMessage(`⚠️ Could not load models from Ollama. Please make sure:
1. Ollama is running (run: ollama serve)
2. You have models installed (run: ollama pull llama2)
3. Ollama is accessible at http://localhost:11434

Available fallback models are shown in the dropdown.`, 'system');
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
            // Add assistant response
            addMessage(data.message.content, 'assistant', selectedModel);
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

// Add message to chat
function addMessage(content, role, model = null, hasFile = false, fileName = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    let messageContent = '';
    
    if (hasFile && fileName) {
        messageContent += `<div class="file-indicator">📎 ${fileName}</div>`;
    }
    
    messageContent += `<div class="message-content">${content}</div>`;
    
    if (model) {
        messageContent += `<div class="model-info">Model: ${model}</div>`;
    }
    
    messageContent += `<div class="message-timestamp">${new Date().toLocaleTimeString()}</div>`;
    
    messageDiv.innerHTML = messageContent;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
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
    document.getElementById('file-preview-name').textContent = file.name;
    filePreview.style.display = 'block';
    fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
}

function clearFileSelection() {
    fileInput.value = '';
    filePreview.style.display = 'none';
    fileInfo.textContent = 'No file selected';
}

// Session management
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
            clearChat();
            addMessage('🎉 New chat session started!', 'system');
        }
    } catch (error) {
        console.error('Error creating new session:', error);
        addMessage('❌ Error creating new session', 'system');
    }
}

function clearChat() {
    chatContainer.innerHTML = '';
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
            clearChat();
            
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
