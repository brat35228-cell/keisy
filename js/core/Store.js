/**
 * Локальне сховище. Ключі лишаються колишніми (cg_*),
 * щоб уже зіграний прогрес не зник після розкладення на модулі.
 */
export class Store {
  #memory = {};

  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (this.#memory[key] ?? null);
    } catch {
      return this.#memory[key] ?? null;
    }
  }

  set(key, value) {
    this.#memory[key] = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* переповнена квота — лишаємо копію в пам'яті */
    }
  }
}
