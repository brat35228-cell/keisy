import { Html } from "../core/Html.js";
import { Ids } from "../core/Ids.js";
import { Money } from "../core/Money.js";
import { MiniGame } from "./MiniGame.js";

/** Ставиш речі й намагаєшся вибити дорожчу. */
export class Upgrader extends MiniGame {
  #selected = new Set();
  #multiplier = 2;
  #last = null;
  static TARGETS = [1.5, 2, 3, 5, 10, 25, 100];

  get id() { return "upg"; }
  get emoji() { return "⬆️"; }
  get title() { return "Апгрейдер"; }
  get blurb() { return "Постав речі й спробуй отримати дорожчу"; }

  #targets() {
    const found = new Map();
    this.app.catalog.cases.forEach((lootCase) => {
      lootCase.items.forEach((item) => {
        found.set(lootCase.n + "|" + item.n, {
          e: item.e,
          n: item.n,
          v: this.app.player.priceOf(item.v),
          from: lootCase.n,
          cp: this.app.rarity.baseOf(lootCase),
        });
      });
    });
    return [...found.values()];
  }

  #target(sum, multiplier) {
    if (sum <= 0) return null;
    const goal = sum * multiplier;
    let best = null;
    let bestDistance = 1e9;
    this.#targets().forEach((candidate) => {
      if (candidate.v <= sum * 1.05) return;
      const distance = Math.abs(Math.log(candidate.v / goal));
      if (distance < bestDistance) { bestDistance = distance; best = candidate; }
    });
    return best;
  }

  #chance(sum, target) {
    return Math.min(0.95, (sum / target.v) * 0.95);
  }

  #percent(value) {
    const percent = value * 100;
    return (percent < 10 ? percent.toFixed(2) : percent.toFixed(1)).replace(".", ",") + "%";
  }

  toggle(uid) {
    if (this.app.session.spinning) return;
    if (this.#selected.has(uid)) this.#selected.delete(uid);
    else this.#selected.add(uid);
    this.#last = null;
    this.render();
  }

  selectAll(on) {
    if (this.app.session.spinning) return;
    this.#selected = on ? new Set(this.app.player.inventory.map((item) => item.uid)) : new Set();
    this.#last = null;
    this.render();
  }

  setMultiplier(value) {
    if (this.app.session.spinning) return;
    this.#multiplier = value;
    this.#last = null;
    this.render();
  }

  render() {
    const app = this.app;
    [...this.#selected].forEach((uid) => {
      if (!app.player.inventory.some((item) => item.uid === uid)) this.#selected.delete(uid);
    });
    const head = this.back("games", "← До міні-ігор") + "<h2>Апгрейдер</h2>";
    const main = document.querySelector("#main");
    if (!app.player.inventory.length) {
      main.innerHTML = head + `<div class="empty">В інвентарі немає речей. Відкрий кейс, а потім повертайся.</div>`;
      return;
    }
    const chosen = app.player.inventory.filter((item) => this.#selected.has(item.uid));
    const sum = chosen.reduce((total, item) => total + item.v, 0);
    const target = this.#target(sum, this.#multiplier);
    const chance = target ? this.#chance(sum, target) : 0;
    const list = app.player.inventory.map((item) => `<div class="it${this.#selected.has(item.uid) ? " sel" : ""}" style="--c:${app.rarity.color(item.r)}" role="button" tabindex="0" onclick="app.hall.game('upg').toggle('${item.uid}')" onkeydown="if(event.key==='Enter')app.hall.game('upg').toggle('${item.uid}')">
      <span class="em">${app.images.itemHtml(item)}</span><div class="tx"><b>${Html.escape(item.n)}</b><span>${Money.format(item.v)} монет</span></div></div>`).join("");
    let right;
    if (!sum) right = `<div class="empty">Обери речі зліва, їх загальна вартість стане ставкою.</div>`;
    else if (!target) right = `<div class="empty">Для такої суми немає цілі, обери менше речей.</div>`;
    else {
      right = `<div class="note">Ставка: <b>${Money.format(sum)}</b> монет (речей: ${chosen.length})</div>
        <div class="qty" style="margin-top:10px"><span class="lb">Ціль:</span>${Upgrader.TARGETS.map((multiplier) => `<button class="${this.#multiplier === multiplier ? "on" : ""}" onclick="app.hall.game('upg').setMultiplier(${multiplier})">×${String(multiplier).replace(".", ",")}</button>`).join("")}</div>
        <div class="tgt"><div class="big">${app.images.itemHtml(target, target.from)}</div><h3 style="margin:6px 0 0">${Html.escape(target.n)}</h3>
        <div class="note">${Money.format(target.v)} монет (×${(target.v / sum).toFixed(2).replace(".", ",")} від ставки)</div></div>
        <div class="gauge"><div class="win" style="width:${Math.max(chance * 100, 0.6)}%"></div><div class="ptr" id="ptr"></div></div>
        <div style="text-align:center;font-weight:700">Шанс: ${this.#percent(chance)}</div>
        <div class="acts"><button class="btn" id="upBtn" onclick="app.hall.game('upg').play()">Апгрейд</button></div>`;
    }
    let result = "";
    if (this.#last) {
      result = this.#last.win
        ? `<div class="panel res show" style="--c:var(--good);margin:0 0 12px"><div class="big">${app.images.itemHtml(this.#last.item)}</div><h2 style="margin:6px 0 2px">Успіх: ${Html.escape(this.#last.item.n)}</h2><div class="note">Річ уже в інвентарі, вартість ${Money.format(this.#last.item.v)}</div></div>`
        : `<div class="panel res show" style="--c:var(--bad);margin:0 0 12px"><h2 style="margin:0 0 2px">Не пощастило</h2><div class="note">Речі на ${Money.format(this.#last.sum)} монет втрачено. Шанс був ${this.#percent(this.#last.ch)}.</div></div>`;
    }
    main.innerHTML = head + `<div class="cols">
      <div class="panel"><h3>Твої речі (${app.player.inventory.length})</h3>
        <div class="acts" style="justify-content:flex-start;margin:0 0 10px"><button class="btn sm ghost" onclick="app.hall.game('upg').selectAll(true)">Обрати всі</button><button class="btn sm ghost" onclick="app.hall.game('upg').selectAll(false)">Скинути</button></div>
        <div class="items upsel">${list}</div></div>
      <div>${result}<div class="panel">${right}</div></div></div>`;
  }

  play() {
    const app = this.app;
    if (app.session.spinning) return;
    const chosen = app.player.inventory.filter((item) => this.#selected.has(item.uid));
    if (!chosen.length) return app.toast("Обери речі");
    const sum = chosen.reduce((total, item) => total + item.v, 0);
    const target = this.#target(sum, this.#multiplier);
    if (!target) return app.toast("Для такої суми немає цілі");
    const chance = this.#chance(sum, target);
    const roll = Math.random();
    const win = roll < chance;
    const kept = app.player.inventory.filter((item) => !this.#selected.has(item.uid));
    app.player.inventory.splice(0, app.player.inventory.length, ...kept);
    let got = null;
    if (win) {
      got = { uid: Ids.next(), e: target.e, n: target.n, v: target.v, r: app.rarity.tier(target.v, target.cp), from: target.from };
      app.player.inventory.unshift(got);
    }
    this.#selected = new Set();
    app.saveState();
    app.session.spinning = true;
    const pointer = document.querySelector("#ptr");
    const button = document.querySelector("#upBtn");
    this.lock(true);
    if (button) button.disabled = true;
    void pointer.offsetWidth;
    pointer.style.transition = "left 1.1s linear";
    pointer.style.left = "calc(100% - 4px)";
    setTimeout(() => {
      if (!pointer.isConnected) return;
      pointer.style.transition = "left 2.2s cubic-bezier(.15,.7,.1,1)";
      pointer.style.left = "calc(" + roll * 100 + "% - 2px)";
    }, 1150);
    setTimeout(() => {
      app.session.spinning = false;
      app.shell.updateInventoryLabel();
      this.#last = { win, item: got, sum, ch: chance };
      if (this.playing()) this.render();
    }, 3550);
  }
}
