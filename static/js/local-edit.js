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
    
    // Remove SVG icons and empty anchor links (header permalinks)
    markdown = markdown.replace(/<svg[^>]*>.*?<\/svg>/gis, '');
    markdown = markdown.replace(/<a[^>]*href="#[^"]*"[^>]*>\s*<\/a>/gi, '');
    
    // Convert headers - use a function to clean inner content
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gis, function(match, content) {
      return '# ' + content.replace(/<[^>]+>/g, '').trim() + '\n\n';
    });
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gis, function(match, content) {
      return '## ' + content.replace(/<[^>]+>/g, '').trim() + '\n\n';
    });
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gis, function(match, content) {
      return '### ' + content.replace(/<[^>]+>/g, '').trim() + '\n\n';
    });
    markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gis, function(match, content) {
      return '#### ' + content.replace(/<[^>]+>/g, '').trim() + '\n\n';
    });
    markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gis, function(match, content) {
      return '##### ' + content.replace(/<[^>]+>/g, '').trim() + '\n\n';
    });
    markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gis, function(match, content) {
      return '###### ' + content.replace(/<[^>]+>/g, '').trim() + '\n\n';
    });
    
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

  // Initialize edit functionality
  document.addEventListener('DOMContentLoaded', function() {
    // Find all contenteditable cells
    const editableCells = document.querySelectorAll('[contenteditable="true"]');
    
    editableCells.forEach(function(cell) {
      let originalContent = cell.innerHTML;
      let saveBtn = null;
      
      // Listen for input changes
      cell.addEventListener('input', function() {
        // Check if content has changed
        if (cell.innerHTML !== originalContent) {
          // Show save button if not already visible
          if (!saveBtn) {
            saveBtn = document.createElement('button');
            saveBtn.innerHTML = '💾';
            saveBtn.className = 'cell-save-btn';
            saveBtn.title = 'Save changes';
            saveBtn.style.cssText = 'position:absolute;top:5px;right:5px;padding:8px 12px;background:#10b981;color:white;border:none;border-radius:4px;cursor:pointer;z-index:10;font-size:18px;box-shadow:0 2px 4px rgba(0,0,0,0.2);';
            
            // Make parent position relative if not already
            const parent = cell.parentElement;
            if (parent && window.getComputedStyle(parent).position === 'static') {
              parent.style.position = 'relative';
            }
            
            parent.appendChild(saveBtn);
            
            // Handle save button click
            saveBtn.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              
              const content = cell.innerHTML;
              const filePath = getFilePath(cell);
              
              console.log('Cell File path:', filePath);
              // console.log('Markdown content:');
              console.log(htmlToMarkdown(content));
              
              // Update original content and hide button
              originalContent = content;
              saveBtn.remove();
              saveBtn = null;
              
              // Show brief confirmation
              const confirmation = document.createElement('span');
              confirmation.textContent = '✓';
              confirmation.style.cssText = 'position:absolute;top:5px;right:5px;color:#10b981;font-size:24px;font-weight:bold;z-index:10;';
              parent.appendChild(confirmation);
              setTimeout(() => confirmation.remove(), 1000);
            });
          }
        } else if (saveBtn) {
          // Content reverted to original, hide save button
          saveBtn.remove();
          saveBtn = null;
        }
      });
    });
  });
})();
