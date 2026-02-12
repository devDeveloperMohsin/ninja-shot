import './index.css';

const viewHome = document.getElementById('view-home');
const viewEditor = document.getElementById('view-editor');
const viewSettings = document.getElementById('view-settings');
const btnFull = document.getElementById('btn-full');
const btnRegion = document.getElementById('btn-region');
const btnSettings = document.getElementById('btn-settings');
const btnSettingsBack = document.getElementById('btn-settings-back');
const settingShortcut = document.getElementById('setting-shortcut');
const settingSavePath = document.getElementById('setting-save-path');
const screenshotImg = document.getElementById('screenshot-img');
const annotCanvas = document.getElementById('annot-canvas');
const btnCopy = document.getElementById('btn-copy');
const btnSave = document.getElementById('btn-save');
const btnNew = document.getElementById('btn-new');
const toolButtons = document.querySelectorAll('.tool');
const inlineTextEditor = document.getElementById('inline-text-editor');
const textEntryInput = document.getElementById('text-entry-input');
const textEntryCancel = document.getElementById('text-entry-cancel');
const textEntryAdd = document.getElementById('text-entry-add');
const btnWindowMinimize = document.getElementById('btn-window-minimize');
const btnWindowMaximize = document.getElementById('btn-window-maximize');
const btnWindowClose = document.getElementById('btn-window-close');
const btnTitlebarSettings = document.getElementById('btn-titlebar-settings');
const titleBarDrag = document.querySelector('.title-bar-drag');

let currentImageDataUrl = null;
let currentTool = 'select';

// --- Title bar: window controls ---
if (btnWindowMinimize) btnWindowMinimize.addEventListener('click', () => window.ninjaShot.windowMinimize());
if (btnWindowMaximize) btnWindowMaximize.addEventListener('click', () => window.ninjaShot.windowToggleMaximize());
if (btnWindowClose) btnWindowClose.addEventListener('click', () => window.ninjaShot.windowClose());
if (titleBarDrag) {
  titleBarDrag.addEventListener('dblclick', () => window.ninjaShot.windowToggleMaximize());
}

async function openSettingsView() {
  viewHome.classList.add('hidden');
  viewEditor.classList.add('hidden');
  viewSettings.classList.remove('hidden');
  const config = await window.ninjaShot.getConfig();
  if (config && config.shortcutAction) settingShortcut.value = config.shortcutAction;
  const pathRes = await window.ninjaShot.getDefaultScreenshotsPath();
  if (pathRes && pathRes.path) settingSavePath.textContent = pathRes.path;
  else settingSavePath.textContent = '';
}
if (btnTitlebarSettings) btnTitlebarSettings.addEventListener('click', openSettingsView);

// --- Home: capture actions ---

/** Detect which capture dependency is needed from the error message. Returns package key or null. */
function getRequiredDependency(errorMsg) {
  if (!errorMsg) return null;
  const msg = errorMsg.toLowerCase();
  if (msg.includes('gnome-screenshot') || (msg.includes('gnome') && msg.includes('wayland')) || msg.includes('wlr-screencopy') || (msg.includes('compositor') && msg.includes('support'))) {
    return 'gnome-screenshot';
  }
  if (msg.includes('grim') || msg.includes('grim is required')) {
    return 'grim';
  }
  if (msg.includes('scrot') || msg.includes('scrot is required')) {
    return 'scrot';
  }
  return null;
}

const DEPENDENCY_LABELS = {
  'gnome-screenshot': 'gnome-screenshot (for GNOME Wayland)',
  grim: 'grim (for Wayland)',
  scrot: 'scrot (for X11)',
};

