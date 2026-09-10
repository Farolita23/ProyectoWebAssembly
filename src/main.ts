import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="canvas-container">
    <canvas id="webgpu-canvas"></canvas>
  </div>

  <div class="ui-overlay">
    <h1>ARTE GENERATIVO AUDIO-REACTIVO</h1>
    <input type="file" id="audio-file-input" accept="audio/*" />
    <audio id="audio-element" controls style="display: none;"></audio>
    <div id="track-info" style="font-size: 12px; color: #64748b;">Sube una pista de audio para empezar</div>
  </div>
`

const fileInput = document.getElementById('audio-file-input') as HTMLInputElement;
const audioElement = document.getElementById('audio-element') as HTMLAudioElement;
const trackInfo = document.getElementById('track-info') as HTMLDivElement;
const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// ---------- Motor de audio ----------
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let freqData: Uint8Array<ArrayBuffer> | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;

function setupAudioGraph() {
  if (audioCtx) return; // solo se crea una vez (el <audio> element solo puede tener una fuente)

  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.82; // suaviza los saltos bruscos

  freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

  sourceNode = audioCtx.createMediaElementSource(audioElement);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

// ---------- Carga de archivo ----------
fileInput.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const file = target.files[0];
  const fileURL = URL.createObjectURL(file);

  audioElement.src = fileURL;
  audioElement.style.display = 'block';
  audioElement.load();

  setupAudioGraph();
  if (audioCtx?.state === 'suspended') audioCtx.resume();

  audioElement.play().catch((error) => {
    console.error("Error al reproducir el audio:", error);
  });

  trackInfo.textContent = `Reproduciendo: ${file.name}`;
});

// ---------- Canvas / resize ----------
let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

function resizeCanvas() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---------- Utilidades de color ----------
function barColor(t: number, alpha = 1) {
  // t: 0 (azul) -> 1 (morado/rosa), interpolación simple
  const r = Math.round(59 + t * (216 - 59));
  const g = Math.round(130 + t * (70 - 130));
  const b = Math.round(246 + t * (255 - 246));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------- Estado de animación ----------
let time = 0;
const barCount = 64; // número de barras a cada lado
const blobPoints = 48;

function draw() {
  requestAnimationFrame(draw);
  time += 0.008;

  // Fondo oscuro con ligero fade para dejar rastro sutil
  ctx.fillStyle = 'rgba(19, 21, 26, 0.35)';
  ctx.fillRect(0, 0, W, H);

  // Energía media (graves) para modular el blob
  let bass = 0;
  if (analyser && freqData) {
    analyser.getByteFrequencyData(freqData);
    const bassBins = freqData.slice(0, 12);
    bass = bassBins.reduce((a, b) => a + b, 0) / bassBins.length / 255; // 0..1
  }

  drawBars();
  drawBlob(bass);
}

function drawBars() {
  const cx = W / 2;
  const cy = H / 2;
  const spacing = 8;
  const maxBarHeight = H * 0.35;

  for (let i = 0; i < barCount; i++) {
    let amp = 0.05;
    if (analyser && freqData) {
      // muestreo logarítmico para dar más peso a graves/medios, como en la referencia
      const idx = Math.floor(Math.pow(i / barCount, 1.6) * (freqData.length - 1));
      amp = freqData[idx] / 255;
    } else {
      // idle: leve ondulación cuando no hay audio sonando
      amp = 0.08 + 0.05 * Math.sin(time * 2 + i * 0.3);
    }

    const h = 4 + amp * maxBarHeight;
    const t = i / barCount;
    const color = barColor(t, 0.85);

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // lado derecho
    const xR = cx + i * spacing;
    ctx.beginPath();
    ctx.moveTo(xR, cy - h / 2);
    ctx.lineTo(xR, cy + h / 2);
    ctx.stroke();

    // lado izquierdo (espejo)
    const xL = cx - i * spacing;
    ctx.beginPath();
    ctx.moveTo(xL, cy - h / 2);
    ctx.lineTo(xL, cy + h / 2);
    ctx.stroke();

    ctx.restore();
  }
}

function drawBlob(bass: number) {
  const cx = W / 2;
  const cy = H / 2;
  const baseRadius = Math.min(W, H) * (0.14 + bass * 0.06);

  ctx.save();
  ctx.beginPath();

  for (let i = 0; i <= blobPoints; i++) {
    const angle = (i / blobPoints) * Math.PI * 2;

    // ruido orgánico: suma de senos con distintas frecuencias/fases animadas
    const noise =
      Math.sin(angle * 3 + time * 1.3) * 0.18 +
      Math.sin(angle * 5 - time * 0.7) * 0.1 +
      Math.sin(angle * 2 + time * 2.1) * 0.12;

    const r = baseRadius * (1 + noise + bass * 0.25);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.6);
  gradient.addColorStop(0, `rgba(120, 90, 255, ${0.55 + bass * 0.3})`);
  gradient.addColorStop(0.6, `rgba(80, 50, 200, ${0.25 + bass * 0.2})`);
  gradient.addColorStop(1, 'rgba(19, 21, 26, 0)');

  ctx.fillStyle = gradient;
  ctx.shadowBlur = 40 + bass * 40;
  ctx.shadowColor = 'rgba(140, 100, 255, 0.6)';
  ctx.fill();
  ctx.restore();
}

draw();