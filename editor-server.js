const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Helper function for logging
function logAction(action, filePath) {
  const now = new Date();
  const day = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0];
  const relativePath = filePath.replace(/^content\//, '/');
  console.log(`SI ${day} ${time} ${action} ${relativePath}`);
}

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(bodyParser.json());

// Root endpoint - just to confirm server is running
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Editor API Server',
    endpoints: [
      'POST /api/save-cell - Save cell content to markdown files',
      'POST /api/save-screenshot - Save screenshot images'
    ]
  });
});

// Save cell content endpoint
app.post('/api/save-cell', (req, res) => {
  const { filePath, content } = req.body;
  
  if (!filePath || !content) {
    return res.status(400).json({ error: 'Missing filePath or content' });
  }
  
  // Security: only allow editing files in content directory
  if (!filePath.startsWith('content/')) {
    return res.status(403).json({ error: 'Invalid file path' });
  }
  
  const fullPath = path.join(__dirname, filePath);
  
  try {
    // Read the existing file
    let fileContent = fs.readFileSync(fullPath, 'utf8');
    
    // Extract frontmatter and replace body
    const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatterMatch) {
      return res.status(400).json({ error: 'Invalid markdown file format' });
    }
    
    const frontmatter = frontmatterMatch[0];
    
    // Remove any existing cell shortcode tags from the content
    let cleanContent = content
      .replace(/\{\{<\s*cell\s*>\}\}/g, '')
      .replace(/\{\{<\s*\/cell\s*>\}\}/g, '')
      .trim();
    
    // Write content without shortcode tags
    const newContent = frontmatter + '\n' + cleanContent + '\n';
    
    // Write back to file
    fs.writeFileSync(fullPath, newContent, 'utf8');
    
    logAction('edit', filePath);
    
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file: ' + error.message });
  }
});

// Save screenshot endpoint
app.post('/api/save-screenshot', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const targetPath = req.body.path || 'content/labs/lab1/exp1/images';
    const fileName = req.file.originalname;
    
    // Security: only allow saving to specific directories
    if (!targetPath.startsWith('content/')) {
      return res.status(403).json({ error: 'Invalid target path' });
    }

    const fullDir = path.join(__dirname, targetPath);
    const fullPath = path.join(fullDir, fileName);

    // Ensure directory exists
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    // Write the image file
    fs.writeFileSync(fullPath, req.file.buffer);

    res.json({ 
      success: true, 
      message: 'Screenshot saved successfully',
      filePath: path.join(targetPath, fileName)
    });
  } catch (error) {
    console.error('Error saving screenshot:', error);
    res.status(500).json({ error: 'Failed to save screenshot: ' + error.message });
  }
});

