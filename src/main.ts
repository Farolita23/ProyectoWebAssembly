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
const adapter = await navigator.gpu?.requestAdapter();

if (!adapter){
  throw new Error("Este navegador no soporta WebGPU, comprueba si tienes esta funcion activada");
}
const device = await adapter.requestDevice();

const context = canvas.getContext('webgpu') as GPUCanvasContext;
if (!context) {
  throw new Error("No se puede inicializar webGPU");
}

const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device: device,
  format: format,
  alphaMode: 'premultiplied'
})

// Cargar el código del shader WGSL
const shaderModule = device.createShaderModule({
  code: `
    @vertex
    fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
        var pos = array<vec2f, 3>(
            vec2f(0.0, 0.5),
            vec2f(-0.5, -0.5),
            vec2f(0.5, -0.5)
        );
        return vec4f(pos[vertexIndex], 0.0, 1.0);
    }

    @fragment
    fn fs_main() -> @location(0) vec4f {
        return vec4f(0.47, 0.35, 1.0, 1.0);
    }
  `
});

// Crear el pipeline de renderizado
const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: shaderModule,
    entryPoint: 'vs_main',
  },
  fragment: {
    module: shaderModule,
    entryPoint: 'fs_main',
    targets: [{
      format: format,
    }],
  },
  primitive: {
    topology: 'triangle-list',
  },
});

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

// ---------- Canvas / redimension ----------
let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

function resizeCanvas() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();


function drawWebGPU() {
  requestAnimationFrame(drawWebGPU);

  // Obtener la textura actual del canvas en pantalla
  const textureView = context.getCurrentTexture().createView();

  // 2. Configurar el pase de renderizado (limpiar pantalla con color oscuro)
  const colorAttachment: GPURenderPassColorAttachment = {
    view: textureView,
    clearValue: { r: 0.07, g: 0.08, b: 0.1, a: 1.0 }, // #13151A
    loadOp: 'clear',
    storeOp: 'store',
  };

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [colorAttachment],
  });

  // Ejecutar el pipeline gráfico en la GPU
  passEncoder.setPipeline(pipeline);
  passEncoder.draw(3, 1, 0, 0); // Dibuja el triángulo base
  passEncoder.end();

  // Enviar los comandos a la cola de la GPU
  device.queue.submit([commandEncoder.finish()]);
}

drawWebGPU();

