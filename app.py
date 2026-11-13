from flask import Flask, request, jsonify, render_template, session, send_file
import requests
import uuid
from contextlib import contextmanager
from datetime import datetime
import html
import io
import base64
import sqlite3
import os
import re
import sys
import tempfile
from werkzeug.utils import secure_filename
import mimetypes
from pathlib import Path

import secrets

# Use the Windows certificate store so TLS-inspecting antivirus/proxies don't break HTTPS.
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    print("WARNING: truststore not installed; HTTPS may fail behind TLS-inspecting antivirus/proxies.")

# Credentials come only from the .env next to this script. OS environment
# variables are deliberately ignored and nothing is written to os.environ.
from dotenv import dotenv_values

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / '.env'


def _read_env_file():
    if not ENV_PATH.exists():
        print(f"WARNING: {ENV_PATH} not found. No credentials loaded.")
        return {}
    return {k: (v or '').strip() for k, v in dotenv_values(ENV_PATH).items()}


ENV = _read_env_file()


def env_value(name, default=''):
    """Return a value from .env only (never from the OS environment)."""
    return ENV.get(name) or default


def _load_flask_secret_key():
    """Session-signing key from .env; generated and persisted to .env on first run."""
    key = env_value('FLASK_SECRET_KEY')
    if key:
        return key
    key = secrets.token_hex(32)
    with open(ENV_PATH, 'a', encoding='utf-8') as f:
        f.write(f"\nFLASK_SECRET_KEY={key}\n")
    ENV['FLASK_SECRET_KEY'] = key
    print("+ Generated FLASK_SECRET_KEY and saved it to .env")
    return key


print(f"+ Credentials loaded from {ENV_PATH.name}: {', '.join(k for k in ENV if ENV[k]) or 'none'}")


def hf_token():
    return env_value('HUGGINGFACE_HUB_TOKEN') or env_value('HF_TOKEN')


try:
    from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage, TextBlock
    import anyio
    CLAUDE_CODE_AVAILABLE = True
    print("+ Claude Agent SDK enabled")
except ImportError:
    CLAUDE_CODE_AVAILABLE = False
    print("WARNING: claude-agent-sdk not installed. Claude Code features disabled.")

try:
    import openai
    OPENAI_SDK_AVAILABLE = True
    print("+ OpenAI SDK enabled")
except ImportError:
    OPENAI_SDK_AVAILABLE = False
    print("WARNING: openai not installed. OpenAI features disabled.")

try:
    from huggingface_hub import InferenceClient
    HUGGINGFACE_AVAILABLE = True
    print("+ Hugging Face Hub enabled for image generation")
except ImportError:
    HUGGINGFACE_AVAILABLE = False
    print("WARNING: huggingface-hub not installed. Image generation features disabled.")

try:
    import markdown
    MARKDOWN_AVAILABLE = True
    print("+ Markdown support enabled")
except ImportError:
    MARKDOWN_AVAILABLE = False
    print("WARNING: markdown not installed. Using basic formatting.")

try:
    try:
        import pypdf as PyPDF2
        PDF_AVAILABLE = True
        print("+ PDF support enabled (using pypdf)")
    except ImportError:
        import PyPDF2
        PDF_AVAILABLE = True
        print("+ PDF support enabled (using PyPDF2)")
except ImportError:
    PDF_AVAILABLE = False
    print("WARNING: PDF library not installed. PDF support disabled.")

try:
    from PIL import Image
    IMAGE_AVAILABLE = True
    print("+ Image processing enabled")
except ImportError:
    IMAGE_AVAILABLE = False
    print("WARNING: Pillow not installed. Image processing disabled.")

try:
    from docx import Document
    DOCX_AVAILABLE = True
    print("+ Word document support enabled")
except ImportError:
    DOCX_AVAILABLE = False
    print("WARNING: python-docx not installed. Word document support disabled.")

try:
    import openpyxl
    import xlrd
    EXCEL_AVAILABLE = True
    print("+ Excel support enabled")
except ImportError:
    EXCEL_AVAILABLE = False
    print("WARNING: openpyxl/xlrd not installed. Excel support disabled.")

try:
    from pptx import Presentation
    PPTX_AVAILABLE = True
    print("+ PowerPoint support enabled")
except ImportError:
    PPTX_AVAILABLE = False
    print("WARNING: python-pptx not installed. PowerPoint support disabled.")

app = Flask(__name__)
app.secret_key = _load_flask_secret_key()

def env_flag(name, default):
    return env_value(name, default).strip().lower() not in ('0', 'false', 'no', 'off')


OLLAMA_BASE_URL = env_value('OLLAMA_BASE_URL', 'http://localhost:11434').rstrip('/')
OLLAMA_TIMEOUT = int(env_value('OLLAMA_TIMEOUT', '600'))  # first load of a model can be slow
DEFAULT_MODELS = ['llama3.2', 'mistral', 'qwen2.5']

# LOCAL_ONLY=true (default): Ollama only; cloud providers are never listed or used as fallbacks.
LOCAL_ONLY = env_flag('LOCAL_ONLY', 'true')

CLAUDE_CODE_API_KEY = env_value('CLAUDE_CODE_API_KEY')
CLAUDE_CODE_MODEL = 'claude-code'
CLAUDE_MODEL_OVERRIDE = env_value('CLAUDE_MODEL') or None

OPENAI_API_KEY = env_value('OPENAI_API_KEY')
OPENAI_CHAT_MODEL = env_value('OPENAI_MODEL', 'gpt-5.5')
OPENAI_MODEL = 'openai'  # model id shown in the UI

# 0.0.0.0 so the Android client can reach the server over the LAN.
HOST = env_value('HOST', '0.0.0.0')
PORT = int(env_value('PORT', '5000'))

UPLOAD_FOLDER = str(BASE_DIR / 'uploads')
DATABASE = str(BASE_DIR / 'chat_app.db')
MAX_FILE_SIZE = 16 * 1024 * 1024

TEXT_EXTENSIONS = ('txt', 'md', 'py', 'js', 'html', 'css', 'json', 'xml', 'csv')
ALLOWED_EXTENSIONS = set(TEXT_EXTENSIONS)
if PDF_AVAILABLE:
    ALLOWED_EXTENSIONS.add('pdf')
if IMAGE_AVAILABLE:
    ALLOWED_EXTENSIONS.update({'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'})
if DOCX_AVAILABLE:
    ALLOWED_EXTENSIONS.add('docx')
if EXCEL_AVAILABLE:
    ALLOWED_EXTENSIONS.update({'xlsx', 'xls'})
