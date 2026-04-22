const { ipcRenderer } = require('electron');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const bgCanvas = document.createElement('canvas'); // Original image kept in memory
const bgCtx = bgCanvas.getContext('2d');
const container = document.getElementById('canvas-container');

let imagePath = '';
let drawing = false;
let currentTextInput = null;
let currentPos = { x: 0, y: 0 };
const activeTexts = []; // List of draggable texts added

// ===== MODE MANAGEMENT =====
// mode: 'draw' | 'text' | 'marker' | 'eraser'
let mode = 'draw';

// Active color and alpha for marker
let markerColor = '#FFE600';
let markerAlpha = 0.38; // Semi-transparent (Windows Snipping Tool style)
const MARKER_SIZE = 22; // Fixed marker body thickness

// DOM references
const colorPicker   = document.getElementById('colorPicker');
const brushSizeEl   = document.getElementById('brushSize');
const brushSizeLabel= document.getElementById('brushSizeLabel');
const markerSizeEl  = document.getElementById('markerSize');
const markerSizeLabel = document.getElementById('markerSizeLabel');
const btnDraw       = document.getElementById('btnDraw');
const btnText       = document.getElementById('btnText');
const btnEraser     = document.getElementById('btnEraser');
const btnUndo       = document.getElementById('btnUndo');
const btnSave       = document.getElementById('btnSave');
const markerBtns    = document.querySelectorAll('.marker-btn');
const btnZoomIn     = document.getElementById('btnZoomIn');
const btnZoomOut    = document.getElementById('btnZoomOut');
const zoomLabel     = document.getElementById('zoomLevelLabel');

let zoomScale = 1.0;

// Size and color updates
brushSizeEl.addEventListener('input', () => {
    brushSizeLabel.textContent = brushSizeEl.value;
    if (currentTextInput) {
        const csize = Math.max(20, parseInt(brushSizeEl.value) * 4);
        currentTextInput.dataset.csize = csize;
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
        currentTextInput.style.fontSize = (csize * scale) + 'px';
    }
});
markerSizeEl.addEventListener('input', () => {
    markerSizeLabel.textContent = markerSizeEl.value;
});
colorPicker.addEventListener('input', () => {
    if (currentTextInput) {
        currentTextInput.style.color = colorPicker.value;
    }
});

// ===== UNDO =====
const undoStack = [];
const MAX_UNDO = 20;

function saveState() {
    if (undoStack.length >= MAX_UNDO) undoStack.shift();
    undoStack.push(canvas.toDataURL());
}

function undo() {
    if (undoStack.length === 0) return;
    const prevState = undoStack.pop();
    const img = new Image();
    img.src = prevState;
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
}

btnUndo.addEventListener('click', undo);
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
});

// ===== MODE SWITCHER =====
function clearToolActive() {
    btnDraw.classList.remove('active');
    btnText.classList.remove('active');
    btnEraser.classList.remove('active');
    markerBtns.forEach(b => b.classList.remove('active'));
}

function setMode(m, markerEl) {
    mode = m;
    clearToolActive();

    if (m === 'draw') {
        btnDraw.classList.add('active');
        canvas.style.cursor = 'crosshair';
        if (currentTextInput) finalizeText();
    } else if (m === 'text') {
        btnText.classList.add('active');
        canvas.style.cursor = 'text';
    } else if (m === 'eraser') {
        btnEraser.classList.add('active');
        canvas.style.cursor = 'cell';
        if (currentTextInput) finalizeText();
    } else if (m === 'marker') {
        if (markerEl) markerEl.classList.add('active');
        canvas.style.cursor = 'crosshair';
        if (currentTextInput) finalizeText();
    }
}

btnDraw.addEventListener('click',   () => setMode('draw'));
btnText.addEventListener('click',   () => setMode('text'));
btnEraser.addEventListener('click', () => setMode('eraser'));

// Marker buttons
markerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        markerColor = btn.dataset.color;
        setMode('marker', btn);
    });
});

