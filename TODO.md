# TODO: Development Instructions & Tasks

## PERMANENT INSTRUCTIONS
**These instructions apply to every step added to this TODO.md:**

1. **Always perform steps in TODO.md** - Work through tasks in order
2. **Mark steps as complete in ACTIONS.md** - Update ACTIONS.md when each task is finished
3. **When finding new steps, add them to TODO.md** - Document any new requirements discovered
4. **When finished with all work, update SUMMARY.md** - Provide comprehensive summary of completed work

---

# TODO: Word/Excel Support & Rich Formatting

## Phase 1: Backend Dependencies & File Processing

### 1.1 Install Dependencies
- [x] Install required Python packages: `python-docx`, `openpyxl`, `xlrd`, `xlwt`, `python-pptx`
- [x] Update requirements.txt with new dependencies

### 1.2 Update File Support
- [x] Add `.docx`, `.xlsx`, `.xls`, `.pptx` to `ALLOWED_EXTENSIONS` in app.py
- [x] Import new libraries with optional error handling (try/except blocks)
- [x] Update file upload acceptance in HTML

### 1.3 File Processing Methods
- [x] Create `_process_word_document()` method - Extract text and formatting from .docx
- [x] Create `_process_excel_file()` method - Extract data from spreadsheets (.xlsx/.xls)
- [x] Create `_process_powerpoint()` method - Extract text from presentations
- [x] Update main `process_file()` method to handle new file types

## Phase 2: Enhanced Response Formatting

### 2.1 Upgrade ResponseFormatter Class
- [x] Add table rendering support (`<table>`, `<tr>`, `<td>`)
- [x] Implement image embedding capabilities
- [x] Add icon/emoji support
- [x] Enhanced bold/italic/underline formatting
- [x] Support for nested lists and complex structures

### 2.2 CSS Enhancements
- [x] Add table styling with borders and hover effects
- [x] Image responsive display styles
- [x] Enhanced typography for bold text
- [x] Icon font support or emoji styling
- [x] Ensure mobile responsiveness for new elements

## Phase 3: Frontend Enhancements

### 3.1 HTML Updates
- [x] Update file input accept attribute for new file types
- [x] Add preview support for Office documents

### 3.2 JavaScript Enhancements
- [x] Support for table display in message rendering
- [x] Image preview/display functionality
- [x] Rich text formatting preservation
- [x] File type detection and appropriate handling

## Phase 4: Advanced Features

### 4.1 Export Capabilities
- [ ] Export chat to Word document (.docx)
- [ ] Export to Excel spreadsheet (.xlsx)
- [ ] Export to PDF with formatting
- [ ] Add export buttons to UI

### 4.2 Enhanced AI Integration
- [ ] Update prompt templates to encourage table/formatted output
- [ ] Add formatting instructions for AI responses
- [ ] Context-aware formatting based on content type

## Phase 5: Advanced UI Layout & Claude Integration

### 5.1 Responsive Layout Enhancement
- [x] Reduce interface size and move to left when outputting response
- [x] Create separate response area on the right (larger than interface)
- [x] Implement smooth transition animations between layouts
- [x] Add responsive breakpoints for different screen sizes
- [x] Optimize mobile layout for split-screen design

### 5.2 Claude Code SDK Integration
- [x] Install and configure claude-code SDK
- [x] Set up API key configuration (securely)
- [x] Create Claude Code client integration
- [x] Add Claude Code as model option in dropdown
- [x] Implement async response handling for better UX
- [x] Add Claude Code specific features (tool usage, code analysis)

## Phase 6: Export Capabilities

### 6.1 Export Functionality
- [ ] Export chat to Word document (.docx)
- [ ] Export to Excel spreadsheet (.xlsx)
- [ ] Export to PDF with formatting
- [ ] Add export buttons to UI
- [ ] Export conversation history with proper formatting

### 6.2 Enhanced AI Integration
- [ ] Update prompt templates to encourage table/formatted output
- [ ] Add formatting instructions for AI responses
- [ ] Context-aware formatting based on content type

## Phase 7: UI/UX Improvements & Bug Fixes

### 7.1 Terminal Output & Startup
- [ ] Update terminal startup output to accurately reflect actual application capabilities
- [ ] Show correct feature availability and status
- [ ] Improve startup messaging and diagnostics

