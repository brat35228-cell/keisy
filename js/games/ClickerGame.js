import { Money } from "../core/Money.js";
import { ClickerEconomy } from "../models/ClickerEconomy.js";
import { MiniGame } from "./MiniGame.js";

/** Клік по монеті й автоклікери, які працюють навіть коли вкладка закрита (до 2 годин). */
export class ClickerGame extends MiniGame {
  #timer = null;
  #ticker = null;
  static META = {
    pow: { ico: "👆", name: "Сила кліку", unit: "за клік", buy: "Покращити", val: ClickerEconomy.powerAt },
    auto: { ico: "⚙️", name: "Автоклікери", unit: "монет/с", buy: "Купити", val: ClickerEconomy.autoAt },
  };

  get id() { return "click"; }
  get emoji() { return "👆"; }
  get title() { return "Клікер"; }
  get blurb() { return "Тицяй на монету, купуй покращення"; }

  startBackground() {
    if (this.#ticker) return;
    const offline = this.app.player.name && this.app.player.clicker.auto ? ClickerEconomy.accrue(this.app.player) : 0;
    if (offline > 0) {
      this.app.player.save(this.app.store);
      setTimeout(() => {
        this.app.shell.updateBalances();
        this.app.toast("Автоклікер заробив +" + Money.format(offline));
      }, 600);
    }
    this.#ticker = setInterval(() => {
      if (!this.app.player.name || !this.app.player.clicker.auto) return;
      const gained = ClickerEconomy.accrue(this.app.player);
      if (gained <= 0) return;
      if (!this.app.session.spinning) {
        this.app.shell.updateBalances();
        const label = document.querySelector("#ckbal");
        if (label) { label.textContent = Money.format(this.app.player.balance); this.#refresh(); }
      }
      this.#saveSoon();
    }, 1000);
  }

