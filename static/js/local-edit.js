// Local editing functionality
(function() {
  // Only enable on localhost
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }

  const API_URL = 'http://localhost:3001';

  // Helper to convert oklch to rgb (simplified approximation)
  function oklchToRgb(oklchStr) {
    // Extract values from oklch string like "oklch(0.5 0.1 180)"
    const match = oklchStr.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
    if (!match) return oklchStr;
    
    const l = parseFloat(match[1]);
    const c = parseFloat(match[2]);
    const h = parseFloat(match[3]);
    
    // Very simplified conversion - just use lightness as grayscale
    const gray = Math.round(l * 255);
    return `rgb(${gray}, ${gray}, ${gray})`;
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
    // First, check if the cell element has a data-cell-path attribute
    if (cellElement && cellElement.hasAttribute('data-cell-path')) {
      let cellPath = cellElement.getAttribute('data-cell-path');
      // Ensure it ends with _index.md
      if (!cellPath.endsWith('_index.md')) {
        if (cellPath.endsWith('/')) {
          cellPath += '_index.md';
        } else {
          cellPath += '/_index.md';
        }
      }
      return cellPath;
    }
    
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
    // e.g., /orgs/org1/prod1/sow1/xyv1/tab1/row1/cell1/ -> content/orgs/org1/prod1/sow1/xyv1/tab1/row1/cell1/_index.md
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
                notification.textContent = '✅ Saved';
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
    
    // Add handlers for insert row buttons
    const insertRowBtns = document.querySelectorAll('.insert-row-btn');
    insertRowBtns.forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const rowPath = btn.getAttribute('data-row-path');
        const rowWeight = btn.getAttribute('data-row-weight');
        
        // Disable button and show loading state
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        
        try {
          const response = await fetch(`${API_URL}/api/insert-row`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rowPath: rowPath,
              rowWeight: rowWeight
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            // Save scroll positions for ALL rows before reload
            const allCellContainers = document.querySelectorAll('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
            allCellContainers.forEach(function(container) {
              const cellWithPath = container.querySelector('[data-cell-path]');
              if (cellWithPath) {
                const cp = cellWithPath.getAttribute('data-cell-path');
                const match = cp.match(/tab(\d+)\/row(\d+)/);
                if (match) {
                  const rId = 'tab' + match[1] + '-row' + match[2];
                  localStorage.setItem('rowScrollPosition_' + rId, container.scrollLeft);
                }
              }
            });
            
            // Show success notification
            const notification = document.createElement('div');
            notification.textContent = '✅ New row created! Refreshing...';
            notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#10b981;color:white;border-radius:8px;z-index:1000;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(notification);
            
            // Refresh the page after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            throw new Error(result.error || 'Failed to insert row');
          }
        } catch (error) {
          console.error('Error inserting row:', error);
          
          // Show error notification
          const notification = document.createElement('div');
          notification.innerHTML = '❌ Failed to insert row!<br><small>' + error.message + '</small>';
          notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#ef4444;color:white;border-radius:8px;z-index:1000;max-width:300px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
          
          // Re-enable button
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    });
    
    // Add handlers for delete row buttons
    const deleteRowBtns = document.querySelectorAll('.delete-row-btn');
    deleteRowBtns.forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const rowPath = btn.getAttribute('data-row-path');
        const rowWeight = btn.getAttribute('data-row-weight');
        
        // Disable button and show loading state
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        
        try {
          const response = await fetch(`${API_URL}/api/delete-row`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              rowPath: rowPath,
              rowWeight: rowWeight
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            // Save scroll positions for ALL rows before reload
            const allCellContainers = document.querySelectorAll('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
            allCellContainers.forEach(function(container) {
              const cellWithPath = container.querySelector('[data-cell-path]');
              if (cellWithPath) {
                const cp = cellWithPath.getAttribute('data-cell-path');
                const match = cp.match(/tab(\d+)\/row(\d+)/);
                if (match) {
                  const rId = 'tab' + match[1] + '-row' + match[2];
                  localStorage.setItem('rowScrollPosition_' + rId, container.scrollLeft);
                }
              }
            });
            
            // Show success notification
            const notification = document.createElement('div');
            notification.textContent = '✅ Row deleted! Refreshing...';
            notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#10b981;color:white;border-radius:8px;z-index:1000;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(notification);
            
            // Refresh the page after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            throw new Error(result.error || 'Failed to delete row');
          }
        } catch (error) {
          console.error('Error deleting row:', error);
          
          // Show error notification
          const notification = document.createElement('div');
          notification.innerHTML = '❌ Failed to delete row!<br><small>' + error.message + '</small>';
          notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#ef4444;color:white;border-radius:8px;z-index:1000;max-width:300px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
          
          // Re-enable button
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    });
    
    // Add handlers for insert cell buttons
    const insertCellBtns = document.querySelectorAll('.insert-cell-btn');
    insertCellBtns.forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const cellPath = btn.getAttribute('data-cell-path');
        const cellWeight = btn.getAttribute('data-cell-weight');
        
        // Disable button and show loading state
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        
        try {
          const response = await fetch(`${API_URL}/api/insert-cell`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cellPath: cellPath,
              cellWeight: cellWeight
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            // Save scroll positions for ALL rows before reload
            const allCellContainers = document.querySelectorAll('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
            allCellContainers.forEach(function(container) {
              const cellWithPath = container.querySelector('[data-cell-path]');
              if (cellWithPath) {
                const cp = cellWithPath.getAttribute('data-cell-path');
                const match = cp.match(/tab(\d+)\/row(\d+)/);
                if (match) {
                  const rId = 'tab' + match[1] + '-row' + match[2];
                  localStorage.setItem('rowScrollPosition_' + rId, container.scrollLeft);
                }
              }
            });
            
            // For the row where the cell was added, scroll to the end to show the new cell
            const cellContainer = btn.closest('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
            if (cellContainer) {
              const tabRowMatch = cellPath.match(/tab(\d+)\/row(\d+)/);
              if (tabRowMatch) {
                const rowId = 'tab' + tabRowMatch[1] + '-row' + tabRowMatch[2];
                localStorage.setItem('rowScrollPosition_' + rowId, cellContainer.scrollWidth);
              }
            }
            
            // Show success notification
            const notification = document.createElement('div');
            notification.textContent = '✅ New cell created! Refreshing...';
            notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#10b981;color:white;border-radius:8px;z-index:1000;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(notification);
            
            // Refresh the page after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            throw new Error(result.error || 'Failed to insert cell');
          }
        } catch (error) {
          console.error('Error inserting cell:', error);
          
          // Show error notification
          const notification = document.createElement('div');
          notification.innerHTML = '❌ Failed to insert cell!<br><small>' + error.message + '</small>';
          notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#ef4444;color:white;border-radius:8px;z-index:1000;max-width:300px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
          
          // Re-enable button
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    });
    
    // Add handlers for delete cell buttons
    const deleteCellBtns = document.querySelectorAll('.delete-cell-btn');
    deleteCellBtns.forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const cellPath = btn.getAttribute('data-cell-path');
        const cellWeight = btn.getAttribute('data-cell-weight');
        
        // Disable button and show loading state
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        
        try {
          const response = await fetch(`${API_URL}/api/delete-cell`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cellPath: cellPath,
              cellWeight: cellWeight
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            // Save scroll positions for ALL rows before reload
            const allCellContainers = document.querySelectorAll('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
            allCellContainers.forEach(function(container) {
              const cellWithPath = container.querySelector('[data-cell-path]');
              if (cellWithPath) {
                const cp = cellWithPath.getAttribute('data-cell-path');
                const match = cp.match(/tab(\d+)\/row(\d+)/);
                if (match) {
                  const rId = 'tab' + match[1] + '-row' + match[2];
                  localStorage.setItem('rowScrollPosition_' + rId, container.scrollLeft);
                }
              }
            });
            
            // Show success notification
            const notification = document.createElement('div');
            notification.textContent = '✅ Cell deleted! Refreshing...';
            notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#10b981;color:white;border-radius:8px;z-index:1000;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(notification);
            
            // Refresh the page after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            throw new Error(result.error || 'Failed to delete cell');
          }
        } catch (error) {
          console.error('Error deleting cell:', error);
          
          // Show error notification
          const notification = document.createElement('div');
          notification.innerHTML = '❌ Failed to delete cell!<br><small>' + error.message + '</small>';
          notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#ef4444;color:white;border-radius:8px;z-index:1000;max-width:300px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
          
          // Re-enable button
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    });
    
    // Add handlers for insert code cell buttons
    const insertCodeCellBtns = document.querySelectorAll('.insert-code-cell-btn');
    insertCodeCellBtns.forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const cellPath = btn.getAttribute('data-cell-path');
        const cellWeight = btn.getAttribute('data-cell-weight');
        
        // Disable button and show loading state
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        
        try {
          const response = await fetch(`${API_URL}/api/insert-code-cell`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cellPath: cellPath,
              cellWeight: cellWeight
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            // Save scroll positions for ALL rows before reload
            const allCellContainers = document.querySelectorAll('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
            allCellContainers.forEach(function(container) {
              const cellWithPath = container.querySelector('[data-cell-path]');
              if (cellWithPath) {
                const cp = cellWithPath.getAttribute('data-cell-path');
                const match = cp.match(/tab(\d+)\/row(\d+)/);
                if (match) {
                  const rId = 'tab' + match[1] + '-row' + match[2];
                  localStorage.setItem('rowScrollPosition_' + rId, container.scrollLeft);
                }
              }
            });
            
            // For the row where the cell was added, scroll to the end to show the new cell
            const cellContainer = btn.closest('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
            if (cellContainer) {
              const tabRowMatch = cellPath.match(/tab(\d+)\/row(\d+)/);
              if (tabRowMatch) {
                const rowId = 'tab' + tabRowMatch[1] + '-row' + tabRowMatch[2];
                localStorage.setItem('rowScrollPosition_' + rowId, cellContainer.scrollWidth);
              }
            }
            
            // Show success notification
            const notification = document.createElement('div');
            notification.textContent = '✅ Code cell created! Refreshing...';
            notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#10b981;color:white;border-radius:8px;z-index:1000;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(notification);
            
            // Refresh the page after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            throw new Error(result.error || 'Failed to insert code cell');
          }
        } catch (error) {
          console.error('Error inserting code cell:', error);
          
          // Show error notification
          const notification = document.createElement('div');
          notification.innerHTML = '❌ Failed to insert code cell!<br><small>' + error.message + '</small>';
          notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#ef4444;color:white;border-radius:8px;z-index:1000;max-width:300px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
          
          // Re-enable button
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      });
    });
    
    // Add handlers for insert terminal cell buttons
    const insertTerminalCellBtns = document.querySelectorAll('.insert-terminal-cell-btn');
    insertTerminalCellBtns.forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const cellPath = btn.getAttribute('data-cell-path');
        const cellWeight = btn.getAttribute('data-cell-weight');
        
        // Disable button and show loading state
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳';
        
        try {
          const response = await fetch(`${API_URL}/api/insert-terminal-cell`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cellPath: cellPath,
              cellWeight: cellWeight
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            // Save scroll positions for ALL rows before reload
            const allCellContainers = document.querySelectorAll('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
            allCellContainers.forEach(function(container) {
              const cellWithPath = container.querySelector('[data-cell-path]');
              if (cellWithPath) {
                const cp = cellWithPath.getAttribute('data-cell-path');
                const match = cp.match(/tab(\d+)\/row(\d+)/);
                if (match) {
                  const rId = 'tab' + match[1] + '-row' + match[2];
                  localStorage.setItem('rowScrollPosition_' + rId, container.scrollLeft);
                }
              }
            });
            
            // For the row where the cell was added, scroll to the end to show the new cell
            const cellContainer = btn.closest('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
            if (cellContainer) {
              const tabRowMatch = cellPath.match(/tab(\d+)\/row(\d+)/);
              if (tabRowMatch) {
                const rowId = 'tab' + tabRowMatch[1] + '-row' + tabRowMatch[2];
                localStorage.setItem('rowScrollPosition_' + rowId, cellContainer.scrollWidth);
              }
            }
            
            // Show success notification
            const notification = document.createElement('div');
            notification.textContent = '✅ Terminal cell created! Refreshing...';
            notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#10b981;color:white;border-radius:8px;z-index:1000;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
            document.body.appendChild(notification);
            
            // Refresh the page after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else {
            throw new Error(result.error || 'Failed to insert terminal cell');
          }
        } catch (error) {
          console.error('Error inserting terminal cell:', error);
          
          // Show error notification
          const notification = document.createElement('div');
          notification.innerHTML = '❌ Failed to insert terminal cell!<br><small>' + error.message + '</small>';
          notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#ef4444;color:white;border-radius:8px;z-index:1000;max-width:300px;box-shadow:0 4px 6px rgba(0,0,0,0.1);';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 5000);
          
          // Re-enable button
          btn.disabled = false;
          btn.innerHTML = originalText;
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

    // Screenshot functionality for XYV views
    async function captureXYVScreenshot(xyvName) {
      console.log('captureXYVScreenshot called, checking for html2canvas...');
      console.log('window.html2canvas exists:', !!window.html2canvas);
      
      // Wait for html2canvas to load
      let attempts = 0;
      while (!window.html2canvas && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      console.log('After waiting, window.html2canvas exists:', !!window.html2canvas);
      console.log('Attempts:', attempts);
      
      if (!window.html2canvas) {
        console.error('html2canvas failed to load after', attempts * 100, 'ms');
        alert('html2canvas library failed to load. Please check the browser console and ensure Hugo server is running.');
        return;
      }

      // Capture the XYV content area (3 columns with tabs/rows/cells)
      const xyvContent = document.querySelector('.hextra-container') || 
                         document.querySelector('article') || 
                         document.querySelector('main') || 
                         document.body;
      
      // Find all row containers and store bg colors
      const rowContainers = xyvContent.querySelectorAll('.hx\\:space-y-8 > div');
      const rowBgColors = [];
      
      // Collect bg colors but use visible width only
      rowContainers.forEach(row => {
        // Store the row's background color
        const bgColor = window.getComputedStyle(row).backgroundColor;
        rowBgColors.push(bgColor);
      });
      
      // Use the visible width of the viewport instead of scrollable width
      const visibleWidth = xyvContent.clientWidth || window.innerWidth;
      
      try {
        const canvas = await html2canvas(xyvContent, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
          x: -275,
          y: -100,
          scrollX: 0,
          scrollY: 0,
          width: visibleWidth,
          windowWidth: visibleWidth,
          windowHeight: xyvContent.scrollHeight,
          ignoreElements: (element) => {
            return element.classList && (element.classList.contains('screenshot-btn') || element.classList.contains('xyv-screenshot-btn'));
          },
          onclone: (clonedDoc) => {
            // Keep overflow hidden to respect visible width
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach(el => {
              if (el.style) {
                // Keep horizontal overflow hidden to capture only visible width
                el.style.overflowX = 'hidden';
                el.style.overflow = 'hidden';
              }
            });
            
            // Keep cell content from overflowing vertically
            const cellContentDivs = clonedDoc.querySelectorAll('.hx\\:prose');
            cellContentDivs.forEach(div => {
              div.style.overflowY = 'hidden';
              div.style.maxHeight = 'calc(25vh - 4rem)'; // Row height minus headers/padding
            });
            
            // Re-apply row background colors to the visible width
            const clonedRows = clonedDoc.querySelectorAll('.hx\\:space-y-8 > div');
            clonedRows.forEach((row, index) => {
              if (rowBgColors[index] && rowBgColors[index] !== 'rgba(0, 0, 0, 0)' && rowBgColors[index] !== 'transparent') {
                // Apply to row container with visible width
                row.style.backgroundColor = rowBgColors[index];
                row.style.setProperty('background-color', rowBgColors[index], 'important');
                row.style.width = visibleWidth + 'px';
                row.style.minWidth = visibleWidth + 'px';
                
                // Also ensure the cell container and all children have the same bg color
                const cellContainer = row.querySelector('.hx\\:flex.hx\\:gap-0');
                if (cellContainer) {
                  cellContainer.style.backgroundColor = rowBgColors[index];
                  cellContainer.style.setProperty('background-color', rowBgColors[index], 'important');
                  cellContainer.style.width = visibleWidth + 'px';
                  cellContainer.style.minWidth = visibleWidth + 'px';
                  
                  // Apply to all cell divs within the container
                  const cells = cellContainer.querySelectorAll('.hx\\:shrink-0');
                  cells.forEach(cell => {
                    // Only apply if cell doesn't have its own bg color
                    const cellBg = window.getComputedStyle(cell).backgroundColor;
                    if (cellBg === 'rgba(0, 0, 0, 0)' || cellBg === 'transparent') {
                      cell.style.backgroundColor = rowBgColors[index];
                      cell.style.setProperty('background-color', rowBgColors[index], 'important');
                    }
                  });
                }
              }
            });
            
            // Disable ALL stylesheets to avoid oklch parsing
            const linkElements = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
            linkElements.forEach(link => link.disabled = true);
            
            const styleElements = clonedDoc.querySelectorAll('style');
            styleElements.forEach(style => style.remove());
            
            // Create a simple replacement stylesheet with basic styles
            const newStyle = clonedDoc.createElement('style');
            newStyle.textContent = `
              * { 
                box-sizing: border-box;
                overflow: visible !important;
              }
              body {
                font-family: system-ui, -apple-system, sans-serif;
                color: rgb(0, 0, 0);
                background: rgb(255, 255, 255);
              }
              h1, h2, h3, h4, h5, h6 {
                color: rgb(0, 0, 0);
                font-weight: 600;
              }
              [contenteditable] {
                border: 1px solid rgb(200, 200, 200);
                padding: 1rem;
                background: rgb(255, 255, 255);
              }
              .row-footer, .tab-footer {
                border-top: 1px solid rgb(200, 200, 200);
                padding: 0.5rem;
                background: rgb(249, 250, 251);
              }
            `;
            clonedDoc.head.appendChild(newStyle);
          }
        });
        
        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('image', blob, `${xyvName}.png`);
          
          // Extract the XYV path from the current URL
          const pathParts = window.location.pathname.split('/').filter(p => p);
          const xyvIndex = pathParts.findIndex(p => p.match(/^xyv\d+$/));
          if (xyvIndex >= 0) {
            const xyvPath = pathParts.slice(0, xyvIndex + 1).join('/');
            formData.append('path', `content/${xyvPath}/images`);
          } else {
            formData.append('path', 'content/orgs/org1/prod1/sow1/xyv1/images');
          }
          
          try {
            const response = await fetch(`${API_URL}/api/save-screenshot`, {
              method: 'POST',
              body: formData
            });
            
            const result = await response.json();
            console.log(`Screenshot saved: ${result.message}`);
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

      // Capture only the tab content area (rows and cells)
      const tabContent = document.querySelector('.hextra-container') || 
                         document.querySelector('article') || 
                         document.querySelector('main') || 
                         document.body;
      
      // Find all row containers to get the full scrollable width and store bg colors
      const rowContainers = tabContent.querySelectorAll('.hx\\:space-y-8 > div');
      let maxScrollWidth = tabContent.scrollWidth;
      const rowBgColors = [];
      
      // Check each row's cell container for overflow and collect bg colors
      rowContainers.forEach(row => {
        const cellContainer = row.querySelector('.hx\\:flex.hx\\:gap-0');
        if (cellContainer) {
          maxScrollWidth = Math.max(maxScrollWidth, cellContainer.scrollWidth + 300);
        }
        // Store the row's background color
        const bgColor = window.getComputedStyle(row).backgroundColor;
        rowBgColors.push(bgColor);
      });
      
      try {
        const canvas = await html2canvas(tabContent, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
          x: -275,
          y: -100,
          scrollX: 0,
          scrollY: 0,
          width: maxScrollWidth,
          windowWidth: maxScrollWidth,
          windowHeight: tabContent.scrollHeight,
          ignoreElements: (element) => {
            return element.classList && element.classList.contains('screenshot-btn');
          },
          onclone: (clonedDoc) => {
            // Make overflow visible to capture scrolled content, but control vertical overflow in cells
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach(el => {
              if (el.style) {
                el.style.overflow = 'visible';
                el.style.overflowX = 'visible';
              }
            });
            
            // Keep cell content from overflowing vertically
            const cellContentDivs = clonedDoc.querySelectorAll('.hx\\:prose');
            cellContentDivs.forEach(div => {
              div.style.overflowY = 'hidden';
              div.style.maxHeight = 'calc(25vh - 4rem)'; // Row height minus headers/padding
            });
            
            // Re-apply row background colors to the full width
            const clonedRows = clonedDoc.querySelectorAll('.hx\\:space-y-8 > div');
            clonedRows.forEach((row, index) => {
              if (rowBgColors[index] && rowBgColors[index] !== 'rgba(0, 0, 0, 0)' && rowBgColors[index] !== 'transparent') {
                // Apply to row container and make it full width
                row.style.backgroundColor = rowBgColors[index];
                row.style.setProperty('background-color', rowBgColors[index], 'important');
                row.style.width = maxScrollWidth + 'px';
                row.style.minWidth = maxScrollWidth + 'px';
                
                // Also ensure the cell container and all children have the same bg color
                const cellContainer = row.querySelector('.hx\\:flex.hx\\:gap-0');
                if (cellContainer) {
                  cellContainer.style.backgroundColor = rowBgColors[index];
                  cellContainer.style.setProperty('background-color', rowBgColors[index], 'important');
                  cellContainer.style.width = maxScrollWidth + 'px';
                  cellContainer.style.minWidth = maxScrollWidth + 'px';
                  
                  // Apply to all cell divs within the container
                  const cells = cellContainer.querySelectorAll('.hx\\:shrink-0');
                  cells.forEach(cell => {
                    // Only apply if cell doesn't have its own bg color
                    const cellBg = window.getComputedStyle(cell).backgroundColor;
                    if (cellBg === 'rgba(0, 0, 0, 0)' || cellBg === 'transparent') {
                      cell.style.backgroundColor = rowBgColors[index];
                      cell.style.setProperty('background-color', rowBgColors[index], 'important');
                    }
                  });
                }
              }
            });
            
            // Disable ALL stylesheets to avoid oklch parsing
            const linkElements = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
            linkElements.forEach(link => link.disabled = true);
            
            const styleElements = clonedDoc.querySelectorAll('style');
            styleElements.forEach(style => style.remove());
            
            // Create a simple replacement stylesheet with basic styles
            const newStyle = clonedDoc.createElement('style');
            newStyle.textContent = `
              * { 
                box-sizing: border-box;
                overflow: visible !important;
              }
              body {
                font-family: system-ui, -apple-system, sans-serif;
                color: rgb(0, 0, 0);
                background: rgb(255, 255, 255);
              }
              h1, h2, h3, h4, h5, h6 {
                color: rgb(0, 0, 0);
                font-weight: 600;
              }
              [contenteditable] {
                border: 1px solid rgb(200, 200, 200);
                padding: 1rem;
                background: rgb(255, 255, 255);
              }
              .row-footer, .tab-footer {
                border-top: 1px solid rgb(200, 200, 200);
                padding: 0.5rem;
                background: rgb(249, 250, 251);
              }
            `;
            clonedDoc.head.appendChild(newStyle);
          }
        });
        
        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('image', blob, `${tabName}.png`);
          formData.append('path', 'content/orgs/org1/prod1/sow1/xyv1/images');
          
          try {
            const response = await fetch(`${API_URL}/api/save-screenshot`, {
              method: 'POST',
              body: formData
            });
            
            const result = await response.json();
            console.log(`Screenshot saved: ${result.message}`);
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

    // Add screenshot button for tab views only (not row or cell views)
    const tabMatch = window.location.pathname.match(/\/(tab\d+)\/?$/);
    if (tabMatch) {
      const tabName = tabMatch[1];
      
      // Create screenshot button
      const screenshotBtn = document.createElement('button');
        screenshotBtn.className = 'screenshot-btn';
        screenshotBtn.innerHTML = '📸 Tab';
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
          this.innerHTML = '⏳ /images';
          captureTabScreenshot(tabName).finally(() => {
            this.disabled = false;
            this.innerHTML = '📸 Tab';
          });
        });
        
        document.body.appendChild(screenshotBtn);
      }

    // Add screenshot button for XYV views
    const xyvMatch = window.location.pathname.match(/\/(xyv\d+)\/?$/);
    if (xyvMatch) {
      const xyvName = xyvMatch[1];
      
      // Create XYV screenshot button
      const xyvScreenshotBtn = document.createElement('button');
      xyvScreenshotBtn.className = 'xyv-screenshot-btn';
      xyvScreenshotBtn.innerHTML = '📸 XYV';
      xyvScreenshotBtn.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 10px 16px;
        background: #10b981;
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
      
      xyvScreenshotBtn.addEventListener('mouseover', function() {
        this.style.background = '#059669';
      });
      
      xyvScreenshotBtn.addEventListener('mouseout', function() {
        this.style.background = '#10b981';
      });
      
      xyvScreenshotBtn.addEventListener('click', function() {
        this.disabled = true;
        this.innerHTML = '⏳ /images';
        captureXYVScreenshot(xyvName).finally(() => {
          this.disabled = false;
          this.innerHTML = '📸 XYV';
        });
      });
      
      document.body.appendChild(xyvScreenshotBtn);
      
      // Create SellOpsPay tx loop toggle button
      const txLoopBtn = document.createElement('button');
      txLoopBtn.className = 'xyv-txloop-btn';
      txLoopBtn.innerHTML = 'SellOpsPay tx loop';
      txLoopBtn.style.cssText = `
        position: fixed;
        top: 80px;
        right: 130px;
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
      
      let txLoopVisible = false;
      
      txLoopBtn.addEventListener('mouseover', function() {
        this.style.background = '#2563eb';
      });
      
      txLoopBtn.addEventListener('mouseout', function() {
        this.style.background = '#3b82f6';
      });
      
      txLoopBtn.addEventListener('click', function() {
        txLoopVisible = !txLoopVisible;
        
        if (txLoopVisible) {
          // Create actual DOM elements instead of pseudo-elements
          const containers = [
            {
              selector: '.xyv-x-container',
              beforeText: 'X BUY Prompts\na - Market\nb - Rates\nc - Docs\nd - Book\n\n\nX OPS Prompts\ne - Input\nf - Steps\ng - Output\nh - Test\n\n\nX PAY Prompts\ni - Pay',
              afterText: 'PROJECT X SOP a-i Prompts',
              color: '#bb2c29'
            },
            {
              selector: '.xyv-y-container',
              beforeText: 'Y SELL Prompts\nk - Market\nl - Rates\nm - Docs\nn - Book\n\n\nY OPS Prompts\no - Input\np - Steps\nq - Output\nr - Test\n\n\nY PAY Prompts\ns - Pay',
              afterText: 'AI AGENT Y SOP k-s Prompts',
              color: '#e99e2f'
            },
            {
              selector: '.xyv-log-container',
              beforeText: 'Z SOW Prompts\na-k - Market ✓\nb-l - Rates ✓\nc-m - Docs ✓\nd-n - Book ✓\n\n\nZ OPS Prompts\ne-o - Input ✓\nf-p - Steps ✓\ng-q - Output ✓\nh-r - Test ✓\n\n\nZ PAY Prompts\ni-s - Pay ✓',
              afterText: 'SOW Z SOP a-z Results',
              color: '#256bac'
            }
          ];
          
          containers.forEach(config => {
            const container = document.querySelector(config.selector);
            if (!container) return;
            
            // Create before element
            const beforeDiv = document.createElement('div');
            beforeDiv.className = 'xyv-txloop-before';
            beforeDiv.contentEditable = 'true';
            beforeDiv.textContent = config.beforeText;
            beforeDiv.style.cssText = `
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              font-size: 70px;
              font-weight: bold;
              color: ${config.color};
              opacity: 0.7;
              z-index: 10;
              pointer-events: auto;
              white-space: pre;
              outline: none;
            `;
            
            // Create after element
            const afterDiv = document.createElement('div');
            afterDiv.className = 'xyv-txloop-after';
            afterDiv.contentEditable = 'true';
            afterDiv.textContent = config.afterText;
            afterDiv.style.cssText = `
              position: absolute;
              top: 10px;
              left: 50%;
              transform: translateX(-50%);
              font-size: 70px;
              font-weight: bold;
              color: ${config.color};
              opacity: 0.7;
              z-index: 10;
              pointer-events: auto;
              white-space: nowrap;
              outline: none;
            `;
            
            container.appendChild(beforeDiv);
            container.appendChild(afterDiv);
          });
          
          this.style.background = '#059669';
          this.innerHTML = '✓ tx loop ON';
        } else {
          // Remove the created elements
          document.querySelectorAll('.xyv-txloop-before, .xyv-txloop-after').forEach(el => el.remove());
          this.style.background = '#3b82f6';
          this.innerHTML = 'SellOpsPay tx loop';
        }
      });
      
      document.body.appendChild(txLoopBtn);
    }

  });

  // Save scroll positions for all rows when leaving the page
  window.addEventListener('beforeunload', function() {
    const cellContainers = document.querySelectorAll('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
    cellContainers.forEach(function(container) {
      const cellWithPath = container.querySelector('[data-cell-path]');
      if (cellWithPath) {
        const cellPath = cellWithPath.getAttribute('data-cell-path');
        const tabRowMatch = cellPath.match(/tab(\d+)\/row(\d+)/);
        if (tabRowMatch) {
          const rowId = 'tab' + tabRowMatch[1] + '-row' + tabRowMatch[2];
          localStorage.setItem('rowScrollPosition_' + rowId, container.scrollLeft);
        }
      }
    });
  });

  // Restore scroll position after page load
  window.addEventListener('load', function() {
    // Restore scroll position for all row containers
    const cellContainers = document.querySelectorAll('.hx\\:flex.hx\\:gap-0.hx\\:overflow-x-auto');
    cellContainers.forEach(function(container) {
      // Find a cell with data-cell-path to identify this row
      const cellWithPath = container.querySelector('[data-cell-path]');
      if (cellWithPath) {
        const cellPath = cellWithPath.getAttribute('data-cell-path');
        const tabRowMatch = cellPath.match(/tab(\d+)\/row(\d+)/);
        if (tabRowMatch) {
          const rowId = 'tab' + tabRowMatch[1] + '-row' + tabRowMatch[2];
          const savedScrollPosition = localStorage.getItem('rowScrollPosition_' + rowId);
          if (savedScrollPosition !== null) {
            container.scrollLeft = parseFloat(savedScrollPosition);
            // Don't remove - keep positions persistent across page navigations
          }
        }
      }
    });
  });
})();

