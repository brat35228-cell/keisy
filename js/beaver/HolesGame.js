import { Html } from "../core/Html.js";
import { Ids } from "../core/Ids.js";
import { Money } from "../core/Money.js";

/** П'ять нірок, скарб лише в одній, виплата ×4. */
export class HolesGame {
  #last = null;
  #locked = false;

  constructor(app) {
    this.app = app;
  }

  render() {
    const last = this.#last
      ? `<div class="holes">${[0, 1, 2, 3, 4].map((index) => {
          const hit = this.#last.pick === index;
          const prize = this.#last.prize === index;
          return `<button class="hole${prize ? " win" : ""}${hit && !prize ? " miss" : ""}" disabled>${prize ? "💎" : hit ? "❌" : "🕳️"}</button>`;
        }).join("")}</div><div class="gres ${this.#last.win ? "win" : "lose"}">${Html.escape(this.#last.msg)}</div>`
      : `<div class="holes">${[0, 1, 2, 3, 4].map((index) => `<button class="hole" ${this.#locked ? "disabled" : ""} onclick="app.beavers.holes.pick(${index})">🕳️</button>`).join("")}</div>`;
    document.querySelector("#main").innerHTML = this.app.beavers.tabs()
      + `<button class="back" onclick="app.go('bgames')">← До міні-ігор бобрів</button>`
      + `<div class="panel" style="text-align:center"><h2>Нірки бобра</h2>
      <p class="note">У одній з п'яти нірок скарб ×4. Інші порожні. Ставка списується перед вибором.</p>
      ${this.#locked || this.#last ? "" : this.app.beaverBets.html()}
      ${last}
      ${this.#last ? `<div class="acts"><button class="btn" onclick="app.beavers.holes.again()">Ще раз</button></div>` : ""}
      </div>`;
  }

  again() {
    if (this.app.session.spinning) return;
    this.#last = null;
    this.#locked = false;
    this.render();
  }

  pick(index) {
    const app = this.app;
    if (app.session.spinning || this.#locked) return;
    const bet = app.beaverBets.take();
    if (!bet) return;
    app.player.debitBeavers(bet);
    app.saveState();
    app.shell.updateBalances();
    app.session.spinning = true;
    this.#locked = true;
    const prize = Ids.int(5);
    const win = index === prize;
    const payout = win ? bet * 4 : 0;
    if (payout) app.player.creditBeavers(payout);
    app.saveState();
    this.#last = {
      pick: index,
      prize,
      win,
      msg: win ? "Скарб ×4 · +" + Money.format(payout) + " бобрів" : "Порожня нірка · −" + Money.format(bet),
    };
    app.session.spinning = false;
    app.shell.updateBalances();
    app.toast(win ? "×4! +" + Money.format(payout) : "Порожньо");
    if (app.session.view === "bgame" && app.session.curId === "holes") this.render();
  }
}
