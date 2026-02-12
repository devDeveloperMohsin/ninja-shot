/**
 * Overlay window: fullscreen transparent canvas for rectangle selection.
 * Draws selection rect; on mouse up sends bounds to main process.
 */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let drawing = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redraw();
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (drawing) {
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
    ctx.fillRect(x, y, w, h);
  }
}

function getBounds() {
  const x = Math.min(startX, currentX);
  const y = Math.min(startY, currentY);
  const w = Math.abs(currentX - startX);
  const h = Math.abs(currentY - startY);
  return { x, y, width: w, height: h };
}

canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  startX = currentX = e.clientX;
  startY = currentY = e.clientY;
  redraw();
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  currentX = e.clientX;
  currentY = e.clientY;
  redraw();
});

canvas.addEventListener('mouseup', (e) => {
  if (!drawing) return;
  drawing = false;
  currentX = e.clientX;
  currentY = e.clientY;
  const bounds = getBounds();
  if (bounds.width >= 5 && bounds.height >= 5) {
    window.overlayApi.commitSelection(bounds);
  } else {
    redraw();
  }
});

canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.overlayApi.cancel();
  }
});

window.addEventListener('resize', resize);
resize();
canvas.focus();