async function handleCaptureError(errorMsg) {
  console.error('[Ninja Shot] Capture error:', errorMsg);
  const packageKey = getRequiredDependency(errorMsg);
  if (packageKey && window.ninjaShot.installDependency) {
    const label = DEPENDENCY_LABELS[packageKey] || packageKey;
    const install = confirm(
      'Ninja Shot needs "' + label + '" to capture the screen.\n\n' +
      'Install it now? You may be asked for your password.'
    );
    if (install) {
      const result = await window.ninjaShot.installDependency(packageKey);
      if (result && result.ok) {
        console.log('[Ninja Shot] Installed:', packageKey);
        alert('Installation finished. Try capturing again.');
      } else {
        const err = (result && result.error) || 'Installation failed. Try in a terminal.';
        console.error('[Ninja Shot] Install failed:', err);
        alert(err);
      }
    }
  } else {
    alert('Capture failed: ' + errorMsg);
  }
}

btnFull.addEventListener('click', async () => {
  const result = await window.ninjaShot.captureFullScreen();
  if (result.ok) {
    showEditorWithImage('data:image/png;base64,' + result.data);
  } else {
    await handleCaptureError(result.error || 'Unknown error');
  }
});

btnRegion.addEventListener('click', async () => {
  await window.ninjaShot.showOverlay();
});

window.ninjaShot.onCaptureResult(async (payload) => {
  if (payload.ok) {
    showEditorWithImage('data:image/png;base64,' + payload.data);
  } else {
    await handleCaptureError(payload.error || 'Unknown error');
  }
});

// --- Editor: show image and setup canvas ---

function showEditorWithImage(dataUrl) {
  currentImageDataUrl = dataUrl;
  viewHome.classList.add('hidden');
  viewSettings.classList.add('hidden');
  viewEditor.classList.remove('hidden');
  viewEditor.classList.add('view-active');
  document.body.classList.add('editor-active');
  console.log('[Ninja Shot] Editor shown – use Save, Copy, or New in the toolbar above the image');

  screenshotImg.onload = () => {
    const wrap = screenshotImg.parentElement;
    const w = screenshotImg.naturalWidth;
    const h = screenshotImg.naturalHeight;
    annotCanvas.width = w;
    annotCanvas.height = h;
    annotCanvas.style.width = screenshotImg.offsetWidth + 'px';
    annotCanvas.style.height = screenshotImg.offsetHeight + 'px';
    initAnnotationCanvas();
  };
  screenshotImg.src = dataUrl;
}

function showHome() {
  viewEditor.classList.add('hidden');
  viewEditor.classList.remove('view-active');
  document.body.classList.remove('editor-active');
  viewHome.classList.remove('hidden');
  currentImageDataUrl = null;
}

btnNew.addEventListener('click', showHome);

// Settings view
btnSettings.addEventListener('click', openSettingsView);

btnSettingsBack.addEventListener('click', () => {
  viewSettings.classList.add('hidden');
  viewHome.classList.remove('hidden');
});

settingShortcut.addEventListener('change', async () => {
  await window.ninjaShot.setConfig({ shortcutAction: settingShortcut.value });
});

// Menu handlers
window.ninjaShot.onMenu('menu:new', showHome);
window.ninjaShot.onMenu('menu:save', () => btnSave.click());
window.ninjaShot.onMenu('menu:copy', () => btnCopy.click());
window.ninjaShot.onMenu('menu:settings', openSettingsView);
window.ninjaShot.onMenu('menu:captureFull', () => btnFull.click());
window.ninjaShot.onMenu('menu:captureRegion', () => btnRegion.click());

// --- Annotation canvas (Phase 2: text, arrow, highlight) ---

let annotCtx = null;
const annotations = [];
let dragStart = null;
let currentAnnotation = null;
let selectedAnnotationIndex = null;
let selectDragStart = null; // { startX, startY } when start dragging selected annotation

function initAnnotationCanvas() {
  annotCtx = annotCanvas.getContext('2d');
  annotations.length = 0;
  redrawAnnotations();
  annotCanvas.onmousedown = onCanvasMouseDown;
  annotCanvas.onmousemove = onCanvasMouseMove;
  annotCanvas.onmouseup = onCanvasMouseUp;
  annotCanvas.onmouseleave = onCanvasMouseUp;
}

function redrawAnnotations() {
  if (!annotCtx) return;
  const w = annotCanvas.width;
  const h = annotCanvas.height;
  annotCtx.clearRect(0, 0, w, h);
  annotations.forEach((a) => drawOneAnnotation(a));
}

