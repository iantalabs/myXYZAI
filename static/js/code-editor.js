// Code Editor Manager - Handles Monaco Editor and Pyodide initialization
(function() {
  'use strict';

  let pyodide = null;
  let pyodideReady = false;
  const editors = new Map();

  // Initialize Pyodide
  async function initPyodide() {
    if (pyodideReady) return pyodide;
    
    try {
      console.log('Loading Pyodide...');
      pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
      });
      
      // Redirect stdout/stderr
      pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);
      
      pyodideReady = true;
      console.log('Pyodide loaded successfully');
      return pyodide;
    } catch (error) {
      console.error('Failed to load Pyodide:', error);
      throw error;
    }
  }

  // Initialize Monaco Editor for a code cell
  function initMonacoEditor(container) {
    const cellId = container.getAttribute('data-cell-id');
    const editorElement = container.querySelector('.monaco-editor-wrapper');
    const preElement = editorElement.querySelector('pre');
    const initialCode = preElement ? preElement.textContent.trim() : '# Enter your Python code here\nprint("Hello, World!")';
    
    if (!editorElement || editors.has(cellId)) return;

    // Clear the pre element
    if (preElement) {
      preElement.remove();
    }

    // Create Monaco editor
    const editor = monaco.editor.create(editorElement, {
      value: initialCode,
      language: 'python',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      padding: { top: 10, bottom: 10 }
    });

    editors.set(cellId, editor);

    // Track changes for save button
    let originalCode = initialCode;
    const saveBtn = container.querySelector('.save-code-btn');
    
    editor.onDidChangeModelContent(() => {
      const currentCode = editor.getValue();
      if (currentCode !== originalCode && saveBtn) {
        saveBtn.style.display = 'flex';
      }
    });

    // Setup keyboard shortcuts
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      runCode(container);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCode(container);
    });

    // Setup button handlers
    const runBtn = container.querySelector('.run-code-btn');
    if (runBtn) {
      runBtn.addEventListener('click', () => runCode(container));
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveCode(container));
    }

    return editor;
  }

  // Run Python code
  async function runCode(container) {
    const cellId = container.getAttribute('data-cell-id');
    const editor = editors.get(cellId);
    const outputElement = document.getElementById(`${cellId}-output`);
    const statusElement = container.querySelector('.code-status');
    const runBtn = container.querySelector('.run-code-btn');
    
    if (!editor || !outputElement) return;

    const code = editor.getValue();
    
    // Update UI
    outputElement.textContent = '';
    outputElement.className = 'code-output';
    if (statusElement) statusElement.textContent = 'Running...';
    if (runBtn) runBtn.disabled = true;

    try {
      // Initialize Pyodide if not ready
      if (!pyodideReady) {
        outputElement.textContent = 'Loading Python environment...';
        await initPyodide();
      }

      // Clear previous output
      pyodide.runPython(`
import sys
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

      // Run the code
      await pyodide.runPythonAsync(code);

      // Get output
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      const stderr = pyodide.runPython('sys.stderr.getvalue()');

      if (stderr) {
        outputElement.textContent = stderr;
        outputElement.classList.add('error');
        if (statusElement) statusElement.textContent = 'Error';
      } else {
        outputElement.textContent = stdout || '(no output)';
        outputElement.classList.add('success');
        if (statusElement) statusElement.textContent = 'Success';
      }
    } catch (error) {
      outputElement.textContent = `Error: ${error.message}`;
      outputElement.classList.add('error');
      if (statusElement) statusElement.textContent = 'Error';
      console.error('Execution error:', error);
    } finally {
      if (runBtn) runBtn.disabled = false;
      
      // Clear status after 3 seconds
      if (statusElement) {
        setTimeout(() => {
          statusElement.textContent = '';
        }, 3000);
      }
    }
  }

  // Save code back to file
  async function saveCode(container) {
    const cellId = container.getAttribute('data-cell-id');
    const cellPath = container.getAttribute('data-cell-path');
    const editor = editors.get(cellId);
    const saveBtn = container.querySelector('.save-code-btn');
    const statusElement = container.querySelector('.code-status');
    
    if (!editor || !cellPath) return;

    const code = editor.getValue();
    const API_URL = 'http://localhost:3001';
    
    // Prepare markdown content
    const content = `{{< code-cell >}}\n${code}\n{{< /code-cell >}}`;

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="save-icon">⏳</span> Saving...';
      }
      if (statusElement) statusElement.textContent = 'Saving...';

      const response = await fetch(`${API_URL}/api/save-cell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: cellPath,
          content: content
        })
      });

      const result = await response.json();

      if (result.success) {
        if (statusElement) statusElement.textContent = '✅ Saved';
        if (saveBtn) {
          saveBtn.style.display = 'none';
          saveBtn.innerHTML = '<span class="save-icon">💾</span> Save';
        }
        
        // Update original code
        // Note: We'd need to track this per editor
        
        setTimeout(() => {
          if (statusElement) statusElement.textContent = '';
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      if (statusElement) statusElement.textContent = '❌ Save failed';
      alert('Failed to save: ' + error.message);
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="save-icon">💾</span> Save';
      }
    }
  }

  // Initialize all code cells on page load
  function initAllCodeCells() {
    if (typeof monaco === 'undefined') {
      console.warn('Monaco Editor not loaded yet, retrying...');
      setTimeout(initAllCodeCells, 100);
      return;
    }

    const codeCells = document.querySelectorAll('.code-cell-container');
    codeCells.forEach(container => {
      initMonacoEditor(container);
    });

    // Start loading Pyodide in background
    initPyodide().catch(err => {
      console.error('Failed to initialize Pyodide:', err);
    });
  }

  // Wait for DOM and Monaco to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllCodeCells);
  } else {
    initAllCodeCells();
  }

  // Expose for debugging
  window.codeEditor = {
    editors,
    initMonacoEditor,
    runCode,
    saveCode,
    getPyodide: () => pyodide
  };
})();
