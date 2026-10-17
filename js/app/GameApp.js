import { BeaverHall } from "../beaver/BeaverHall.js";
import { Session } from "./Session.js";
import { Store } from "../core/Store.js";
import { BetBox } from "../games/BetBox.js";
import { GameHall } from "../games/GameHall.js";
import { BeaverCatalog } from "../models/BeaverCatalog.js";
import { Catalog } from "../models/Catalog.js";
import { Player } from "../models/Player.js";
import { RarityTable } from "../models/RarityTable.js";
import { CloudSync } from "../services/CloudSync.js";
import { ImageBook } from "../services/ImageBook.js";
import { AdminConsole } from "../ui/AdminConsole.js";
import { CaseScreen } from "../ui/CaseScreen.js";
import { InventoryScreen } from "../ui/InventoryScreen.js";
import { ProfileScreen } from "../ui/ProfileScreen.js";
import { Shell } from "../ui/Shell.js";
import { ShopScreen } from "../ui/ShopScreen.js";

/**
 * Корінь композиції: збирає моделі, екрани й сервіси.
 * Єдиний глобальний `app` — це фасад для кнопок у розмітці, не купа функцій.
 */
export class GameApp {
  constructor() {
    this.store = new Store();
    this.session = new Session();
    this.catalog = new Catalog(this.store);
    this.player = Player.load(this.store);
    this.images = new ImageBook();
    this.rarity = new RarityTable();
    this.beaverRarity = new RarityTable([null, null, null, 0.035, 0.005]);
    this.beaverCatalog = new BeaverCatalog();
    this.shell = new Shell(this);
    this.shop = new ShopScreen(this);
    this.cases = new CaseScreen(this);
    this.inventory = new InventoryScreen(this);
    this.profile = new ProfileScreen(this);
    this.admin = new AdminConsole(this);
    this.hall = new GameHall(this);
    this.beavers = new BeaverHall(this);
    this.cloud = new CloudSync(this);
    this.bets = new BetBox(this, {
      sessionKey: "bet",
      storeKey: "cg_bet",
      fallback: 100,
      inputId: "bet",
      balance: () => this.player.balance,
      noun: "монети",
    });
    this.beaverBets = new BetBox(this, {
      sessionKey: "beaverBet",
      storeKey: "cg_bbet",
      fallback: 10,
      inputId: "bbet",
      balance: () => this.player.beaverBalance,
      noun: "бобр-коіна",
    });
  }

  start() {
    this.render();
    this.hall.clicker.startBackground();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) return;
      this.player.save(this.store);
      this.cloud.push();
    });
  }

  async connect() {
    const { ensureFirebase } = await import("../services/firebase-config.js");
    await ensureFirebase();
    this.cloud.init();
    if (this.store.get("cg_isadmin")) this.admin.init();
  }

  go(view, id) {
    if (this.session.spinning) return;
    if (Session.BEAVER_VIEWS.includes(view) && !this.player.beaverUnlocked(this.admin.isAdmin)) {
      this.toast("Вкладка Кейси 2 відкривається після 20 ребіртів");
      view = "shop";
    }
    this.session.view = view;
    if (id !== undefined) this.session.curId = id;
    this.session.resetArmed = false;
    this.render();
    window.scrollTo(0, 0);
  }

  render() {
    this.shell.render();
  }

  toast(message) {
    this.shell.toast(message);
  }

  saveState() {
    this.player.save(this.store);
    this.cloud.schedule();
  }

  saveCatalog() {
    this.catalog.save();
    this.admin.scheduleCatalogPush();
  }
}