### 7.2 Split Screen Layout Optimization
- [ ] Change split screen proportions to 30% left panel, 60% right panel
- [ ] Add 10% total padding around both panels (5% each side)
- [ ] Ensure responsive design maintains proportions on different screen sizes
- [ ] Update mobile layout to work with new proportions

### 7.3 Elegant & Simplistic Styling
- [ ] Redesign interface with more elegant and minimalist approach
- [ ] Simplify color palette and typography
- [ ] Reduce visual clutter and improve whitespace usage
- [ ] Enhance overall user experience with cleaner design

### 7.4 Claude Code Integration Bug Fix
- [ ] Investigate and fix 500 error when querying claude-code model
- [ ] Debug API call issues and error handling
- [ ] Ensure proper async/await implementation
- [ ] Test claude-code responses and error scenarios
- [ ] Improve error messaging for claude-code failures

## Phase 8: Export Capabilities

### 8.1 Export Functionality
- [ ] Export chat to Word document (.docx)
- [ ] Export to Excel spreadsheet (.xlsx)
- [ ] Export to PDF with formatting
- [ ] Add export buttons to UI
- [ ] Export conversation history with proper formatting

### 8.2 Enhanced AI Integration
- [ ] Update prompt templates to encourage table/formatted output
- [ ] Add formatting instructions for AI responses
- [ ] Context-aware formatting based on content type

## Phase 9: UI Bug Fixes & Display Issues

### 9.1 Output Display Fixes
- [x] Fix output formatting - ensure rich text with icons, tables, bold/italic displays properly
- [x] Move AI responses to right-side output window instead of main chat window
- [x] Remove "Chat Sessions Loading" popup that never loads content
- [x] Fix content not displaying - resolved CSS layout issue (was showing below instead of to the right)

### 9.2 Performance & Polish
- [x] Clean up debug logging from production code
- [x] Optimize split mode transition timing
- [x] Improve element initialization and error handling
- [x] Ensure proper CSS application for responsive design

### 9.3 Layout Positioning Fix
- [x] Fixed CSS flexbox layout - added explicit `flex-direction: row` for split mode
- [x] Ensured response area appears to the right, not below the interface
- [x] Added proper height and display properties for response area
- [x] Removed temporary debug buttons and logging

### 9.4 Panel Styling & Persistence
- [x] Removed close button from response panel header
- [x] Made response area a permanent styled div (not floating window)
- [x] Matched styling between input and output panels (background, border-radius, shadows)
- [x] Made output pane persistent until new chat is started
- [x] Updated response header with proper border radius and flex properties

## Phase 10: Testing & Optimization

### 10.1 Comprehensive Testing
- [ ] Test Word document upload and processing
- [ ] Test Excel file data extraction
- [ ] Test PowerPoint file processing
- [ ] Verify rich formatting displays correctly
- [ ] Test export functionality
- [ ] Test Claude Code SDK integration
- [ ] Cross-browser compatibility testing
- [ ] Mobile device testing

### 10.2 Performance & Polish
- [ ] Optimize file processing performance
- [ ] Add loading indicators for large files
- [ ] Error handling and user feedback
- [ ] Documentation updates

## Phase 11: Speech & Image Features

### 11.1 Speech Capture Functionality
- [ ] Research and integrate Web Speech API for voice input
- [ ] Add microphone button to interface for voice recording
- [ ] Implement speech-to-text conversion for search queries
- [ ] Add audio feedback and visual indicators during recording
- [ ] Test voice functionality across different browsers and devices
- [ ] Add voice command support for basic navigation

### 11.2 Image Creation Functionality
- [ ] Research Flux Kontext API integration options
- [ ] Evaluate alternative image generation APIs (DALL-E, Midjourney, Stable Diffusion)
- [ ] Implement image generation API client
- [ ] Add image creation interface with prompt input
- [ ] Create image gallery/display functionality
- [ ] Add image download and export capabilities
- [ ] Implement prompt history and templates for image generation

### 11.3 Mobile Device Optimization
- [ ] Audit all existing features for mobile compatibility
- [ ] Test speech capture on mobile browsers (iOS Safari, Chrome Mobile)
- [ ] Optimize touch interfaces for mobile image creation
- [ ] Ensure responsive design works across all screen sizes
- [ ] Test file upload functionality on mobile devices
- [ ] Optimize performance for mobile processors and networks
- [ ] Add mobile-specific UI enhancements (swipe gestures, touch feedback)
- [ ] Test Claude Code integration on mobile browsers
- [ ] Verify document processing works on mobile uploads
