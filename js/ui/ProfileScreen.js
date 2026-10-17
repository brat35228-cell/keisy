import { Html } from "../core/Html.js";
import { Money } from "../core/Money.js";

/** Нікнейм, зв'язок із сервером і ребірт. */
export class ProfileScreen {
  #app;

  constructor(app) {
    this.#app = app;
  }

  renderName() {
    document.querySelector("#main").innerHTML = `<div class="panel" style="max-width:420px;margin:30px auto"><h2>Як тебе звати?</h2><p class="note">Нікнейм побачить адміністратор гри.</p>
      <div style="display:grid;gap:8px"><input id="nm" maxlength="20" placeholder="Нікнейм" onkeydown="if(event.key==='Enter')app.profile.saveName('nm')"><button class="btn" onclick="app.profile.saveName('nm')">Почати гру</button></div></div>`;
  }

  saveName(inputId) {
    const app = this.#app;
    const field = document.querySelector("#" + inputId);
    const value = (field?.value || "").trim();
    if (value.length < 2) return app.toast("Нікнейм має бути від 2 символів");
    app.player.name = value.slice(0, 20);
    app.saveState();
    app.toast("Збережено");
    app.render();
  }

  statusHtml() {
    const cloud = this.#app.cloud;
    const online = cloud.online;
    return `<div class="note">Зв'язок з сервером: <b style="color:${online ? "var(--good)" : "var(--bad)"}">${online ? "є" : "немає"}</b>${cloud.uid ? " · ID …" + Html.escape(cloud.uid.slice(-6)) : ""}</div>${cloud.error ? `<div class="note" style="color:var(--bad);margin-top:6px;overflow-wrap:anywhere">${Html.escape(cloud.error)}</div>` : ""}`;
  }

  refreshStatus() {
    const node = document.querySelector("#mestat");
    if (node) node.innerHTML = this.statusHtml();
    this.#app.shell.updateNet();
  }

  render() {
    const app = this.#app;
    const rebirths = app.player.rebirths;
    const need = app.player.rebirthCost();
    const have = app.player.balance + app.player.inventoryValue();
    const ready = have >= need;
    const percent = Math.round(rebirths * 5);
    const factor = (1 + rebirths * 0.05).toFixed(2).replace(".", ",");
    document.querySelector("#main").innerHTML = `<div class="panel" style="max-width:480px"><h2>Профіль</h2>
      <div class="row two"><input id="mn" maxlength="20" value="${Html.escape(app.player.name)}"><button class="btn ghost" onclick="app.profile.saveName('mn')">Змінити нікнейм</button></div>
      <div id="mestat">${this.statusHtml()}</div>
      <p class="note">Прогрес зберігається на телефоні й копіюється на сервер. Якщо видалити додаток, прогрес на цьому пристрої втратиться.</p></div>
      <div class="panel" style="max-width:480px"><h2>Ребірт</h2>
        <div class="bigbal">×${factor} до цін речей</div>
        <p class="note">Зроблено ребіртів: <b>${rebirths}</b>${rebirths ? ` · речі з кейсів дорожчі на ${percent}%` : ""}. Скидаються монети, інвентар і міні-ігри. Ціни кейсів не змінюються — продавати речі стає вигідніше.</p>
        <p class="note">Для наступного ребірта потрібно <b>${Money.format(need)}</b> монет (рахунок + інвентар). Зараз: ${Money.format(have)}.</p>
        <p class="note">${rebirths >= 20 || app.admin.isAdmin ? "Вкладка Кейси 2 відкрита: майнкрафт-кейси, міні-ігри й бобр-коіни." : "Після 20 ребіртів відкриється вкладка Кейси 2 з окремою валютою."}</p>
        <div class="acts" style="justify-content:flex-start"><button class="btn ${ready ? "" : "ghost"}" ${ready ? "" : "disabled"} onclick="app.profile.rebirth()">${ready ? "Зробити ребірт" : "Ще рано"}</button></div></div>`;
  }

  rebirth() {
    const app = this.#app;
    const need = app.player.rebirthCost();
    const have = app.player.balance + app.player.inventoryValue();
    if (have < need) return app.toast("Потрібно " + Money.format(need) + " монет (рахунок + інвентар)");
    if (!confirm("Ребірт скине монети, інвентар і міні-ігри. Речі з кейсів стануть дорожчими на 5%. Продовжити?")) return;
    app.player.rebirthReset();
    app.session.lastDrops = [];
    let message = "Ребірт " + app.player.rebirths + "! Речі дорожчі на " + Math.round(app.player.rebirths * 5) + "%";
    if (app.player.rebirths === 20) {
      app.player.ensureBeaverGift(app.admin.isAdmin);
      message = "Ребірт 20! Відкрито вкладку Кейси 2 й бобр-коіни";
    }
    app.saveState();
    app.toast(message);
    app.render();
  }
}
