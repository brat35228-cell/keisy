import { Ids } from "../core/Ids.js";

/** Усі речі з кейсів «Кейси 2». Підбирає приз, найближчий за вартістю до потрібної. */
export class PrizePool {
  #entries;

  constructor(app) {
    this.app = app;
    this.#entries = app.beaverCatalog.cases.flatMap((lootCase) => lootCase.items.map((item) => ({ item, lootCase })));
  }

  /** Річ, найближча до `target` за вартістю (з трьох найближчих — випадкова). */
  nearest(target) {
    const goal = Math.log(Math.max(1, target));
    const ranked = this.#entries
      .map((entry) => ({ entry, gap: Math.abs(Math.log(entry.item.v) - goal) }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 3);
    const { entry } = ranked[Ids.int(ranked.length)];
    return this.#make(entry.item, entry.lootCase);
  }

  /** Нова копія речі з іншим uid. */
  copy(item) {
    return { ...item, uid: Ids.next() };
  }

  #make(item, lootCase) {
    return {
      uid: Ids.next(),
      e: item.e,
      n: item.n,
      v: item.v,
      r: this.app.beaverRarity.tier(item.v, this.app.beaverRarity.baseOf(lootCase)),
      from: lootCase.n,
      bb: 1,
    };
  }
}
