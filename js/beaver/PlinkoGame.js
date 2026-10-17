import { Html } from "../core/Html.js";
import { Money } from "../core/Money.js";
import { RarityTable } from "../models/RarityTable.js";

/**
 * Плінко на canvas: ставиш річ, кулька падає між кілочками в слот з множником.
 * Приз — річ, вартість якої найближча до «вартість ставки × множник».
 */
export class PlinkoGame {
  static MULTIPLIERS = [12, 5, 2, 1.2, 0.7, 0.4, 0.7, 1.2, 2, 5, 12];
  static ROWS = 10;

  #ctx = null;
  #geo = null;
  #colors = null;
  #emoji = "";
  #hot = -1;
  #flash = new Map();
  #raf = 0;

  constructor(app) {
    this.app = app;
  }

  static label(multiplier) {
    return "×" + String(multiplier).replace(".", ",");
  }

  static slotColor(multiplier) {
    if (multiplier >= 5) return "#ffd24a";
    if (multiplier >= 2) return "#42dfb3";
    if (multiplier >= 1) return "#4a9eff";
    return "#ff6b6b";
  }

  render() {
    const app = this.app;
    app.beavers.stake.begin("plinko", { max: 1, onChange: () => this.#picked() });
    document.querySelector("#main").innerHTML = app.beavers.tabs()
      + `<button class="back" onclick="app.go('bgames')">← До міні-ігор</button>`
      + `<div class="panel" style="text-align:center"><h2>Плінко</h2>
      <p class="note">Постав річ — кулька впаде між кілочками. Крайні слоти додають вартості, середні — забирають. Приз іде в інвентар.</p>
      ${app.beavers.stake.html()}
      <div class="pkwrap"><canvas id="pkcv"></canvas></div>
      <div class="gres" id="pkres"></div>
      <div class="acts"><button class="btn" id="pkgo" onclick="app.beavers.plinko.drop()">Кинути кульку</button></div></div>`;
    this.#hot = -1;
    this.#flash.clear();
    this.#setup();
    this.#picked();
  }

  #picked() {
    const item = this.app.beavers.stake.selected()[0];
    this.#emoji = item ? item.e : "";
    this.#draw(null);
  }

  #setup() {
    const canvas = document.querySelector("#pkcv");
    if (!canvas) return;
    const rows = PlinkoGame.ROWS;
    const width = Math.max(260, Math.min(460, canvas.parentElement.clientWidth || 360));
    const rowH = width * 0.058;
    const top = 40;
    const slotH = Math.max(30, width * 0.075);
    const slotTop = top + (rows - 1) * rowH + rowH * 0.95;
    const height = Math.round(slotTop + slotH + 10);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    this.#ctx = canvas.getContext("2d");
    this.#ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const margin = 12;
    this.#geo = {
      width, height, rowH, top, slotH, slotTop,
      dx: (width - margin * 2) / (rows + 1),
      cx: width / 2,
      pegR: Math.max(3, width * 0.0105),
      ballR: Math.max(8, width * 0.024),
    };
    const style = getComputedStyle(document.documentElement);
    const css = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    this.#colors = { bg: css("--panel2", "#252f40"), tape: css("--tape", "#ffd24a") };
  }

  #pegX(row, index) {
    return this.#geo.cx + (index - row / 2) * this.#geo.dx;
  }

  #pegY(row) {
    return this.#geo.top + row * this.#geo.rowH;
  }

  #slotX(slot) {
    return this.#geo.cx + (slot - PlinkoGame.ROWS / 2) * this.#geo.dx;
  }

  #draw(ball) {
    const ctx = this.#ctx;
    const geo = this.#geo;
    const colors = this.#colors;
    if (!ctx || !geo || !document.querySelector("#pkcv")) return;
    const now = performance.now();
    ctx.clearRect(0, 0, geo.width, geo.height);
    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, geo.width, geo.height, 16);
    ctx.fill();

    for (let row = 0; row < PlinkoGame.ROWS; row++) {
      for (let index = 0; index <= row; index++) {
        const hit = this.#flash.get(row + "-" + index);
        const power = hit ? Math.max(0, 1 - (now - hit) / 280) : 0;
        ctx.beginPath();
        ctx.arc(this.#pegX(row, index), this.#pegY(row), geo.pegR * (1 + power * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = power > 0 ? "#fff6c9" : "#b58a3a";
        ctx.shadowColor = power > 0 ? colors.tape : "transparent";
        ctx.shadowBlur = power > 0 ? 12 : 0;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    const fontSize = Math.max(10, geo.dx * 0.3);
    PlinkoGame.MULTIPLIERS.forEach((multiplier, slot) => {
      const hot = slot === this.#hot;
      const w = geo.dx - 4;
      const x = this.#slotX(slot) - w / 2;
      const y = geo.slotTop - (hot ? 5 : 0);
      ctx.globalAlpha = hot ? 1 : 0.82;
      ctx.fillStyle = PlinkoGame.slotColor(multiplier);
      ctx.shadowColor = hot ? PlinkoGame.slotColor(multiplier) : "transparent";
      ctx.shadowBlur = hot ? 16 : 0;
      ctx.beginPath();
      ctx.roundRect(x, y, w, geo.slotH, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#1a1500";
      ctx.font = `700 ${fontSize}px Onest, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(PlinkoGame.label(multiplier), x + w / 2, y + geo.slotH / 2);
    });

    const spot = ball || { x: geo.cx, y: geo.top - geo.rowH * 1.1 };
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, geo.ballR, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(spot.x - geo.ballR * 0.3, spot.y - geo.ballR * 0.3, 1, spot.x, spot.y, geo.ballR);
    glow.addColorStop(0, "#fff0a8");
    glow.addColorStop(1, "#e0a413");
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#9a6a00";
    ctx.stroke();
    if (this.#emoji) {
      ctx.font = Math.round(geo.ballR * 1.45) + "px sans-serif";
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.#emoji, spot.x, spot.y + 1);
    }
  }

  /** Відрізки польоту: падіння на перший кілочок, стрибки між рядами, падіння в слот. */
  #timeline(path, slot) {
    const geo = this.#geo;
    const rest = geo.pegR + geo.ballR;
    const points = [{ x: geo.cx, y: geo.top - geo.rowH * 1.1 }];
    const pegs = [];
    let index = 0;
    for (let row = 0; row < PlinkoGame.ROWS; row++) {
      points.push({ x: this.#pegX(row, index), y: this.#pegY(row) - rest });
      pegs.push(row + "-" + index);
      if (path[row]) index += 1;
    }
    points.push({ x: this.#slotX(slot), y: geo.slotTop + geo.slotH * 0.45 });
    const last = points.length - 2;
    return points.slice(1).map((to, i) => ({
      from: points[i],
      to,
      dur: i === 0 ? 280 : i === last ? 260 : 200,
      type: i === 0 || i === last ? "fall" : "hop",
      peg: pegs[i] || null,
    }));
  }

  drop() {
    const app = this.app;
    if (app.session.spinning) return;
    const item = app.beavers.stake.selected()[0];
    if (!item) return app.toast("Обери річ для ставки");

    const path = Array.from({ length: PlinkoGame.ROWS }, () => Math.random() < 0.5);
    const slot = path.filter(Boolean).length;
    const multiplier = PlinkoGame.MULTIPLIERS[slot];
    const prize = app.beavers.prizes.nearest(Math.floor(item.v * multiplier));
    app.beavers.stake.take();
    app.player.unshiftBeavers([prize]);
    app.saveState();
    app.beavers.updateInvLabel();
    app.beavers.stake.refresh();

    app.session.spinning = true;
    this.#hot = -1;
    this.#flash.clear();
    this.#emoji = item.e;
    const button = document.querySelector("#pkgo");
    if (button) button.disabled = true;
    const result = document.querySelector("#pkres");
    if (result) { result.className = "gres"; result.innerHTML = ""; }

    const segments = this.#timeline(path, slot);
    const total = segments.reduce((sum, segment) => sum + segment.dur, 0);
    const hop = this.#geo.rowH * 0.55;
    const started = performance.now();
    const seen = new Set();

    const frame = (now) => {
      if (!document.querySelector("#pkcv")) { app.session.spinning = false; return; }
      const elapsed = Math.min(now - started, total);
      let left = elapsed;
      let position = segments[segments.length - 1].to;
      let passed = 0;
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (left > segment.dur && i < segments.length - 1) { left -= segment.dur; passed = i + 1; continue; }
        const t = Math.min(left / segment.dur, 1);
        const x = segment.from.x + (segment.to.x - segment.from.x) * t;
        const y = segment.type === "fall"
          ? segment.from.y + (segment.to.y - segment.from.y) * t * t
          : segment.from.y + (segment.to.y - segment.from.y) * t - Math.sin(Math.PI * t) * hop;
        position = { x, y };
        if (t >= 1) passed = i + 1;
        break;
      }
      for (let i = 0; i < passed; i++) {
        const key = segments[i].peg;
        if (key && !seen.has(key)) { seen.add(key); this.#flash.set(key, now); }
      }
      this.#draw(position);
      if (elapsed < total) { this.#raf = requestAnimationFrame(frame); return; }
      this.#land(item, prize, slot, multiplier);
    };
    this.#raf = requestAnimationFrame(frame);
  }

  #land(item, prize, slot, multiplier) {
    const app = this.app;
    this.#hot = slot;
    this.#draw({ x: this.#slotX(slot), y: this.#geo.slotTop + this.#geo.slotH * 0.45 });
    app.session.spinning = false;
    const better = prize.v >= item.v;
    const result = document.querySelector("#pkres");
    if (result) {
      result.className = "gres " + (better ? "win" : "lose");
      result.innerHTML = `${PlinkoGame.label(multiplier)} · ${Html.escape(item.n)} → ${Html.escape(prize.n)}`
        + `<div class="resgrid" style="max-width:150px;margin:10px auto 0"><div class="rcard" style="--c:${app.beaverRarity.color(prize.r)}"><div class="em">${Html.escape(prize.e)}</div><b>${Html.escape(prize.n)}</b><span>${RarityTable.NAMES[prize.r]} · ${Money.format(prize.v)}</span></div></div>`;
    }
    const button = document.querySelector("#pkgo");
    if (button) button.disabled = false;
    app.toast("Плінко " + PlinkoGame.label(multiplier) + ": " + prize.n);
  }
}
