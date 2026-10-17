import { Money } from "../core/Money.js";
import { MiniGame } from "./MiniGame.js";

/** Орел чи решка. Шанс 50/50, виграш ×3. */
export class CoinFlipGame extends MiniGame {
  #turns = 0;

  get id() { return "coin"; }
  get emoji() { return "🪙"; }
  get title() { return "Монетка"; }
  get blurb() { return "Орел чи решка, виграш ×1.9"; }

  render() {
    document.querySelector("#main").innerHTML = this.back("games", "← До міні-ігор") + `<div class="panel" style="text-align:center"><h2>Монетка</h2>
      <p class="note">Обери бік. Якщо вгадаєш — ставка повертається з множником ×3.</p>
      ${this.app.bets.html()}
      <div class="coinwrap"><div class="coin" id="coin"><div>🦅</div><div class="bk">🪙</div></div></div>
      <div class="gres" id="coinres"></div>
      <div class="acts">
        <button class="btn" onclick="app.hall.game('coin').flip('heads')">Орел</button>
        <button class="btn ghost" onclick="app.hall.game('coin').flip('tails')">Решка</button>
      </div></div>`;
  }

  flip(side) {
    const app = this.app;
    if (app.session.spinning) return;
    const bet = app.bets.take();
    if (!bet) return;
    app.player.debit(bet);
    app.saveState();
    app.shell.updateBalances();
    app.session.spinning = true;
    this.lock(true);
    const landed = Math.random() < 0.5 ? "heads" : "tails";
    this.#turns += 1;
    const coin = document.querySelector("#coin");
    if (coin) {
      const spins = 4 + this.#turns;
      const angle = landed === "tails" ? spins * 360 + 180 : spins * 360;
      coin.style.transform = "rotateY(" + angle + "deg)";
    }
    setTimeout(() => {
      const win = landed === side;
      const payout = win ? Math.floor(bet * 3) : 0;
      if (payout) app.player.credit(payout);
      app.saveState();
      app.shell.updateBalances();
      app.session.spinning = false;
      const result = document.querySelector("#coinres");
      if (result) {
        result.className = "gres " + (win ? "win" : "lose");
        result.textContent = (landed === "heads" ? "Орел" : "Решка") + (win ? " · +" + Money.format(payout) : " · −" + Money.format(bet));
      }
      app.toast(win ? "+" + Money.format(payout) : "−" + Money.format(bet));
      if (this.playing()) this.lock(false);
    }, 2000);
  }
}