function drawOneAnnotation(a) {
  const x = a.x;
  const y = a.y;
  const w = a.width || 0;
  const h = a.height || 0;

  if (a.type === 'text') {
    const fontSize = a.fontSize || 20;
    const color = a.color || '#ffeb3b';
    const lines = (a.text || '').split('\n');
    const lineHeight = fontSize * 1.2;
    annotCtx.font = fontSize + 'px sans-serif';
    annotCtx.fillStyle = color;
    lines.forEach((line, i) => {
      annotCtx.fillText(line, x, y + (i + 1) * lineHeight);
    });
  } else if (a.type === 'arrow') {
    const x2 = a.x2 !== undefined ? a.x2 : a.x + w;
    const y2 = a.y2 !== undefined ? a.y2 : a.y + h;
    drawArrow(annotCtx, x, y, x2, y2, a.color || '#e94560', a.lineWidth || 3);
  } else if (a.type === 'highlight') {
    annotCtx.fillStyle = a.color || 'rgba(255, 235, 59, 0.4)';
    annotCtx.fillRect(x, y, w, h);
  } else if (a.type === 'blur') {
    annotCtx.fillStyle = 'rgba(0,0,0,0.5)';
    annotCtx.fillRect(x, y, w, h);
  }
}

function drawArrow(ctx, x1, y1, x2, y2, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 12;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function getCanvasPoint(e) {
  const rect = annotCanvas.getBoundingClientRect();
  const scaleX = annotCanvas.width / rect.width;
  const scaleY = annotCanvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
    clientX: e.clientX - rect.left,
    clientY: e.clientY - rect.top,
  };
}

// Hit-test: distance from point to line segment (squared to avoid sqrt)
function distToSegmentSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return (px - qx) * (px - qx) + (py - qy) * (py - qy);
}

function hitTestAnnotation(canvasX, canvasY) {
  const thresholdSq = 64; // ~8px
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i];
    if (a.type === 'text') {
      if (!annotCtx) continue;
      const lines = (a.text || '').split('\n');
      const fontSize = a.fontSize || 20;
      const lineHeight = fontSize * 1.2;
      annotCtx.font = fontSize + 'px sans-serif';
      let maxW = 0;
      lines.forEach((line) => {
        const w = annotCtx.measureText(line).width;
        if (w > maxW) maxW = w;
      });
      const top = a.y;
      const left = a.x;
      const width = maxW;
      const height = lines.length * lineHeight;
      if (canvasX >= left && canvasX <= left + width && canvasY >= top && canvasY <= top + height) return i;
    } else if (a.type === 'arrow') {
      const x2 = a.x2 !== undefined ? a.x2 : a.x + (a.width || 0);
      const y2 = a.y2 !== undefined ? a.y2 : a.y + (a.height || 0);
      if (distToSegmentSq(canvasX, canvasY, a.x, a.y, x2, y2) <= thresholdSq) return i;
    } else if (a.type === 'highlight' || a.type === 'blur') {
      const w = a.width || 0;
      const h = a.height || 0;
      if (canvasX >= a.x && canvasX <= a.x + w && canvasY >= a.y && canvasY <= a.y + h) return i;
    }
  }
  return null;
}

function onCanvasMouseDown(e) {
  const p = getCanvasPoint(e);
  if (currentTool === 'select') {
    const idx = hitTestAnnotation(p.x, p.y);
    if (idx !== null) {
      selectedAnnotationIndex = idx;
      selectDragStart = { startX: p.x, startY: p.y, origX: annotations[idx].x, origY: annotations[idx].y };
      if (annotations[idx].type === 'arrow') {
        selectDragStart.origX2 = annotations[idx].x2;
        selectDragStart.origY2 = annotations[idx].y2;
      }
    }
    return;
  }
  dragStart = { x: p.x, y: p.y, clientX: p.clientX, clientY: p.clientY };
  currentAnnotation = { type: currentTool, x: p.x, y: p.y, width: 0, height: 0, color: currentTool === 'highlight' ? 'rgba(255,235,59,0.4)' : '#e94560' };
}