if PPTX_AVAILABLE:
    ALLOWED_EXTENSIONS.add('pptx')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


class OllamaClient:
    def __init__(self, base_url=OLLAMA_BASE_URL):
        self.base_url = base_url
    
    def chat(self, model, messages):
        payload = {"model": model, "messages": messages, "stream": False}
        try:
            response = requests.post(f"{self.base_url}/api/chat", json=payload, timeout=OLLAMA_TIMEOUT)
            if response.status_code == 404:
                raise Exception(f"Model '{model}' is not installed in Ollama. Run: ollama pull {model}")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.ConnectionError:
            raise Exception(f"Cannot connect to Ollama. Make sure Ollama is running on {self.base_url}")
        except requests.exceptions.Timeout:
            raise Exception("Request timed out. The model might be taking too long to respond.")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Ollama request failed: {e}")

    def list_models(self):
        """Names of installed models; empty list if Ollama is unreachable."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            response.raise_for_status()
            return [m['name'] for m in response.json().get("models", [])]
        except (requests.exceptions.RequestException, ValueError, KeyError) as e:
            print(f"Error listing models: {e}")
            return []


ollama_client = OllamaClient()

SYSTEM_PROMPT = (
    "You are a helpful AI assistant with access to powerful tools for code analysis, "
    "file processing, and data manipulation."
)


def _history_to_prompt(messages):
    """Flatten chat history into one prompt so the model keeps conversation context."""
    if not messages:
        return ""
    *history, last = messages
    if not history:
        return last.get('content', '')
    lines = ["Conversation so far:"]
    for m in history:
        lines.append(f"{m.get('role', 'user').upper()}: {m.get('content', '')}")
    lines.append("")
    lines.append("Respond to the latest message:")
    lines.append(last.get('content', ''))
    return "\n".join(lines)


class ClaudeCodeClient:
    """Claude via the Claude Agent SDK. The key is passed only to the CLI subprocess."""

    def __init__(self, api_key=CLAUDE_CODE_API_KEY):
        self.api_key = api_key
        self.available = CLAUDE_CODE_AVAILABLE and bool(self.api_key)

    def _subprocess_env(self):
        # OAuth tokens (from `claude setup-token`) and API keys use different variables.
        # Blank the other one so nothing outside .env can be picked up instead.
        if self.api_key.startswith('sk-ant-oat'):
            return {'CLAUDE_CODE_OAUTH_TOKEN': self.api_key, 'ANTHROPIC_API_KEY': ''}
        return {'ANTHROPIC_API_KEY': self.api_key, 'CLAUDE_CODE_OAUTH_TOKEN': ''}

    async def chat(self, messages, tools=None):
        if not CLAUDE_CODE_AVAILABLE:
            raise Exception("claude-agent-sdk is not installed.")
        if not self.api_key:
            raise Exception("CLAUDE_CODE_API_KEY is missing from .env.")

        # Read-only tools, confined to uploads: the server is reachable over the LAN
        # and prompts can carry injected instructions from uploaded files, so the
        # agent must not be able to run commands or write files.
        options = ClaudeAgentOptions(
            max_turns=8,
            system_prompt=SYSTEM_PROMPT,
            cwd=UPLOAD_FOLDER,
            allowed_tools=tools or ["Read", "Grep", "Glob"],
            disallowed_tools=["Bash", "Write", "Edit", "WebFetch", "WebSearch"],
            setting_sources=[],  # ignore ~/.claude settings; .env is the only config
            env=self._subprocess_env(),
            model=CLAUDE_MODEL_OVERRIDE,
        )

        result_text = None
        result_error = None
        assistant_text = []
        # Let the stream finish before raising; raising mid-iteration breaks the SDK's cleanup
        try:
            async for message in query(prompt=_history_to_prompt(messages), options=options):
                if isinstance(message, AssistantMessage):
                    assistant_text.extend(b.text for b in message.content if isinstance(b, TextBlock))
                elif isinstance(message, ResultMessage):
                    if message.is_error:
                        result_error = message.result or message.subtype or 'unknown error'
                    else:
                        result_text = message.result
        except Exception as e:
            raise Exception(f"Claude Code request failed: {e}") from e
        if result_error:
            raise Exception(f"Claude Code request failed: {result_error}")

        content = result_text or "\n\n".join(t for t in assistant_text if t.strip())
        if not content:
            raise Exception("Claude Code returned an empty response.")
        return {"message": {"content": content, "role": "assistant"}}


class OpenAIClient:
    """OpenAI Chat Completions. The SDK retries transient errors (429/5xx/timeouts) itself."""

    def __init__(self, api_key=OPENAI_API_KEY, model=OPENAI_CHAT_MODEL):
        self.model = model
        self.available = OPENAI_SDK_AVAILABLE and bool(api_key)
        # Explicit api_key so the SDK never falls back to the OPENAI_API_KEY OS variable
        self._client = openai.OpenAI(api_key=api_key, max_retries=3, timeout=180) if self.available else None

    def chat(self, messages):
        if not self.available:
            raise Exception("OpenAI not available. Check OPENAI_API_KEY in .env and the openai package.")
        payload = [{"role": "system", "content": SYSTEM_PROMPT}]
        payload += [
            {"role": m.get('role', 'user'), "content": m.get('content', '')}
            for m in messages if m.get('role') in ('user', 'assistant')
        ]
        try:
            response = self._client.chat.completions.create(model=self.model, messages=payload)
        except openai.OpenAIError as e:
            raise Exception(f"OpenAI request failed: {e}") from e
        content = response.choices[0].message.content or ''
        if not content.strip():
            raise Exception("OpenAI returned an empty response.")
        return {"message": {"content": content, "role": "assistant"}}


claude_code_client = ClaudeCodeClient()
openai_client = OpenAIClient()
if LOCAL_ONLY:
    # Never touch cloud providers, even if keys are present in .env
    claude_code_client.available = False
    openai_client.available = False
    print(f"+ LOCAL_ONLY mode: using Ollama models only ({OLLAMA_BASE_URL})")


def chat_with_fallback(model, messages):
    """Try the requested model, then fall back to the other configured providers.

    Returns (assistant_text, model_that_answered).
    """
    def run_claude():
        async def _go():
            return await claude_code_client.chat(messages)
        return anyio.run(_go)

    providers = {
        CLAUDE_CODE_MODEL: (lambda: claude_code_client.available, run_claude),
        OPENAI_MODEL: (lambda: openai_client.available, lambda: openai_client.chat(messages)),
    }
    if model in providers:
        order = [model] + [m for m in providers if m != model]
        attempts = [(m, *providers[m]) for m in order]
    else:
        # Local Ollama model first; cloud providers only if Ollama fails
        attempts = [(model, lambda: True, lambda: ollama_client.chat(model, messages))]
        attempts += [(m, *providers[m]) for m in (CLAUDE_CODE_MODEL, OPENAI_MODEL)]

    errors = []
    for name, is_available, call in attempts:
        if not is_available():
            continue
        try:
            response = call()
            content = response.get('message', {}).get('content', '')
            if content:
                if errors:
                    print(f"INFO: fell back to {name} after: {'; '.join(errors)}")
                return content, name
            errors.append(f"{name}: empty response")
        except Exception as e:
            print(f"WARNING: {name} failed: {e}")
            errors.append(f"{name}: {e}")
    raise Exception("All AI providers failed. " + " | ".join(errors))

class FileProcessor:
    def process_file(self, file_path, filename, mime_type):
        """Extract text content from an uploaded file."""
        try:
            if mime_type.startswith('text/') or filename.endswith(tuple('.' + e for e in TEXT_EXTENSIONS)):
                return self._process_text_file(file_path)
            elif mime_type == 'application/pdf' and PDF_AVAILABLE:
                return self._process_pdf(file_path)
            elif mime_type.startswith('image/') and IMAGE_AVAILABLE:
                return self._process_image(file_path, filename)
            elif filename.endswith('.docx') and DOCX_AVAILABLE:
                return self._process_word_document(file_path, filename)
            elif filename.endswith(('.xlsx', '.xls')) and EXCEL_AVAILABLE:
                return self._process_excel_file(file_path, filename)
            elif filename.endswith('.pptx') and PPTX_AVAILABLE:
                return self._process_powerpoint(file_path, filename)
            else:
                return f"File uploaded: {filename} (content extraction not supported for this file type)"
        except Exception as e:
            return f"Error processing file: {str(e)}"
    
    def _process_text_file(self, file_path):
        # latin-1 decodes any byte sequence, so it is the final fallback
        for encoding in ('utf-8', 'cp1252', 'latin-1'):
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
            except OSError as e:
                return f"Error reading file: {e}"
        return "Error: Could not decode file"

    def _process_pdf(self, file_path):
        try:
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                text = "\n".join(page.extract_text() or '' for page in reader.pages).strip()
            return text or "PDF processed but no text could be extracted"
        except Exception as e:
            return f"Error reading PDF: {e}"

    def _process_image(self, file_path, filename):
        try:
            with Image.open(file_path) as img:
                width, height = img.size
                return (f"Image file: {filename}\nDimensions: {width}x{height}\nFormat: {img.format}\n"
                        f"Mode: {img.mode}\n\nNote: For image analysis, please use a vision-capable model like llava.")
        except Exception as e:
            return f"Error processing image: {e}"

    def _process_word_document(self, file_path, filename):
        try:
            doc = Document(file_path)
            content = [f"Word Document: {filename}\n", "=" * 50 + "\n"]

            for paragraph in doc.paragraphs:
                text = paragraph.text
                if text.strip():
                    is_heading = paragraph.style is not None and paragraph.style.name.startswith('Heading')
                    content.append(f"## {text}\n" if is_heading else f"{text}\n")

            if doc.tables:
                content.append("\n**Tables found in document:**\n")
                for i, table in enumerate(doc.tables):
                    content.append(f"\nTable {i+1}:\n")
                    for row in table.rows:
                        content.append(f"| {' | '.join(cell.text.strip() for cell in row.cells)} |\n")

            return "".join(content)
        except Exception as e:
            return f"Error reading Word document: {e}"

    EXCEL_MAX_ROWS = 50
    EXCEL_MAX_COLS = 20

    def _excel_rows(self, rows):
        """Render non-empty rows as pipe-table lines."""
        lines = []
        for row in rows:
            cells = ["" if v is None or v == "" else str(v) for v in row]
            if any(c.strip() for c in cells):
                lines.append(f"| {' | '.join(cells)} |\n")
        return lines

    def _process_excel_file(self, file_path, filename):
        max_r, max_c = self.EXCEL_MAX_ROWS, self.EXCEL_MAX_COLS
        try:
            content = [f"Excel File: {filename}\n", "=" * 50 + "\n"]

            if filename.endswith('.xlsx'):
                workbook = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
                try:
                    for sheet in workbook.worksheets:
                        content.append(f"\n**Sheet: {sheet.title}**\n")
                        content += self._excel_rows(sheet.iter_rows(max_row=max_r, max_col=max_c, values_only=True))
                        total = sheet.max_row or 0
                        if total > max_r:
                            content.append(f"\n... (showing first {max_r} of {total} rows)\n")
                finally:
                    workbook.close()
            else:
                workbook = xlrd.open_workbook(file_path)
                for sheet in workbook.sheets():
                    content.append(f"\n**Sheet: {sheet.name}**\n")
                    rows = (sheet.row_values(r, 0, min(sheet.ncols, max_c)) for r in range(min(sheet.nrows, max_r)))
                    content += self._excel_rows(rows)
                    if sheet.nrows > max_r:
                        content.append(f"\n... (showing first {max_r} of {sheet.nrows} rows)\n")

            return "".join(content)
        except Exception as e:
            return f"Error reading Excel file: {e}"

    def _process_powerpoint(self, file_path, filename):
        try:
            prs = Presentation(file_path)
            content = [f"PowerPoint Presentation: {filename}\n", "=" * 50 + "\n",
                       f"Total slides: {len(prs.slides)}\n\n"]

            for i, slide in enumerate(prs.slides, 1):
                content.append(f"**Slide {i}:**\n")
                texts = [s.text.strip() for s in slide.shapes if hasattr(s, "text") and s.text.strip()]
                content += [f"- {t}\n" for t in texts] or ["- (No text content)\n"]
                content.append("\n")

            return "".join(content)
        except Exception as e:
            return f"Error reading PowerPoint file: {e}"


SAFE_URL = re.compile(r'^(https?:|mailto:|#|/)', re.IGNORECASE)


def _sanitize_links(html_text):
    """Neutralize javascript:/data: and other non-web URLs in href/src attributes."""
    def fix(m):
        url = html.unescape(m.group(2)).strip()
        return m.group(0) if SAFE_URL.match(url) else f'{m.group(1)}="#"'
    return re.sub(r'\b(href|src)="([^"]*)"', fix, html_text, flags=re.IGNORECASE)


class ResponseFormatter:
    def __init__(self):
        self._md = None
        if MARKDOWN_AVAILABLE:
            # No attr_list: it lets text add arbitrary attributes (e.g. onclick).
            self._md = markdown.Markdown(extensions=['codehilite', 'fenced_code', 'tables'])
            # Model output is untrusted (it can echo uploaded files) and the page renders
            # it via innerHTML, so raw HTML is escaped instead of passed through.
            self._md.preprocessors.deregister('html_block')
            self._md.inlinePatterns.deregister('html')

    def format_response(self, text):
        if self._md:
            try:
                formatted = self._md.reset().convert(text)
                return _sanitize_links(self._enhance_formatting(formatted))
            except Exception as e:
                print(f"Markdown formatting error: {e}")
        return _sanitize_links(self._basic_format(text))

    def _basic_format(self, text):
        """Basic HTML formatting without markdown"""
        """Regex fallback when the markdown package is unavailable. Escapes first."""
        text = html.escape(text)
        text = self._format_tables(text)

        text = re.sub(r'```(\w+)?\n(.*?)\n```', r'<pre><code class="language-\1">\2</code></pre>', text, flags=re.DOTALL)
        text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)

        text = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', text)
        text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
        text = re.sub(r'__(.+?)__', r'<u>\1</u>', text)
        text = re.sub(r'~~(.+?)~~', r'<del>\1</del>', text)

        for level in (4, 3, 2, 1):
            text = re.sub(rf'^{"#" * level} (.+)$', rf'<h{level}>\1</h{level}>', text, flags=re.MULTILINE)

        text = self._format_lists(text)
        text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>', text)

        text = text.replace('\n\n', '</p><p>').replace('\n', '<br>')
        return f'<p>{text}</p>' if text.strip() else text

    def _enhance_formatting(self, text):
        text = re.sub(r'</(h[1-6]|p|ul|ol)>', r'</\1>\n', text)
        text = text.replace('<table>', '<table class="formatted-table">')
        text = text.replace('<a href=', '<a target="_blank" rel="noopener noreferrer" href=')
        return text
    
    def _format_tables(self, text):
        """Convert pipe tables to HTML tables"""
        lines = text.split('\n')
        result = []
        in_table = False
        table_rows = []
        
        for line in lines:
            stripped = line.strip()
            
            if '|' in stripped and len(stripped.split('|')) > 2:
                cells = [cell.strip() for cell in stripped.split('|')]
                if cells[0] == '':
                    cells = cells[1:]
                if cells and cells[-1] == '':
                    cells = cells[:-1]
                
                if cells:  # Only process if we have actual content
                    if not in_table:
                        in_table = True
                        table_rows = []
                    
                    if not re.match(r'^[\s\-\|\:]+$', stripped):
                        table_rows.append(cells)
            else:
                if in_table and table_rows:
                    result.append(self._build_html_table(table_rows))
                    table_rows = []
                    in_table = False
                
                result.append(line)
        
        if in_table and table_rows:
            result.append(self._build_html_table(table_rows))
        
        return '\n'.join(result)
    
    def _build_html_table(self, rows):
        """Build an HTML table from rows of cells"""
        if not rows:
            return ''
        
        table_html = ['<table class="formatted-table">']
        
        first_row = rows[0]
        if len(rows) > 1 and any(cell.isupper() or ':' in cell for cell in first_row):
            table_html.append('<thead><tr>')
            for cell in first_row:
                table_html.append(f'<th>{cell}</th>')
            table_html.append('</tr></thead>')
            body_rows = rows[1:]
        else:
            body_rows = rows
        
        if body_rows:
            table_html.append('<tbody>')
            for row in body_rows:
                table_html.append('<tr>')
                for cell in row:
                    table_html.append(f'<td>{cell}</td>')
                table_html.append('</tr>')
            table_html.append('</tbody>')
        
        table_html.append('</table>')
        return '\n'.join(table_html)
    
    def _format_lists(self, text):
        """Convert markdown-style lists to HTML lists"""
        lines = text.split('\n')
        result = []
        in_ul = False
        in_ol = False
        
        for line in lines:
            stripped = line.strip()
            
            if re.match(r'^[\*\-\+]\s+', stripped):
                if not in_ul:
                    if in_ol:
                        result.append('</ol>')
                        in_ol = False
                    result.append('<ul>')
                    in_ul = True
                
                content = re.sub(r'^[\*\-\+]\s+', '', stripped)
                result.append(f'<li>{content}</li>')
            
            elif re.match(r'^\d+\.\s+', stripped):
                if not in_ol:
                    if in_ul:
                        result.append('</ul>')
                        in_ul = False
                    result.append('<ol>')
                    in_ol = True
                
                content = re.sub(r'^\d+\.\s+', '', stripped)
                result.append(f'<li>{content}</li>')
            
            else:
                if in_ul:
                    result.append('</ul>')
                    in_ul = False
                if in_ol:
                    result.append('</ol>')
                    in_ol = False
                
                result.append(line)
        
        if in_ul:
            result.append('</ul>')
        if in_ol:
            result.append('</ol>')
        
        return '\n'.join(result)


formatter = ResponseFormatter()
file_processor = FileProcessor()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def enhance_prompt(user_message):
    return f"""{user_message}

