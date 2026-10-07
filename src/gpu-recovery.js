// When the graphics chip resets (iOS does this to a page sent to the background, or any phone
// that runs out of GPU memory), the canvas loses everything on the GPU. three.js re-uploads
// meshes and textures by itself once the browser gives the context back; this module pauses the
// game meanwhile, rebuilds what three.js can't (the post-processing chain), compiles the shaders
// again before play resumes, and only if the browser never gives it back (iOS sometimes doesn't)
// offers a button to reload.
import { LOOK } from './look.js';

export function recoverGpu({ renderer, scene, camera, gfx, pause, onRestored = () => {} }) {
  const canvas = renderer.domElement;
  const note = document.createElement('div');
  note.className = 'jf-keep gpu-note';
  note.hidden = true;
  note.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:98;max-width:80vw;padding:14px 18px;'
    + 'border-radius:12px;background:#101624ee;color:#e8f6ff;font:15px/1.4 system-ui,sans-serif;text-align:center';
  note.innerHTML = '<div class="msg">Graphics paused. Restoring…</div>'
    + '<button class="reload" hidden style="margin-top:10px;padding:8px 16px;border-radius:8px;border:0;background:#5ff0ff;color:#04121a;font:600 15px system-ui">Reload the game</button>';
  const msg = note.querySelector('.msg'), reload = note.querySelector('.reload');
  reload.onclick = () => location.reload();
  const attach = () => { if (!note.isConnected) document.body.appendChild(note); };
  if (document.body) attach(); else addEventListener('DOMContentLoaded', attach);

  const state = { lost: false, restores: 0, giveUpAfter: LOOK.num('gpu-restore-wait', 4) * 1000 };
  let timer = 0;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();            // without this the browser never restores the context
    state.lost = true;
    pause();
    msg.textContent = 'Graphics paused. Restoring…';
    reload.hidden = true;
    note.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!state.lost) return;
      msg.textContent = "The graphics didn't come back by themselves. Reload to keep playing.";
      reload.hidden = false;
    }, state.giveUpAfter);
  });
  canvas.addEventListener('webglcontextrestored', async () => {
    clearTimeout(timer);
    gfx.build();                   // new render targets and passes for the new context
    try { await renderer.compileAsync(scene, camera); } catch {}
    state.lost = false;
    state.restores++;
    note.hidden = true;
    onRestored();
  });
  return state;
}
