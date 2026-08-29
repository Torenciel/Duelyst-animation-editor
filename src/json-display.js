import { jsonHeader, jsonContent } from "./dom.js";
import { currentAnims, currentUnitName } from "./state.js";

export function syntaxHighlight(json) {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^"\\])*")\s*(:)?|(\b(true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (m, _s, _s2, colon, _b, bool, num) => {
        if (colon) return `<span class="jk">${m}</span>`;
        if (bool) return `<span class="jb">${m}</span>`;
        if (num) return `<span class="jn">${m}</span>`;
        return `<span class="js">${m}</span>`;
      },
    );
}

export function refreshJsonPanel() {
  if (!currentAnims || !currentUnitName) {
    jsonHeader.textContent = "anims.json";
    jsonContent.innerHTML =
      '<span style="color:#2a2e42">No animation loaded</span>';
    return;
  }
  jsonHeader.textContent = `${currentUnitName}_anims.json`;
  jsonContent.innerHTML = syntaxHighlight(
    JSON.stringify(currentAnims, null, 2),
  );
}
