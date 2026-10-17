import { Html } from "../core/Html.js";
import { Ids } from "../core/Ids.js";
import { Money } from "../core/Money.js";
import { RarityTable } from "../models/RarityTable.js";
import { CraftGame } from "./CraftGame.js";
import { ItemStake } from "./ItemStake.js";
import { PlinkoGame } from "./PlinkoGame.js";
import { PrizePool } from "./PrizePool.js";
import { TimesFiveGame } from "./TimesFiveGame.js";

/** Вкладка «Кейси 2»: майнкрафт-кейси, інвентар і три міні-ігри, де ставкою є речі. */
export class BeaverHall {
  #games;

  constructor(app) {
    this.app = app;
    this.stake = new ItemStake(app);
    this.prizes = new PrizePool(app);
    this.plinko = new PlinkoGame(app);
    this.timesFive = new TimesFiveGame(app);
    this.craft = new CraftGame(app);
    this.#games = [
      ["plinko", "📍", "Плінко", "Кулька падає в слот: річ ×0,4 … ×12", this.plinko],
      ["x5", "📦", "Кейс ×5", "10% шанс ×5 речей, інакше нічого", this.timesFive],
      ["craft", "🧰", "Верстак", "3–9 речей у сітці → одна нова", this.craft],
    ];
  }

  tabs() {
    const view = this.app.session.view;
    const on = (key, extra) => `class="btn sm ${view === key || extra ? "" : "ghost"}"`;
    return `<div class="qty" style="margin-bottom:14px"><button ${on("beaver", view === "bcase")} onclick="app.go('beaver')">Кейси</button><button ${on("bgames", view === "bgame")} onclick="app.go('bgames')">Міні-ігри</button><button ${on("binv", false)} onclick="app.go('binv')">Інвентар (${this.app.player.beaverInventory.length})</button></div>`;
  }

  /** Оновлює лічильник на кнопці «Інвентар» без перемальовування екрана. */
  updateInvLabel() {
    const button = document.querySelector("#main button[onclick=\"app.go('binv')\"]");
    if (button) button.textContent = "Інвентар (" + this.app.player.beaverInventory.length + ")";
  }

  renderShop() {
    document.querySelector("#main").innerHTML = this.tabs() + `<div class="bonus"><span>Окрема валюта вкладки Кейси 2 — бобр-коіни. Ціна кожного наступного кейсу ×5.</span></div>
      <div class="grid">${this.app.beaverCatalog.cases.map((lootCase) => `<button class="box" style="cursor:pointer;color:inherit" onclick="app.go('bcase','${lootCase.id}')">
        <div class="sticker">${Html.escape(lootCase.e)}</div><div class="nm">${Html.escape(lootCase.n)}</div>
        <div class="pr">${Money.format(lootCase.p)} бобрів</div></button>`).join("")}</div>`;
  }

  #current() {
    return this.app.beaverCatalog.find(this.app.session.curId);
  }

  #tile(item, lootCase) {
    const tier = this.app.beaverRarity.tier(item.v, this.app.beaverRarity.baseOf(lootCase));
    return `<div class="tile" style="--c:${this.app.beaverRarity.color(tier)}"><div class="em">${Html.escape(item.e)}</div><div class="tn">${Html.escape(item.n)}</div><div class="tv">${Money.compact(item.v)}</div></div>`;
  }

  renderCase() {
    const lootCase = this.#current();
    if (!lootCase) { this.app.go("beaver"); return; }
    const list = this.app.beaverRarity.chances(lootCase);
    const count = this.app.session.beaverOpenCount;
    const reels = Array.from({ length: count }, (_, reel) => `<div class="vp"><div class="track">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => this.#tile(list[(index + reel * 3) % list.length], lootCase)).join("")}</div></div>`).join("");
    document.querySelector("#main").innerHTML = this.tabs() + `
      <button class="back" onclick="app.go('beaver')">← До кейсів</button>
      <div class="head"><div class="sticker">${Html.escape(lootCase.e)}</div>
        <div style="flex:1;min-width:160px"><h2 style="margin:0">${Html.escape(lootCase.n)}</h2><div class="note">20 речей · епік 3,5% кожна · легендарна 0,5%</div></div>
        <button class="btn" id="openBtn" onclick="app.beavers.open()">Відкрити ${count > 1 ? "×" + count + " " : ""}за ${Money.format(lootCase.p * count)}</button></div>
      <div class="qty"><span class="lb">Скільки відкрити:</span>${[1, 2, 3, 6].map((amount) => `<button class="${count === amount ? "on" : ""}${this.app.player.beaverBalance < lootCase.p * amount ? " cant" : ""}" onclick="app.beavers.setCount(${amount})">×${amount}</button>`).join("")}</div>
      <div class="reels${count > 1 ? " m" : ""}" id="reels">${reels}</div>
      <div class="panel res" id="res"></div>
      <div class="panel"><h3>Що може випасти</h3>
        <div class="items">${list.map((item) => `<div class="it" style="--c:${this.app.beaverRarity.color(item.r)}"><span class="em">${Html.escape(item.e)}</span><div class="tx"><b>${Html.escape(item.n)}</b><span>${RarityTable.NAMES[item.r]} · ${Money.format(item.v)} бобрів · ${item.pc.toFixed(1)}%</span></div></div>`).join("")}</div></div>`;
  }

  setCount(amount) {
    if (this.app.session.spinning) return;
    this.app.session.beaverOpenCount = amount;
    this.renderCase();
  }

  open() {
    const app = this.app;
    if (app.session.spinning) return;
    const lootCase = this.#current();
    if (!lootCase) return;
    const count = app.session.beaverOpenCount;
    const cost = lootCase.p * count;
    if (app.player.beaverBalance < cost) return app.toast("Не вистачає бобр-коінів: потрібно " + Money.format(cost));
    app.player.debitBeavers(cost);
    const wins = [];
    const got = [];
    for (let index = 0; index < count; index++) {
      const drop = app.beaverRarity.roll(lootCase);
      wins.push(drop);
      got.push({
        uid: Ids.next(),
        e: drop.e,
        n: drop.n,
        v: drop.v,
        r: app.beaverRarity.tier(drop.v, app.beaverRarity.baseOf(lootCase)),
        from: lootCase.n,
        bb: 1,
      });
    }
    app.player.unshiftBeavers(got);
    app.session.beaverLast = got;
    app.saveState();
    app.shell.updateBalances();
    app.session.spinning = true;
    document.querySelector("#openBtn").disabled = true;
    document.querySelector("#res").classList.remove("show");
    const reels = [...document.querySelectorAll("#reels .track")];
    const winIndex = 40;
    const length = 50;
    const viewport = document.querySelector("#reels .vp").clientWidth;
    reels.forEach((track, index) => {
      const strip = [];
      for (let step = 0; step < length; step++) strip.push(step === winIndex ? wins[index] : app.beaverRarity.roll(lootCase));
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      track.innerHTML = strip.map((item) => this.#tile(item, lootCase)).join("");
    });
    void document.body.offsetWidth;
    reels.forEach((track, index) => {
      const tile = track.firstElementChild.offsetWidth;
      const step = tile + 8;
      const target = winIndex * step + tile / 2 - viewport / 2 + (Math.random() - 0.5) * tile * 0.5;
      track.style.transition = "transform " + (5.5 + index * 0.25) + "s cubic-bezier(.12,.6,.1,1)";
      track.style.transform = `translateX(${-target}px)`;
    });
    setTimeout(() => {
      app.session.spinning = false;
      const result = document.querySelector("#res");
      if (!result) return;
      this.#showResult(lootCase, got, result);
      const button = document.querySelector("#openBtn");
      if (button) button.disabled = false;
      app.shell.updateBalances();
    }, Math.round((5.5 + (count - 1) * 0.25) * 1000) + 200);
  }

  #showResult(lootCase, got, result) {
    const app = this.app;
    if (got.length === 1) {
      const item = got[0];
      result.style.setProperty("--c", app.beaverRarity.color(item.r));
      result.innerHTML = `<div class="big">${Html.escape(item.e)}</div><h2 style="margin:6px 0 2px">${Html.escape(item.n)}</h2><div class="rn">${RarityTable.NAMES[item.r]}</div><div class="note">Вартість ${Money.format(item.v)} бобр-коінів. Річ уже в інвентарі Кейсів 2.</div>
        <div class="acts"><button class="btn" onclick="app.beavers.sell('${item.uid}',true)">Продати за ${Money.format(item.v)}</button><button class="btn ghost" onclick="app.beavers.open()">Відкрити ще раз</button></div>`;
    } else {
      const total = got.reduce((sum, item) => sum + item.v, 0);
      const cost = lootCase.p * got.length;
      const diff = total - cost;
      const best = Math.max(...got.map((item) => item.r));
      result.style.setProperty("--c", app.beaverRarity.color(best));
      result.innerHTML = `<h2 style="margin:0 0 4px">Випало речей: ${got.length}</h2>
        <div class="note">Разом ${Money.format(total)} бобрів. Кейси коштували ${Money.format(cost)} (${diff >= 0 ? "плюс " : "мінус "}${Money.format(Math.abs(diff))})</div>
        <div class="resgrid">${[...got].sort((a, b) => b.v - a.v).map((item) => `<div class="rcard" data-uid="${item.uid}" style="--c:${app.beaverRarity.color(item.r)}"><div class="em">${Html.escape(item.e)}</div><b>${Html.escape(item.n)}</b><span>${RarityTable.NAMES[item.r]} · ${Money.format(item.v)}</span><button class="btn sm ghost" onclick="app.beavers.sellCard('${item.uid}')">Продати</button></div>`).join("")}</div>
        <div class="acts"><button class="btn" id="sellBatch" onclick="app.beavers.sellBatch()"></button><button class="btn ghost" onclick="app.beavers.open()">Відкрити ще раз ×${got.length}</button></div>`;
      this.#refreshBatch();
    }
    result.classList.add("show");
  }

  #left() {
    const owned = new Set(this.app.player.beaverInventory.map((item) => item.uid));
    return this.app.session.beaverLast.filter((item) => owned.has(item.uid));
  }

  #refreshBatch() {
    const button = document.querySelector("#sellBatch");
    if (!button) return;
    const left = this.#left();
    const total = left.reduce((sum, item) => sum + item.v, 0);
    button.disabled = !left.length;
    button.textContent = left.length ? "Продати все за " + Money.format(total) : "Усе продано";
  }

  sellCard(uid) {
    const item = this.app.player.takeBeaver(uid);
    if (!item) return;
    this.app.player.creditBeavers(item.v);
    this.app.saveState();
    this.app.shell.updateBalances();
    this.app.toast("Продано: +" + Money.format(item.v) + " бобрів");
    const card = document.querySelector('.rcard[data-uid="' + uid + '"]');
    if (card) {
      card.classList.add("sold");
      const button = card.querySelector("button");
      if (button) { button.disabled = true; button.textContent = "Продано"; }
    }
    this.#refreshBatch();
  }

  sellBatch() {
    const left = this.#left();
    if (!left.length) return;
    let total = 0;
    left.forEach((item) => {
      const taken = this.app.player.takeBeaver(item.uid);
      if (taken) total += taken.v;
    });
    this.app.player.creditBeavers(total);
    this.app.saveState();
    this.app.shell.updateBalances();
    this.app.toast("Продано: +" + Money.format(total) + " бобрів");
    document.querySelectorAll(".rcard").forEach((card) => {
      card.classList.add("sold");
      const button = card.querySelector("button");
      if (button) { button.disabled = true; button.textContent = "Продано"; }
    });
    this.#refreshBatch();
  }

  sell(uid, fromResult) {
    const item = this.app.player.takeBeaver(uid);
    if (!item) return;
    this.app.player.creditBeavers(item.v);
    this.app.saveState();
    this.app.toast("Продано: +" + Money.format(item.v) + " бобрів");
    if (fromResult) {
      document.querySelector("#res")?.classList.remove("show");
      this.app.shell.updateBalances();
    } else this.app.render();
  }

  renderInventory() {
    const items = this.app.player.beaverInventory;
    if (!items.length) {
      document.querySelector("#main").innerHTML = this.tabs() + `<div class="empty">Інвентар Кейсів 2 порожній.</div>`;
      return;
    }
    const total = items.reduce((sum, item) => sum + item.v, 0);
    document.querySelector("#main").innerHTML = this.tabs() + `<div class="bonus"><span>Речей: ${items.length}, на суму ${Money.format(total)} бобр-коінів</span><button class="btn sm" onclick="app.beavers.sellAll()">Продати все</button></div>
      <div class="items">${items.map((item) => `<div class="it" style="--c:${this.app.beaverRarity.color(item.r)}"><span class="em">${Html.escape(item.e)}</span><div class="tx"><b>${Html.escape(item.n)}</b><span>${RarityTable.NAMES[item.r] || ""} · ${Html.escape(item.from || "")}</span></div><button class="btn sm" onclick="app.beavers.sell('${item.uid}')">${Money.format(item.v)}</button></div>`).join("")}</div>`;
  }

  sellAll() {
    const total = this.app.player.beaverInventory.reduce((sum, item) => sum + item.v, 0);
    this.app.player.creditBeavers(total);
    this.app.player.beaverInventory.splice(0, this.app.player.beaverInventory.length);
    this.app.saveState();
    this.app.toast("Продано все: +" + Money.format(total) + " бобрів");
    this.app.render();
  }

  renderGames() {
    document.querySelector("#main").innerHTML = this.tabs() + `<div class="grid">${this.#games.map(([id, emoji, title, blurb]) => `<button class="box" style="cursor:pointer;color:inherit;font:inherit" onclick="app.go('bgame','${id}')">
      <div class="sticker">${emoji}</div><div class="nm">${Html.escape(title)}</div>
      <div class="pr" style="color:var(--mute);font-weight:400">${Html.escape(blurb)}</div></button>`).join("")}</div>`;
  }

  renderGame() {
    const found = this.#games.find((entry) => entry[0] === this.app.session.curId);
    if (!found) { this.app.session.view = "bgames"; this.renderGames(); return; }
    found[4].render();
  }
}