// ===== LOAD IMAGE =====
ipcRenderer.on('load-image', (e, path) => {
    imagePath = path;
    const img = new Image();
    img.src = 'file://' + path;
    img.onload = () => {
        bgCanvas.width  = img.width;
        bgCanvas.height = img.height;
        bgCtx.drawImage(img, 0, 0);

        canvas.width  = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        saveState(); // Save initial state
        
        // Initial fit zoom
        const padding = 40;
        const availableW = container.clientWidth - padding;
        const availableH = container.clientHeight - padding;
        const fitScale = Math.min(availableW / img.width, availableH / img.height, 1.0);
        
        zoomScale = fitScale;
        updateZoom();
    };
});

// ===== ZOOM LOGIC =====
function updateZoom() {
    // We change the CSS size of the canvas element.
    // This allows the container's overflow:auto to show scrollbars.
    canvas.style.width = (canvas.width * zoomScale) + 'px';
    canvas.style.height = (canvas.height * zoomScale) + 'px';
    
    zoomLabel.innerText = Math.round(zoomScale * 100) + '%';
    updateTextOverlays();
}

btnZoomIn.addEventListener('click', () => {
    zoomScale = Math.min(zoomScale + 0.1, 5.0);
    updateZoom();
});

btnZoomOut.addEventListener('click', () => {
    zoomScale = Math.max(zoomScale - 0.1, 0.1);
    updateZoom();
});

container.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomScale = Math.min(zoomScale + 0.1, 5.0);
        else zoomScale = Math.max(zoomScale - 0.1, 0.1);
        updateZoom();
    }
}, { passive: false });

// ===== MOUSE COORDINATES =====
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    
    return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top)  / scale,
        clientX: e.clientX,
        clientY: e.clientY
    };
}

// ===== TEXT MANAGEMENT =====
function updateTextOverlays() {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.width;

    activeTexts.forEach(el => {
        const cx = parseFloat(el.dataset.cx);
        const cy = parseFloat(el.dataset.cy);
        const csize = parseFloat(el.dataset.csize);

        el.style.left = (rect.left + cx * scale) + 'px';
        el.style.top = (rect.top + cy * scale) + 'px';
        el.style.fontSize = Math.max(8, csize * scale) + 'px';
    });
}

window.addEventListener('resize', updateTextOverlays);

function finalizeText() {
    if (currentTextInput) {
        const textVal = currentTextInput.value.trim();
        if (textVal !== '') {
            const pos = getMousePos({ clientX: parseFloat(currentTextInput.style.left), clientY: parseFloat(currentTextInput.style.top) + 18 });
            createTextOverlay(
                textVal, 
                pos.x, 
                pos.y, 
                currentTextInput.style.color || colorPicker.value, 
                parseFloat(currentTextInput.dataset.csize) || Math.max(20, parseInt(brushSizeEl.value) * 4)
            );
            saveState();
        }
        removeInput();
    }
}

function createTextOverlay(text, cx, cy, color, csize) {
    const el = document.createElement('div');
    el.innerText = text;
    el.className = 'draggable-text';
    el.style.position = 'absolute';
    el.style.color = color;
    el.style.fontWeight = 'bold';
    el.style.cursor = 'move';
    el.style.textShadow = '1px 1px 2px black';
    el.style.userSelect = 'none';
    el.style.zIndex = '50';
    el.title = window.appLang?.editor_tooltip_drag || "Drag to move, Double Click to edit";
    
    el.dataset.cx = cx;
    el.dataset.cy = cy;
    el.dataset.csize = csize;
    
    document.body.appendChild(el);
    activeTexts.push(el);
    updateTextOverlays(); // Set initial pixel position

    // Drag and Drop logic
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    
    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragOffsetX = e.clientX - el.getBoundingClientRect().left;
        dragOffsetY = e.clientY - el.getBoundingClientRect().top;
        e.stopPropagation(); // Prevent drawing
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const newClientX = e.clientX - dragOffsetX;
        const newClientY = e.clientY - dragOffsetY;
        
        // Update dataset based on new client pos
        const pos = getMousePos({ clientX: newClientX, clientY: newClientY });
        el.dataset.cx = pos.x;
        el.dataset.cy = pos.y;
        
        updateTextOverlays();
    });
    
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Double Click to Edit
    el.addEventListener('dblclick', (e) => {
        el.remove();
        const index = activeTexts.indexOf(el);
        if (index > -1) activeTexts.splice(index, 1);
        
        currentTextInput = document.createElement('input');
        currentTextInput.type = 'text';
        currentTextInput.value = el.innerText;
        currentTextInput.className = 'floating-input';
        currentTextInput.style.left = el.style.left;
        currentTextInput.style.top = (parseFloat(el.style.top) - 18) + 'px';
        currentTextInput.dataset.csize = el.dataset.csize;
        currentTextInput.style.fontSize = el.style.fontSize;
        
        document.body.appendChild(currentTextInput);
        currentTextInput.focus();
        
        currentTextInput.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') finalizeText();
            else if (ev.key === 'Escape') removeInput();
        });
        
        e.stopPropagation();
    });
}

