// Local editing functionality
(function() {
  // Only enable on localhost
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }

  // Add edit button to each cell
  document.addEventListener('DOMContentLoaded', function() {
    const cells = document.querySelectorAll('.hextra-cell');
    
    cells.forEach(function(cell) {
      // Create edit button
      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️ Edit';
      editBtn.className = 'cell-edit-btn';
      editBtn.style.cssText = 'position:absolute;top:5px;right:5px;padding:5px 10px;background:#0070f3;color:white;border:none;border-radius:4px;cursor:pointer;z-index:10;';
      
      // Make cell position relative
      cell.style.position = 'relative';
      cell.insertBefore(editBtn, cell.firstChild);
      
      editBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const content = cell.querySelector('.content') || cell;
        
        if (cell.classList.contains('editing')) {
          // Save mode
          cell.classList.remove('editing');
          content.contentEditable = 'false';
          editBtn.textContent = '✏️ Edit';
          editBtn.style.background = '#0070f3';
          
          // Show save notification
          const notification = document.createElement('div');
          notification.textContent = 'Changes saved to browser memory. To persist, copy content and update the file.';
          notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px;background:#10b981;color:white;border-radius:8px;z-index:1000;max-width:300px;';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 4000);
          
          // Store in localStorage
          const path = window.location.pathname;
          localStorage.setItem('cell-edit-' + path, content.innerHTML);
        } else {
          // Edit mode
          cell.classList.add('editing');
          content.contentEditable = 'true';
          content.style.border = '2px solid #0070f3';
          content.style.padding = '10px';
          editBtn.textContent = '💾 Save';
          editBtn.style.background = '#10b981';
        }
      });
      
      // Restore from localStorage
      const path = window.location.pathname;
      const saved = localStorage.getItem('cell-edit-' + path);
      if (saved) {
        const content = cell.querySelector('.content') || cell;
        content.innerHTML = saved;
      }
    });
  });
})();
