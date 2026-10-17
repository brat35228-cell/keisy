import { Html } from "../core/Html.js";
import { Ids } from "../core/Ids.js";
import { Money } from "../core/Money.js";
import { RarityTable } from "../models/RarityTable.js";

/** Відкриття кейсу: зважений дроп, стрічка й продаж щойно випалого. */
export class CaseScreen {
  #app;

  constructor(app) {
    this.#app = app;
    const saved = app.store.get("cg_n");
    app.session.openCount = [1, 2, 3, 6].includes(saved) ? saved : 1;
  }

  #current() {
    return this.#app.catalog.find(this.#app.session.curId);
  }

  #free(lootCase) {
    return !!lootCase.free || lootCase.p === 0;
  }

  #stuck() {
    const app = this.#app;
    return app.player.balance + app.player.inventoryValue() < app.catalog.cheapestPrice();
  }

  #label(lootCase) {
    const count = this.#app.session.openCount;
    if (this.#free(lootCase)) return "Відкрити безкоштовно";
    return "Відкрити " + (count > 1 ? "×" + count + " " : "") + "за " + Money.format(lootCase.p * count);
  }

  #tile(item, lootCase) {
    const app = this.#app;
    const tier = app.rarity.tier(item.v, app.rarity.baseOf(lootCase));
    return `<div class="tile" style="--c:${app.rarity.color(tier)}"><div class="em">${app.images.itemHtml(item, lootCase ? lootCase.n : "")}</div><div class="tn">${Html.escape(item.n)}</div><div class="tv">${Money.compact(app.player.priceOf(item.v))}</div></div>`;
  }

  #reels(list, count) {
    let html = "";
    for (let reel = 0; reel < count; reel++) {
      html += `<div class="vp"><div class="track">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => this.#tile(list[(index + reel * 3) % list.length], this.#current())).join("")}</div></div>`;
    }
    return html;
  }

  render() {
    const app = this.#app;
    const lootCase = this.#current();
    if (!lootCase) { app.go("shop"); return; }
    const list = app.rarity.chances(lootCase);
    if (app.session.openCount > 6 && !app.admin.isAdmin) app.session.openCount = 1;
    const count = this.#free(lootCase) ? 1 : app.session.openCount;
    const rebirthNote = app.player.rebirths
      ? " · ребірт ×" + (1 + app.player.rebirths * 0.05).toFixed(2).replace(".", ",") + " до цін речей"
      : "";
    const qty = this.#free(lootCase) ? "" : `<div class="qty"><span class="lb">Скільки відкрити:</span>${(app.admin.isAdmin ? [1, 2, 3, 6, 100] : [1, 2, 3, 6]).map((amount) => `<button class="${app.session.openCount === amount ? "on" : ""}${app.player.balance < lootCase.p * amount ? " cant" : ""}" onclick="app.cases.setCount(${amount})">×${amount}</button>`).join("")}</div>`;
    document.querySelector("#main").innerHTML = `
      <button class="back" onclick="app.go('shop')">← До всіх кейсів</button>
      <div class="head"><div class="sticker">${app.images.caseHtml(lootCase)}</div>
        <div style="flex:1;min-width:160px"><h2 style="margin:0">${Html.escape(lootCase.n)}</h2><div class="note">${list.length} речей усередині${this.#free(lootCase) ? ". Відкривається, коли монет і речей не вистачає навіть на найдешевший кейс" : ""}${rebirthNote}</div></div>
        <button class="btn" id="openBtn" onclick="app.cases.open()">${this.#label(lootCase)}</button></div>
      ${qty}
      <div class="reels${count > 1 ? " m" : ""}" id="reels">${this.#reels(list, count > 6 ? 1 : count)}</div>
      <div class="panel res" id="res"></div>
      <div class="panel"><h3>Що може випасти</h3>
        <div class="items">${list.map((item) => `<div class="it" style="--c:${app.rarity.color(item.r)}"><span class="em">${app.images.itemHtml(item, lootCase.n)}</span><div class="tx"><b>${Html.escape(item.n)}</b><span>${RarityTable.NAMES[item.r]} · ${Money.format(app.player.priceOf(item.v))} · ${item.pc.toFixed(1)}%</span></div></div>`).join("")}</div></div>`;
  }

  setCount(amount) {
    const app = this.#app;
    if (app.session.spinning || (amount > 6 && !app.admin.isAdmin)) return;
    app.session.openCount = amount;
    if (amount <= 6) app.store.set("cg_n", amount);
    this.render();
  }

  open() {
    const app = this.#app;
    if (app.session.spinning) return;
    const lootCase = this.#current();
    if (!lootCase) return;
    if (!lootCase.items.length) return app.toast("У кейсі ще немає речей");
    if (app.session.openCount > 6 && !app.admin.isAdmin) {
      app.session.openCount = 1;
      app.toast("×100 доступно лише після входу в адмінку");
      this.render();
      return;
    }
    const free = this.#free(lootCase);
    const count = free ? 1 : app.session.openCount;
    const cost = lootCase.p * count;
    if (free) {
      if (!this.#stuck()) return app.toast("Безкоштовний кейс доступний, коли немає за що купити навіть найдешевший кейс");
    } else if (app.player.balance < cost) {
      return app.toast(count > 1
        ? "Не вистачає монет: потрібно " + Money.format(cost) + ". Продай речі, забери бонус або обери менше кейсів"
        : "Не вистачає монет. Продай речі або забери бонус");
    }
    app.player.debit(cost);
    const wins = [];
    const got = [];
    for (let index = 0; index < count; index++) {
      const drop = app.rarity.roll(lootCase);
      wins.push(drop);
      got.push({
        uid: Ids.next(),
        e: drop.e,
        n: drop.n,
        v: app.player.priceOf(drop.v),
        r: app.rarity.tier(drop.v, app.rarity.baseOf(lootCase)),
        from: lootCase.n,
      });
    }
    app.player.unshiftItems(got);
    app.session.lastDrops = got;
    app.saveState();
    app.shell.updateBalances();
    if (count > 6) {
      const result = document.querySelector("#res");
      this.#showResult(lootCase, got, result);
      app.shell.updateInventoryLabel();
      result?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      return;
    }
    app.session.spinning = true;
    document.querySelector("#openBtn").disabled = true;
    document.querySelector("#res").classList.remove("show");
    const reels = [...document.querySelectorAll("#reels .track")];
    const winIndex = 40;
    const length = 50;
    const viewport = document.querySelector("#reels .vp").clientWidth;
    reels.forEach((track, index) => {
      const strip = [];
      for (let step = 0; step < length; step++) strip.push(step === winIndex ? wins[index] : app.rarity.roll(lootCase));
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      track.innerHTML = strip.map((item) => this.#tile(item, lootCase)).join("");
    });
    void document.body.offsetWidth;
    reels.forEach((track, index) => {
      const tileWidth = track.firstElementChild.offsetWidth;
      const step = tileWidth + 8;
      const target = winIndex * step + tileWidth / 2 - viewport / 2 + (Math.random() - 0.5) * tileWidth * 0.5;
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
      app.shell.updateInventoryLabel();
    }, Math.round((5.5 + (count - 1) * 0.25) * 1000) + 200);
  }

  #showResult(lootCase, got, result) {
    const app = this.#app;
    if (got.length > 6) {
      const total = got.reduce((sum, item) => sum + item.v, 0);
      const cost = lootCase.p * got.length;
      const diff = total - cost;
      const grouped = {};
      got.forEach((item) => { (grouped[item.n] = grouped[item.n] || { i: item, k: 0 }).k += 1; });
      result.style.setProperty("--c", app.rarity.color(Math.max(...got.map((item) => item.r))));
      result.innerHTML = `<h2 style="margin:0 0 4px">Випало речей: ${got.length}</h2>
        <div class="note">Разом ${Money.format(total)} монет. Кейси коштували ${Money.format(cost)} (${diff >= 0 ? "плюс " : "мінус "}${Money.format(Math.abs(diff))}). Речі вже в інвентарі.</div>
        <div class="resgrid">${Object.values(grouped).sort((a, b) => b.i.v - a.i.v).map(({ i, k }) => `<div class="rcard" style="--c:${app.rarity.color(i.r)}"><div class="em">${app.images.itemHtml(i)}</div><b>${Html.escape(i.n)}${k > 1 ? " ×" + k : ""}</b><span>${RarityTable.NAMES[i.r]} · ${Money.format(i.v)}</span></div>`).join("")}</div>
        <div class="acts"><button class="btn" id="sellBatch" onclick="app.cases.sellBatch()"></button><button class="btn ghost" onclick="app.cases.open()">Відкрити ще раз ×${got.length}</button></div>`;
      this.#refreshBatch();
      result.classList.add("show");
      return;
    }
    if (got.length === 1) {
      const item = got[0];
      result.style.setProperty("--c", app.rarity.color(item.r));
      result.innerHTML = `<div class="big">${app.images.itemHtml(item)}</div><h2 style="margin:6px 0 2px">${Html.escape(item.n)}</h2><div class="rn">${RarityTable.NAMES[item.r]}</div><div class="note">Вартість ${Money.format(item.v)} монет. Річ уже в інвентарі.</div>
        <div class="acts"><button class="btn" onclick="app.cases.sell('${item.uid}',true)">Продати за ${Money.format(item.v)}</button><button class="btn ghost" onclick="app.cases.open()">Відкрити ще раз</button></div>`;
    } else {
      const total = got.reduce((sum, item) => sum + item.v, 0);
      const cost = lootCase.p * got.length;
      const diff = total - cost;
      const best = Math.max(...got.map((item) => item.r));
      result.style.setProperty("--c", app.rarity.color(best));
      result.innerHTML = `<h2 style="margin:0 0 4px">Випало речей: ${got.length}</h2>
        <div class="note">Разом ${Money.format(total)} монет. Кейси коштували ${Money.format(cost)} (${diff >= 0 ? "плюс " : "мінус "}${Money.format(Math.abs(diff))}). Речі вже в інвентарі.</div>
        <div class="resgrid">${[...got].sort((a, b) => b.v - a.v).map((item) => `<div class="rcard" data-uid="${item.uid}" style="--c:${app.rarity.color(item.r)}"><div class="em">${app.images.itemHtml(item)}</div><b>${Html.escape(item.n)}</b><span>${RarityTable.NAMES[item.r]} · ${Money.format(item.v)}</span><button class="btn sm ghost" onclick="app.cases.sellCard('${item.uid}')">Продати</button></div>`).join("")}</div>
        <div class="acts"><button class="btn" id="sellBatch" onclick="app.cases.sellBatch()"></button><button class="btn ghost" onclick="app.cases.open()">Відкрити ще раз ×${got.length}</button></div>`;
      this.#refreshBatch();
    }
    result.classList.add("show");
  }

  #stillHere() {
    const owned = new Set(this.#app.player.inventory.map((item) => item.uid));
    return this.#app.session.lastDrops.filter((item) => owned.has(item.uid));
  }

  #refreshBatch() {
    const button = document.querySelector("#sellBatch");
    if (!button) return;
    const left = this.#stillHere();
    const total = left.reduce((sum, item) => sum + item.v, 0);
    button.disabled = !left.length;
    button.textContent = left.length ? "Продати все за " + Money.format(total) : "Усе продано";
  }

  sellCard(uid) {
    const app = this.#app;
    const item = app.player.takeItem(uid);
    if (!item) return;
    app.player.credit(item.v);
    app.saveState();
    app.shell.updateBalances();
    app.shell.updateInventoryLabel();
    app.toast("Продано: +" + Money.format(item.v));
    const card = document.querySelector('.rcard[data-uid="' + uid + '"]');
    if (card) {
      card.classList.add("sold");
      const button = card.querySelector("button");
      if (button) { button.disabled = true; button.textContent = "Продано"; }
    }
    this.#refreshBatch();
  }

  sellBatch() {
    const app = this.#app;
    const left = this.#stillHere();
    if (!left.length) return;
    let total = 0;
    left.forEach((item) => {
      const taken = app.player.takeItem(item.uid);
      if (taken) total += taken.v;
    });
    app.player.credit(total);
    app.saveState();
    app.shell.updateBalances();
    app.shell.updateInventoryLabel();
    app.toast("Продано: +" + Money.format(total));
    document.querySelectorAll(".rcard").forEach((card) => {
      card.classList.add("sold");
      const button = card.querySelector("button");
      if (button) { button.disabled = true; button.textContent = "Продано"; }
    });
    this.#refreshBatch();
  }

  sell(uid, fromResult) {
    const app = this.#app;
    const item = app.player.takeItem(uid);
    if (!item) return;
    app.player.credit(item.v);
    app.saveState();
    app.toast("Продано: +" + Money.format(item.v));
    if (fromResult) {
      document.querySelector("#res")?.classList.remove("show");
      app.shell.updateBalances();
      app.shell.updateInventoryLabel();
    } else app.render();
  }
}