Please format your response professionally using:
- **Bold text** for emphasis and important points
- *Italic text* for explanations or definitions
- `code snippets` for technical terms and functions
- ```language blocks``` for code examples
- ## Headings for organizing content
- Tables with | pipes | for | structured data |
- Bullet points and numbered lists for clarity
- Links [like this](url) when referencing external resources"""

def enhance_prompt_with_file(user_message, file_content, filename):
    return f"""I'm sharing a file with you: {filename}

File content:
{file_content}

User question: {user_message}

Please analyze this file and respond to my question. Format your response professionally using:
- **Bold text** for emphasis and important findings
- *Italic text* for explanations or definitions
- `code snippets` for technical terms and functions
- ```language blocks``` for code examples
- ## Headings to organize your analysis
- Tables with | pipes | for | data summary | or | comparisons |
- Bullet points and numbered lists for clarity
- Links [like this](url) when referencing external resources
- When analyzing spreadsheet data, present key findings in table format"""

@contextmanager
def get_db():
    """Connection that commits on success, rolls back on error, and is always closed.

    (sqlite3's own context manager only commits/rolls back; it never closes.)
    """
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_db():
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

            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id, id);
            CREATE INDEX IF NOT EXISTS idx_attachments_message ON file_attachments (message_id);
        ''')


@app.route('/')
def index():
    file_accept = ','.join(f'.{ext}' for ext in sorted(ALLOWED_EXTENSIONS))
    return render_template('index.html', file_accept=file_accept)


def save_upload(uploaded_file):
    """Save an allowed upload under a collision-free name and extract its content."""
    original = uploaded_file.filename
    ext = original.rsplit('.', 1)[1].lower()
    # secure_filename can strip non-ASCII names down to just the extension, so keep the
    # extension separately and prefix a random id to avoid overwriting other uploads.
    safe_name = secure_filename(original) or f"file.{ext}"
    if not safe_name.lower().endswith('.' + ext):
        safe_name = f"{safe_name}.{ext}"
    unique_filename = f"{datetime.now():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:8]}_{safe_name}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
    uploaded_file.save(file_path)

    mime_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
    return {
        'filename': unique_filename,
        'original_filename': safe_name,
        'file_path': file_path,
        'file_size': os.path.getsize(file_path),
        'mime_type': mime_type,
        'processed_content': file_processor.process_file(file_path, safe_name, mime_type),
    }


@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        if request.is_json:
            data = request.get_json(silent=True) or {}
            uploaded_file = None
        else:
            data = request.form
            uploaded_file = request.files.get('file')
        user_message = (data.get('message') or '').strip()
        model = data.get('model') or DEFAULT_MODELS[0]

        has_file = uploaded_file is not None and uploaded_file.filename != ''
        if not user_message and not has_file:
            return jsonify({'success': False, 'error': 'Empty message and no file'}), 400

        if 'session_id' not in session:
            session['session_id'] = create_session()
        session_id = session['session_id']
        create_session(session_id)  # recreate if it was deleted

        file_info = None
        if has_file:
            if not allowed_file(uploaded_file.filename):
                return jsonify({'success': False, 'error': 'File type not allowed'}), 400
            file_info = save_upload(uploaded_file)

        add_message(session_id, 'user', user_message, model, file_info)

        if file_info:
            enhanced_message = enhance_prompt_with_file(
                user_message, file_info['processed_content'], file_info['original_filename'])
        else:
            enhanced_message = enhance_prompt(user_message)

        # History minus the message just saved, which is replaced by the enhanced prompt
        messages = get_recent_messages(session_id, limit=10)[:-1]
        messages.append({'role': 'user', 'content': enhanced_message})

        try:
            assistant_message, answered_by = chat_with_fallback(model, messages)
            formatted_content = add_message(session_id, 'assistant', assistant_message, answered_by)
            return jsonify({
                'success': True,
                'model': answered_by,
                'fallback': answered_by != model,
                'message': {
                    'content': assistant_message,
                    'formatted_content': formatted_content
                }
            })

        except Exception as e:
            error_message = str(e)
            print(f"ERROR: Chat with model {model} failed: {error_message}")
            add_message(session_id, 'assistant', f"Error: {error_message}", model)
            return jsonify({'success': False, 'error': error_message}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/models', methods=['GET'])
def get_models():
    models = ollama_client.list_models()
    # Cloud models first so the default selection works even when Ollama is down
    cloud = [m for m, c in ((CLAUDE_CODE_MODEL, claude_code_client), (OPENAI_MODEL, openai_client)) if c.available]
    if not models and not cloud:
        models = DEFAULT_MODELS.copy()  # placeholders; chat will say which to `ollama pull`
    return jsonify({'success': True, 'models': cloud + models})


@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    try:
        sessions = [{
            'session_id': s['id'],
            'title': s['title'] or f"Session {s['id'][:8]}",
            'created_at': s['created_at'],
            'last_active': s['last_active'],
            'message_count': s['message_count'] or 0,
            'last_message': s['last_message'] or 'No messages',
        } for s in get_all_sessions()]
        return jsonify({'success': True, 'sessions': sessions})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/session/<session_id>/load', methods=['POST'])
def load_session(session_id):
    try:
        messages = get_session_messages(session_id)
        session['session_id'] = session_id
        formatted = [{
            'role': m['role'],
            'content': m['content'],
            'formatted_content': m['formatted_content'],
            'timestamp': m['timestamp'],
            'has_file': m['has_file'],
            'file_name': m.get('original_filename') or m.get('file_name'),
            'model': m['model'],
        } for m in messages]
        return jsonify({'success': True, 'messages': formatted})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def _is_inside_uploads(path):
    try:
        return Path(path).resolve().is_relative_to(Path(UPLOAD_FOLDER).resolve())
    except (OSError, ValueError):
        return False


@app.route('/api/session/<session_id>/delete', methods=['DELETE'])
def delete_session(session_id):
    try:
        with get_db() as conn:
            rows = conn.execute('''
                SELECT fa.file_path FROM file_attachments fa
                JOIN messages m ON fa.message_id = m.id
                WHERE m.session_id = ?
            ''', (session_id,)).fetchall()

            # Older rows store paths relative to the app directory
            for row in rows:
                file_path = os.path.join(BASE_DIR, row['file_path'])
                if not _is_inside_uploads(file_path):
                    continue
                try:
                    os.remove(file_path)
                except FileNotFoundError:
                    pass
                except OSError as e:
                    print(f"Error deleting file {file_path}: {e}")

            conn.execute('''
                DELETE FROM file_attachments
                WHERE message_id IN (SELECT id FROM messages WHERE session_id = ?)
            ''', (session_id,))
            conn.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
            conn.execute('DELETE FROM sessions WHERE id = ?', (session_id,))

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

@app.route('/api/claude-code/status', methods=['GET'])
def get_claude_status():
    return jsonify({
        'success': True,
        'available': claude_code_client.available,
        'sdk_installed': CLAUDE_CODE_AVAILABLE,
        'has_api_key': bool(claude_code_client.api_key),
    })


def create_session(session_id=None):
    session_id = session_id or str(uuid.uuid4())
    try:
        with get_db() as conn:
            conn.execute(
                'INSERT OR IGNORE INTO sessions (id, title) VALUES (?, ?)',
                (session_id, f'Chat Session {datetime.now():%Y-%m-%d %H:%M}')
            )
    except sqlite3.Error as e:
        print(f"Error creating session: {e}")
    return session_id


def add_message(session_id, role, content, model=None, file_info=None):
    """Store a message; returns the formatted HTML for assistant messages."""
    formatted_content = None
    if role == 'assistant':
        try:
            formatted_content = formatter.format_response(content)
        except Exception as e:
            print(f"Error formatting message: {e}")
            formatted_content = html.escape(content)

    try:
        with get_db() as conn:
            cursor = conn.execute(
                '''INSERT INTO messages (session_id, role, content, formatted_content, model, has_file, file_name, file_type)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (session_id, role, content, formatted_content, model, file_info is not None,
                 file_info and file_info['original_filename'], file_info and file_info['mime_type'])
            )
            if file_info:
                conn.execute(
                    '''INSERT INTO file_attachments (message_id, filename, original_filename, file_path, file_size, mime_type, processed_content)
                       VALUES (?, ?, ?, ?, ?, ?, ?)''',
                    (cursor.lastrowid, file_info['filename'], file_info['original_filename'],
                     file_info['file_path'], file_info['file_size'], file_info['mime_type'],
                     file_info.get('processed_content', ''))
                )
            conn.execute('UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE id = ?', (session_id,))
    except sqlite3.Error as e:
        print(f"Error adding message to database: {e}")
    return formatted_content


# Messages are ordered by id, not timestamp: CURRENT_TIMESTAMP has one-second
# resolution, so a question and its answer often share a timestamp.
def get_session_messages(session_id, limit=50):
    """Latest `limit` messages, oldest first; limit=None returns all."""
    if limit is None:
        limit = -1  # SQLite: negative LIMIT means no limit
    try:
        with get_db() as conn:
            rows = conn.execute(
                '''SELECT m.*, fa.original_filename, fa.mime_type AS attachment_mime_type, fa.processed_content
                   FROM messages m
                   LEFT JOIN file_attachments fa ON m.id = fa.message_id
                   WHERE m.session_id = ?
                   ORDER BY m.id DESC LIMIT ?''',
                (session_id, limit)
            ).fetchall()
        return [dict(r) for r in reversed(rows)]
    except sqlite3.Error as e:
        print(f"Error getting session messages: {e}")
        return []


def get_recent_messages(session_id, limit=10):
    """Conversation context for the model, oldest first, without stored error replies."""
    try:
        with get_db() as conn:
            rows = conn.execute(
                '''SELECT m.role, m.content, fa.processed_content
                   FROM messages m
                   LEFT JOIN file_attachments fa ON m.id = fa.message_id
                   WHERE m.session_id = ?
                   ORDER BY m.id DESC LIMIT ?''',
                (session_id, limit)
            ).fetchall()
    except sqlite3.Error as e:
        print(f"Error getting recent messages: {e}")
        return []

    result = []
    for r in reversed(rows):
        if r['role'] == 'assistant' and r['content'].startswith('Error: '):
            continue
        content = r['content']
        if r['processed_content']:
            content += f"\n\nFile content:\n{r['processed_content']}"
        result.append({'role': r['role'], 'content': content})
    return result


def get_all_sessions():
    try:
        with get_db() as conn:
            cursor = conn.execute('''
                SELECT s.*,
                       COUNT(m.id) as message_count,
                       MAX(m.timestamp) as last_message_time,
                       (SELECT content FROM messages WHERE session_id = s.id ORDER BY id DESC LIMIT 1) as last_message
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


# --- Image / video generation (Hugging Face Inference Providers) ---

# First is the default; the rest are fallbacks if a model/provider fails.
HF_IMAGE_MODELS = [
    'black-forest-labs/FLUX.1-schnell',
    'stabilityai/stable-diffusion-xl-base-1.0',
    'Qwen/Qwen-Image',
]


def hf_client(token):
    # provider='auto' routes to whichever provider serves the model (fal-ai, together, ...)
    return InferenceClient(provider='auto', token=token)


def hf_text_to_image(client, prompt, preferred=None):
    """Generate an image, trying the preferred model then the others. Returns (image, model)."""
    order = [preferred] if preferred else []
    order += [m for m in HF_IMAGE_MODELS if m != preferred]
    errors = []
    for model in order:
        try:
            return client.text_to_image(prompt, model=model), model
        except Exception as e:
            print(f"WARNING: image model {model} failed: {e}")
            errors.append(f"{model}: {e}")
    raise Exception("All image models failed. " + " | ".join(errors))


def data_url(raw_bytes, mime):
    return f"data:{mime};base64,{base64.b64encode(raw_bytes).decode('ascii')}"


def image_to_data_url(image):
    buf = io.BytesIO()
    image.save(buf, format='PNG')
    return data_url(buf.getvalue(), 'image/png')


@app.route('/api/generate-image', methods=['POST'])
def generate_image():
    if not HUGGINGFACE_AVAILABLE:
        return jsonify({'success': False, 'error': 'Image generation not available - huggingface-hub not installed'}), 400

    try:
        data = request.get_json(silent=True) or {}
        prompt = (data.get('prompt') or '').strip()
        if not prompt:
            return jsonify({'success': False, 'error': 'Prompt is required'}), 400

        token = hf_token()
        if not token:
            return jsonify({
                'success': False,
                'error': 'Hugging Face API token required for image generation. Please add HUGGINGFACE_HUB_TOKEN or HF_TOKEN to the .env file.',
                'setup_required': True
            }), 400

        requested_model = data.get('model') or HF_IMAGE_MODELS[0]
        print(f"Generating image with {requested_model}: {prompt}")
        image, model_used = hf_text_to_image(hf_client(token), prompt, requested_model)

        return jsonify({
            'success': True,
            'images': [image_to_data_url(image)],
            'prompt': prompt,
            'model': model_used,
            'fallback': model_used != requested_model
        })
    except Exception as e:
        print(f"Image generation error: {e}")
        return jsonify({'success': False, 'error': f'Image generation failed: {e}'}), 500


MAX_VIDEO_FRAMES = 8  # each frame is a separate image-generation call


@app.route('/api/generate-video', methods=['POST'])
def generate_video():
    """Short slideshow-style animation built from several generated images."""
    try:
        data = request.get_json(silent=True) or {}
        prompt = (data.get('prompt') or '').strip()
        duration = max(1, min(int(data.get('duration', 3)), 30))
        fps = max(1, min(int(data.get('fps', 8)), 30))
        if not prompt:
            return jsonify({'success': False, 'error': 'Prompt is required'}), 400

        result = create_simple_video_animation(prompt, duration, fps)
        if not result['success']:
            return jsonify({'success': False, 'error': result['error']}), 500
        return jsonify({
            'success': True,
            'video_url': result['video_url'],
            'prompt': prompt,
            'duration': duration,
            'fps': fps,
            'method': 'simple_animation'
        })
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'duration and fps must be numbers'}), 400
    except Exception as e:
        print(f"Video generation error: {e}")
        return jsonify({'success': False, 'error': f'Video generation failed: {e}'}), 500


def create_simple_video_animation(prompt, duration, fps):
    if not HUGGINGFACE_AVAILABLE:
        return {'success': False, 'error': 'Hugging Face not available for image generation'}
    token = hf_token()
    if not token:
        return {'success': False, 'error': 'Hugging Face token required'}

    client = hf_client(token)
    frames = []
    try:
        for i in range(min(duration * fps, MAX_VIDEO_FRAMES)):
            try:
                image, _ = hf_text_to_image(client, f"{prompt}, frame {i + 1}, slightly different angle")
                frames.append(image)
            except Exception as e:
                print(f"Frame {i} generation failed: {e}")
                if frames:
                    frames.append(frames[-1])

        if not frames:
            return {'success': False, 'error': 'No frames could be generated'}

        video = encode_frames(frames, fps)
        if not video:
            return {'success': False, 'error': 'Failed to create video from frames'}
        return {'success': True, 'video_url': data_url(*video)}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def encode_frames(frames, fps):
    """Encode PIL frames as WebM/VP8 (plays in browsers), or an animated GIF without OpenCV.

    Returns (bytes, mime) or None.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        print("OpenCV not available; falling back to animated GIF")
        return encode_gif(frames, fps)

    fd, video_path = tempfile.mkstemp(suffix='.webm')
    os.close(fd)
    try:
        width, height = frames[0].size
        writer = cv2.VideoWriter(video_path, cv2.VideoWriter_fourcc(*'VP80'), fps, (width, height))
        if not writer.isOpened():
            return encode_gif(frames, fps)
        repeats = max(1, 24 // len(frames))  # stretch to a watchable length
        try:
            for frame in frames:
                if frame.size != (width, height):
                    frame = frame.resize((width, height))
                bgr = cv2.cvtColor(np.asarray(frame.convert('RGB')), cv2.COLOR_RGB2BGR)
                for _ in range(repeats):
                    writer.write(bgr)
        finally:
            writer.release()
        with open(video_path, 'rb') as f:
            return f.read(), 'video/webm'
    except Exception as e:
        print(f"Video creation error: {e}")
        return None
    finally:
        try:
            os.remove(video_path)
        except OSError:
            pass


def encode_gif(frames, fps):
    try:
        buf = io.BytesIO()
        frames[0].save(buf, format='GIF', save_all=True, append_images=frames[1:],
                       duration=1000 // fps, loop=0)
        return buf.getvalue(), 'image/gif'
    except Exception as e:
        print(f"GIF creation error: {e}")
        return None


@app.route('/api/huggingface/status', methods=['GET'])
def huggingface_status():
    if not HUGGINGFACE_AVAILABLE:
        return jsonify({
            'available': False,
            'sdk_installed': False,
            'has_api_key': False,
            'error': 'Hugging Face Hub SDK not installed'
        })

    token = hf_token()
    return jsonify({
        'available': bool(token),
        'sdk_installed': True,
        'has_api_key': bool(token),
        'token_required': True,
        'setup_url': 'https://huggingface.co/settings/tokens'
    })


# --- Export ---

# Control characters that are illegal in XML (docx/xlsx) and break reportlab
_XML_ILLEGAL = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')


def _clean(text):
    return _XML_ILLEGAL.sub('', str(text or ''))


def _export_name(session_id, ext):
    return f"chat_session_{secure_filename(session_id[:8]) or 'export'}_{datetime.now():%Y%m%d_%H%M%S}.{ext}"


def _send_buffer(buf, session_id, ext, mimetype):
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name=_export_name(session_id, ext), mimetype=mimetype)


@app.route('/api/export/word/<session_id>', methods=['GET'])
def export_to_word(session_id):
    if not DOCX_AVAILABLE:
        return jsonify({'success': False, 'error': 'Word export not available - python-docx not installed'}), 400

    try:
        from docx.enum.text import WD_ALIGN_PARAGRAPH

        messages = get_session_messages(session_id, limit=None)
        if not messages:
            return jsonify({'success': False, 'error': 'No messages found for this session'}), 404

        doc = Document()
        doc.add_heading('Chat Session Export', 0).alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.add_paragraph(f'Session ID: {session_id}')
        doc.add_paragraph(f'Exported on: {datetime.now():%Y-%m-%d %H:%M:%S}')
        doc.add_paragraph(f'Total Messages: {len(messages)}')
        doc.add_paragraph('')

        for i, msg in enumerate(messages, 1):
            header = doc.add_paragraph()
            header.add_run(f"{i}. {msg['role'].title()}").bold = True
            if msg['role'] == 'assistant' and msg.get('model'):
                header.add_run(f" ({_clean(msg['model'])})")
            header.add_run(f" - {msg['timestamp']}")

            if msg.get('content'):
                doc.add_paragraph(_clean(msg['content']))
            if msg.get('has_file') and msg.get('file_name'):
                para = doc.add_paragraph()
                para.add_run("📎 Attached file: ").italic = True
                para.add_run(_clean(msg['file_name']))
            doc.add_paragraph('')

        buf = io.BytesIO()
        doc.save(buf)
        return _send_buffer(buf, session_id, 'docx',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    except Exception as e:
        return jsonify({'success': False, 'error': f'Export failed: {e}'}), 500


@app.route('/api/export/excel/<session_id>', methods=['GET'])
def export_to_excel(session_id):
    if not EXCEL_AVAILABLE:
        return jsonify({'success': False, 'error': 'Excel export not available - openpyxl not installed'}), 400

    try:
        from openpyxl.styles import Font, PatternFill

        messages = get_session_messages(session_id, limit=None)
        if not messages:
            return jsonify({'success': False, 'error': 'No messages found for this session'}), 404

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"Chat Session {session_id[:8]}"

        ws.append(['#', 'Role', 'Model', 'Timestamp', 'Content', 'Has File', 'File Name'])
        for cell in ws[1]:
            cell.font = Font(bold=True)
            cell.fill = PatternFill(start_color="CCCCCC", end_color="CCCCCC", fill_type="solid")

        for i, msg in enumerate(messages, 1):
            ws.append([i, msg['role'].title(), _clean(msg.get('model')), msg['timestamp'],
                       _clean(msg.get('content')), 'Yes' if msg.get('has_file') else 'No',
                       _clean(msg.get('file_name'))])

        for col in ws.columns:
            longest = max(len(str(c.value or '')) for c in col)
            ws.column_dimensions[col[0].column_letter].width = min(longest + 2, 50)

        buf = io.BytesIO()
        wb.save(buf)
        return _send_buffer(buf, session_id, 'xlsx',
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    except Exception as e:
        return jsonify({'success': False, 'error': f'Export failed: {e}'}), 500


@app.route('/api/export/pdf/<session_id>', methods=['GET'])
def export_to_pdf(session_id):
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    except ImportError:
        return jsonify({'success': False, 'error': 'PDF export not available - reportlab not installed'}), 400

    try:
        messages = get_session_messages(session_id, limit=None)
        if not messages:
            return jsonify({'success': False, 'error': 'No messages found for this session'}), 404

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], alignment=1, spaceAfter=30)
        header_style = ParagraphStyle('MessageHeader', parent=styles['Heading3'], spaceBefore=12, spaceAfter=6)
        body = styles['Normal']

        # Paragraph parses its text as markup, so message text must be escaped
        def esc(text):
            return html.escape(_clean(text))

        story = [
            Paragraph("Chat Session Export", title_style),
            Spacer(1, 12),
            Paragraph(f"<b>Session ID:</b> {esc(session_id)}", body),
            Paragraph(f"<b>Exported on:</b> {datetime.now():%Y-%m-%d %H:%M:%S}", body),
            Paragraph(f"<b>Total Messages:</b> {len(messages)}", body),
            Spacer(1, 20),
        ]
        for i, msg in enumerate(messages, 1):
            header = f"{i}. {msg['role'].title()}"
            if msg['role'] == 'assistant' and msg.get('model'):
                header += f" ({esc(msg['model'])})"
            story.append(Paragraph(f"{header} - {esc(msg['timestamp'])}", header_style))
            if msg.get('content'):
                story.append(Paragraph(esc(msg['content']).replace('\n', '<br/>'), body))
            if msg.get('has_file') and msg.get('file_name'):
                story.append(Paragraph(f"<i>Attached file: {esc(msg['file_name'])}</i>", body))
            story.append(Spacer(1, 12))

        buf = io.BytesIO()
        SimpleDocTemplate(buf, pagesize=letter).build(story)
        return _send_buffer(buf, session_id, 'pdf', 'application/pdf')
    except Exception as e:
        return jsonify({'success': False, 'error': f'Export failed: {e}'}), 500


@app.errorhandler(413)
def too_large(e):
    return jsonify({'success': False, 'error': 'File too large. Maximum size is 16MB.'}), 413


@app.errorhandler(404)
def not_found(e):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500


def safe_print(text):
    """print() that degrades emoji to '?' on consoles that can't encode them."""
    try:
        print(text)
    except UnicodeEncodeError:
        encoding = sys.stdout.encoding or 'ascii'
        print(text.encode(encoding, errors='replace').decode(encoding))


def initialize_app():
    safe_print("🚀 Starting Sypha AI Chat Application...")
    print("=" * 50)
    safe_print(f"📁 Upload folder: {UPLOAD_FOLDER}")
    safe_print(f"🗄️  Database: {DATABASE}")
    safe_print(f"🌐 Ollama URL: {OLLAMA_BASE_URL}")
    print("")

    safe_print("🤖 AI MODELS:")
    ai_models = ollama_client.list_models()
    if ai_models:
        more = '...' if len(ai_models) > 3 else ''
        safe_print(f"   ✅ Ollama: {len(ai_models)} models ({', '.join(ai_models[:3])}{more})")
    else:
        safe_print("   ⚠️  Ollama: no models found, or Ollama isn't running "
                   "(start it with `ollama serve`, install a model with `ollama pull llama3.2`)")

    if claude_code_client.available:
        ai_models.append(CLAUDE_CODE_MODEL)
        safe_print("   ✅ Claude Code: Ready (read-only tools)")
    elif LOCAL_ONLY:
        safe_print("   ⏸️  Claude Code: disabled (LOCAL_ONLY=true)")
    elif CLAUDE_CODE_AVAILABLE:
        safe_print("   ⚠️  Claude Code: CLAUDE_CODE_API_KEY missing from .env")
    else:
        safe_print("   ❌ Claude Code: claude-agent-sdk not installed")

    if openai_client.available:
        ai_models.append(OPENAI_MODEL)
        safe_print(f"   ✅ OpenAI: Ready ({OPENAI_CHAT_MODEL})")
    elif LOCAL_ONLY:
        safe_print("   ⏸️  OpenAI: disabled (LOCAL_ONLY=true)")
    elif OPENAI_SDK_AVAILABLE:
        safe_print("   ⚠️  OpenAI: OPENAI_API_KEY missing from .env")
    else:
        safe_print("   ❌ OpenAI: openai package not installed")

    if claude_code_client.available and openai_client.available:
        safe_print("   🔁 Automatic fallback between Claude Code and OpenAI enabled")
    print("")

    safe_print("📄 DOCUMENT PROCESSING:")
    capabilities = [name for name, ok in (
        ("Word (.docx)", DOCX_AVAILABLE),
        ("Excel (.xlsx/.xls)", EXCEL_AVAILABLE),
        ("PowerPoint (.pptx)", PPTX_AVAILABLE),
        ("PDF", PDF_AVAILABLE),
        ("Images", IMAGE_AVAILABLE),
    ) if ok]
    for cap in capabilities or ["Basic text files only"]:
        safe_print(f"   ✅ {cap}")
    print("")

    safe_print("⚡ FEATURES:")
    if MARKDOWN_AVAILABLE:
        safe_print("   ✅ Rich text formatting with tables")
    safe_print("   ✅ File upload and analysis")
    safe_print("   ✅ Session-based conversation history")
    safe_print("   ✅ Export to Word, Excel, and PDF")
    if not HUGGINGFACE_AVAILABLE:
        safe_print("   ❌ AI image generation (huggingface-hub package not installed)")
    elif hf_token():
        safe_print("   ✅ AI image generation (Hugging Face)")
    else:
        safe_print("   ⚠️  AI image generation: add HF_TOKEN to .env to enable")
    print("")
    safe_print(f"📎 Supported file types: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    init_db()
    safe_print("✅ Database initialized")

    print("")
    print("=" * 50)
    if ai_models:
        safe_print(f"🎯 Ready! {len(ai_models)} AI model(s) available")
    else:
        safe_print("⚠️  Ready with limited functionality (no AI models)")
    safe_print(f"🌐 Access the application at: http://localhost:{PORT}")
    print("=" * 50)


if __name__ == '__main__':
    initialize_app()

    from waitress import serve
    serve(app, host=HOST, port=PORT, threads=8)
