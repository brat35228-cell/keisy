/** Гроші: округлення драбини цін і український запис великих чисел. */
export class Money {
  static UNITS = [
    [1e36, " андецилн"],
    [1e33, " децилн"],
    [1e30, " нонілн"],
    [1e27, " октлн"],
    [1e24, " септлн"],
    [1e21, " секстлн"],
    [1e18, " квінтлн"],
    [1e15, " квадрлн"],
    [1e12, " трлн"],
    [1e9, " млрд"],
    [1e6, " млн"],
  ];

  /** Округлення до двох значущих розрядів, дрібні суми — до цілого. */
  static round(x) {
    if (x < 10) return Math.max(1, Math.round(x));
    const e = Math.pow(10, Math.floor(Math.log10(x)) - 1);
    return Math.round(x / e) * e;
  }

  static format(n) {
    n = Number(n);
    return n >= 1e15 ? Money.compact(n) : n.toLocaleString("uk-UA");
  }

  static compact(n) {
    n = Number(n);
    for (const [d, s] of Money.UNITS) {
      if (n >= d) {
        const x = n / d;
        return (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString("uk-UA") + s;
      }
    }
    return Money.format(n);
  }
}
