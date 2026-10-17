import { IMAGE_INDEX } from "../data/image-index.js";
import { Html } from "../core/Html.js";

/** Наліпки речей: файли в assets/ і власні картинки адміна. */
export class ImageBook {
  #custom = {};

  refresh(cases) {
    const next = {};
    cases.forEach((lootCase) => {
      lootCase.items.forEach((item) => {
        if (item.img) next[lootCase.n + "|" + item.n] = item.img;
      });
    });
    this.#custom = next;
  }

  url(item, caseName) {
    const key = (caseName || item.from || "") + "|" + item.n;
    if (this.#custom[key]) return this.#custom[key];
    const relative = IMAGE_INDEX[key];
    if (!relative) return "";
    return new URL("../../" + relative, import.meta.url).href;
  }

  itemHtml(item, caseName, className = "ii") {
    const src = this.url(item, caseName);
    if (!src) return Html.escape(item.e);
    return `<img class="${className}" src="${Html.escape(src)}" alt="" decoding="async" draggable="false">`;
  }

  caseHtml(lootCase) {
    if (!lootCase.img) return Html.escape(lootCase.e);
    return `<img class="ci" src="${Html.escape(lootCase.img)}" alt="" decoding="async" draggable="false">`;
  }
}
