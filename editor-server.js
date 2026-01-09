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
    
    // Wrap content with cell shortcode tags
    const newContent = frontmatter + '\n{{< cell >}}\n\n' + cleanContent + '\n\n{{< /cell >}}\n';
    
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

    const targetPath = req.body.path || 'content/orgs/org1/prod1/sow1/ver1/images';
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
    
    // Extract row number from path (e.g., content/orgs/org1/prod1/sow1/ver1/tab1/row1 -> 1)
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

{{< cell >}}

## R${rowNumber}C${newCellPosition}
content

{{< /cell >}}
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

// Insert row endpoint
app.post('/api/insert-row', (req, res) => {
  const { rowPath, rowWeight } = req.body;
  
  if (!rowPath) {
    return res.status(400).json({ error: 'Row path is required' });
  }
  
  // Security: only allow inserting rows in content directory
  if (!rowPath.startsWith('content/')) {
    return res.status(403).json({ error: 'Invalid row path' });
  }
  
  try {
    // Extract tab directory from row path
    const tabDir = path.dirname(rowPath);
    const tabFullPath = path.join(__dirname, tabDir);
    
    // Parse the row number from the current row path
    const currentRowMatch = rowPath.match(/row(\d+)/);
    if (!currentRowMatch) {
      return res.status(400).json({ error: 'Invalid row path format' });
    }
    
    const currentRowNumber = parseInt(currentRowMatch[1]);
    const newRowNumber = currentRowNumber + 1;
    const newWeight = parseInt(rowWeight) + 1;
    
    // Read all existing rows in the tab with their weights
    const rowDirs = fs.readdirSync(tabFullPath)
      .filter(name => name.startsWith('row') && fs.statSync(path.join(tabFullPath, name)).isDirectory());
    
    const rowsWithWeights = rowDirs.map(name => {
      const rowIndexPath = path.join(tabFullPath, name, '_index.md');
      if (fs.existsSync(rowIndexPath)) {
        const content = fs.readFileSync(rowIndexPath, 'utf8');
        const weightMatch = content.match(/weight:\s*(\d+)/);
        const titleMatch = content.match(/title:\s*(.+)/);
        const weight = weightMatch ? parseInt(weightMatch[1]) : 999;
        const title = titleMatch ? titleMatch[1].trim() : '';
        const rowNumMatch = name.match(/row(\d+)/);
        const rowNum = rowNumMatch ? parseInt(rowNumMatch[1]) : 0;
        return { name, weight, title, rowNum, fullPath: path.join(tabFullPath, name) };
      }
      return null;
    }).filter(r => r !== null);
    
    // Filter rows that need to be shifted (rowNum >= newRowNumber)
    const rowsToShift = rowsWithWeights.filter(r => r.rowNum >= newRowNumber);
    
    // Sort in DESCENDING order by row number (highest first) to avoid conflicts
    rowsToShift.sort((a, b) => b.rowNum - a.rowNum);
    
    // Shift existing rows by renaming from highest to lowest
    rowsToShift.forEach(row => {
      const oldRowPath = row.fullPath;
      const newRowNum = row.rowNum + 1;
      const updatedWeight = row.weight + 1;
      const newRowPath = path.join(tabFullPath, `row${newRowNum}`);
      
      // Read and update content before renaming
      const rowIndexPath = path.join(oldRowPath, '_index.md');
      let content = fs.readFileSync(rowIndexPath, 'utf8');
      
      // Update weight
      content = content.replace(/weight:\s*\d+/, `weight: ${updatedWeight}`);
      
      // Update title
      content = content.replace(/title:\s*.+/, `title: Row ${newRowNum}`);
      
      // Write updated content
      fs.writeFileSync(rowIndexPath, content, 'utf8');
      
      // Update all cells in this row to reflect new row number in R{row}C{col}
      const cellDirs = fs.readdirSync(oldRowPath)
        .filter(name => name.startsWith('cell') && fs.statSync(path.join(oldRowPath, name)).isDirectory());
      
      cellDirs.forEach(cellDir => {
        const cellIndexPath = path.join(oldRowPath, cellDir, '_index.md');
        if (fs.existsSync(cellIndexPath)) {
          let cellContent = fs.readFileSync(cellIndexPath, 'utf8');
          // Update R<row>C<col> heading
          cellContent = cellContent.replace(/##\s*R(\d+)C(\d+)/, (match, r, c) => {
            return `## R${newRowNum}C${c}`;
          });
          fs.writeFileSync(cellIndexPath, cellContent, 'utf8');
        }
      });
      
      // Rename folder if needed
      if (oldRowPath !== newRowPath) {
        fs.renameSync(oldRowPath, newRowPath);
      }
    });
    
    // Create the new row directory at the correct position
    const newRowDir = `row${newRowNumber}`;
    const newRowPath = path.join(tabFullPath, newRowDir);
    
    if (!fs.existsSync(newRowPath)) {
      fs.mkdirSync(newRowPath, { recursive: true });
    }
    
    // Create the _index.md file for the row
    const rowTitle = `Row ${newRowNumber}`;
    const rowIndexContent = `---
title: ${rowTitle}
weight: ${newWeight}
type: row
---
`;
    
    fs.writeFileSync(path.join(newRowPath, '_index.md'), rowIndexContent, 'utf8');
    
    // Create 3 cells (A-C) in the new row for testing
    for (let i = 1; i <= 3; i++) {
      const cellDir = `cell${i}`;
      const cellPath = path.join(newRowPath, cellDir);
      
      if (!fs.existsSync(cellPath)) {
        fs.mkdirSync(cellPath, { recursive: true });
      }
      
      const cellTitle = numberToLetters(i);
      const cellIndexContent = `---
title: ${cellTitle}
weight: ${i}
type: cell
---

{{< cell >}}

## R${newRowNumber}C${i}
content

{{< /cell >}}
`;
      
      fs.writeFileSync(path.join(cellPath, '_index.md'), cellIndexContent, 'utf8');
    }
    
    logAction('add', path.join(tabDir, newRowDir, '_index.md'));
    
    res.json({ 
      success: true, 
      message: 'Row inserted successfully',
      rowDir: newRowDir,
      rowPath: path.join(tabDir, newRowDir)
    });
  } catch (error) {
    console.error('Error inserting row:', error);
    res.status(500).json({ error: 'Failed to insert row: ' + error.message });
  }
});

