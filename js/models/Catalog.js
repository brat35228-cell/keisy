import { RAW } from "../data/raw-cases.js";
import { Money } from "../core/Money.js";

/**
 * Каталог кейсів: збірка, міграція старих збережень і запис на пристрій.
 * Ціни стандартних кейсів рахуються з сирих даних, а не зашиті намертво.
 */
export class Catalog {
  static MULTIPLIERS = [0.55, 0.65, 0.75, 0.85, 0.95, 1.05, 1.15, 1.3, 1.5, 1.8, 2.2, 3, 4.5, 7, 11, 20];
  static PRICE_CUT = 0.9;
  static SCHEMA = 6;

  #cases = [];
  #store;

  constructor(store) {
    this.#store = store;
    this.#cases = this.applyFix(store.get("cg_cases") || this.defaults(), "local");
    this.#migrate();
    store.set("cg_cases", this.#cases);
  }

  get cases() {
    return this.#cases;
  }

  set cases(next) {
    this.#cases = next;
  }

  get size() {
    return RAW.length;
  }

  find(id) {
    return this.#cases.find((entry) => entry.id === id);
  }

  defaults() {
    return RAW.map((entry, index) => {
      const price = entry.p > 0 ? Money.round(entry.p * Catalog.PRICE_CUT) : 0;
      const base = Money.round((entry.b || (entry.p > 0 ? entry.p : 100)) * Catalog.PRICE_CUT);
      return {
        id: "c" + index,
        n: entry.n,
        e: entry.e,
        p: price,
        b: entry.b ? base : 0,
        pv: 3,
        free: entry.f ? 1 : 0,
        items: entry.i.map((row, slot) => {
          const [emoji, name] = row.split("|");
          return { e: emoji, n: name, v: Money.round(base * Catalog.MULTIPLIERS[slot]) };
        }),
      };
    });
  }

  /**
   * Підтягує ціни до поточної версії й додає нові стандартні кейси,
   * навіть якщо в гравця чи на сервері лежить старий каталог.
   */
  applyFix(list, mode, deleted) {
    const fresh = this.defaults();
    const cases = list || [];
    cases.forEach((entry) => {
      const match = fresh.find((item) => item.id === entry.id);
      if (match && entry.pv !== match.pv) {
        entry.p = match.p;
        entry.b = match.b;
        entry.pv = match.pv;
        entry.items.forEach((item) => {
          const updated = match.items.find((candidate) => candidate.n === item.n);
          if (updated) item.v = updated.v;
        });
      }
    });
    const seen = mode === "local" ? Number(this.#store.get("cg_seen")) || 40 : 0;
    fresh.forEach((entry, index) => {
      if (index < 40 || cases.some((item) => item.id === entry.id)) return;
      const allow = mode === "net" ? !(deleted || []).includes(entry.id) : index >= seen;
      if (allow) cases.push(entry);
    });
    if (mode === "local") this.#store.set("cg_seen", fresh.length);
    return cases;
  }

  cheapestPrice() {
    const prices = this.#cases.filter((entry) => entry.p > 0 && entry.items.length).map((entry) => entry.p);
    return prices.length ? Math.min(...prices) : Infinity;
  }

  save(store = this.#store) {
    store.set("cg_cases", this.#cases);
  }

  #migrate() {
    const version = this.#store.get("cg_ver") || 1;
    if (version >= Catalog.SCHEMA) return;
    const fresh = this.defaults();
    const ids = new Set(fresh.map((entry) => entry.id));
    if (version < 4) {
      this.#cases = fresh.concat((this.#cases || []).filter((entry) => !ids.has(entry.id)));
    } else {
      this.#cases.forEach((entry) => {
        const match = fresh.find((item) => item.id === entry.id);
        if (!match) return;
        entry.p = match.p;
        entry.b = match.b;
        entry.pv = match.pv;
        entry.free = match.free;
      });
      this.#upgradeValues(fresh);
    }
    this.#store.set("cg_cases", this.#cases);
    this.#store.set("cg_ver", Catalog.SCHEMA);
  }

  #upgradeValues(fresh) {
    this.#cases.forEach((entry) => {
      const match = fresh.find((item) => item.id === entry.id);
      if (!match) return;
      entry.items.forEach((item) => {
        const updated = match.items.find((candidate) => candidate.n === item.n);
        if (updated) item.v = updated.v;
      });
    });
  }
}
