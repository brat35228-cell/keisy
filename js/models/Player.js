import { Money } from "../core/Money.js";

/** Стан гравця. Поля збереження сумісні зі старою грою й сервером. */
export class Player {
  #state;

  constructor(raw) {
    this.#state = raw && typeof raw === "object" ? raw : Player.blank();
    this.#normalize();
  }

  static blank() {
    return { bal: 1000, inv: [], bonusAt: 0 };
  }

  static load(store) {
    return new Player(store.get("cg_state") || Player.blank());
  }

  #normalize() {
    const state = this.#state;
    state.name = state.name || "";
    state.adminRev = state.adminRev || 0;
    state.ck = state.ck || { pow: 1, auto: 0, at: Date.now() };
    state.rbh = state.rbh || [];
    state.mn = state.mn ?? null;
    state.rebirths = state.rebirths || 0;
    state.bbal = state.bbal || 0;
    state.binv = state.binv || [];
    state.bbGift = state.bbGift || 0;
    state.inv = state.inv || [];
    state.bal = Number(state.bal) || 0;
    state.bonusAt = state.bonusAt || 0;
  }

  /** Знімок для localStorage / Firestore — той самий об'єкт, що мутують методи. */
  snapshot() {
    return this.#state;
  }

  save(store) {
    store.set("cg_state", this.#state);
  }

  get name() { return this.#state.name; }
  set name(value) { this.#state.name = value; }
  get balance() { return this.#state.bal; }
  get inventory() { return this.#state.inv; }
  get bonusAt() { return this.#state.bonusAt; }
  set bonusAt(value) { this.#state.bonusAt = value; }
  get rebirths() { return this.#state.rebirths || 0; }
  get clicker() { return this.#state.ck; }
  get rouletteHistory() { return this.#state.rbh; }
  get mines() { return this.#state.mn; }
  set mines(value) { this.#state.mn = value; }
  get beaverBalance() { return this.#state.bbal || 0; }
  get beaverInventory() { return this.#state.binv; }
  get adminRev() { return this.#state.adminRev || 0; }

  credit(amount) { this.#state.bal += amount; }
  debit(amount) { this.#state.bal -= amount; }
  creditBeavers(amount) { this.#state.bbal = (this.#state.bbal || 0) + amount; }
  debitBeavers(amount) { this.#state.bbal -= amount; }

  itemMultiplier() {
    return 1 + this.rebirths * 0.05;
  }

  priceOf(baseValue) {
    const multiplier = this.itemMultiplier();
    return multiplier === 1 ? baseValue : Money.round(baseValue * multiplier);
  }

  rebirthCost() {
    return Money.round(100000 * Math.pow(10, this.rebirths));
  }

  inventoryValue() {
    return this.inventory.reduce((sum, item) => sum + item.v, 0);
  }

  beaverUnlocked(isAdmin) {
    return !!isAdmin || this.rebirths >= 20;
  }

  /** Перший вхід у бобрів дарує стартові бобр-коіни. Повертає true, якщо дарунок видано. */
  ensureBeaverGift(isAdmin) {
    if (!this.beaverUnlocked(isAdmin)) return false;
    if (this.#state.bbGift) return false;
    this.#state.bbGift = 1;
    this.#state.bbal = (this.#state.bbal || 0) + 100;
    this.#state.binv = this.#state.binv || [];
    return true;
  }

  unshiftItems(items) {
    this.inventory.unshift(...items);
  }

  takeItem(uid) {
    const index = this.inventory.findIndex((item) => item.uid === uid);
    if (index < 0) return null;
    return this.inventory.splice(index, 1)[0];
  }

  unshiftBeavers(items) {
    this.beaverInventory.unshift(...items);
  }

  takeBeaver(uid) {
    const index = this.beaverInventory.findIndex((item) => item.uid === uid);
    if (index < 0) return null;
    return this.beaverInventory.splice(index, 1)[0];
  }

  rebirthReset() {
    this.#state.rebirths = this.rebirths + 1;
    this.#state.bal = 1000;
    this.#state.inv = [];
    this.#state.bonusAt = 0;
    this.#state.ck = { pow: 1, auto: 0, at: Date.now() };
    this.#state.rbh = [];
    this.#state.mn = null;
  }

  replaceAll(next) {
    this.#state = next;
    this.#normalize();
  }

  applyAdminSnapshot(data) {
    this.#state.bal = Number(data.balance) || 0;
    try { this.#state.inv = JSON.parse(data.inv || "[]"); } catch { /* лишаємо інвентар */ }
    this.#state.adminRev = data.adminRev || 0;
  }
}