function onCanvasMouseMove(e) {
  const p = getCanvasPoint(e);
  if (currentTool === 'select' && selectedAnnotationIndex !== null && selectDragStart) {
    const dx = p.x - selectDragStart.startX;
    const dy = p.y - selectDragStart.startY;
    const a = annotations[selectedAnnotationIndex];
    a.x = selectDragStart.origX + dx;
    a.y = selectDragStart.origY + dy;
    if (a.type === 'arrow' && selectDragStart.origX2 !== undefined) {
      a.x2 = selectDragStart.origX2 + dx;
      a.y2 = selectDragStart.origY2 + dy;
    }
    selectDragStart.startX = p.x;
    selectDragStart.startY = p.y;
    selectDragStart.origX = a.x;
    selectDragStart.origY = a.y;
    if (a.type === 'arrow') {
      selectDragStart.origX2 = a.x2;
      selectDragStart.origY2 = a.y2;
    }
    redrawAnnotations();
    return;
  }
  if (!dragStart) return;
  if (currentTool === 'arrow') {
    currentAnnotation.x2 = p.x;
    currentAnnotation.y2 = p.y;
  } else if (currentTool === 'highlight' || currentTool === 'blur') {
    currentAnnotation.width = p.x - dragStart.x;
    currentAnnotation.height = p.y - dragStart.y;
  }
  redrawAnnotations();
  if (currentAnnotation) {
    if (currentAnnotation.type === 'arrow') {
      drawOneAnnotation(currentAnnotation);
    } else if (currentAnnotation.type === 'highlight' || currentAnnotation.type === 'blur') {
      const a = { ...currentAnnotation };
      const scaleX = annotCanvas.width / annotCanvas.offsetWidth;
      const scaleY = annotCanvas.height / annotCanvas.offsetHeight;
      a.width = currentAnnotation.width;
      a.height = currentAnnotation.height;
      drawOneAnnotation(a);
    }
  }
}

function onCanvasMouseUp(e) {
  if (currentTool === 'select') {
    selectedAnnotationIndex = null;
    selectDragStart = null;
    return;
  }
  if (!dragStart) return;
  const p = getCanvasPoint(e);
  if (currentTool === 'arrow') {
    currentAnnotation.x2 = p.x;
    currentAnnotation.y2 = p.y;
    const dx = Math.abs(currentAnnotation.x2 - currentAnnotation.x);
    const dy = Math.abs(currentAnnotation.y2 - currentAnnotation.y);
    if (dx + dy > 10) annotations.push({ ...currentAnnotation });
  } else if (currentTool === 'highlight' || currentTool === 'blur') {
    currentAnnotation.width = p.x - dragStart.x;
    currentAnnotation.height = p.y - dragStart.y;
    if (Math.abs(currentAnnotation.width) > 5 && Math.abs(currentAnnotation.height) > 5) {
      const a = { ...currentAnnotation };
      if (a.width < 0) {
        a.x += a.width;
        a.width = -a.width;
      }
      if (a.height < 0) {
        a.y += a.height;
        a.height = -a.height;
      }
      annotations.push(a);
    }
  } else if (currentTool === 'text') {
    openInlineTextEditor({ ...currentAnnotation }, p.clientX, p.clientY);
  }
  dragStart = null;
  currentAnnotation = null;
  redrawAnnotations();
}

// Inline text editor (on screenshot at click position, multi-line)
let pendingTextAnnotation = null;

function openInlineTextEditor(annotation, displayX, displayY) {
  pendingTextAnnotation = annotation;
  if (!inlineTextEditor || !textEntryInput) return;
  const wrap = annotCanvas.parentElement;
  if (!wrap) return;
  const fontSize = 24;
  const scale = wrap.offsetWidth / annotCanvas.width;
  const displayFontSize = Math.max(12, Math.round(fontSize * scale));
  inlineTextEditor.style.left = displayX + 'px';
  inlineTextEditor.style.top = displayY + 'px';
  inlineTextEditor.style.fontSize = displayFontSize + 'px';
  textEntryInput.style.fontSize = displayFontSize + 'px';
  textEntryInput.value = '';
  inlineTextEditor.classList.remove('hidden');
  textEntryInput.focus();
}

