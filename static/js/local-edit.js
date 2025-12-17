// Local editing functionality
(function() {
  // Only enable on localhost
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }

  const API_URL = 'http://localhost:3001';

  // Load html2canvas dynamically
  if (!window.html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    document.head.appendChild(script);
  }

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
    // If we have a cell element, try to find the link in the parent container
    if (cellElement) {
      // First check if there's a link inside the cell element itself
      let cellLink = cellElement.querySelector('h3 a[href]');
      
      // If not found, check the parent's h3 (for row view where link is sibling)
      if (!cellLink && cellElement.parentElement) {
        cellLink = cellElement.parentElement.querySelector('h3 a[href]');
      }
      
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
            saveBtn.addEventListener('click', async function(e) {
              e.preventDefault();
              e.stopPropagation();
              
              const content = cell.innerHTML;
              const filePath = getFilePath(cell);
              const markdownContent = htmlToMarkdown(content);
              
              console.log('Cell File path:', filePath);
              console.log(markdownContent);
              
              // Disable button and show saving state
              saveBtn.disabled = true;
              saveBtn.innerHTML = '⏳';
              saveBtn.title = 'Saving...';
              
              try {
                // Save to file
                await saveToFile(markdownContent, cell);
                
                // Update original content and hide button
                originalContent = content;
                saveBtn.remove();
                saveBtn = null;
                
                // Show success notification
                const notification = document.createElement('div');
                notification.textContent = '✅ Changes saved to file!';
                notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#10b981;color:white;border-radius:8px;z-index:1000;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
              } catch (error) {
                // Show error notification
                const notification = document.createElement('div');
                notification.innerHTML = '❌ Save failed! Make sure editor server is running.<br><small>Run: node editor-server.js</small>';
                notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#ef4444;color:white;border-radius:8px;z-index:1000;max-width:300px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 5000);
                
                // Re-enable button
                saveBtn.disabled = false;
                saveBtn.innerHTML = '💾';
                saveBtn.title = 'Save changes';
              }
            });
          }
        } else if (saveBtn) {
          // Content reverted to original, hide save button
          saveBtn.remove();
          saveBtn = null;
        }
      });
    });
    
    // // Add keyboard shortcut for save (Ctrl+S)
    // document.addEventListener('keydown', function(e) {
    //   // Check for Ctrl+S
    //   if (e.ctrlKey && e.key === 's') {
    //     e.preventDefault();
        
    //     // Find the focused cell or any cell with a save button
    //     const focusedCell = document.activeElement;
    //     let targetCell = null;
        
    //     if (focusedCell && focusedCell.hasAttribute('contenteditable')) {
    //       targetCell = focusedCell;
    //     } else {
    //       // Find any cell with a save button
    //       const cellWithSaveBtn = document.querySelector('.cell-save-btn');
    //       if (cellWithSaveBtn) {
    //         targetCell = cellWithSaveBtn.parentElement.querySelector('[contenteditable="true"]');
    //       }
    //     }
        
    //     if (targetCell) {
    //       // Find and click the save button for this cell
    //       const parent = targetCell.parentElement;
    //       const saveButton = parent.querySelector('.cell-save-btn');
    //       if (saveButton) {
    //         saveButton.click();
    //       }
    //     }
    //   }
    // });

    // Screenshot functionality for tab views
    async function captureTabScreenshot(tabName) {
      // Wait for html2canvas to load
      let attempts = 0;
      while (!window.html2canvas && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!window.html2canvas) {
        console.error('html2canvas failed to load');
        return;
      }

      const mainContent = document.querySelector('main') || document.body;
      
      try {
        const canvas = await html2canvas(mainContent, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true
        });
        
        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('image', blob, `${tabName}.png`);
          formData.append('path', 'content/labs/lab1/exp1/images');
          
          try {
            const response = await fetch(`${API_URL}/api/save-screenshot`, {
              method: 'POST',
              body: formData
            });
            
            const result = await response.json();
            console.log(`Screenshot saved: ${result.message}`);
            alert(`Screenshot saved to ${result.filePath}`);
          } catch (error) {
            console.error('Error saving screenshot:', error);
            alert('Error saving screenshot: ' + error.message);
          }
        }, 'image/png');
      } catch (error) {
        console.error('Error capturing screenshot:', error);
        alert('Error capturing screenshot: ' + error.message);
      }
    }

    // Add screenshot button for tab views
    if (window.location.pathname.includes('/tab1/') || window.location.pathname.includes('/tab2/')) {
      const tabMatch = window.location.pathname.match(/\/(tab\d+)\//);
      if (tabMatch) {
        const tabName = tabMatch[1];
        
        // Create screenshot button
        const screenshotBtn = document.createElement('button');
        screenshotBtn.innerHTML = '📸 Capture Screenshot';
        screenshotBtn.style.cssText = `
          position: fixed;
          top: 80px;
          right: 20px;
          padding: 10px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          z-index: 1000;
          transition: background 0.2s;
        `;
        
        screenshotBtn.addEventListener('mouseover', function() {
          this.style.background = '#2563eb';
        });
        
        screenshotBtn.addEventListener('mouseout', function() {
          this.style.background = '#3b82f6';
        });
        
        screenshotBtn.addEventListener('click', function() {
          this.disabled = true;
          this.innerHTML = '⏳ Capturing...';
          captureTabScreenshot(tabName).finally(() => {
            this.disabled = false;
            this.innerHTML = '📸 Capture Screenshot';
          });
        });
        
        document.body.appendChild(screenshotBtn);
      }
    }

  });
})();
