const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

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
    const newContent = frontmatter + '\n{{< cell >}}\n\n' + content + '\n\n{{< /cell >}}\n';
    
    // Write back to file
    fs.writeFileSync(fullPath, newContent, 'utf8');
    
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

app.listen(PORT, () => {
  console.log(`Editor API server running on http://localhost:${PORT}`);
});