function removeInput() {
    if (currentTextInput) {
        if (currentTextInput.parentNode) {
            currentTextInput.parentNode.removeChild(currentTextInput);
        }
        currentTextInput = null;
    }
}

let currentStrokePoints = [];
let lastImageData = null;

// ===== DRAWING FUNCTIONS =====
function startDraw(pos) {
    drawing = true;
    currentStrokePoints = [pos];
    lastImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function continueDraw(pos) {
    if (!drawing) return;
    currentStrokePoints.push(pos);
    
    // Restore background to state before drawing started (synchronous)
    ctx.putImageData(lastImageData, 0, 0);
    
    ctx.save();
    if (mode === 'marker') {
        ctx.globalAlpha = 0.5;                           // Fixed and uniform transparency
        ctx.globalCompositeOperation = 'source-over';    // source-over is best to avoid corruption on dark backgrounds
        ctx.strokeStyle = markerColor;
        ctx.lineWidth = parseInt(markerSizeEl.value);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    } else if (mode === 'eraser') {
        const pattern = ctx.createPattern(bgCanvas, 'no-repeat');
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.strokeStyle = pattern;
        ctx.lineWidth = parseInt(brushSizeEl.value) * 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    } else {
        // Normal pen
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = colorPicker.value;
        ctx.lineWidth = brushSizeEl.value;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    // Draw entire path at once (prevents overlapping/darkening at joints)
    ctx.beginPath();
    ctx.moveTo(currentStrokePoints[0].x, currentStrokePoints[0].y);
    for (let i = 1; i < currentStrokePoints.length; i++) {
        ctx.lineTo(currentStrokePoints[i].x, currentStrokePoints[i].y);
    }
    ctx.stroke();
    ctx.restore();
}

function endDraw() {
    if (!drawing) return;
    drawing = false;
    saveState();
}

// ===== CANVAS EVENT LISTENERS =====
canvas.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);

    if (mode === 'text') {
        if (currentTextInput) {
            finalizeText();
            return;
        }
        currentPos = { x: pos.x, y: pos.y };
        
        currentTextInput = document.createElement('input');
        currentTextInput.type = 'text';
        currentTextInput.placeholder = window.appLang?.editor_placeholder || 'Type, confirm with Enter...';
        currentTextInput.className = 'floating-input';
        currentTextInput.style.left  = pos.clientX + 'px';
        currentTextInput.style.top   = (pos.clientY - 18) + 'px';
        currentTextInput.style.color = colorPicker.value;
        const csize = Math.max(18, parseInt(brushSizeEl.value) * 4);
        currentTextInput.dataset.csize = csize;
        
        const rect = canvas.getBoundingClientRect();
        const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
        currentTextInput.style.fontSize = (csize * scale) + 'px';

        document.body.appendChild(currentTextInput);
        setTimeout(() => currentTextInput && currentTextInput.focus(), 10);
        
        currentTextInput.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter')  finalizeText();
            else if (ev.key === 'Escape') removeInput();
        });
    } else {
        startDraw(pos);
    }
});

window.addEventListener('mouseup', endDraw);

canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const pos = getMousePos(e);
    continueDraw(pos);
});

// ===== SAVE =====
btnSave.addEventListener('click', () => {
    if (currentTextInput) finalizeText();

    activeTexts.forEach(el => {
        const x = parseFloat(el.dataset.cx);
        const y = parseFloat(el.dataset.cy);
        const csize = parseFloat(el.dataset.csize);
        
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.textBaseline = 'top';
        ctx.font = `bold ${csize}px Arial`;
        ctx.fillStyle = el.style.color;
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 3;
        ctx.fillText(el.innerText, x, y);
        ctx.restore();
    });

    // Save only canvas (already contains background and drawings)
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    ipcRenderer.send('save-edited-image', base64Data, imagePath);
});
