/** Базовий клас міні-гри. Нащадки малюють себе самі — поліморфний render(). */
export class MiniGame {
  constructor(app) {
    this.app = app;
  }

  get id() { return ""; }
  get emoji() { return "🎮"; }
  get title() { return ""; }
  get blurb() { return ""; }

  render() {}

  back(target, label) {
    return `<button class="back" onclick="app.go('${target}')">${label}</button>`;
  }

  playing() {
    return this.app.session.view === "game" && this.app.session.curId === this.id;
  }

  lock(disabled) {
    document.querySelectorAll("#main .acts button, #main .qty button").forEach((button) => {
      button.disabled = disabled;
    });
  }
}
