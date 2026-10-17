import { Money } from "../core/Money.js";
import { MiniGame } from "./MiniGame.js";

/** Поле 5×5. Відкривай безпечні клітинки й забирай виграш, поки не натрапиш на міну. */
export class MinesGame extends MiniGame {
  static SIZE = 25;
  static OPTIONS = [3, 5, 8, 12];

  get id() { return "mines"; }
  get emoji() { return "💣"; }
  get title() { return "Міни"; }
  get blurb() { return "Відкривай клітинки й не підірвись"; }

  #fair(mines, revealed) {
    let chance = 1;
    for (let step = 0; step < revealed; step++) {
      chance *= (MinesGame.SIZE - mines - step) / (MinesGame.SIZE - step);
    }
    if (chance <= 0) return 1;
    return Math.floor((1 / chance) * 0.97 * 100) / 100;
  }

  render() {
    const round = this.app.player.mines;
    const board = round
      ? this.#board(round)
      : `<p class="note">Обери, скільки мін заховати, постав ставку й відкривай клітинки. Множник росте з кожною безпечною.</p>
        ${this.app.bets.html()}
        <div class="qty"><span class="lb">Мін:</span>${MinesGame.OPTIONS.map((count) => `<button class="${(this.#picked() === count) ? "on" : ""}" onclick="app.hall.game('mines').arm(${count})">${count}</button>`).join("")}</div>
        <div class="acts"><button class="btn" onclick="app.hall.game('mines').start()">Почати</button></div>`;
    document.querySelector("#main").innerHTML = this.back("games", "← До міні-ігор") + `<div class="panel" style="text-align:center"><h2>Міни</h2>${board}<div class="gres" id="mnres"></div></div>`;
  }

  #picked() {
    return this._mines || 5;
  }

  arm(count) {
    if (this.app.player.mines) return;
    this._mines = count;
    this.render();
  }

  #board(round) {
    const multiplier = this.#fair(round.mines, round.revealed.length);
    const next = this.#fair(round.mines, round.revealed.length + 1);
    const cells = Array.from({ length: MinesGame.SIZE }, (_, index) => {
      const open = round.revealed.includes(index);
      const bomb = round.over && round.bombs.includes(index);
      const cls = open ? " ok" : bomb ? " bomb" : round.over ? " dim" : "";
      const glyph = open ? "💎" : bomb ? "💣" : "";
      return `<button class="mc${cls}" ${round.over || open ? "disabled" : ""} onclick="app.hall.game('mines').openCell(${index})">${glyph}</button>`;
    }).join("");
    const cash = Math.floor(round.bet * multiplier);
    return `<p class="note">Мін: ${round.mines}. Зараз ×${String(multiplier).replace(".", ",")} · наступна ×${String(next).replace(".", ",")}</p>
      <div class="mg">${cells}</div>
      ${round.over ? "" : `<div class="acts"><button class="btn" ${round.revealed.length ? "" : "disabled"} onclick="app.hall.game('mines').cashout()">Забрати ${Money.format(cash)}</button></div>`}`;
  }

  start() {
    const app = this.app;
    if (app.player.mines || app.session.spinning) return;
    const bet = app.bets.take();
    if (!bet) return;
    const mines = this.#picked();
    const bombs = new Set();
    while (bombs.size < mines) bombs.add(Math.floor(Math.random() * MinesGame.SIZE));
    app.player.debit(bet);
    app.player.mines = { bet, mines, revealed: [], bombs: [...bombs], over: false };
    app.saveState();
    app.shell.updateBalances();
    this.render();
  }

  openCell(index) {
    const round = this.app.player.mines;
    if (!round || round.over || round.revealed.includes(index)) return;
    if (round.bombs.includes(index)) {
      round.over = true;
      this.app.player.mines = null;
      this.app.saveState();
      this.app.toast("Міна · −" + Money.format(round.bet));
      const host = document.querySelector("#main .panel");
      if (host) {
        round.over = true;
        this.app.player.mines = round;
        this.render();
        const result = document.querySelector("#mnres");
        if (result) { result.className = "gres lose"; result.textContent = "Вибух · −" + Money.format(round.bet); }
        this.app.player.mines = null;
        this.app.saveState();
      }
      return;
    }
    round.revealed.push(index);
    const safe = MinesGame.SIZE - round.mines;
    if (round.revealed.length >= safe) {
      const multiplier = this.#fair(round.mines, round.revealed.length);
      const payout = Math.floor(round.bet * multiplier);
      this.app.player.credit(payout);
      this.app.player.mines = null;
      this.app.saveState();
      this.app.shell.updateBalances();
      this.app.toast("Поле чисте · +" + Money.format(payout));
      this.render();
      return;
    }
    this.app.saveState();
    this.render();
  }

  cashout() {
    const round = this.app.player.mines;
    if (!round || !round.revealed.length) return;
    const multiplier = this.#fair(round.mines, round.revealed.length);
    const payout = Math.floor(round.bet * multiplier);
    this.app.player.credit(payout);
    this.app.player.mines = null;
    this.app.saveState();
    this.app.shell.updateBalances();
    this.app.toast("+" + Money.format(payout));
    this.render();
  }
}
