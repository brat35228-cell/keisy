/** Унікальні ідентифікатори речей в інвентарі. */
export class Ids {
  static next() {
    return Date.now() + "-" + Math.random().toString(36).slice(2);
  }

  static int(max) {
    return Math.floor(Math.random() * max);
  }
}
