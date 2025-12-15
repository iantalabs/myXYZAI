// Local editing functionality
(function() {
  // Only enable on localhost
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }

  const API_URL = 'http://localhost:3001';

  // Simple HTML to Markdown converter
  function htmlToMarkdown(html) {
    let markdown = html;
    
    // Remove button elements
    markdown = markdown.replace(/<button[^>]*>.*?<\/button>/g, '');
    
    // Convert headers
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
    
    // Convert bold and italic
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    
    // Convert links
    markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    
    // Convert images
    markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
    markdown = markdown.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
    
    // Convert lists
    markdown = markdown.replace(/<ul[^>]*>/gi, '\n');
    markdown = markdown.replace(/<\/ul>/gi, '\n');
    markdown = markdown.replace(/<ol[^>]*>/gi, '\n');
    markdown = markdown.replace(/<\/ol>/gi, '\n');
    markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    
    // Convert paragraphs
    markdown = markdown.replace(/<p[^>]*>/gi, '');
    markdown = markdown.replace(/<\/p>/gi, '\n\n');
    
    // Convert line breaks
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    
    // Convert code blocks
    markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n');
    markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    
    // Remove remaining HTML tags
    markdown = markdown.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    markdown = markdown.replace(/&amp;/g, '&');
    markdown = markdown.replace(/&lt;/g, '<');
    markdown = markdown.replace(/&gt;/g, '>');
    markdown = markdown.replace(/&quot;/g, '"');
    markdown = markdown.replace(/&#39;/g, "'");
    markdown = markdown.replace(/&nbsp;/g, ' ');
    
    // Clean up extra whitespace
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.trim();
    
    return markdown;
  }

  // Extract file path from URL or cell element
  function getFilePath(cellElement) {
    // If we have a cell element with a link, use its href to get the actual cell path
    if (cellElement) {
      const cellLink = cellElement.querySelector('h3 a[href]');
      if (cellLink) {
        const href = cellLink.getAttribute('href');
        // Convert href to file path
        let filePath = 'content' + href;
        if (filePath.endsWith('/')) {
          filePath += '_index.md';
        }
        return filePath;
      }
    }
    
    // Fallback to URL-based path (for non-row layouts)
    const path = window.location.pathname;
    // Convert URL path to file path
    // e.g., /labs/lab1/exp1/tab1/row1/cell1/ -> content/labs/lab1/exp1/tab1/row1/cell1/_index.md
    let filePath = 'content' + path;
    if (filePath.endsWith('/')) {
      filePath += '_index.md';
    }
    return filePath;
  }

  // Save content to file via API
  async function saveToFile(content, cellElement) {
    const filePath = getFilePath(cellElement);
    
    try {
      const response = await fetch(`${API_URL}/api/save-cell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: filePath,
          content: content
        })
      });
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }

  // Add edit button to editable elements
  function addEditButton(cell) {
    // Skip if already has edit button
    if (cell.querySelector('.cell-edit-btn')) {
      return;
    }
    
    // Create edit button
    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Edit';
    editBtn.className = 'cell-edit-btn';
    editBtn.style.cssText = 'position:absolute;top:5px;right:5px;padding:5px 10px;background:#0070f3;color:white;border:none;border-radius:4px;cursor:pointer;z-index:10;font-size:14px;';
    
    // Make cell position relative
    cell.style.position = 'relative';
    cell.insertBefore(editBtn, cell.firstChild);
    
    editBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        
        if (cell.classList.contains('editing')) {
          // Save mode
          editBtn.disabled = true;
          editBtn.textContent = '⏳ Saving...';
          
          const contentDiv = cell.querySelector('div');
          const htmlContent = contentDiv ? contentDiv.innerHTML : cell.innerHTML.replace(/<button[^>]*>.*?<\/button>/g, '');
          const markdownContent = htmlToMarkdown(htmlContent);
          
          try {
            const result = await saveToFile(markdownContent, cell);
            
            cell.classList.remove('editing');
            contentDiv.contentEditable = 'false';
            contentDiv.style.border = '';
            contentDiv.style.padding = '';
            editBtn.textContent = '✏️ Edit';
            editBtn.style.background = '#0070f3';
            editBtn.disabled = false;
            
            // Show success notification
            const notification = document.createElement('div');
            notification.textContent = '✅ Changes saved to file!';
            notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#10b981;color:white;border-radius:8px;z-index:1000;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
          } catch (error) {
            // Show error notification
            const notification = document.createElement('div');
            notification.innerHTML = '❌ Save failed! Make sure editor server is running.<br><small>Run: npm install && node editor-server.js</small>';
            notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#ef4444;color:white;border-radius:8px;z-index:1000;max-width:300px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 5000);
            
            editBtn.textContent = '💾 Save';
            editBtn.disabled = false;
          }
        } else {
          // Edit mode
          cell.classList.add('editing');
          const contentDiv = cell.querySelector('div');
          contentDiv.contentEditable = 'true';
          contentDiv.style.border = '2px solid #0070f3';
          contentDiv.style.padding = '10px';
          contentDiv.style.minHeight = '100px';
          contentDiv.style.cursor = 'text';
          contentDiv.style.setProperty('cursor', 'text', 'important');
          editBtn.textContent = '💾 Save';
          editBtn.style.background = '#10b981';
          
          // Add CSS rule for all children to have text cursor
          const styleId = 'cell-edit-cursor-style';
          if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = '.editing [contenteditable="true"], .editing [contenteditable="true"] * { cursor: text !important; }';
            document.head.appendChild(style);
          }
          
          contentDiv.focus();
        }
      });
  }

  // Initialize edit functionality
  document.addEventListener('DOMContentLoaded', function() {
    // Add edit buttons to all .hextra-cell elements (for row views)
    const cells = document.querySelectorAll('.hextra-cell');
    cells.forEach(function(cell) {
      addEditButton(cell);
    });
    
    // For individual cell pages, also make the main content editable
    // Look for article or main content area that contains cell content
    if (cells.length === 0) {
      const mainContent = document.querySelector('article.hx-prose, article, main .hx-prose, main');
      if (mainContent && !mainContent.querySelector('.cell-edit-btn')) {
        // Wrap content in a container div if not already wrapped
        let editableContainer = mainContent;
        
        // Check if we're on a cell page by looking at the URL pattern
        const path = window.location.pathname;
        if (path.includes('/cell')) {
          // Create a wrapper for the editable content
          const wrapper = document.createElement('div');
          wrapper.className = 'hextra-cell';
          wrapper.style.position = 'relative';
          wrapper.style.minHeight = '200px';
          
          // Move all content into wrapper
          while (mainContent.firstChild) {
            wrapper.appendChild(mainContent.firstChild);
          }
          mainContent.appendChild(wrapper);
          
          addEditButton(wrapper);
        }
      }
    }
  });
})();
