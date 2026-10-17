import { Html } from "../core/Html.js";
import { Ids } from "../core/Ids.js";
import { Money } from "../core/Money.js";
import { RarityTable } from "../models/RarityTable.js";
import { FIREBASE_CONFIG } from "../services/firebase-config.js";
import { CloudSync } from "../services/CloudSync.js";

/**
 * Адмінка: гравці, видача речей і редактор каталогу.
 * Права перевіряє Firestore, не клієнт.
 */
export class AdminConsole {
  #app;
  #firebaseApp = null;
  auth = null;
  db = null;
  players = [];
  selected = null;
  #unsub = null;
  error = "";
  busy = false;
  tab = "players";
  email = "";
  isAdmin = false;
  giveCase = null;
  giveIndex = 0;
  #itemDraft = null;
  #caseDraft = null;
  #deleteArmed = null;
  #purgeArmed = false;
  #catalogTimer = null;

  constructor(app) {
    this.#app = app;
  }

  init() {
    if (this.#firebaseApp || typeof firebase === "undefined") return;
    try {
      this.#firebaseApp = firebase.initializeApp(FIREBASE_CONFIG, "admin");
      this.auth = this.#firebaseApp.auth();
      this.db = this.#firebaseApp.firestore();
      this.db.settings({ experimentalAutoDetectLongPolling: true });
      this.auth.onAuthStateChanged((user) => {
        if (user && !user.isAnonymous) this.#verify(user);
        else {
          this.isAdmin = false;
          this.#stopPlayers();
          if (this.#app.session.view === "admin") this.#app.render();
        }
      });
    } catch (error) {
      this.error = CloudSync.describe(error);
    }
  }

  async #verify(user) {
    this.busy = true;
    try {
      await this.db.collection("players").limit(1).get();
      this.isAdmin = true;
      this.email = user.email || "";
      this.error = "";
      this.#app.store.set("cg_isadmin", 1);
      this.#listenPlayers();
    } catch (error) {
      this.isAdmin = false;
      this.error = error && error.code === "permission-denied"
        ? "Цей акаунт не має прав адміна. Перевір пошту в правилах Firestore."
        : CloudSync.describe(error);
      try { await this.auth.signOut(); } catch { /* уже вийшли */ }
    }
    this.busy = false;
    this.#app.render();
  }

  async login() {
    this.init();
    if (!this.auth) return this.#app.toast("Firebase недоступний");
    const email = document.querySelector("#ae").value.trim();
    const password = document.querySelector("#ap").value;
    if (!email || !password) return this.#app.toast("Введи пошту і пароль");
    this.error = "";
    this.busy = true;
    this.#app.render();
    try {
      await this.auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      this.busy = false;
      this.error = /invalid-credential|wrong-password|user-not-found|invalid-login/.test(error.code || "")
        ? "Неправильна пошта або пароль"
        : CloudSync.describe(error);
      this.#app.render();
    }
  }

  async logout() {
    try { await this.auth.signOut(); } catch { /* offline */ }
    this.isAdmin = false;
    this.#app.store.set("cg_isadmin", 0);
    this.#stopPlayers();
    this.#app.render();
  }

  #listenPlayers() {
    this.#stopPlayers();
    this.#unsub = this.db.collection("players").onSnapshot((snap) => {
      this.players = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
      const session = this.#app.session;
      if (session.view === "admin" && this.isAdmin && this.tab === "players") {
        this.#renderList();
        this.#renderDetail();
      }
    }, (error) => {
      this.error = CloudSync.describe(error);
      this.#app.toast("Помилка списку гравців");
    });
  }

  #stopPlayers() {
    if (!this.#unsub) return;
    try { this.#unsub(); } catch { /* already closed */ }
    this.#unsub = null;
  }

  setTab(tab) {
    this.tab = tab;
    this.#app.render();
  }

  render() {
    this.init();
    const main = document.querySelector("#main");
    if (!this.auth) {
      main.innerHTML = `<div class="panel"><h2>Адмін</h2><p class="note">Firebase не завантажився. ${Html.escape(this.error || this.#app.cloud.error)}</p></div>`;
      return;
    }
    if (!this.isAdmin) {
      main.innerHTML = `<div class="panel" style="max-width:420px"><h2>Вхід для адміна</h2>
        <div style="display:grid;gap:8px"><input id="ae" type="email" placeholder="Пошта адміна" autocomplete="username"><input id="ap" type="password" placeholder="Пароль" autocomplete="current-password" onkeydown="if(event.key==='Enter')app.admin.login()"><button class="btn" onclick="app.admin.login()" ${this.busy ? "disabled" : ""}>${this.busy ? "Перевірка…" : "Увійти"}</button></div>
        ${this.error ? `<p class="note" style="color:var(--bad);overflow-wrap:anywhere">${Html.escape(this.error)}</p>` : ""}</div>`;
      return;
    }
    main.innerHTML = `<div class="panel"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <div class="tabs2"><button class="btn sm ${this.tab === "players" ? "" : "ghost"}" onclick="app.admin.setTab('players')">Гравці</button><button class="btn sm ${this.tab === "cases" ? "" : "ghost"}" onclick="app.admin.setTab('cases')">Кейси</button></div>
      <div class="note">${Html.escape(this.email)} <button class="btn ghost sm" onclick="app.admin.logout()">Вийти</button></div></div></div>`
      + (this.tab === "players"
        ? `<div class="cols"><div class="panel"><h3>Гравці (${this.players.length})</h3><input id="psearch" placeholder="Пошук за нікнеймом" oninput="app.admin.paintList()"><div id="pbulk"></div><div id="plist"></div></div><div class="panel" id="pdet"></div></div>`
        : this.#casesHtml());
    if (this.tab === "players") {
      this.#renderList();
      this.#renderDetail(true);
    }
  }

  paintList() { this.#renderList(); }

  #stamp(player) {
    return player && player.updatedAt && player.updatedAt.toMillis ? player.updatedAt.toMillis() : 0;
  }

  #ago(time) {
    if (!time) return "давно";
    const seconds = Math.floor((Date.now() - time) / 1000);
    if (seconds < 60) return "щойно";
    if (seconds < 3600) return Math.floor(seconds / 60) + " хв тому";
    if (seconds < 86400) return Math.floor(seconds / 3600) + " год тому";
    return Math.floor(seconds / 86400) + " дн тому";
  }

  #stale() {
    const limit = Date.now() - 7 * 864e5;
    return this.players.filter((player) => this.#stamp(player) < limit);
  }

  #renderList() {
    const host = document.querySelector("#plist");
    if (!host) return;
    const query = (document.querySelector("#psearch")?.value || "").toLowerCase();
    const list = this.players
      .filter((player) => !query || (player.name || "").toLowerCase().includes(query))
      .sort((a, b) => this.#stamp(b) - this.#stamp(a));
    const stale = this.#stale();
    const bulk = document.querySelector("#pbulk");
    if (bulk) {
      bulk.innerHTML = stale.length
        ? `<button class="btn danger sm" style="margin:8px 0" onclick="app.admin.purge()">${this.#purgeArmed ? "Точно? Видалити " + stale.length + " акаунтів" : "Видалити неактивних 7+ днів (" + stale.length + ")"}</button>`
        : "";
    }
    host.innerHTML = list.length
      ? list.map((player) => `<button class="plr${player.id === this.selected ? " on" : ""}" onclick="app.admin.select('${player.id}')"><b>${Html.escape(player.name || "Без імені")}${Number(player.banUntil) > Date.now() ? " ⛔" : ""}</b><span>${Money.format(player.balance || 0)} монет · ${player.invCount || 0} речей · ${this.#ago(this.#stamp(player))}</span></button>`).join("")
      : '<div class="empty">Гравців поки немає</div>';
  }

  select(id) {
    this.selected = id;
    this.#renderList();
    this.#renderDetail(true);
    document.querySelector("#pdet")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  #renderDetail(force) {
    const host = document.querySelector("#pdet");
    if (!host) return;
    const active = document.activeElement;
    if (!force && active && (active.tagName === "INPUT" || active.tagName === "SELECT") && host.contains(active)) return;
    const player = this.players.find((entry) => entry.id === this.selected);
    if (!player) { host.innerHTML = '<div class="empty">Вибери гравця зі списку</div>'; return; }
    let inventory = [];
    try { inventory = JSON.parse(player.inv || "[]"); } catch { inventory = []; }
    host.innerHTML = `<h3>${Html.escape(player.name || "Без імені")}</h3><div class="note">ID …${Html.escape(player.id.slice(-6))} · був ${this.#ago(this.#stamp(player))}</div>
      <div class="bigbal">${Money.format(player.balance || 0)} монет</div>
      <div class="row two"><input id="bv" type="number" min="0" placeholder="Сума"><button class="btn" onclick="app.admin.setBalance('set')">Встановити</button></div>
      <div class="acts" style="justify-content:flex-start;margin:0 0 6px"><button class="btn sm ghost" onclick="app.admin.setBalance('add')">+ Додати</button><button class="btn sm ghost" onclick="app.admin.setBalance('sub')">− Забрати</button></div>
      <div class="bigbal" style="margin-top:12px">${Money.format(player.bbal || 0)} бобр-коінів</div>
      <div class="row two"><input id="bbv" type="number" min="0" placeholder="Сума бобр-коінів"><button class="btn" onclick="app.admin.setBeavers('set')">Встановити</button></div>
      <div class="acts" style="justify-content:flex-start;margin:0 0 6px"><button class="btn sm ghost" onclick="app.admin.setBeavers('add')">+ Видати</button><button class="btn sm ghost" onclick="app.admin.setBeavers('sub')">− Забрати</button></div>
      ${this.#giveHtml()}
      <h3 style="margin-top:14px">Інвентар (${inventory.length})</h3>
      <div style="display:grid;gap:8px">${inventory.slice(0, 100).map((item) => `<div class="it" style="--c:${this.#app.rarity.color(item.r || 0)}"><span class="em">${this.#app.images.itemHtml(item)}</span><div class="tx"><b>${Html.escape(item.n)}</b><span>${Money.format(item.v)} монет</span></div><button class="btn danger sm" onclick="app.admin.removeItem('${Html.escape(item.uid)}')">Забрати</button></div>`).join("") || '<div class="empty">Порожньо</div>'}</div>
      ${inventory.length > 100 ? '<p class="note">Показано перші 100 речей.</p>' : ""}
      ${inventory.length ? '<button class="btn danger sm" style="margin-top:10px" onclick="app.admin.clearInventory()">Очистити інвентар</button>' : ""}
      ${this.#accountHtml(player)}`;
  }

  #accountHtml(player) {
    const ban = Number(player.banUntil) || 0;
    const active = ban > Date.now();
    return `<h3 style="margin-top:16px">Керування акаунтом</h3>
      ${active ? `<div class="note" style="color:var(--bad)">⛔ Тайм-аут до ${Html.escape(new Date(ban).toLocaleString("uk-UA"))}</div>` : ""}
      <div class="acts" style="justify-content:flex-start;margin:6px 0"><button class="btn sm ghost" onclick="app.admin.kick()">Кікнути з гри</button>${active ? '<button class="btn sm ghost" onclick="app.admin.ban(0)">Зняти тайм-аут</button>' : ""}</div>
      <div class="note">Тайм-аут:</div>
      <div class="acts" style="justify-content:flex-start;margin:4px 0"><button class="btn sm ghost" onclick="app.admin.ban(5)">5 хв</button><button class="btn sm ghost" onclick="app.admin.ban(30)">30 хв</button><button class="btn sm ghost" onclick="app.admin.ban(60)">1 год</button><button class="btn sm ghost" onclick="app.admin.ban(1440)">24 год</button></div>
      <button class="btn danger sm" style="margin-top:12px" onclick="app.admin.deleteAccount()">${this.#deleteArmed === player.id ? "Точно видалити? Натисни ще раз" : "Видалити акаунт"}</button>`;
  }

  async #patch(uid, patch, message) {
    if (!uid || !this.db) return;
    try {
      await this.db.doc("players/" + uid).update(patch);
      this.#app.toast(message);
    } catch (error) {
      this.#app.toast("Помилка: " + CloudSync.describe(error));
    }
  }

  kick() {
    this.#patch(this.selected, { kickRev: firebase.firestore.FieldValue.increment(1) }, "Гравця кікнуто");
  }

  ban(minutes) {
    this.#patch(this.selected, { banUntil: minutes > 0 ? Date.now() + minutes * 60000 : 0 }, minutes > 0 ? "Тайм-аут видано" : "Тайм-аут знято");
  }

  async deleteAccount() {
    const id = this.selected;
    if (!id || !this.db) return;
    if (this.#deleteArmed !== id) {
      this.#deleteArmed = id;
      this.#renderDetail(true);
      setTimeout(() => {
        if (this.#deleteArmed === id) { this.#deleteArmed = null; this.#renderDetail(true); }
      }, 4000);
      return;
    }
    this.#deleteArmed = null;
    try {
      await this.db.doc("players/" + id).delete();
      this.selected = null;
      this.#app.toast("Акаунт видалено");
    } catch (error) {
      this.#app.toast("Помилка: " + CloudSync.describe(error));
    }
    this.#renderList();
    this.#renderDetail(true);
  }

  async purge() {
    const list = this.#stale();
    if (!list.length) return;
    if (!this.#purgeArmed) {
      this.#purgeArmed = true;
      this.#renderList();
      setTimeout(() => { this.#purgeArmed = false; this.#renderList(); }, 4000);
      return;
    }
    this.#purgeArmed = false;
    try {
      for (let index = 0; index < list.length; index += 400) {
        const batch = this.db.batch();
        list.slice(index, index + 400).forEach((player) => batch.delete(this.db.doc("players/" + player.id)));
        await batch.commit();
      }
      if (list.some((player) => player.id === this.selected)) this.selected = null;
      this.#app.toast("Видалено акаунтів: " + list.length);
    } catch (error) {
      this.#app.toast("Помилка: " + CloudSync.describe(error));
    }
    this.#renderList();
    this.#renderDetail(true);
  }

  async #transaction(uid, mutate) {
    if (!uid || !this.db) return;
    const ref = this.db.doc("players/" + uid);
    try {
      await this.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return;
        const data = snap.data();
        const patch = mutate(data);
        tx.update(ref, Object.assign({}, patch, { adminRev: (data.adminRev || 0) + 1 }));
      });
      this.#app.toast("Збережено");
    } catch (error) {
      this.#app.toast("Помилка: " + CloudSync.describe(error));
    }
  }

  #inventoryPatch(inventory) {
    return {
      inv: JSON.stringify(inventory),
      invCount: inventory.length,
      invValue: inventory.reduce((sum, item) => sum + (item.v || 0), 0),
    };
  }

  setBalance(mode) {
    const raw = document.querySelector("#bv").value;
    if (raw === "") return this.#app.toast("Введи суму");
    const value = Math.round(Number(raw));
    if (!(value >= 0)) return this.#app.toast("Сума має бути від 0");
    document.querySelector("#bv").value = "";
    this.#transaction(this.selected, (data) => {
      const balance = Number(data.balance) || 0;
      return { balance: mode === "set" ? value : mode === "add" ? balance + value : Math.max(0, balance - value) };
    });
  }

  setBeavers(mode) {
    const raw = document.querySelector("#bbv").value;
    if (raw === "") return this.#app.toast("Введи суму бобр-коінів");
    const value = Math.round(Number(raw));
    if (!(value >= 0)) return this.#app.toast("Сума має бути від 0");
    document.querySelector("#bbv").value = "";
    this.#transaction(this.selected, (data) => {
      const current = Number(data.bbal) || 0;
      return { bbal: mode === "set" ? value : mode === "add" ? current + value : Math.max(0, current - value) };
    });
  }

  removeItem(uid) {
    this.#transaction(this.selected, (data) => {
      let inventory = [];
      try { inventory = JSON.parse(data.inv || "[]"); } catch { inventory = []; }
      return this.#inventoryPatch(inventory.filter((item) => item.uid !== uid));
    });
  }

  clearInventory() {
    this.#transaction(this.selected, () => this.#inventoryPatch([]));
  }

  #giveHtml() {
    const cases = this.#app.catalog.cases;
    if (!cases.length) return "";
    if (!cases.find((entry) => entry.id === this.giveCase)) this.giveCase = cases[0].id;
    const lootCase = cases.find((entry) => entry.id === this.giveCase);
    if (!lootCase.items[+this.giveIndex]) this.giveIndex = 0;
    return `<h3 style="margin-top:14px">Видати предмет</h3>
      <div style="display:grid;gap:8px">
        <select id="gc" onchange="app.admin.pickGiveCase(this.value)">${cases.map((entry) => `<option value="${Html.escape(entry.id)}" ${entry.id === this.giveCase ? "selected" : ""}>${Html.escape(entry.e)} ${Html.escape(entry.n)}</option>`).join("")}</select>
        <select id="gi" onchange="app.admin.giveIndex=+this.value">${lootCase.items.map((item, index) => `<option value="${index}" ${index === +this.giveIndex ? "selected" : ""}>${Html.escape(item.e)} ${Html.escape(item.n)} · ${Money.format(item.v)}</option>`).join("")}</select>
        <div class="row two"><input id="gq" type="number" min="1" max="500" value="1" placeholder="Кількість"><button class="btn" onclick="app.admin.giveSelected()">Видати</button></div>
        <details><summary class="note" style="cursor:pointer">Свій предмет (будь-яка назва й ціна)</summary>
          <div style="display:grid;gap:8px;margin-top:8px">
            <div class="row two"><input id="gce" maxlength="4" value="🎁" placeholder="Емодзі"><input id="gcn" maxlength="40" placeholder="Назва"></div>
            <div class="row two"><input id="gcv" type="number" min="0" placeholder="Вартість"><select id="gcr">${RarityTable.NAMES.map((name, index) => `<option value="${index}">${name}</option>`).join("")}</select></div>
            <button class="btn ghost" onclick="app.admin.giveCustom()">Видати свій предмет (кількість зверху)</button>
          </div></details>
      </div>`;
  }

  pickGiveCase(id) {
    this.giveCase = id;
    this.giveIndex = 0;
    this.#renderDetail(true);
  }

  giveSelected() {
    const lootCase = this.#app.catalog.find(this.giveCase);
    const item = lootCase && lootCase.items[+this.giveIndex];
    if (!item) return this.#app.toast("Обери предмет");
    this.#give(item, this.#app.rarity.tier(item.v, this.#app.rarity.baseOf(lootCase)), lootCase.n, document.querySelector("#gq").value);
  }

  giveCustom() {
    const name = document.querySelector("#gcn").value.trim();
    if (!name) return this.#app.toast("Введи назву");
    const value = Math.max(0, Math.round(Number(document.querySelector("#gcv").value) || 0));
    this.#give({
      e: document.querySelector("#gce").value.trim() || "🎁",
      n: name,
      v: value,
    }, +document.querySelector("#gcr").value || 0, "Адмін", document.querySelector("#gq").value);
  }

  #give(item, tier, from, rawCount) {
    if (!this.isAdmin || !this.selected) return;
    const count = Math.max(1, Math.min(500, Math.round(Number(rawCount) || 1)));
    this.#transaction(this.selected, (data) => {
      let inventory = [];
      try { inventory = JSON.parse(data.inv || "[]"); } catch { inventory = []; }
      if (inventory.length + count > 5000) throw new Error("В інвентарі не може бути понад 5000 речей");
      const added = [];
      for (let index = 0; index < count; index++) {
        added.push({ uid: Ids.next(), e: item.e, n: item.n, v: item.v, r: tier, from });
      }
      return this.#inventoryPatch(added.concat(inventory));
    });
  }

  scheduleCatalogPush() {
    if (!this.isAdmin || !this.db) return;
    clearTimeout(this.#catalogTimer);
    this.#catalogTimer = setTimeout(() => this.pushCatalog(), 600);
  }

  async pushCatalog() {
    if (!this.db) return;
    const cases = this.#app.catalog.cases;
    const json = JSON.stringify(cases);
    if (json.length > 900000) {
      this.#app.toast("Забагато картинок: каталог завеликий для відправки (понад 900 КБ). Прибери частину картинок");
      return;
    }
    try {
      const deleted = Array.from({ length: this.#app.catalog.size }, (_, index) => "c" + index)
        .filter((id) => !cases.find((entry) => entry.id === id));
      await this.db.doc("config/catalog").set({ json, v: Date.now(), cv: 6, del: deleted });
      this.#app.toast("Кейси відправлено гравцям");
    } catch (error) {
      this.#app.toast("Не вдалося відправити кейси: " + CloudSync.describe(error));
    }
  }

  #casesHtml() {
    const app = this.#app;
    const cases = app.catalog.cases;
    if (!app.session.adminCase || !cases.find((entry) => entry.id === app.session.adminCase)) {
      app.session.adminCase = cases[0] ? cases[0].id : null;
    }
    const lootCase = cases.find((entry) => entry.id === app.session.adminCase);
    return `<div class="cols">
      <div class="panel"><h3>Речі в кейсі</h3>
        <select id="sel" onchange="app.admin.pickCase(this.value)">${cases.map((entry) => `<option value="${entry.id}" ${entry.id === app.session.adminCase ? "selected" : ""}>${Html.escape(entry.e)} ${Html.escape(entry.n)} (${entry.items.length})</option>`).join("")}</select>
        ${lootCase ? `<div class="acts" style="justify-content:flex-start;margin-top:8px;align-items:center"><span class="sticker" style="width:44px;height:44px;margin:0;font-size:24px">${app.images.caseHtml(lootCase)}</span><button class="btn ghost sm" onclick="app.admin.pickCaseImage()">🖼 Картинка кейсу</button>${lootCase.img ? '<button class="btn ghost sm" onclick="app.admin.clearCaseImage()">Прибрати</button>' : ""}</div>` : ""}
        <div style="margin-top:12px;display:grid;gap:8px">${lootCase ? lootCase.items.map((item, index) => `<div class="it" style="--c:${app.rarity.color(app.rarity.tier(item.v, app.rarity.baseOf(lootCase)))}"><span class="em">${app.images.itemHtml(item, lootCase.n)}</span><div class="tx"><b>${Html.escape(item.n)}</b><span>${Money.format(item.v)} монет · ${app.rarity.name(app.rarity.tier(item.v, app.rarity.baseOf(lootCase)))}</span></div><button class="btn ghost sm" onclick="app.admin.pickItemImage(${index})">🖼</button>${item.img ? `<button class="btn ghost sm" onclick="app.admin.clearItemImage(${index})">✕</button>` : ""}<button class="btn danger sm" onclick="app.admin.deleteItem(${index})">Видалити</button></div>`).join("") || '<div class="empty">Кейс порожній</div>' : '<div class="empty">Немає кейсів</div>'}</div>
        ${lootCase ? `<button class="btn danger sm" style="margin-top:12px" onclick="app.admin.deleteCase()">Видалити весь кейс</button>` : ""}
      </div>
      <div>
        <div class="panel"><h3>Додати річ у вибраний кейс</h3>
          <div class="row"><input id="ie" placeholder="🎁" maxlength="4"><input id="in" placeholder="Назва речі"><input id="iv" type="number" min="1" placeholder="Ціна"></div>
          <div class="acts" style="justify-content:flex-start;margin:8px 0;align-items:center"><button class="btn ghost sm" onclick="app.admin.pickDraft('item')">🖼 Картинка речі</button><span id="iprev" class="note">без картинки</span></div>
          <button class="btn" onclick="app.admin.addItem()">Додати річ</button>
          <p class="note">Рідкість залежить від ціни відносно ціни кейсу: що дорожча річ, то рідше випадає.</p></div>
        <div class="panel"><h3>Новий кейс</h3>
          <div class="row"><input id="ce" placeholder="📦" maxlength="4"><input id="cn" placeholder="Назва кейсу"><input id="cp" type="number" min="1" placeholder="Ціна"></div>
          <div class="acts" style="justify-content:flex-start;margin:8px 0;align-items:center"><button class="btn ghost sm" onclick="app.admin.pickDraft('case')">🖼 Картинка кейсу</button><span id="cprev" class="note">без картинки</span></div>
          <button class="btn" onclick="app.admin.addCase()">Створити кейс</button></div>
        <div class="panel"><h3>Для всіх гравців</h3>
          <p class="note">Зміни кейсів автоматично відправляються гравцям. Якщо щойно почав, натисни кнопку, щоб відправити поточні кейси.</p>
          <div class="acts" style="justify-content:flex-start"><button class="btn" onclick="app.admin.pushCatalog()">Відправити кейси гравцям</button>
          <button class="btn ${app.session.resetArmed ? "danger" : "ghost"}" onclick="app.admin.resetCatalog()">${app.session.resetArmed ? "Точно скинути всі кейси?" : "Повернути " + app.catalog.size + " стандартних кейсів"}</button></div></div>
      </div>
    </div>`;
  }

  pickCase(id) {
    this.#app.session.adminCase = id;
    this.#app.render();
  }

  #selectedCase() {
    return this.#app.catalog.find(this.#app.session.adminCase);
  }

  addItem() {
    if (!this.isAdmin) return;
    const lootCase = this.#selectedCase();
    if (!lootCase) return;
    const name = document.querySelector("#in").value.trim();
    const value = Math.round(Number(document.querySelector("#iv").value));
    const emoji = document.querySelector("#ie").value.trim() || "🎁";
    if (!name) return this.#app.toast("Введи назву речі");
    if (!(value > 0)) return this.#app.toast("Введи ціну більше нуля");
    const item = { e: emoji, n: name, v: value };
    if (this.#itemDraft) { item.img = this.#itemDraft; this.#itemDraft = null; }
    lootCase.items.push(item);
    this.#app.saveCatalog();
    this.#app.toast("Річ додано");
    this.#app.render();
  }

  #pickImage(done) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.type && !/^image\//.test(file.type)) return this.#app.toast("Обери файл-картинку");
      const reader = new FileReader();
      reader.onerror = () => this.#app.toast("Не вдалося прочитати файл");
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => this.#app.toast("Не вдалося відкрити картинку");
        image.onload = () => {
          const size = 128;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const side = Math.min(image.width, image.height);
          canvas.getContext("2d").drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
          let data = canvas.toDataURL("image/webp", 0.75);
          if (data.indexOf("data:image/webp") !== 0) data = canvas.toDataURL("image/jpeg", 0.8);
          done(data);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  pickDraft(kind) {
    if (!this.isAdmin) return;
    this.#pickImage((data) => {
      if (kind === "item") {
        this.#itemDraft = data;
        const preview = document.querySelector("#iprev");
        if (preview) preview.innerHTML = '<img src="' + data + '" style="width:36px;height:36px;border-radius:8px;vertical-align:middle"> вибрано';
      } else {
        this.#caseDraft = data;
        const preview = document.querySelector("#cprev");
        if (preview) preview.innerHTML = '<img src="' + data + '" style="width:36px;height:36px;border-radius:8px;vertical-align:middle"> вибрано';
      }
    });
  }

  pickItemImage(index) {
    if (!this.isAdmin) return;
    const lootCase = this.#selectedCase();
    if (!lootCase || !lootCase.items[index]) return;
    this.#pickImage((data) => {
      lootCase.items[index].img = data;
      this.#app.saveCatalog();
      this.#app.toast("Картинку додано");
      this.#app.render();
    });
  }

  clearItemImage(index) {
    if (!this.isAdmin) return;
    const lootCase = this.#selectedCase();
    if (!lootCase?.items[index]) return;
    delete lootCase.items[index].img;
    this.#app.saveCatalog();
    this.#app.render();
  }

  pickCaseImage() {
    if (!this.isAdmin) return;
    const lootCase = this.#selectedCase();
    if (!lootCase) return;
    this.#pickImage((data) => {
      lootCase.img = data;
      this.#app.saveCatalog();
      this.#app.toast("Картинку додано");
      this.#app.render();
    });
  }

  clearCaseImage() {
    if (!this.isAdmin) return;
    const lootCase = this.#selectedCase();
    if (!lootCase) return;
    delete lootCase.img;
    this.#app.saveCatalog();
    this.#app.render();
  }

  deleteItem(index) {
    if (!this.isAdmin) return;
    const lootCase = this.#selectedCase();
    if (!lootCase) return;
    lootCase.items.splice(index, 1);
    this.#app.saveCatalog();
    this.#app.render();
  }

  addCase() {
    if (!this.isAdmin) return;
    const name = document.querySelector("#cn").value.trim();
    const price = Math.round(Number(document.querySelector("#cp").value));
    const emoji = document.querySelector("#ce").value.trim() || "📦";
    if (!name) return this.#app.toast("Введи назву кейсу");
    if (!(price > 0)) return this.#app.toast("Введи ціну кейсу");
    const created = { id: "c" + Date.now(), n: name, e: emoji, p: price, items: [] };
    if (this.#caseDraft) { created.img = this.#caseDraft; this.#caseDraft = null; }
    this.#app.catalog.cases.push(created);
    this.#app.session.adminCase = created.id;
    this.#app.saveCatalog();
    this.#app.toast("Кейс створено. Додай у нього речі");
    this.#app.render();
  }

  deleteCase() {
    if (!this.isAdmin) return;
    const id = this.#app.session.adminCase;
    this.#app.catalog.cases = this.#app.catalog.cases.filter((entry) => entry.id !== id);
    this.#app.session.adminCase = null;
    this.#app.saveCatalog();
    this.#app.render();
  }

  resetCatalog() {
    if (!this.isAdmin) return;
    if (!this.#app.session.resetArmed) {
      this.#app.session.resetArmed = true;
      this.#app.render();
      return;
    }
    this.#app.catalog.cases = this.#app.catalog.defaults();
    this.#app.session.adminCase = null;
    this.#app.session.resetArmed = false;
    this.#app.saveCatalog();
    this.#app.toast("Кейси скинуто");
    this.#app.render();
  }
}
