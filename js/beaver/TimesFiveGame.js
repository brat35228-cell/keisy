import { Html } from "../core/Html.js";
import { Money } from "../core/Money.js";
import { RarityTable } from "../models/RarityTable.js";

/** Ставиш речі: з шансом 10% кожна повертається в п'яти копіях, інакше речі зникають. */
export class TimesFiveGame {
  static CHANCE = 0.1;
  static TIMES = 5;
  static MAX = 10;

  constructor(app) {
    this.app = app;
  }

  #tile(win) {
    const color = win ? "var(--r4)" : "var(--r0)";
    return `<div class="tile" style="--c:${color}"><div class="em">${win ? "💎" : "⬛"}</div><div class="tn">${win ? "×5" : "Порожньо"}</div></div>`;
  }

  #strip(length, winAt, win) {
    return Array.from({ length }, (_, index) => this.#tile(index === winAt ? win : Math.random() < TimesFiveGame.CHANCE)).join("");
  }

  render() {
    const app = this.app;
    app.beavers.stake.begin("x5", { max: TimesFiveGame.MAX, onChange: () => this.#info() });
    document.querySelector("#main").innerHTML = app.beavers.tabs()
      + `<button class="back" onclick="app.go('bgames')">← До міні-ігор</button>`
      + `<div class="panel" style="text-align:center"><h2>Кейс ×5</h2>
      <p class="note">Постав до ${TimesFiveGame.MAX} речей. У 1 з 10 спроб кейс відкриється й кожна річ повернеться п'ятьма копіями. В інших 9 з 10 — речі зникають.</p>
      ${app.beavers.stake.html()}
      <div class="note" id="x5info"></div></div>
      <div class="reels" id="x5reels"><div class="vp"><div class="track" id="x5track">${this.#strip(14, -1, false)}</div></div></div>
      <div class="panel res" id="x5res"></div>
      <div class="acts" style="margin-top:0"><button class="btn" id="x5go" onclick="app.beavers.timesFive.open()">Відкрити</button></div>`;
    this.#info();
  }

  #info() {
    const node = document.querySelector("#x5info");
    if (!node) return;
    const picked = this.app.beavers.stake.selected();
    if (!picked.length) { node.textContent = "Обери речі, щоб зробити ставку."; return; }
    const sum = this.app.beavers.stake.total();
    node.textContent = `Ставка: ${picked.length} шт. на ${Money.format(sum)} бобрів. У разі успіху повернеться ${picked.length * TimesFiveGame.TIMES} шт. на ${Money.format(sum * TimesFiveGame.TIMES)}.`;
  }

  open() {
    const app = this.app;
    if (app.session.spinning) return;
    const items = app.beavers.stake.selected();
    if (!items.length) return app.toast("Обери речі для ставки");

    const win = Math.random() < TimesFiveGame.CHANCE;
    app.beavers.stake.take();
    const got = [];
    if (win) items.forEach((item) => { for (let copy = 0; copy < TimesFiveGame.TIMES; copy++) got.push(app.beavers.prizes.copy(item)); });
    if (got.length) app.player.unshiftBeavers(got);
    app.saveState();
    app.beavers.updateInvLabel();
    app.beavers.stake.refresh();
    this.#info();

    app.session.spinning = true;
    const button = document.querySelector("#x5go");
    if (button) button.disabled = true;
    document.querySelector("#x5res")?.classList.remove("show");

    const winIndex = 40;
    const track = document.querySelector("#x5track");
    const viewport = document.querySelector("#x5reels .vp").clientWidth;
    track.style.transition = "none";
    track.style.transform = "translateX(0)";
    track.innerHTML = this.#strip(50, winIndex, win);
    void document.body.offsetWidth;
    const tile = track.firstElementChild.offsetWidth;
    const target = winIndex * (tile + 8) + tile / 2 - viewport / 2 + (Math.random() - 0.5) * tile * 0.5;
    track.style.transition = "transform 4.8s cubic-bezier(.12,.6,.1,1)";
    track.style.transform = `translateX(${-target}px)`;

    setTimeout(() => {
      app.session.spinning = false;
      const result = document.querySelector("#x5res");
      if (!result) return;
      this.#show(result, items, win);
      const again = document.querySelector("#x5go");
      if (again) again.disabled = false;
      app.toast(win ? "×5! Речі в інвентарі" : "Порожньо");
    }, 5000);
  }

  #show(result, items, win) {
    const app = this.app;
    if (win) {
      result.style.setProperty("--c", "var(--r4)");
      result.innerHTML = `<div class="big">💎</div><h2 style="margin:6px 0 2px">×5!</h2><div class="note">Кожна річ повернулась ${TimesFiveGame.TIMES} копіями — усе вже в інвентарі.</div>
        <div class="resgrid">${items.map((item) => `<div class="rcard" style="--c:${app.beaverRarity.color(item.r)}"><div class="em">${Html.escape(item.e)}</div><b>${Html.escape(item.n)}</b><span>${RarityTable.NAMES[item.r]} · ×${TimesFiveGame.TIMES}</span></div>`).join("")}</div>`;
    } else {
      result.style.setProperty("--c", "var(--bad)");
      result.innerHTML = `<div class="big">⬛</div><h2 style="margin:6px 0 2px">Порожньо</h2><div class="note">Речей втрачено: ${items.length}. Спробуй ще раз.</div>
        <div class="resgrid">${items.map((item) => `<div class="rcard sold" style="--c:${app.beaverRarity.color(item.r)}"><div class="em">${Html.escape(item.e)}</div><b>${Html.escape(item.n)}</b><span>${RarityTable.NAMES[item.r]}</span></div>`).join("")}</div>`;
    }
    result.classList.add("show");
  }
}
