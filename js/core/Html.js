/** Екранування тексту, який потрапляє в розмітку. */
export class Html {
  static escape(value) {
    return String(value).replace(/[&<>"']/g, (c) => {
      switch (c) {
        case "&":
          return "&" + "amp;";
        case "<":
          return "&" + "lt;";
        case ">":
          return "&" + "gt;";
        case '"':
          return "&" + "quot;";
        default:
          return "&" + "#39;";
      }
    });
  }
}
