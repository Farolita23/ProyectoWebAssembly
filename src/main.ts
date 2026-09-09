import './style.css'

// 1. Inyectar la estructura HTML básica de la UI y el Canvas en el DOM
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

// 2. Lógica para manejar la carga y reproducción del archivo de audio local
const fileInput = document.getElementById('audio-file-input') as HTMLInputElement;
const audioElement = document.getElementById('audio-element') as HTMLAudioElement;
const trackInfo = document.getElementById('track-info') as HTMLDivElement;

fileInput.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const file = target.files[0];
  const fileURL = URL.createObjectURL(file);

  // Asignar la URL del archivo local al elemento de audio HTML5
  audioElement.src = fileURL;
  audioElement.style.display = 'block'; // Mostrar el reproductor nativo
  audioElement.load();
  
  // Reproducir automáticamente y actualizar texto
  audioElement.play().catch((error) => {
    console.error("Error al reproducir el audio:", error);
  });

  trackInfo.textContent = `Reproduciendo: ${file.name}`;
  
  // Dejamos preparado el terreno para conectar el AudioContext en el Sprint 2
  console.log("Archivo de audio cargado correctamente:", file.name);
});