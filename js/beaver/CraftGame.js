import { Html } from "../core/Html.js";
import { Money } from "../core/Money.js";
import { RarityTable } from "../models/RarityTable.js";

/**
 * Верстак: кладеш від 3 до 9 речей у сітку 3×3, вони зникають,
 * а замість них з'являється одна нова річ. Її вартість — частка або кратне від суми покладеного.
 */
export class CraftGame {
  static MIN = 3;
  static MAX = 9;
  /** [шанс, мінімальний множник суми, максимальний множник суми]. Середнє ≈ 0,97. */
  static BANDS = [
    [0.45, 0.3, 0.8],
    [0.35, 0.8, 1.15],
    [0.15, 1.15, 2],
    [0.05, 2, 4],
  ];
  static LABELS = ["Дешевша", "Приблизно така ж", "Краща", "Набагато краща"];

  #result = null;
  #timer = 0;

  constructor(app) {
    this.app = app;
  }

  static roll() {
    let pick = Math.random();
    for (const [chance, low, high] of CraftGame.BANDS) {
      if (pick < chance) return low + Math.random() * (high - low);
      pick -= chance;
    }
    return 1;
  }

  render() {
    const app = this.app;
    app.beavers.stake.begin("craft", { max: CraftGame.MAX, onChange: () => this.#paint() });
    document.querySelector("#main").innerHTML = app.beavers.tabs()
      + `<button class="back" onclick="app.go('bgames')">← До міні-ігор</button>`
      + `<div class="panel" style="text-align:center"><h2>Верстак</h2>
      <p class="note">Поклади від ${CraftGame.MIN} до ${CraftGame.MAX} речей у сітку. Вони зникнуть, а верстак видасть одну нову річ. Клік по клітинці прибирає річ.</p>
      <div class="craft"><div class="cgrid" id="cgrid"></div><div class="carrow">➜</div><div class="cres" id="cres">?</div></div>
      <div class="note" id="cinfo"></div>
      <div class="acts"><button class="btn" id="cgo" onclick="app.beavers.craft.make()">Скрафтити</button></div></div>
      <div class="panel res" id="cout"></div>
      <div class="panel"><h3>Інвентар</h3>${app.beavers.stake.html()}</div>`;
    this.#paint();
    if (this.#result) this.#showResult();
  }

  #paint() {
    const grid = document.querySelector("#cgrid");
    if (!grid) return;
    const app = this.app;
    const picked = app.beavers.stake.selected();
    grid.innerHTML = Array.from({ length: CraftGame.MAX }, (_, slot) => {
      const item = picked[slot];
      if (!item) return `<div class="ccell"><i>＋</i></div>`;
      return `<div class="ccell full" role="button" style="--c:${app.beaverRarity.color(item.r)}" title="${Html.escape(item.n)}" onclick="app.beavers.stake.pick('${item.uid}')"><span>${Html.escape(item.e)}</span><small>${Money.compact(item.v)}</small></div>`;
    }).join("");

    const info = document.querySelector("#cinfo");
    const button = document.querySelector("#cgo");
    if (button) button.disabled = picked.length < CraftGame.MIN;
    if (!info) return;
    if (picked.length < CraftGame.MIN) {
      info.textContent = "Поклади ще речей: " + (CraftGame.MIN - picked.length) + ".";
      return;
    }
    const sum = app.beavers.stake.total();
    info.innerHTML = `Сума покладеного: <b>${Money.format(sum)}</b> бобрів<br>`
      + CraftGame.BANDS.map(([chance, low, high], index) => `${Math.round(chance * 100)}% · ${CraftGame.LABELS[index]}: ${Money.compact(sum * low)}–${Money.compact(sum * high)}`).join("<br>");
  }

  make() {
    const app = this.app;
    if (app.session.spinning) return;
    const items = app.beavers.stake.selected();
    if (items.length < CraftGame.MIN) return app.toast("Потрібно щонайменше " + CraftGame.MIN + " речі");

    const sum = items.reduce((total, item) => total + item.v, 0);
    const prize = app.beavers.prizes.nearest(Math.floor(sum * CraftGame.roll()));
    app.beavers.stake.take();
    app.player.unshiftBeavers([prize]);
    app.saveState();
    app.beavers.updateInvLabel();
    app.beavers.stake.refresh();

    app.session.spinning = true;
    this.#result = null;
    document.querySelector("#cout")?.classList.remove("show");
    const button = document.querySelector("#cgo");
    if (button) button.disabled = true;
    const grid = document.querySelector("#cgrid");
    const slot = document.querySelector("#cres");
    if (grid) grid.classList.add("shake");
    if (slot) slot.className = "cres spin";

    const faces = app.beaverCatalog.cases.map((lootCase) => lootCase.e);
    clearInterval(this.#timer);
    this.#timer = setInterval(() => {
      const cell = document.querySelector("#cres");
      if (cell) cell.textContent = faces[Math.floor(Math.random() * faces.length)];
    }, 90);

    setTimeout(() => {
      clearInterval(this.#timer);
      app.session.spinning = false;
      this.#result = { prize, sum };
      if (!document.querySelector("#cgrid")) return;
      document.querySelector("#cgrid").classList.remove("shake");
      this.#paint();
      this.#showResult();
      app.toast("Скрафтив: " + prize.n);
    }, 1800);
  }

  #showResult() {
    const app = this.app;
    const { prize, sum } = this.#result;
    const slot = document.querySelector("#cres");
    if (slot) {
      slot.className = "cres done";
      slot.style.setProperty("--c", app.beaverRarity.color(prize.r));
      slot.textContent = prize.e;
    }
    const ratio = prize.v / sum;
    const out = document.querySelector("#cout");
    if (!out) return;
    out.style.setProperty("--c", app.beaverRarity.color(prize.r));
    out.innerHTML = `<div class="big">${Html.escape(prize.e)}</div><h2 style="margin:6px 0 2px">${Html.escape(prize.n)}</h2><div class="rn">${RarityTable.NAMES[prize.r]}</div>
      <div class="note">Вартість ${Money.format(prize.v)} бобрів · ${ratio >= 1 ? "+" : "−"}${Math.abs(Math.round((ratio - 1) * 100))}% до суми ${Money.format(sum)}. Річ уже в інвентарі.</div>`;
    out.classList.add("show");
  }
}
