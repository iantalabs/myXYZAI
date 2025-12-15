// Local editing functionality
(function() {
  // Only enable on localhost
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }

  const API_URL = 'http://localhost:3001';

  // Extract file path from URL
  function getFilePath() {
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
  async function saveToFile(content) {
    const filePath = getFilePath();
    
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

  // Add edit button to each cell
  document.addEventListener('DOMContentLoaded', function() {
    const cells = document.querySelectorAll('.hextra-cell');
    
    cells.forEach(function(cell) {
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
          const content = contentDiv ? contentDiv.innerHTML : cell.innerHTML.replace(/<button[^>]*>.*?<\/button>/g, '');
          
          try {
            const result = await saveToFile(content);
            
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
          editBtn.textContent = '💾 Save';
          editBtn.style.background = '#10b981';
          contentDiv.focus();
        }
      });
    });
  });
})();
