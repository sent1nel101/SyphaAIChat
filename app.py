from flask import Flask, request, jsonify, render_template, session
import requests
import json
import uuid
from datetime import datetime
import sqlite3
import os
import re
from werkzeug.utils import secure_filename
import mimetypes

# Try to import optional dependencies with better error handling
try:
    import markdown
    MARKDOWN_AVAILABLE = True
    print("✓ Markdown support enabled")
except ImportError:
    MARKDOWN_AVAILABLE = False
    print("⚠ Warning: markdown not installed. Using basic formatting.")

try:
    # Try new pypdf first, then fall back to PyPDF2
    try:
        import pypdf as PyPDF2
        PDF_AVAILABLE = True
        print("✓ PDF support enabled (using pypdf)")
    except ImportError:
        import PyPDF2
        PDF_AVAILABLE = True
        print("✓ PDF support enabled (using PyPDF2)")
except ImportError:
    PDF_AVAILABLE = False
    print("⚠ Warning: PDF library not installed. PDF support disabled.")

try:
    from PIL import Image
    import io
    IMAGE_AVAILABLE = True
    print("✓ Image processing enabled")
except ImportError:
    IMAGE_AVAILABLE = False
    print("⚠ Warning: Pillow not installed. Image processing disabled.")

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'

# Ollama configuration
OLLAMA_BASE_URL = 'http://localhost:11434'
DEFAULT_MODELS = ['llama2', 'codellama', 'mistral']

# File upload configuration
UPLOAD_FOLDER = 'uploads'
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
ALLOWED_EXTENSIONS = {
    'txt', 'md', 'py', 'js', 'html', 'css', 'json', 'xml', 'csv'
}

# Add PDF and image extensions only if libraries are available
if PDF_AVAILABLE:
    ALLOWED_EXTENSIONS.add('pdf')
if IMAGE_AVAILABLE:
    ALLOWED_EXTENSIONS.update({'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'})

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Create upload directory
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Database configuration
DATABASE = 'chat_app.db'

class OllamaClient:
    def __init__(self, base_url=OLLAMA_BASE_URL):
        self.base_url = base_url
    
    def chat(self, model, messages):
        """Send chat request to Ollama"""
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": False
        }
        
        try:
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.ConnectionError:
            raise Exception("Cannot connect to Ollama. Make sure Ollama is running on http://localhost:11434")
        except requests.exceptions.Timeout:
            raise Exception("Request timed out. The model might be taking too long to respond.")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama request failed: {str(e)}")
    
    def list_models(self):
        """List available models"""
        url = f"{self.base_url}/api/tags"
        
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            return {"models": data.get("models", [])}
        except requests.exceptions.RequestException as e:
            print(f"Error listing models: {e}")
            return {"models": []}

# Initialize Ollama client
ollama_client = OllamaClient()

class FileProcessor:
    def __init__(self):
        pass
    
    def process_file(self, file_path, filename, mime_type):
        """Process uploaded file and extract content"""
        try:
            if mime_type.startswith('text/') or filename.endswith(('.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.xml', '.csv')):
                return self._process_text_file(file_path)
            elif mime_type == 'application/pdf' and PDF_AVAILABLE:
                return self._process_pdf(file_path)
            elif mime_type.startswith('image/') and IMAGE_AVAILABLE:
                return self._process_image(file_path, filename)
            else:
                return f"File uploaded: {filename} (content extraction not supported for this file type)"
        except Exception as e:
            return f"Error processing file: {str(e)}"
    
    def _process_text_file(self, file_path):
        """Extract text from text files"""
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                return content
            except UnicodeDecodeError:
                continue
            except Exception as e:
                return f"Error reading file: {str(e)}"
        
        return "Error: Could not decode file with any supported encoding"
    
    def _process_pdf(self, file_path):
        """Extract text from PDF files"""
        if not PDF_AVAILABLE:
            return "PDF processing not available (pypdf/PyPDF2 not installed)"
        
        try:
            with open(file_path, 'rb') as f:
                pdf_reader = PyPDF2.PdfReader(f)
                text = ""
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                return text.strip() if text.strip() else "PDF processed but no text could be extracted"
        except Exception as e:
            return f"Error reading PDF: {str(e)}"
    
    def _process_image(self, file_path, filename):
        """Process image files"""
        if not IMAGE_AVAILABLE:
            return "Image processing not available (Pillow not installed)"
        
        try:
            with Image.open(file_path) as img:
                width, height = img.size
                format_name = img.format
                mode = img.mode
                
                return f"Image file: {filename}\nDimensions: {width}x{height}\nFormat: {format_name}\nMode: {mode}\n\nNote: For image analysis, please use a vision-capable model like llava."
        except Exception as e:
            return f"Error processing image: {str(e)}"

