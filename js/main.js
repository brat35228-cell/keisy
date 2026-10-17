import { GameApp } from "./app/GameApp.js";

const SHELL = `<div class="wrap">
  <header>
    <h1>Кейси речей</h1>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="net" id="net">Офлайн</span><div class="bal" id="rbbadge" style="display:none">Ребірт <b id="rbn">0</b></div><div class="bal" id="bbwrap" style="display:none">Бобр-коіни <b id="bbal">0</b></div><div class="bal">Монети <b id="bal">0</b></div></div>
  </header>
  <nav id="nav"></nav>
  <main id="main"></main>
</div>
<div class="toast" id="toast"></div>`;

let booting = null;

export function mount(root) {
  if (!root) return;
  if (!root.querySelector("#main")) root.innerHTML = SHELL;
  if (globalThis.app) {
    globalThis.app.render();
    return;
  }
  if (!booting) {
    booting = true;
    const app = new GameApp();
    globalThis.app = app;
    app.start();
    app.connect();
  }
}

globalThis.mountKeisy = mount;

const host = document.getElementById("keisy-mount");
if (host) mount(host);
