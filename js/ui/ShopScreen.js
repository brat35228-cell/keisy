import { Html } from "../core/Html.js";
import { Money } from "../core/Money.js";

/** Вітрина кейсів і безкоштовний бонус раз на пів години. */
export class ShopScreen {
  #app;

  constructor(app) {
    this.#app = app;
  }

  #stuck() {
    const app = this.#app;
    return app.player.balance + app.player.inventoryValue() < app.catalog.cheapestPrice();
  }

  render() {
    const app = this.#app;
    const left = app.player.bonusAt - Date.now();
    const bonus = left <= 0
      ? `<div class="bonus"><span>Безкоштовний бонус готовий</span><button class="btn sm" onclick="app.shop.claimBonus()">Забрати 300 монет</button></div>`
      : `<div class="bonus"><span>Наступний бонус через ${Math.ceil(left / 60000)} хв</span></div>`;
    const stuck = this.#stuck();
    const cards = [...app.catalog.cases].sort((a, b) => a.p - b.p).map((lootCase) => {
      const free = !!lootCase.free || lootCase.p === 0;
      const locked = free && !stuck;
      const price = free
        ? (locked ? "Для тих, у кого закінчились монети" : "Безкоштовно, забери")
        : Money.format(lootCase.p) + " монет";
      return `<button class="box${locked ? " locked" : ""}${free && stuck ? " glow" : ""}" style="cursor:pointer;color:inherit" onclick="app.go('case','${Html.escape(lootCase.id)}')">
        <div class="sticker">${app.images.caseHtml(lootCase)}</div>
        <div class="nm">${Html.escape(lootCase.n)}</div>
        <div class="pr">${price}</div>
      </button>`;
    }).join("");
    document.querySelector("#main").innerHTML = bonus + `<div class="grid">${cards}</div>`;
  }

  claimBonus() {
    const app = this.#app;
    if (app.player.bonusAt > Date.now()) return;
    app.player.credit(300);
    app.player.bonusAt = Date.now() + 30 * 60000;
    app.saveState();
    app.toast("+300 монет");
    app.render();
  }
}