class ResponseFormatter:
    def __init__(self):
        pass
        
    def format_response(self, text):
        """Format the AI response with proper HTML structure"""
        if MARKDOWN_AVAILABLE:
            try:
                formatted = markdown.markdown(
                    text,
                    extensions=['codehilite', 'fenced_code', 'tables']
                )
                return self._enhance_formatting(formatted)
            except Exception as e:
                print(f"Markdown formatting error: {e}")
                return self._basic_format(text)
        else:
            return self._basic_format(text)
    
    def _basic_format(self, text):
        """Basic HTML formatting without markdown"""
        import html
        
        # Escape HTML first
        text = html.escape(text)
        
        # Handle code blocks
        text = re.sub(r'```(\w+)?\n(.*?)\n```', r'<pre><code class="language-\1">\2</code></pre>', text, flags=re.DOTALL)
        
        # Handle inline code
        text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
        
        # Handle bold and italic
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
        
        # Handle headers
        text = re.sub(r'^### (.+)$', r'<h3>\1</h3>', text, flags=re.MULTILINE)
        text = re.sub(r'^## (.+)$', r'<h2>\1</h2>', text, flags=re.MULTILINE)
        text = re.sub(r'^# (.+)$', r'<h1>\1</h1>', text, flags=re.MULTILINE)
        
        # Handle paragraphs
        text = text.replace('\n\n', '</p><p>')
        text = text.replace('\n', '<br>')
        
        if text.strip():
            text = f'<p>{text}</p>'
        
        return text
    
    def _enhance_formatting(self, text):
        """Additional formatting enhancements"""
        text = re.sub(r'</h([1-6])>', r'</h\1>\n', text)
        text = re.sub(r'</p>', r'</p>\n', text)
        text = re.sub(r'</ul>', r'</ul>\n', text)
        text = re.sub(r'</ol>', r'</ol>\n', text)
        return text

formatter = ResponseFormatter()
file_processor = FileProcessor()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def enhance_prompt(user_message):
    """Enhance user prompt with formatting instructions"""
    return f"""{user_message}

Please format your response professionally using:
- **Bold text** for emphasis
- `code snippets` for technical terms
- ```language blocks``` for code examples
- Clear headings and bullet points where appropriate"""

def enhance_prompt_with_file(user_message, file_content, filename):
    """Add file context to user prompt"""
    return f"""I'm sharing a file with you: {filename}

File content:
{file_content}

User question: {user_message}

Please analyze this file and respond to my question. Format your response professionally using:
- **Bold text** for emphasis
- `code snippets` for technical terms  
- ```language blocks``` for code examples
- Clear headings and bullet points where appropriate"""

