import { Money } from "../core/Money.js";
import { Session } from "../app/Session.js";

/** Шапка, вкладки, тости й перемикання екранів. Сам вміст малюють екрани. */
export class Shell {
  #app;
  #toastTimer = null;

  constructor(app) {
    this.#app = app;
  }

  toast(message) {
    const node = document.querySelector("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  updateBalances() {
    const app = this.#app;
    const balance = document.querySelector("#bal");
    if (balance) balance.textContent = Money.format(app.player.balance);
    const badge = document.querySelector("#rbbadge");
    const count = document.querySelector("#rbn");
    if (badge && count) {
      count.textContent = String(app.player.rebirths);
      badge.style.display = app.player.rebirths ? "" : "none";
    }
    const wrap = document.querySelector("#bbwrap");
    const beavers = document.querySelector("#bbal");
    if (wrap && beavers) {
      beavers.textContent = Money.format(app.player.beaverBalance);
      wrap.style.display = app.player.beaverUnlocked(app.admin.isAdmin) ? "" : "none";
    }
  }

  updateNet() {
    const node = document.querySelector("#net");
    if (!node) return;
    const online = this.#app.cloud.online;
    node.textContent = online ? "Онлайн" : "Офлайн";
    node.className = "net" + (online ? " on" : "");
  }

  updateInventoryLabel() {
    const button = document.querySelector('#nav button[data-tab="inv"]');
    if (button) button.textContent = "Інвентар (" + this.#app.player.inventory.length + ")";
  }

  render() {
    const app = this.#app;
    app.images.refresh(app.catalog.cases);
    if (app.player.ensureBeaverGift(app.admin.isAdmin)) app.saveState();
    this.updateBalances();
    this.updateNet();
    if (!app.player.name) {
      document.querySelector("#nav").innerHTML = "";
      app.profile.renderName();
      return;
    }
    if (Session.BEAVER_VIEWS.includes(app.session.view) && !app.player.beaverUnlocked(app.admin.isAdmin)) {
      app.session.view = "shop";
    }
    this.#renderNav();
    const view = app.session.view;
    if (view === "shop") app.shop.render();
    else if (view === "case") app.cases.render();
    else if (view === "games") app.hall.renderMenu();
    else if (view === "game") app.hall.renderCurrent();
    else if (view === "inv") app.inventory.render();
    else if (view === "me") app.profile.render();
    else if (view === "beaver") app.beavers.renderShop();
    else if (view === "bcase") app.beavers.renderCase();
    else if (view === "bgames") app.beavers.renderGames();
    else if (view === "bgame") app.beavers.renderGame();
    else if (view === "binv") app.beavers.renderInventory();
    else app.admin.render();
  }

  #renderNav() {
    const app = this.#app;
    const view = app.session.view;
    const tabs = [["shop", "Кейси"], ["games", "Міні-ігри"]];
    if (app.player.beaverUnlocked(app.admin.isAdmin)) tabs.push(["beaver", "Бобри"]);
    tabs.push(
      ["inv", "Інвентар (" + app.player.inventory.length + ")"],
      ["me", "Профіль"],
      ["admin", app.admin.isAdmin ? "Адмін 🔓" : "Адмін 🔒"],
    );
    document.querySelector("#nav").innerHTML = tabs.map(([key, label]) => {
      const on = view === key
        || (view === "case" && key === "shop")
        || (view === "game" && key === "games")
        || (Session.BEAVER_VIEWS.includes(view) && key === "beaver");
      return `<button data-tab="${key}" class="${on ? "on" : ""}" onclick="app.go('${key}')">${label}</button>`;
    }).join("");
  }
}