function closeInlineTextEditor() {
  pendingTextAnnotation = null;
  if (inlineTextEditor) inlineTextEditor.classList.add('hidden');
}

function commitTextEntry() {
  const text = textEntryInput && textEntryInput.value ? textEntryInput.value : '';
  if (pendingTextAnnotation) {
    if (text.trim()) {
      const a = { ...pendingTextAnnotation };
      a.text = text.trimEnd();
      a.fontSize = 24;
      annotations.push(a);
      redrawAnnotations();
    }
    closeInlineTextEditor();
  }
}

if (textEntryAdd) textEntryAdd.addEventListener('click', () => { commitTextEntry(); });
if (textEntryCancel) textEntryCancel.addEventListener('click', closeInlineTextEditor);
if (textEntryInput) {
  textEntryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeInlineTextEditor(); }
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commitTextEntry(); }
  });
}

// Tool buttons
toolButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    toolButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    selectedAnnotationIndex = null;
    selectDragStart = null;
  });
});

// --- Copy & Save (Phase 3) ---

btnCopy.addEventListener('click', async () => {
  const dataUrl = await getComposedImageDataUrl();
  if (!dataUrl) return;
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const result = await window.ninjaShot.copyImageToClipboard(base64);
  if (result && result.ok) alert('Copied to clipboard');
  else {
    console.error('[Ninja Shot] Copy failed:', result && result.error ? result.error : 'Unknown');
    alert('Copy failed');
  }
});

btnSave.addEventListener('click', async () => {
  const dataUrl = await getComposedImageDataUrl();
  if (!dataUrl) {
    console.error('[Ninja Shot] Save failed: no image to save (capture or compose failed)');
    alert('No image to save. Take a screenshot first.');
    return;
  }
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const defaultPath = await window.ninjaShot.getDefaultScreenshotsPath();
  const result = await window.ninjaShot.saveImage(base64, defaultPath ? defaultPath.path : undefined);
  if (result && result.ok) {
    console.log('[Ninja Shot] Saved to:', result.path);
    alert('Saved to ' + result.path);
  } else {
    const err = result && result.error ? result.error : 'Unknown';
    console.error('[Ninja Shot] Save failed:', err);
    alert('Save failed: ' + err);
  }
});

function boxBlur(ctx, x, y, w, h, radius) {
  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;
  const r = Math.max(1, Math.floor(radius));
  const w2 = w;
  const h2 = h;
  for (let py = 0; py < h2; py++) {
    for (let px = 0; px < w2; px++) {
      let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = Math.max(0, Math.min(w2 - 1, px + dx));
          const ny = Math.max(0, Math.min(h2 - 1, py + dy));
          const i = (ny * w2 + nx) * 4;
          sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; sa += data[i + 3];
          n++;
        }
      }
      const i = (py * w2 + px) * 4;
      data[i] = sr / n; data[i + 1] = sg / n; data[i + 2] = sb / n; data[i + 3] = sa / n;
    }
  }
  ctx.putImageData(imageData, x, y);
}

function getComposedImageDataUrl() {
  if (!currentImageDataUrl || !annotCtx) return null;
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = annotCanvas.width;
      c.height = annotCanvas.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const scaleX = annotCanvas.width / annotCanvas.offsetWidth;
      const scaleY = annotCanvas.height / annotCanvas.offsetHeight;
      annotations.forEach((a) => {
        if (a.type === 'blur') {
          const x = Math.round(a.x);
          const y = Math.round(a.y);
          const w = Math.round(Math.abs(a.width));
          const h = Math.round(Math.abs(a.height));
          if (w > 0 && h > 0) boxBlur(ctx, x, y, w, h, 8);
        } else {
          const saved = annotCtx;
          annotCtx = ctx;
          drawOneAnnotation(a);
          annotCtx = saved;
        }
      });
      resolve(c.toDataURL('image/png'));
    };
    img.src = currentImageDataUrl;
  });
}
