/** Короткоживучий стан екрана: куди дивимось, чи крутиться рулетка, остання ставка. */
export class Session {
  view = "shop";
  curId = null;
  spinning = false;
  resetArmed = false;
  adminCase = null;
  openCount = 1;
  lastDrops = [];
  beaverOpenCount = 1;
  beaverLast = [];
  bet = 100;
  beaverBet = 10;

  static BEAVER_VIEWS = ["beaver", "bcase", "bgames", "bgame", "binv"];
}
