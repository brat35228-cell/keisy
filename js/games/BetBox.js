/** Поле ставки, спільне для міні-ігор однієї валюти. */
export class BetBox {
  #app;
  #sessionKey;
  #storeKey;
  #inputId;
  #balance;
  #noun;

  constructor(app, { sessionKey, storeKey, fallback, inputId, balance, noun }) {
    this.#app = app;
    this.#sessionKey = sessionKey;
    this.#storeKey = storeKey;
    this.#inputId = inputId;
    this.#balance = balance;
    this.#noun = noun;
    const stored = Number(app.store.get(storeKey));
    app.session[sessionKey] = Math.max(1, Math.floor(stored || fallback));
  }

  html() {
    const value = this.#app.session[this.#sessionKey];
    const who = this.#sessionKey === "bet" ? "bets" : "beaverBets";
    return `<div class="qty"><span class="lb">Ставка:</span><input id="${this.#inputId}" type="number" inputmode="numeric" min="1" value="${value}" style="width:130px"><button onclick="app.${who}.set(0.5)">½</button><button onclick="app.${who}.set(2)">×2</button><button onclick="app.${who}.set(0)">Все</button></div>`;
  }

  set(factor) {
    const input = document.querySelector("#" + this.#inputId);
    if (!input) return;
    const purse = this.#balance();
    let amount = Math.floor(Number(input.value) || this.#app.session[this.#sessionKey]);
    amount = factor === 0 ? purse : Math.floor(amount * factor);
    amount = Math.min(Math.max(amount, 1), Math.max(purse, 1));
    input.value = amount;
  }

  /** Списує ставку. 0 — ставку не прийнято. */
  take() {
    const input = document.querySelector("#" + this.#inputId);
    const amount = Math.floor(Number(input && input.value));
    if (!(amount >= 1)) {
      this.#app.toast("Введи ставку від 1 " + this.#noun);
      return 0;
    }
    if (amount > this.#balance()) {
      this.#app.toast("Не вистачає " + (this.#sessionKey === "bet" ? "монет" : "бобр-коінів"));
      return 0;
    }
    this.#app.session[this.#sessionKey] = amount;
    this.#app.store.set(this.#storeKey, amount);
    return amount;
  }
}
