import { Html } from "../core/Html.js";
import { Money } from "../core/Money.js";

/** 10% шанс помножити ставку на 5, інакше нічого. */
export class TimesFiveGame {
  #last = null;

  constructor(app) {
    this.app = app;
  }

  render() {
    const last = this.#last
      ? `<div class="x5box" style="border-color:${this.#last.win ? "var(--good)" : "var(--bad)"}"><div class="big">${this.#last.win ? "×5" : "0"}</div><div class="gres ${this.#last.win ? "win" : "lose"}">${Html.escape(this.#last.msg)}</div></div>`
      : `<div class="x5box"><div class="big">?</div><div class="note">10% шанс помножити ставку на 5, 90% — нічого</div></div>`;
    document.querySelector("#main").innerHTML = this.app.beavers.tabs()
      + `<button class="back" onclick="app.go('bgames')">← До міні-ігор бобрів</button>`
      + `<div class="panel" style="text-align:center"><h2>Кейс ×5</h2>
      <p class="note">Ставка списується одразу. У 1 з 10 спроб повертається ×5 бобр-коінів.</p>
      ${this.app.beaverBets.html()}${last}
      <div class="acts"><button class="btn" id="x5go" onclick="app.beavers.timesFive.open()">Відкрити</button></div></div>`;
  }

  open() {
    const app = this.app;
    if (app.session.spinning) return;
    const bet = app.beaverBets.take();
    if (!bet) return;
    app.player.debitBeavers(bet);
    app.saveState();
    app.shell.updateBalances();
    app.session.spinning = true;
    const button = document.querySelector("#x5go");
    if (button) button.disabled = true;
    setTimeout(() => {
      const win = Math.random() < 0.1;
      const payout = win ? bet * 5 : 0;
      if (payout) app.player.creditBeavers(payout);
      app.saveState();
      app.shell.updateBalances();
      this.#last = { win, msg: win ? "×5 · +" + Money.format(payout) + " бобрів" : "Порожньо · −" + Money.format(bet) };
      app.session.spinning = false;
      app.toast(win ? "×5! +" + Money.format(payout) : "Нічого");
      if (app.session.view === "bgame" && app.session.curId === "x5") this.render();
    }, 700);
  }
}
