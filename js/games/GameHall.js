import { Html } from "../core/Html.js";
import { ClickerGame } from "./ClickerGame.js";
import { CoinFlipGame } from "./CoinFlipGame.js";
import { MinesGame } from "./MinesGame.js";
import { RocketGame } from "./RocketGame.js";
import { RouletteGame } from "./RouletteGame.js";
import { Upgrader } from "./Upgrader.js";
import { MiniGame } from "./MiniGame.js";

/** Ребірт у меню міні-ігор лише веде в профіль. */
class RebirthLink extends MiniGame {
  get id() { return "reb"; }
  get emoji() { return "♻️"; }
  get title() { return "Ребіртх"; }
  get blurb() { return "Скинь прогрес — речі з кейсів стануть дорожчими"; }
  render() { this.app.go("me"); }
}

/** Меню міні-ігор і диспетчер конкретних ігор. */
export class GameHall {
  #games;

  constructor(app) {
    this.app = app;
    this.#games = [
      new Upgrader(app),
      new RebirthLink(app),
      new ClickerGame(app),
      new RouletteGame(app),
      new CoinFlipGame(app),
      new MinesGame(app),
      new RocketGame(app),
    ];
  }

  game(id) {
    return this.#games.find((entry) => entry.id === id);
  }

  get clicker() {
    return this.game("click");
  }

  renderMenu() {
    document.querySelector("#main").innerHTML = `<div class="grid">${this.#games.map((entry) => `<button class="box" style="cursor:pointer;color:inherit;font:inherit" onclick="app.go('game','${entry.id}')">
      <div class="sticker">${entry.emoji}</div><div class="nm">${Html.escape(entry.title)}</div>
      <div class="pr" style="color:var(--mute);font-weight:400">${Html.escape(entry.blurb)}</div></button>`).join("")}</div>`;
  }

  renderCurrent() {
    const current = this.game(this.app.session.curId);
    if (!current) {
      this.app.session.view = "games";
      this.renderMenu();
      return;
    }
    current.render();
  }
}
