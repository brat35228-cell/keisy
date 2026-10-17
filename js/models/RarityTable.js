/**
 * Таблиця рідкості й ваг випадіння.
 * Епік і легендарка мають фіксований шанс, решта ділиться за кривою ціни.
 */
export class RarityTable {
  static NAMES = ["Звичайна", "Незвичайна", "Рідкісна", "Епічна", "Легендарна"];
  static CURVE = 1.6;

  #fixed;

  constructor(fixed = [null, null, null, 0.04, 0.008]) {
    this.#fixed = fixed;
  }

  baseOf(lootCase) {
    if (lootCase && lootCase.b > 0) return lootCase.b;
    if (lootCase && lootCase.p > 0) return lootCase.p;
    return 100;
  }

  tier(value, priceBase) {
    const ratio = value / (priceBase > 0 ? priceBase : 100);
    if (ratio < 0.9) return 0;
    if (ratio < 1.4) return 1;
    if (ratio < 4) return 2;
    if (ratio < 10) return 3;
    return 4;
  }

  color(tier) {
    return `var(--r${tier})`;
  }

  name(tier) {
    return RarityTable.NAMES[tier] || RarityTable.NAMES[0];
  }

  weights(lootCase) {
    const base = this.baseOf(lootCase);
    const raw = lootCase.items.map((item) =>
      Math.pow(Math.min(Math.max(item.v / base, 0.2), 50), -RarityTable.CURVE),
    );
    const tiers = lootCase.items.map((item) => this.tier(item.v, base));
    let fixed = 0;
    let rest = 0;
    raw.forEach((weight, index) => {
      if (this.#fixed[tiers[index]] != null) fixed += this.#fixed[tiers[index]];
      else rest += weight;
    });
    const scale = fixed > 1 ? 1 / fixed : 1;
    const remaining = Math.max(0, 1 - Math.min(1, fixed));
    return raw.map((weight, index) =>
      this.#fixed[tiers[index]] != null
        ? this.#fixed[tiers[index]] * scale
        : rest > 0
          ? (weight / rest) * remaining
          : 0,
    );
  }

  roll(lootCase) {
    const weights = this.weights(lootCase);
    let cursor = weights.reduce((sum, weight) => sum + weight, 0) * Math.random();
    for (let index = 0; index < weights.length; index++) {
      cursor -= weights[index];
      if (cursor <= 0) return lootCase.items[index];
    }
    return lootCase.items[lootCase.items.length - 1];
  }

  chances(lootCase) {
    const weights = this.weights(lootCase);
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const base = this.baseOf(lootCase);
    return lootCase.items
      .map((item, index) => ({
        ...item,
        r: this.tier(item.v, base),
        pc: (weights[index] / total) * 100,
      }))
      .sort((a, b) => b.v - a.v);
  }
}
