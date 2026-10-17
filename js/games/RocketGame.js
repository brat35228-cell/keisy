import { Money } from "../core/Money.js";
import { MiniGame } from "./MiniGame.js";

/** Ракета росте до ×15. Забери виграш до вибуху. */
export class RocketGame extends MiniGame {
  #frame = 0;
  #running = false;

  get id() { return "rocket"; }
  get emoji() { return "🚀"; }
  get title() { return "Ракета"; }
  get blurb() { return "Злітає вгору, забери виграш до вибуху, до ×15"; }

  render() {
    document.querySelector("#main").innerHTML = this.back("games", "← До міні-ігор") + `<div class="panel" style="text-align:center"><h2>Ракета</h2>
      <p class="note">Множник росте сам. Натисни «Забрати», поки ракета не вибухнула. Стеля — ×15.</p>
      ${this.app.bets.html()}
      <div class="x5box"><div class="big" id="rkmul">×1,00</div><div class="note" id="rknote">очікує старту</div></div>
      <div class="gauge"><div class="win" id="rkbar" style="width:0"></div></div>
      <div class="gres" id="rkres"></div>
      <div class="acts"><button class="btn" id="rkgo" onclick="app.hall.game('rocket').launch()">Запустити</button></div></div>`;
  }

  /** Краш із тяжким хвостом: частіше рано, рідко біля стелі. Математичне сподівання нижче ставки. */
  #crashAt() {
    const roll = Math.random();
    const point = 0.96 / (1 - roll * 0.96);
    return Math.max(1.01, Math.min(15, Math.round(point * 100) / 100));
  }

  launch() {
    const app = this.app;
    if (app.session.spinning || this.#running) return;
    const bet = app.bets.take();
    if (!bet) return;
    const crash = this.#crashAt();
    app.player.debit(bet);
    app.saveState();
    app.shell.updateBalances();
    app.session.spinning = true;
    this.#running = true;
    let current = 1;
    const button = document.querySelector("#rkgo");
    if (button) {
      button.textContent = "Забрати";
      button.onclick = () => this.cash(bet, current);
    }
    let last = performance.now();
    const step = (now) => {
      if (!this.#running) return;
      if (!this.playing()) { this.#running = false; app.session.spinning = false; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      current = Math.min(15, current * Math.exp(dt * 0.55));
      const label = document.querySelector("#rkmul");
      const bar = document.querySelector("#rkbar");
      const note = document.querySelector("#rknote");
      if (label) label.textContent = "×" + current.toFixed(2).replace(".", ",");
      if (bar) bar.style.width = Math.min(100, ((current - 1) / 14) * 100) + "%";
      if (note) note.textContent = "у польоті";
      if (current >= crash) { this.#finish(false, bet, crash); return; }
      this.#frame = requestAnimationFrame(step);
    };
    const cash = () => this.cash(bet, current);
    if (button) button.onclick = cash;
    this.#frame = requestAnimationFrame(step);
  }

  cash(bet, current) {
    if (!this.#running) return;
    const payout = Math.floor(bet * current);
    this.#finish(true, bet, current, payout);
  }

  #finish(won, bet, multiplier, payout) {
    cancelAnimationFrame(this.#frame);
    this.#running = false;
    this.app.session.spinning = false;
    if (won) this.app.player.credit(payout);
    this.app.saveState();
    this.app.shell.updateBalances();
    const result = document.querySelector("#rkres");
    const text = won
      ? "×" + multiplier.toFixed(2).replace(".", ",") + " · +" + Money.format(payout)
      : "Вибух на ×" + multiplier.toFixed(2).replace(".", ",") + " · −" + Money.format(bet);
    if (result) { result.className = "gres " + (won ? "win" : "lose"); result.textContent = text; }
    const note = document.querySelector("#rknote");
    if (note) note.textContent = won ? "забрано" : "вибух";
    this.app.toast(won ? "+" + Money.format(payout) : "−" + Money.format(bet));
    const button = document.querySelector("#rkgo");
    if (button) { button.textContent = "Запустити"; button.onclick = () => this.launch(); }
  }
}
