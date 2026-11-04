export const THEME_KEY = "infl-theme";
/** Kök düzende <head> içine: kayıtlı temayı (yoksa sistem tercihini) boyamadan önce uygular. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){}})();`;
