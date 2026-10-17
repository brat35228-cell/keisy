import { Html } from "../core/Html.js";
import { Money } from "../core/Money.js";
import { RarityTable } from "../models/RarityTable.js";

/** Інвентар монетних речей. */
export class InventoryScreen {
  #app;

  constructor(app) {
    this.#app = app;
  }

  render() {
    const app = this.#app;
    const items = app.player.inventory;
    const main = document.querySelector("#main");
    if (!items.length) {
      main.innerHTML = `<div class="empty">Інвентар порожній. Відкрий перший кейс.</div>`;
      return;
    }
    const total = items.reduce((sum, item) => sum + item.v, 0);
    main.innerHTML = `<div class="bonus"><span>Усього речей: ${items.length}, на суму ${Money.format(total)} монет</span><button class="btn sm" onclick="app.inventory.sellAll()">Продати все</button></div>
      <div class="items">${items.map((item) => `<div class="it" style="--c:${app.rarity.color(item.r)}"><span class="em">${app.images.itemHtml(item)}</span><div class="tx"><b>${Html.escape(item.n)}</b><span>${RarityTable.NAMES[item.r] || ""} · ${Html.escape(item.from || "")}</span></div><button class="btn sm" onclick="app.cases.sell('${item.uid}')">${Money.format(item.v)}</button></div>`).join("")}</div>`;
  }

  sellAll() {
    const app = this.#app;
    const total = app.player.inventory.reduce((sum, item) => sum + item.v, 0);
    app.player.credit(total);
    app.player.inventory.splice(0, app.player.inventory.length);
    app.saveState();
    app.toast("Продано все: +" + Money.format(total));
    app.render();
  }
}
