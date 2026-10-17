import { Html } from "../core/Html.js";
import { Money } from "../core/Money.js";
import { RarityTable } from "../models/RarityTable.js";

/** Вибір речей з інвентаря для ставки в міні-іграх «Кейси 2». */
export class ItemStake {
  static LIMIT = 150;

  #game = null;
  #uids = [];
  #max = 1;
  #onChange = null;

  constructor(app) {
    this.app = app;
  }

  /** Гра оголошує себе й ліміт речей. При зміні гри вибір скидається. */
  begin(game, { max, onChange }) {
    if (this.#game !== game) this.#uids = [];
    this.#game = game;
    this.#max = max;
    this.#onChange = onChange || null;
    this.#prune();
  }

  #prune() {
    const owned = new Set(this.app.player.beaverInventory.map((item) => item.uid));
    this.#uids = this.#uids.filter((uid) => owned.has(uid));
  }

  selected() {
    this.#prune();
    const byUid = new Map(this.app.player.beaverInventory.map((item) => [item.uid, item]));
    return this.#uids.map((uid) => byUid.get(uid));
  }

  total() {
    return this.selected().reduce((sum, item) => sum + item.v, 0);
  }

  pick(uid) {
    if (this.app.session.spinning) return;
    const at = this.#uids.indexOf(uid);
    if (at >= 0) this.#uids.splice(at, 1);
    else if (this.#max === 1) this.#uids = [uid];
    else if (this.#uids.length >= this.#max) return this.app.toast("Максимум речей: " + this.#max);
    else this.#uids.push(uid);
    this.refresh();
    if (this.#onChange) this.#onChange();
  }

  clear() {
    if (this.app.session.spinning) return;
    this.#uids = [];
    this.refresh();
    if (this.#onChange) this.#onChange();
  }

  /** Забирає вибрані речі з інвентаря й повертає їх. Ставку списано. */
  take() {
    const items = this.selected();
    items.forEach((item) => this.app.player.takeBeaver(item.uid));
    this.#uids = [];
    return items;
  }

  refresh() {
    const box = document.querySelector("#stakebox");
    if (!box) return;
    const scroll = box.querySelector(".upsel")?.scrollTop || 0;
    box.innerHTML = this.#inner();
    const list = box.querySelector(".upsel");
    if (list) list.scrollTop = scroll;
  }

  html() {
    return `<div id="stakebox">${this.#inner()}</div>`;
  }

  #inner() {
    const inventory = this.app.player.beaverInventory;
    const picked = this.selected();
    const title = this.#max === 1 ? "Обери річ для ставки" : "Обери речі для ставки (до " + this.#max + ")";
    const head = `<div class="bonus"><span>${title} · обрано <b>${picked.length}</b>${picked.length ? " на " + Money.format(this.total()) + " бобрів" : ""}</span>${picked.length > 1 || (picked.length && this.#max > 1) ? `<button class="btn sm ghost" onclick="app.beavers.stake.clear()">Очистити</button>` : ""}</div>`;
    if (!inventory.length) {
      return head + `<div class="empty">Інвентар порожній. Відкрий кейс, щоб мати що ставити.</div>`;
    }
    const chosen = new Set(picked.map((item) => item.uid));
    const sorted = [...inventory].sort((a, b) => b.v - a.v).slice(0, ItemStake.LIMIT);
    const more = inventory.length > sorted.length ? `<div class="note">Показано ${sorted.length} найцінніших із ${inventory.length}.</div>` : "";
    return head + `<div class="items upsel">${sorted.map((item) => `<div class="it${chosen.has(item.uid) ? " sel" : ""}" role="button" style="--c:${this.app.beaverRarity.color(item.r)}" onclick="app.beavers.stake.pick('${item.uid}')"><span class="em">${Html.escape(item.e)}</span><div class="tx"><b>${Html.escape(item.n)}</b><span>${RarityTable.NAMES[item.r] || ""} · ${Money.format(item.v)} бобрів</span></div></div>`).join("")}</div>${more}`;
  }
}