  #saveSoon() {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.app.player.save(this.app.store);
      this.app.cloud.schedule(8000);
    }, 700);
  }

  #card(kind) {
    const meta = ClickerGame.META[kind];
    const level = this.app.player.clicker[kind];
    return `<div class="ck-up" data-k="${kind}"><div class="ck-ico" aria-hidden="true">${meta.ico}</div>
      <div><div class="ck-name">${meta.name}<em>рівень ${Money.format(level)}</em></div>
      <div class="ck-delta">${Money.format(meta.val(level))} → <b>${Money.format(meta.val(level + 1))}</b> ${meta.unit}</div></div>
      <div class="ck-bar"><i></i></div>
      <div class="ck-buy"><button class="btn ck-b1" onclick="app.hall.game('click').buy('${kind}',1)">${meta.buy} · <span class="ck-pr"></span></button>
        <button class="btn sm ghost" onclick="app.hall.game('click').buy('${kind}',10)">×10</button>
        <button class="btn sm ghost ck-mx" onclick="app.hall.game('click').buy('${kind}','max')">Макс</button></div></div>`;
  }

  #refresh() {
    if (!document.querySelector("#ckbal")) return;
    document.querySelectorAll(".ck-up").forEach((node) => {
      const kind = node.dataset.k;
      const price = ClickerEconomy.price(kind, Math.max(1, this.app.player.clicker[kind]));
      const plan = ClickerEconomy.plan(this.app.player, kind, "max");
      node.classList.toggle("cant", this.app.player.balance < price);
      node.querySelector(".ck-pr").textContent = Money.format(price);
      node.querySelector(".ck-bar i").style.width = Math.min(100, (this.app.player.balance / price) * 100) + "%";
      node.querySelector(".ck-mx").textContent = plan.cnt > 1 ? "Макс ×" + plan.cnt : "Макс";
    });
  }

  render() {
    ClickerEconomy.accrue(this.app.player);
    const power = ClickerEconomy.powerAt(this.app.player.clicker.pow);
    const auto = ClickerEconomy.autoAt(this.app.player.clicker.auto);
    document.querySelector("#main").innerHTML = this.back("games", "← До міні-ігор") + `<div class="ck"><div class="ck-stage">
      <div class="ck-bal"><b id="ckbal">${Money.format(this.app.player.balance)}</b><span>монет на рахунку</span></div>
      <div class="ck-coinwrap" id="ckarea"><i class="ck-ripple" id="ckrip"></i>
        <button class="ckbtn" onclick="app.hall.game('click').tap(event)" aria-label="Клік по монеті"><svg viewBox="0 0 200 200" aria-hidden="true">
          <defs><linearGradient id="cg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset=".5" stop-color="#f5b81c"/><stop offset="1" stop-color="#b87800"/></linearGradient>
          <linearGradient id="cg2" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe08a"/><stop offset=".6" stop-color="#f7c443"/><stop offset="1" stop-color="#d99a0c"/></linearGradient></defs>
          <circle cx="100" cy="100" r="96" fill="url(#cg1)"/>
          <circle cx="100" cy="100" r="88" fill="none" stroke="#9a6a00" stroke-opacity=".55" stroke-width="6" stroke-dasharray="3 5.2"/>
          <circle cx="100" cy="100" r="74" fill="url(#cg2)" stroke="#9a6a00" stroke-opacity=".5" stroke-width="2"/>
          <path d="M100 52l13.5 27.4 30.2 4.4-21.9 21.3 5.2 30.1L100 120.9 73 135.2l5.2-30.1-21.9-21.3 30.2-4.4z" fill="#b87800" fill-opacity=".55" transform="translate(0 4)"/>
          <path d="M100 52l13.5 27.4 30.2 4.4-21.9 21.3 5.2 30.1L100 120.9 73 135.2l5.2-30.1-21.9-21.3 30.2-4.4z" fill="#fff3c4" fill-opacity=".9"/>
        </svg></button></div>
      <div class="ck-rates"><span><b>${Money.format(power)}</b> за клік</span><span><b>${Money.format(auto)}</b> монет/с</span></div>
      <p class="ck-hint">Тицяй на монету. Автоклікери заробляють самі, навіть коли ти вийшов (до 2 годин).</p></div>
      <div class="ck-ups">${this.#card("pow")}${this.#card("auto")}</div></div>`;
    this.#refresh();
  }

  tap(event) {
    const power = ClickerEconomy.powerAt(this.app.player.clicker.pow);
    this.app.player.credit(power);
    this.app.shell.updateBalances();
    const label = document.querySelector("#ckbal");
    if (label) label.textContent = Money.format(this.app.player.balance);
    const area = document.querySelector("#ckarea");
    if (area && event) {
      const box = area.getBoundingClientRect();
      const floater = document.createElement("span");
      floater.className = "fl";
      floater.textContent = "+" + Money.format(power);
      floater.style.left = Math.max(0, Math.min(box.width - 30, (event.clientX || box.left + box.width / 2) - box.left - 10)) + "px";
      floater.style.top = Math.max(0, (event.clientY || box.top + box.height / 2) - box.top - 30) + "px";
      area.appendChild(floater);
      setTimeout(() => floater.remove(), 800);
    }
    const ripple = document.querySelector("#ckrip");
    if (ripple) { ripple.classList.remove("go"); void ripple.offsetWidth; ripple.classList.add("go"); }
    this.#refresh();
    this.#saveSoon();
  }

  buy(kind, count = 1) {
    ClickerEconomy.accrue(this.app.player);
    const plan = ClickerEconomy.plan(this.app.player, kind, count);
    if (plan.cnt < 1) {
      return this.app.toast("Не вистачає монет: потрібно " + Money.format(ClickerEconomy.price(kind, Math.max(1, this.app.player.clicker[kind]))));
    }
    this.app.player.debit(plan.sum);
    this.app.player.clicker[kind] += plan.cnt;
    this.app.saveState();
    this.app.shell.updateBalances();
    this.render();
  }
}
