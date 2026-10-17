import { FIREBASE_CONFIG } from "./firebase-config.js";

/** Анонімний вхід, хмара прогресу, кік і тайм-аут від адміна. */
export class CloudSync {
  #app;
  uid = null;
  db = null;
  auth = null;
  error = "";
  #subscribed = false;
  #hadDoc = false;
  #pushTimer = null;
  #mod = { kind: "", until: 0, timer: null };

  constructor(app) {
    this.#app = app;
  }

  get online() {
    return !!this.uid && !this.error;
  }

  static describe(error) {
    return String((error && error.code ? error.code + ": " : "") + (error && error.message ? error.message : error)).slice(0, 220);
  }

  async init() {
    const ready = typeof firebase !== "undefined";
    if (!ready) {
      this.error = "Firebase не завантажився";
      this.#app.shell.updateNet();
      return;
    }
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      this.db.settings({ experimentalAutoDetectLongPolling: true });
      this.auth.onAuthStateChanged((user) => {
        if (!user) return;
        this.uid = user.uid;
        this.#app.shell.updateNet();
        this.#subscribe();
      });
      this.auth.signInAnonymously().catch((error) => {
        this.error = CloudSync.describe(error);
        this.#app.profile.refreshStatus();
      });
    } catch (error) {
      this.error = CloudSync.describe(error);
    }
    this.#app.shell.updateNet();
  }

  #subscribe() {
    if (this.#subscribed || !this.db || !this.uid) return;
    this.#subscribed = true;
    this.db.doc("config/catalog").onSnapshot((snap) => {
      if (!snap.exists) return;
      try {
        const data = snap.data();
        if ((data.cv || 1) < 5) return;
        const list = JSON.parse(data.json);
        if (!Array.isArray(list) || !list.length) return;
        this.#app.catalog.cases = this.#app.catalog.applyFix(list, "net", data.del);
        this.#app.store.set("cg_cases", this.#app.catalog.cases);
        if (!this.#app.session.spinning && this.#app.session.view === "shop") this.#app.render();
      } catch { /* битий каталог ігноруємо */ }
    }, (error) => {
      this.error = CloudSync.describe(error);
      this.#app.profile.refreshStatus();
    });
    this.db.doc("players/" + this.uid).onSnapshot((snap) => {
      if (!snap.exists) {
        if (this.#hadDoc) this.#onDeleted();
        return;
      }
      this.#hadDoc = true;
      const data = snap.data();
      if ((data.adminRev || 0) > this.#app.player.adminRev) this.#applyAdmin(data);
      this.#checkModeration(data);
    }, (error) => {
      this.error = CloudSync.describe(error);
      this.#app.profile.refreshStatus();
    });
    this.push();
  }

  schedule(delay) {
    if (!this.uid || this.#pushTimer) return;
    this.#pushTimer = setTimeout(() => {
      this.#pushTimer = null;
      this.push();
    }, delay || 1200);
  }

  async push() {
    const player = this.#app.player;
    if (!this.uid || !this.db || !player.name) return;
    clearTimeout(this.#pushTimer);
    this.#pushTimer = null;
    const ref = this.db.doc("players/" + this.uid);
    let adminData = null;
    try {
      await this.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists && (snap.data().adminRev || 0) > player.adminRev) {
          adminData = snap.data();
          return;
        }
        const stamp = firebase.firestore.FieldValue.serverTimestamp();
        const state = player.snapshot();
        const base = {
          name: state.name,
          balance: state.bal,
          inv: JSON.stringify(state.inv),
          invCount: state.inv.length,
          invValue: player.inventoryValue(),
          bonusAt: state.bonusAt || 0,
          updatedAt: stamp,
        };
        if (snap.exists) tx.update(ref, base);
        else tx.set(ref, Object.assign({ adminRev: state.adminRev || 0, createdAt: stamp }, base));
      });
      this.error = "";
    } catch (error) {
      this.error = CloudSync.describe(error);
      if (!error || error.code !== "permission-denied") this.schedule(15000);
    }
    if (adminData) this.#applyAdmin(adminData);
    this.#app.profile.refreshStatus();
  }

  #applyAdmin(data) {
    this.#app.player.applyAdminSnapshot(data);
    this.#app.player.save(this.#app.store);
    this.#app.shell.updateBalances();
    if (!this.#app.session.spinning) this.#app.render();
    this.#app.toast("Адмін оновив ваш рахунок");
  }

  #onDeleted() {
    this.#hadDoc = false;
    this.#hideMod();
    this.#app.player.replaceAll({
      bal: 1000, inv: [], bonusAt: 0, name: "", adminRev: 0,
      ck: { pow: 1, auto: 0, at: Date.now() }, rbh: [], mn: null,
      rebirths: 0, bbal: 0, binv: [], bbGift: 0,
    });
    this.#app.player.save(this.#app.store);
    this.#app.session.spinning = false;
    this.#app.session.view = "shop";
    this.#app.render();
    this.#app.toast("Ваш акаунт видалено адміном");
  }

  #modRoot() {
    let node = document.getElementById("mod");
    if (node) return node;
    node = document.createElement("div");
    node.id = "mod";
    node.style.cssText = "position:fixed;inset:0;z-index:200;background:var(--bg);color:var(--ink);display:flex;align-items:center;justify-content:center;text-align:center;padding:24px";
    document.body.appendChild(node);
    return node;
  }

  #hideMod() {
    document.getElementById("mod")?.remove();
    clearInterval(this.#mod.timer);
    this.#mod.kind = "";
  }

  #showMod(kind) {
    if (kind === "ban" && this.#mod.kind === "ban") return;
    const node = this.#modRoot();
    this.#mod.kind = kind;
    clearInterval(this.#mod.timer);
    if (kind === "kick") {
      node.innerHTML = '<div><div style="font-size:54px">🚪</div><h2>Вас виключено з гри</h2><p class="note">Адмін завершив вашу поточну сесію.</p><button class="btn" onclick="location.reload()">Повернутися в гру</button></div>';
      return;
    }
    node.innerHTML = '<div><div style="font-size:54px">⛔</div><h2>Тайм-аут</h2><p class="note">Адмін тимчасово обмежив вам доступ до гри.</p><div class="bigbal" id="modt"></div></div>';
    const tick = () => {
      const left = this.#mod.until - Date.now();
      if (left <= 0) { this.#hideMod(); return; }
      const total = Math.ceil(left / 1000);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      const label = document.getElementById("modt");
      if (label) label.textContent = (hours ? hours + ":" : "") + String(minutes).padStart(hours ? 2 : 1, "0") + ":" + String(seconds).padStart(2, "0");
    };
    tick();
    this.#mod.timer = setInterval(tick, 1000);
  }

  #checkModeration(data) {
    const kick = Number(data.kickRev) || 0;
    const state = this.#app.player.snapshot();
    if (state.kickRev === undefined) {
      state.kickRev = kick;
      this.#app.player.save(this.#app.store);
    } else if (kick > state.kickRev) {
      state.kickRev = kick;
      this.#app.player.save(this.#app.store);
      this.#showMod("kick");
    }
    this.#mod.until = Number(data.banUntil) || 0;
    if (this.#mod.until > Date.now()) this.#showMod("ban");
    else if (this.#mod.kind === "ban") this.#hideMod();
  }
}
