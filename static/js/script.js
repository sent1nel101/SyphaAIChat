// Update the loadModels function with better error handling and debugging
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

// Update the sendMessage function to check for model selection
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