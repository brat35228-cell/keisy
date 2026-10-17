/**
 * Економіка клікера. Дохід і ціна ростуть поліноміально,
 * тож прокачка не впирається в космічні числа за один крок.
 */
export class ClickerEconomy {
  static powerAt(level) {
    return level + Math.floor((level * level) / 20);
  }

  static autoAt(level) {
    return level <= 0 ? 0 : level + Math.floor((level * level) / 25);
  }

  static price(kind, level) {
    return Math.round((kind === "pow" ? 50 : 75) * Math.pow(Math.max(1, level), 1.5));
  }

  /** Скільки рівнів можна купити зараз (n — число або 'max') і за яку суму. */
  static plan(player, kind, count) {
    let level = player.clicker[kind];
    let bought = 0;
    let sum = 0;
    const limit = count === "max" ? 10000 : count;
    while (bought < limit) {
      const cost = ClickerEconomy.price(kind, kind === "auto" ? Math.max(1, level) : level);
      if (sum + cost > player.balance) break;
      sum += cost;
      level += 1;
      bought += 1;
    }
    return { cnt: bought, sum };
  }

  /** Нараховує офлайн/фон, не довше двох годин. Повертає суму. */
  static accrue(player) {
    const clicker = player.clicker;
    const now = Date.now();
    let seconds = Math.floor((now - clicker.at) / 1000);
    if (seconds <= 0) return 0;
    clicker.at += seconds * 1000;
    if (seconds > 7200) seconds = 7200;
    const gained = seconds * ClickerEconomy.autoAt(clicker.auto);
    if (gained > 0) player.credit(gained);
    return gained;
  }
}
