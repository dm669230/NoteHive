let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;

// PDF Handling
async function loadPDF(input) {
    const file = input.files[0];
    if (!file) return;

    const loader = document.createElement('div');
    loader.textContent = 'Loading PDF...';
    document.getElementById('pdf-container').prepend(loader);

    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        document.getElementById('page-count').textContent = pdfDoc.numPages;
        pageNum = 1;
        renderPage(pageNum);
    } catch (error) {
        showError('Error loading PDF:', error);
    } finally {
        loader.remove();
    }
}

async function renderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
        return;
    }
    
    pageRendering = true;
    
    try {
        const page = await pdfDoc.getPage(num);
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');

        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;

        await renderTextLayer(page, viewport);
        document.getElementById('page-num').textContent = num;
        
        pageRendering = false;
        if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
        }
    } catch (error) {
        showError('Error rendering page:', error);
        pageRendering = false;
    }
}

async function renderTextLayer(page, viewport) {
    const textLayer = document.getElementById('text-layer');
    textLayer.innerHTML = '';
    textLayer.style.width = viewport.width + 'px';
    textLayer.style.height = viewport.height + 'px';

    const textContent = await page.getTextContent();
    pdfjsLib.renderTextLayer({
        textContent: textContent,
        container: textLayer,
        viewport: viewport,
        textDivs: []
    });
}

// Navigation
function prevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    renderPage(pageNum);
}

function nextPage() {
    if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
    pageNum++;
    renderPage(pageNum);
}

// Text Selection
document.getElementById('text-layer').addEventListener('mouseup', function() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const selectedText = selection.toString().trim();
        if (selectedText) {
            document.getElementById('text-input').value = selectedText;
        }
    }
});

// File Handling
async function fetchFiles() {
    try {
        const response = await fetch('/list-files');
        const fileList = await response.json();
        
        const select = document.getElementById('file-select');
        select.innerHTML = '<option value="">Create New File</option>';
        
        fileList.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            select.appendChild(option);
        });
    } catch (error) {
        showError('Error fetching files:', error);
    }
}

async function viewFile() {
    const selectedFile = document.getElementById('file-select').value;
    if (!selectedFile) {
        alert('Please select a file to view');
        return;
    }

    try {
        const response = await fetch(`/view-file?name=${selectedFile}`);
        const content = await response.text();
        const viewContent = document.getElementById('view-content');
        // Preserve whitespace and line breaks
        viewContent.style.whiteSpace = 'pre-wrap';
        viewContent.textContent = content;
    } catch (error) {
        showError('Error viewing file:', error);
    }
}

async function createNewFile() {
    const fileName = document.getElementById('new-file-name').value.trim();
    if (!fileName) {
        alert('Please enter a file name');
        return;
    }

    try {
        const response = await fetch('/create-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: fileName })
        });
        
        const result = await response.json();
        document.getElementById('response-message').textContent = result.message;
        if (result.success) {
            await fetchFiles();
            document.getElementById('new-file-name').value = '';
        }
    } catch (error) {
        showError('Error creating file:', error);
    }
}

async function saveText() {
    const selectedFile = document.getElementById('file-select').value;
    const text = document.getElementById('text-input').value;
    const saveLocation = document.getElementById('save-location').value;

    if (!text) {
        alert('Please select or enter text to save');
        return;
    }

    if (!selectedFile) {
        alert('Please select or create a file first');
        return;
    }

    try {
        const response = await fetch('/save-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                file_name: selectedFile,
                save_location: saveLocation
            })
        });

        const result = await response.json();
        document.getElementById('response-message').textContent = result.message;
        
        // Refresh the view if we're viewing the same file
        if (selectedFile === document.getElementById('file-select').value) {
            await viewFile();
        }
    } catch (error) {
        showError('Error saving text:', error);
    }
}

async function undoText() {
    const selectedFile = document.getElementById('file-select').value;
    if (!selectedFile) {
        alert('Please select a file first');
        return;
    }

    try {
        const response = await fetch('/undo-last-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_name: selectedFile })
        });

        const result = await response.json();
        document.getElementById('response-message').textContent = result.message;
        
        // Refresh the view
        await viewFile();
    } catch (error) {
        showError('Error undoing text:', error);
    }
}

function showError(message, error) {
    console.error(message, error);
    document.getElementById('response-message').innerHTML = `
        <span style="color: red">Error:</span> ${error.message}
    `;
}

// Initial setup
document.addEventListener('DOMContentLoaded', fetchFiles);
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prevPage();
    if (e.key === 'ArrowRight') nextPage();
});