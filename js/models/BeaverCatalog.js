import { Money } from "../core/Money.js";
import { MINECRAFT_CASES } from "../data/minecraft-cases.js";

/** Окрема драбина кейсів вкладки «Кейси 2» (тематика Майнкрафта): кожен наступний у п'ять разів дорожчий. */
export class BeaverCatalog {
  static RANK_MULT = [0.38, 0.45, 0.52, 0.6, 0.68, 0.76, 0.85, 0.95, 1.1, 1.25, 1.45, 1.7, 2.1, 2.6, 3.2, 3.8, 5.2, 7, 9, 16];

  #cases;

  constructor() {
    this.#cases = MINECRAFT_CASES.map(([name, emoji, items], index) => {
      const price = Money.round(10 * Math.pow(5, index));
      return {
        id: "b" + index,
        n: name,
        e: emoji,
        p: price,
        b: price,
        items: items.map((itemName, slot) => ({
          e: emoji,
          n: itemName,
          v: Money.round(price * BeaverCatalog.RANK_MULT[slot]),
        })),
      };
    });
  }

  get cases() {
    return this.#cases;
  }

  find(id) {
    return this.#cases.find((entry) => entry.id === id);
  }
}
