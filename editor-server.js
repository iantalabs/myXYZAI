const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Root endpoint - just to confirm server is running
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Editor API Server',
    endpoints: [
      'POST /api/save-cell - Save cell content to markdown files'
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
    const newContent = frontmatter + '\n{{< cell >}}\n\n' + content + '\n\n{{< /cell >}}\n';
    
    // Write back to file
    fs.writeFileSync(fullPath, newContent, 'utf8');
    
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Editor API server running on http://localhost:${PORT}`);
});