// Delete row endpoint
app.post('/api/delete-row', (req, res) => {
  const { rowPath, rowWeight } = req.body;
  
  if (!rowPath) {
    return res.status(400).json({ error: 'Row path is required' });
  }
  
  // Security: only allow deleting rows in content directory
  if (!rowPath.startsWith('content/')) {
    return res.status(403).json({ error: 'Invalid row path' });
  }
  
  try {
    // Extract tab directory from row path
    const tabDir = path.dirname(rowPath);
    const tabFullPath = path.join(__dirname, tabDir);
    const rowFullPath = path.join(__dirname, rowPath);
    
    // Check if row exists
    if (!fs.existsSync(rowFullPath)) {
      return res.status(404).json({ error: 'Row not found' });
    }
    
    // Parse the row number from the path
    const deletedRowMatch = rowPath.match(/row(\d+)/);
    if (!deletedRowMatch) {
      return res.status(400).json({ error: 'Invalid row path format' });
    }
    const deletedRowNumber = parseInt(deletedRowMatch[1]);
    
    // Delete the row directory recursively
    fs.rmSync(rowFullPath, { recursive: true, force: true });
    
    logAction('delete', path.join(rowPath, '_index.md'));
    
    // Re-read all remaining rows from disk
    const remainingRowDirs = fs.readdirSync(tabFullPath)
      .filter(name => name.startsWith('row') && fs.statSync(path.join(tabFullPath, name)).isDirectory())
      .map(name => {
        const match = name.match(/row(\d+)/);
        const rowNum = match ? parseInt(match[1]) : 0;
        return {
          name,
          rowNum,
          fullPath: path.join(tabFullPath, name)
        };
      })
      .sort((a, b) => a.rowNum - b.rowNum);
    
    // Only process rows that were AFTER the deleted position
    const rowsToRenumber = remainingRowDirs.filter(row => row.rowNum > deletedRowNumber);
    
    // First pass: rename affected folders to temporary names
    const tempNames = [];
    rowsToRenumber.forEach((row, index) => {
      const tempDir = `row_temp_${index}`;
      const tempPath = path.join(tabFullPath, tempDir);
      fs.renameSync(row.fullPath, tempPath);
      tempNames.push({ tempPath, index });
    });
    
    // Second pass: rename to final sequential names and update content
    tempNames.forEach(({ tempPath, index }) => {
      // New position fills the gap
      const newRowNum = deletedRowNumber + index;
      const newRowDir = `row${newRowNum}`;
      const newRowPath = path.join(tabFullPath, newRowDir);
      
      // Rename from temp to final name
      fs.renameSync(tempPath, newRowPath);
      
      // Update the row _index.md file
      const rowIndexPath = path.join(newRowPath, '_index.md');
      let content = fs.readFileSync(rowIndexPath, 'utf8');
      
      const newWeight = newRowNum;
      
      // Update weight
      content = content.replace(/weight:\s*\d+/, `weight: ${newWeight}`);
      
      // Update title
      content = content.replace(/title:\s*.+/, `title: Row ${newRowNum}`);
      
      fs.writeFileSync(rowIndexPath, content, 'utf8');
      
      // Update all cells in this row to reflect new row number in R{row}C{col}
      const cellDirs = fs.readdirSync(newRowPath)
        .filter(name => name.startsWith('cell') && fs.statSync(path.join(newRowPath, name)).isDirectory());
      
      cellDirs.forEach(cellDir => {
        const cellIndexPath = path.join(newRowPath, cellDir, '_index.md');
        if (fs.existsSync(cellIndexPath)) {
          let cellContent = fs.readFileSync(cellIndexPath, 'utf8');
          // Update R<row>C<col> heading
          cellContent = cellContent.replace(/##\s*R(\d+)C(\d+)/, (match, r, c) => {
            return `## R${newRowNum}C${c}`;
          });
          fs.writeFileSync(cellIndexPath, cellContent, 'utf8');
        }
      });
    });
    
    res.json({ 
      success: true, 
      message: 'Row deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting row:', error);
    res.status(500).json({ error: 'Failed to delete row: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Editor API server running on http://localhost:${PORT}`);
});
