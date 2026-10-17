import { Money } from "../core/Money.js";
import { MiniGame } from "./MiniGame.js";

/**
 * Червоне / чорне. Європейське колесо: 18 червоних, 18 чорних, 1 зелене.
 * Червоне й чорне платять ×2, зелене — ×14.
 */
export class RouletteGame extends MiniGame {
  static POCKETS = (() => {
    const colors = [];
    for (let index = 0; index < 18; index++) colors.push("r", "b");
    colors.push("g");
    return colors;
  })();

  get id() { return "rb"; }
  get emoji() { return "🎡"; }
  get title() { return "Червоне / Чорне"; }
  get blurb() { return "Рулетка, зелене платить ×14"; }

  render() {
    const history = this.app.player.rouletteHistory.slice(-18);
    document.querySelector("#main").innerHTML = this.back("games", "← До міні-ігор") + `<div class="panel" style="text-align:center"><h2>Червоне / Чорне</h2>
      <p class="note">18 червоних, 18 чорних і одне зелене. Червоне чи чорне повертає ×2, зелене — ×14.</p>
      ${this.app.bets.html()}
      <div class="vp" id="rbvp"><div class="track" id="rbtrack">${RouletteGame.POCKETS.concat(RouletteGame.POCKETS).map((color) => `<div class="rt ${color}">${color === "g" ? "0" : ""}</div>`).join("")}</div></div>
      <div class="hist">${history.map((color) => `<i class="${color}"></i>`).join("")}</div>
      <div class="gres" id="rbres"></div>
      <div class="acts">
        <button class="btn" onclick="app.hall.game('rb').spin('r')">Червоне</button>
        <button class="btn ghost" onclick="app.hall.game('rb').spin('b')">Чорне</button>
        <button class="btn ghost" onclick="app.hall.game('rb').spin('g')">Зелене ×14</button>
      </div></div>`;
  }

  spin(pick) {
    const app = this.app;
    if (app.session.spinning) return;
    const bet = app.bets.take();
    if (!bet) return;
    app.player.debit(bet);
    app.saveState();
    app.shell.updateBalances();
    app.session.spinning = true;
    this.lock(true);
    const pockets = RouletteGame.POCKETS;
    const index = Math.floor(Math.random() * pockets.length);
    const color = pockets[index];
    const track = document.querySelector("#rbtrack");
    const viewport = document.querySelector("#rbvp");
    if (track && viewport) {
      const strip = [];
      for (let step = 0; step < 42; step++) strip.push(pockets[(index + step) % pockets.length]);
      strip[30] = color;
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      track.innerHTML = strip.map((tone) => `<div class="rt ${tone}">${tone === "g" ? "0" : ""}</div>`).join("");
      void track.offsetWidth;
      const tile = track.firstElementChild.offsetWidth + 8;
      const target = 30 * tile + tile / 2 - viewport.clientWidth / 2;
      track.style.transition = "transform 3.2s cubic-bezier(.12,.7,.1,1)";
      track.style.transform = `translateX(${-target}px)`;
    }
    setTimeout(() => {
      const win = color === pick;
      const multiplier = color === "g" ? 14 : 2;
      const payout = win ? bet * multiplier : 0;
      if (payout) app.player.credit(payout);
      const history = app.player.rouletteHistory;
      history.push(color);
      if (history.length > 24) history.splice(0, history.length - 24);
      app.saveState();
      app.shell.updateBalances();
      app.session.spinning = false;
      const result = document.querySelector("#rbres");
      if (result) {
        result.className = "gres " + (win ? "win" : "lose");
        const name = color === "r" ? "Червоне" : color === "b" ? "Чорне" : "Зелене";
        result.textContent = win ? name + " · +" + Money.format(payout) : name + " · −" + Money.format(bet);
      }
      app.toast(win ? "+" + Money.format(payout) : "−" + Money.format(bet));
      if (this.playing()) this.lock(false);
    }, 3400);
  }
}