// Insert cell endpoint// Helper function to convert number to Excel-style column letters
function numberToLetters(num) {
  let result = '';
  while (num > 0) {
    let remainder = (num - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result || 'A';
}
app.post('/api/insert-cell', (req, res) => {
  const { cellPath, cellWeight } = req.body;
  
  if (!cellPath) {
    return res.status(400).json({ error: 'Missing cellPath' });
  }
  
  // Security: only allow creating cells in content directory
  if (!cellPath.startsWith('content/')) {
    return res.status(403).json({ error: 'Invalid cell path' });
  }
  
  try {
    // Extract row directory from cell path
    const rowDir = path.dirname(cellPath);
    const rowFullPath = path.join(__dirname, rowDir);
    
    // Read all existing cells in the row with their weights
    const cellDirs = fs.readdirSync(rowFullPath)
      .filter(name => name.startsWith('cell') && fs.statSync(path.join(rowFullPath, name)).isDirectory());
    
    const cellsWithWeights = cellDirs.map(name => {
      const cellIndexPath = path.join(rowFullPath, name, '_index.md');
      if (fs.existsSync(cellIndexPath)) {
        const content = fs.readFileSync(cellIndexPath, 'utf8');
        const weightMatch = content.match(/weight:\s*(\d+)/);
        const weight = weightMatch ? parseInt(weightMatch[1]) : 999;
        return { name, weight };
      }
      return null;
    }).filter(c => c !== null);
    
    // Determine the weight for the new cell (insert after current cell)
    const currentWeight = cellWeight ? parseInt(cellWeight) : 0;
    const newWeight = currentWeight + 1;
    
    // Calculate the position (column) of the new cell based on its weight
    // Sort cells by weight to determine position
    const sortedCells = cellsWithWeights.sort((a, b) => a.weight - b.weight);
    const newCellPosition = sortedCells.filter(c => c.weight < newWeight).length + 1;
    const cellTitle = numberToLetters(newCellPosition);
    
    // Extract row number from path (e.g., content/labs/lab1/exp1/tab1/row1 -> 1)
    const rowMatch = rowDir.match(/row(\d+)/);
    const rowNumber = rowMatch ? rowMatch[1] : '1';
    
    // Get cells that need to be shifted (weight >= newWeight), sorted in REVERSE order
    const cellsToShift = cellsWithWeights
      .filter(cell => cell.weight >= newWeight)
      .sort((a, b) => b.weight - a.weight); // Sort descending (highest weight first)
    
    // Shift cells in REVERSE order to avoid folder name conflicts
    cellsToShift.forEach(cell => {
      const oldPosition = sortedCells.filter(c => c.weight < cell.weight).length + 1;
      const newPosition = oldPosition + 1;
      const updatedWeight = cell.weight + 1;
      
      // Determine old and new folder names
      const oldCellNum = cell.name.match(/cell(\d+)/)[1];
      const newCellNum = newPosition;
      const oldCellPath = path.join(rowFullPath, cell.name);
      const newCellName = `cell${newCellNum}`;
      const newCellPath = path.join(rowFullPath, newCellName);
      
      // Read and update content before renaming
      const cellIndexPath = path.join(oldCellPath, '_index.md');
      let content = fs.readFileSync(cellIndexPath, 'utf8');
      
      // Update weight
      content = content.replace(/weight:\s*\d+/, `weight: ${updatedWeight}`);
      
      // Update title
      const newTitle = numberToLetters(newPosition);
      content = content.replace(/title:\s*.+/, `title: ${newTitle}`);
      
      // Update R<row>C<col> heading in content if it exists
      content = content.replace(/##\s*R(\d+)C(\d+)/, (match, r, c) => {
        return `## R${r}C${newPosition}`;
      });
      
      // Write updated content
      fs.writeFileSync(cellIndexPath, content, 'utf8');
      
      // Rename folder if needed
      if (oldCellPath !== newCellPath) {
        fs.renameSync(oldCellPath, newCellPath);
      }
    });
    
    // Create the new cell directory at the correct position
    const newCellDir = `cell${newCellPosition}`;
    const newCellPath = path.join(rowFullPath, newCellDir);
    
    if (!fs.existsSync(newCellPath)) {
      fs.mkdirSync(newCellPath, { recursive: true });
    }
    
    // Create the _index.md file with alphabetic title and R<row>C<col> content
    const indexContent = `---
title: ${cellTitle}
weight: ${newWeight}
type: cell
---

## R${rowNumber}C${newCellPosition}
content
`;
    
    fs.writeFileSync(path.join(newCellPath, '_index.md'), indexContent, 'utf8');
    
    logAction('add', path.join(rowDir, newCellDir, '_index.md'));
    
    res.json({ 
      success: true, 
      message: 'Cell inserted successfully',
      cellDir: newCellDir,
      cellPath: path.join(rowDir, newCellDir)
    });
  } catch (error) {
    console.error('Error inserting cell:', error);
    res.status(500).json({ error: 'Failed to insert cell: ' + error.message });
  }
});

// Delete cell endpoint
app.post('/api/delete-cell', (req, res) => {
  const { cellPath, cellWeight } = req.body;
  
  if (!cellPath) {
    return res.status(400).json({ error: 'Cell path is required' });
  }
  
  // Security: only allow deleting cells in content directory
  if (!cellPath.startsWith('content/')) {
    return res.status(403).json({ error: 'Invalid cell path' });
  }
  
  try {
    // Extract row directory and full cell path
    const rowDir = path.dirname(cellPath);
    const rowFullPath = path.join(__dirname, rowDir);
    const cellFullPath = path.join(__dirname, cellPath);
    
    // Check if cell exists
    if (!fs.existsSync(cellFullPath)) {
      return res.status(404).json({ error: 'Cell not found' });
    }
    
    // Read all existing cells in the row with their weights
    const cellDirs = fs.readdirSync(rowFullPath)
      .filter(name => name.startsWith('cell') && fs.statSync(path.join(rowFullPath, name)).isDirectory());
    
    const cellsWithWeights = cellDirs.map(name => {
      const cellIndexPath = path.join(rowFullPath, name, '_index.md');
      if (fs.existsSync(cellIndexPath)) {
        const content = fs.readFileSync(cellIndexPath, 'utf8');
        const weightMatch = content.match(/weight:\s*(\d+)/);
        const titleMatch = content.match(/title:\s*(.+)/);
        const weight = weightMatch ? parseInt(weightMatch[1]) : 999;
        const title = titleMatch ? titleMatch[1].trim() : '';
        return { name, weight, title, fullPath: path.join(rowFullPath, name) };
      }
      return null;
    }).filter(c => c !== null);
    
    // Sort cells by weight to determine their positions
    const sortedCells = cellsWithWeights.sort((a, b) => a.weight - b.weight);
    
    // Find the deleted cell's weight and position
    const deletedWeight = cellWeight ? parseInt(cellWeight) : 0;
    const deletedPosition = sortedCells.filter(c => c.weight < deletedWeight).length + 1;
    
    // Delete the cell directory recursively
    fs.rmSync(cellFullPath, { recursive: true, force: true });
    
    logAction('delete', path.join(cellPath, '_index.md'));
    
    // Re-read all remaining cells from disk after deletion, with their current folder numbers
    const remainingCellDirs = fs.readdirSync(rowFullPath)
      .filter(name => name.startsWith('cell') && fs.statSync(path.join(rowFullPath, name)).isDirectory())
      .map(name => {
        const match = name.match(/cell(\d+)/);
        const cellNum = match ? parseInt(match[1]) : 0;
        return {
          name,
          cellNum,
          fullPath: path.join(rowFullPath, name)
        };
      })
      .sort((a, b) => a.cellNum - b.cellNum);
    
    // Only process cells that were AFTER the deleted position
    const cellsToRenumber = remainingCellDirs.filter(cell => cell.cellNum > deletedPosition);
    
    // First pass: rename affected folders to temporary names to avoid conflicts
    const tempNames = [];
    cellsToRenumber.forEach((cell, index) => {
      const tempDir = `cell_temp_${index}`;
      const tempPath = path.join(rowFullPath, tempDir);
      fs.renameSync(cell.fullPath, tempPath);
      tempNames.push({ tempPath, index });
    });
    
    // Second pass: rename to final sequential names and update content
    tempNames.forEach(({ tempPath, index }) => {
      // New position is deletedPosition + index (since we're filling the gap)
      const newPosition = deletedPosition + index;
      const newCellDir = `cell${newPosition}`;
      const newCellPath = path.join(rowFullPath, newCellDir);
      
      // Rename from temp to final name
      fs.renameSync(tempPath, newCellPath);
      
      // Update the _index.md file
      const cellIndexPath = path.join(newCellPath, '_index.md');
      let content = fs.readFileSync(cellIndexPath, 'utf8');
      
      const newWeight = newPosition;
      
      // Update weight
      content = content.replace(/weight:\s*\d+/, `weight: ${newWeight}`);
      
      // Update title with alphabetic letter
      const newTitle = numberToLetters(newPosition);
      content = content.replace(/title:\s*.+/, `title: ${newTitle}`);
      
      // Update R<row>C<col> heading in content if it exists
      content = content.replace(/##\s*R(\d+)C(\d+)/, (match, r, c) => {
        return `## R${r}C${newPosition}`;
      });
      
      fs.writeFileSync(cellIndexPath, content, 'utf8');
    });
    
    res.json({ 
      success: true, 
      message: 'Cell deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting cell:', error);
    res.status(500).json({ error: 'Failed to delete cell: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Editor API server running on http://localhost:${PORT}`);
});