# Database functions (same as before)
def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database with required tables"""
    with get_db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                title TEXT,
                summary TEXT
            );
            
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                model TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                has_file BOOLEAN DEFAULT FALSE,
                file_name TEXT,
                file_type TEXT,
                formatted_content TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            );
            
            CREATE TABLE IF NOT EXISTS file_attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER,
                filename TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                mime_type TEXT,
                processed_content TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages (id)
            );
        ''')
        conn.commit()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        # Handle both JSON and form data
        if request.is_json:
            data = request.get_json()
            user_message = data.get('message', '').strip()
            model = data.get('model', 'llama2')
            uploaded_file = None
        else:
            user_message = request.form.get('message', '').strip()
            model = request.form.get('model', 'llama2')
            uploaded_file = request.files.get('file')
        
        if not user_message.strip() and not uploaded_file:
            return jsonify({'success': False, 'error': 'Empty message and no file'}), 400
        
        # Session management
        if 'session_id' not in session:
            session['session_id'] = create_session()
        
        session_id = session['session_id']
        create_session(session_id)
        
        file_info = None
        file_content = ""
        
        # Process uploaded file if present
        if uploaded_file and uploaded_file.filename != '':
            if allowed_file(uploaded_file.filename):
                filename = secure_filename(uploaded_file.filename)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                unique_filename = f"{timestamp}_{filename}"
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
                
                uploaded_file.save(file_path)
                
                # Get file info
                file_size = os.path.getsize(file_path)
                mime_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
                
                # Process file content
                processed_content = file_processor.process_file(file_path, filename, mime_type)
                
                file_info = {
                    'filename': unique_filename,
                    'original_filename': filename,
                    'file_path': file_path,
                    'file_size': file_size,
                    'mime_type': mime_type,
                    'processed_content': processed_content
                }
                
                file_content = processed_content
            else:
                return jsonify({'success': False, 'error': 'File type not allowed'}), 400
        
        # Save user message to database
        add_message(session_id, 'user', user_message, model, file_info)
        
        # Get recent messages for context
        recent_messages = get_recent_messages(session_id, limit=10)
        
        # Prepare the prompt
        if file_content:
            enhanced_message = enhance_prompt_with_file(user_message, file_content, file_info['original_filename'])
        else:
            enhanced_message = enhance_prompt(user_message)
        
        # Prepare messages for Ollama
        messages = recent_messages[:-1]  # Exclude the current message
        messages.append({'role': 'user', 'content': enhanced_message})
        
        # Send to Ollama
        try:
            response = ollama_client.chat(model, messages)
            assistant_message = response.get('message', {}).get('content', 'No response received')
            
            # Save assistant response to database
            add_message(session_id, 'assistant', assistant_message, model)
            
            # Format the response
            formatted_content = formatter.format_response(assistant_message)
            
            return jsonify({
                'success': True,
                'message': {
                    'content': assistant_message,
                    'formatted_content': formatted_content
                }
            })
            
        except Exception as e:
            error_message = str(e)
            add_message(session_id, 'assistant', f"Error: {error_message}", model)
            return jsonify({'success': False, 'error': error_message}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/models', methods=['GET'])
def get_models():
    try:
        models_data = ollama_client.list_models()
        models = []
        
        if models_data.get('models'):
            models = [model['name'] for model in models_data['models']]
        
        # If no models found, return default models
        if not models:
            models = DEFAULT_MODELS
            
        return jsonify({'success': True, 'models': models})
    except Exception as e:
        return jsonify({'success': True, 'models': DEFAULT_MODELS})

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    try:
        sessions = get_all_sessions()
        
        # Format sessions for frontend
        formatted_sessions = []
        for session_data in sessions:
            formatted_sessions.append({
                'session_id': session_data['id'],
                'title': session_data['title'] or f"Session {session_data['id'][:8]}",
                'created_at': session_data['created_at'],
                'last_active': session_data['last_active'],
                'message_count': session_data['message_count'] or 0,
                'last_message': session_data['last_message'] or 'No messages'
            })
        
        return jsonify({'success': True, 'sessions': formatted_sessions})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/session/<session_id>/load', methods=['POST'])
def load_session(session_id):
    try:
        messages = get_session_messages(session_id)
        session['session_id'] = session_id
        
        # Format messages for frontend
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({
                'role': msg['role'],
                'content': msg['content'],
                'formatted_content': msg['formatted_content'],
                'timestamp': msg['timestamp'],
                'has_file': msg['has_file'],
                'file_name': msg['original_filename'] if msg.get('original_filename') else msg.get('file_name'),
                'model': msg['model']
            })
        
        return jsonify({'success': True, 'messages': formatted_messages})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/session/<session_id>/delete', methods=['DELETE'])
def delete_session(session_id):
    try:
        with get_db() as conn:
            # Delete file attachments first
            cursor = conn.execute('''
                SELECT fa.file_path FROM file_attachments fa
                JOIN messages m ON fa.message_id = m.id
                WHERE m.session_id = ?
            ''', (session_id,))
            
            file_paths = cursor.fetchall()
            
            # Delete physical files
            for file_path_row in file_paths:
                file_path = file_path_row['file_path']
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                except Exception as e:
                    print(f"Error deleting file {file_path}: {e}")
            
            # Delete database records
            conn.execute('''
                DELETE FROM file_attachments 
                WHERE message_id IN (SELECT id FROM messages WHERE session_id = ?)
            ''', (session_id,))
            
            conn.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
            conn.execute('DELETE FROM sessions WHERE id = ?', (session_id,))
            conn.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/session/new', methods=['POST'])
def new_session():
    try:
        new_session_id = create_session()
        session['session_id'] = new_session_id
        return jsonify({'success': True, 'session_id': new_session_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Database helper functions
def create_session(session_id=None):
    """Create a new chat session"""
    if not session_id:
        session_id = str(uuid.uuid4())
    
    try:
        with get_db() as conn:
            conn.execute(
                'INSERT OR IGNORE INTO sessions (id, title) VALUES (?, ?)',
                (session_id, f'Chat Session {datetime.now().strftime("%Y-%m-%d %H:%M")}')
            )
            conn.commit()
    except Exception as e:
        print(f"Error creating session: {e}")
    
    return session_id

def add_message(session_id, role, content, model=None, file_info=None):
    """Add a message to the database"""
    formatted_content = None
    if role == 'assistant':
        try:
            formatted_content = formatter.format_response(content)
        except Exception as e:
            print(f"Error formatting message: {e}")
            formatted_content = content
    
    has_file = file_info is not None
    file_name = file_info.get('original_filename') if file_info else None
    file_type = file_info.get('mime_type') if file_info else None
    
    try:
        with get_db() as conn:
            cursor = conn.execute(
                '''INSERT INTO messages (session_id, role, content, formatted_content, model, has_file, file_name, file_type) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (session_id, role, content, formatted_content, model, has_file, file_name, file_type)
            )
            message_id = cursor.lastrowid
            
            # Add file attachment if present
            if file_info:
                conn.execute(
                    '''INSERT INTO file_attachments (message_id, filename, original_filename, file_path, file_size, mime_type, processed_content)
                       VALUES (?, ?, ?, ?, ?, ?, ?)''',
                    (message_id, file_info['filename'], file_info['original_filename'], 
                     file_info['file_path'], file_info['file_size'], file_info['mime_type'], 
                     file_info.get('processed_content', ''))
                )
            
            # Update session last active time
            conn.execute(
                'UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = ?',
                (session_id,)
            )
            conn.commit()
            return message_id
    except Exception as e:
        print(f"Error adding message to database: {e}")
        return None

def get_session_messages(session_id, limit=50):
    """Get messages for a session"""
    try:
        with get_db() as conn:
            cursor = conn.execute(
                '''SELECT m.*, fa.original_filename, fa.mime_type as attachment_mime_type, fa.processed_content
                   FROM messages m
                   LEFT JOIN file_attachments fa ON m.id = fa.message_id
                   WHERE m.session_id = ? 
                   ORDER BY m.timestamp DESC LIMIT ?''',
                (session_id, limit)
            )
            messages = cursor.fetchall()
            return [dict(msg) for msg in reversed(messages)]
    except Exception as e:
        print(f"Error getting session messages: {e}")
        return []

def get_recent_messages(session_id, limit=10):
    """Get recent messages for context"""
    try:
        with get_db() as conn:
            cursor = conn.execute(
                '''SELECT m.role, m.content, fa.processed_content
                   FROM messages m
                   LEFT JOIN file_attachments fa ON m.id = fa.message_id
                   WHERE m.session_id = ? 
                   ORDER BY m.timestamp DESC LIMIT ?''',
                (session_id, limit)
            )
            messages = cursor.fetchall()
            result = []
            for msg in reversed(messages):
                message_content = msg['content']
                if msg['processed_content']:
                    message_content += f"\n\nFile content:\n{msg['processed_content']}"
                result.append({'role': msg['role'], 'content': message_content})
            return result
    except Exception as e:
        print(f"Error getting recent messages: {e}")
        return []

def get_all_sessions():
    """Get all chat sessions"""
    try:
        with get_db() as conn:
            cursor = conn.execute('''
                SELECT s.*,
                       COUNT(m.id) as message_count,
                       MAX(m.timestamp) as last_message_time,
                       (SELECT content FROM messages WHERE session_id = s.id ORDER BY timestamp DESC LIMIT 1) as last_message
                FROM sessions s
                LEFT JOIN messages m ON s.id = m.session_id
                GROUP BY s.id
                ORDER BY s.last_active DESC
            ''')
            sessions = cursor.fetchall()
            return [dict(session) for session in sessions]
    except Exception as e:
        print(f"Error getting sessions: {e}")
        return []

def load_messages_from_session(messages):
    """Helper function to format messages for frontend loading"""
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            'role': msg['role'],
            'content': msg['content'],
            'formatted_content': msg.get('formatted_content'),
            'timestamp': msg['timestamp'],
            'has_file': msg.get('has_file', False),
            'file_name': msg.get('file_name'),
            'model': msg.get('model')
        })
    return formatted_messages

# Error handlers
@app.errorhandler(413)
def too_large(e):
    return jsonify({'success': False, 'error': 'File too large. Maximum size is 16MB.'}), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

# Initialize database on startup
def initialize_app():
    """Initialize the application"""
    print("🚀 Starting Ollama Chat Application...")
    print(f"📁 Upload folder: {UPLOAD_FOLDER}")
    print(f"💾 Database: {DATABASE}")
    print(f"🔗 Ollama URL: {OLLAMA_BASE_URL}")
    
    # Check feature availability
    features = []
    if MARKDOWN_AVAILABLE:
        features.append("Markdown formatting")
    if PDF_AVAILABLE:
        features.append("PDF processing")
    if IMAGE_AVAILABLE:
        features.append("Image processing")
    
    if features:
        print(f"✨ Available features: {', '.join(features)}")
    else:
        print("⚠ Running with basic features only")
    
    print(f"📎 Allowed file types: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    
    # Initialize database
    init_db()
    print("✅ Database initialized")
    
    # Test Ollama connection
    try:
        models = ollama_client.list_models()
        if models.get('models'):
            model_names = [model['name'] for model in models['models']]
            print(f"🤖 Available models: {', '.join(model_names)}")
        else:
            print("⚠ No models found in Ollama. Make sure you have models installed.")
    except Exception as e:
        print(f"⚠ Could not connect to Ollama: {e}")
        print("Make sure Ollama is running: ollama serve")
    
    print("🎉 Application ready!")

if __name__ == '__main__':
    initialize_app()
    
    # Run the application
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        threaded=True
    )

