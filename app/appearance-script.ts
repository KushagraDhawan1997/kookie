/**
 * Runs in <head> before first paint, so dark mode never flashes. Follows a choice stored by
 * any Kookie site on this origin, otherwise the OS. The root Theme inherits what this writes
 * on <html>. Storage reads are guarded on their own: a browser that blocks storage still gets
 * an appearance.
 */
export const appearanceScript = `(function () {
  var e = document.documentElement;
  var read = function (k) { try { return localStorage.getItem(k); } catch (err) { return null; } };
  var a = read("kui-appearance");
  var dark = a === "light" ? false : a === "dark" ? true : matchMedia("(prefers-color-scheme: dark)").matches;
  e.setAttribute("data-appearance", dark ? "dark" : "light");
  var c = read("kui-contrast");
  if (c === "high" || c === "normal") e.setAttribute("data-contrast", c);
})();`;
