import { Money } from "../core/Money.js";

/** Кулька падає між кілочками в кошик з множником. */
export class PlinkoGame {
  static MULTIPLIERS = [6, 2.5, 1.2, 0.6, 0.4, 0.6, 1.2, 2.5, 6];
  static ROWS = 8;

  constructor(app) {
    this.app = app;
  }

  #board() {
    let html = '<div class="pball" id="pball"></div>';
    for (let row = 0; row < PlinkoGame.ROWS; row++) {
      html += '<div class="pkrow">';
      for (let peg = 0; peg < row + 3; peg++) html += '<i class="peg"></i>';
      html += "</div>";
    }
    return html;
  }

  render() {
    const app = this.app;
    document.querySelector("#main").innerHTML = app.beavers.tabs()
      + `<button class="back" onclick="app.go('bgames')">← До міні-ігор бобрів</button>`
      + `<div class="panel" style="text-align:center"><h2>Плінко</h2>
      <p class="note">Кулька падає між кілочками. Крайні кошики платять більше, середні — менше.</p>
      ${app.beaverBets.html()}
      <div class="pk" id="pkboard">${this.#board()}</div>
      <div class="pkslots">${PlinkoGame.MULTIPLIERS.map((multiplier, index) => `<span id="pks${index}">×${String(multiplier).replace(".", ",")}</span>`).join("")}</div>
      <div class="gres" id="pkres"></div>
      <div class="acts"><button class="btn" id="pkgo" onclick="app.beavers.plinko.drop()">Кинути кульку</button></div></div>`;
  }

  drop() {
    const app = this.app;
    if (app.session.spinning) return;
    const bet = app.beaverBets.take();
    if (!bet) return;
    app.player.debitBeavers(bet);
    app.saveState();
    app.shell.updateBalances();
    app.session.spinning = true;
    const button = document.querySelector("#pkgo");
    if (button) button.disabled = true;
    document.querySelectorAll(".pkslots span").forEach((slot) => slot.classList.remove("on"));
    const path = [];
    let slot = 0;
    for (let row = 0; row < PlinkoGame.ROWS; row++) {
      const right = Math.random() < 0.5;
      path.push(right);
      if (right) slot += 1;
    }
    const ball = document.querySelector("#pball");
    const board = document.querySelector("#pkboard");
    let step = 0;
    const tick = () => {
      if (!(app.session.view === "bgame" && app.session.curId === "plinko")) {
        app.session.spinning = false;
        return;
      }
      const width = board.clientWidth;
      const height = board.clientHeight;
      const x = width / 2 + path.slice(0, step).reduce((sum, right) => sum + (right ? 1 : -1), 0) * 14;
      const y = 12 + step * ((height - 40) / PlinkoGame.ROWS);
      if (ball) { ball.style.left = x + "px"; ball.style.top = y + "px"; }
      step += 1;
      if (step <= PlinkoGame.ROWS) { setTimeout(tick, 140); return; }
      const multiplier = PlinkoGame.MULTIPLIERS[slot];
      const payout = Math.floor(bet * multiplier);
      app.player.creditBeavers(payout);
      app.saveState();
      app.shell.updateBalances();
      document.querySelector("#pks" + slot)?.classList.add("on");
      const result = document.querySelector("#pkres");
      if (result) {
        result.className = "gres " + (payout >= bet ? "win" : "lose");
        result.textContent = "×" + String(multiplier).replace(".", ",") + (payout >= bet ? " · +" + Money.format(payout) + " бобрів" : " · −" + Money.format(bet - payout) + " бобрів");
      }
      app.session.spinning = false;
      if (button) button.disabled = false;
      app.toast(payout >= bet ? "+" + Money.format(payout) : "−" + Money.format(bet - payout));
    };
    tick();
  }
}
