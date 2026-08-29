import "./controls.js";
import "./canvas.js";
import "./animation-manager.js";
import "./frame-editor.js";
import { loadFxManifests } from "./projectile.js";
import "./keyboard.js";
import "./aseprite-import.js";
import { loadManifest } from "./item-loader.js";
import { STATIC_MODE } from "./config.js";

if (STATIC_MODE) {
  document.getElementById("import-toggle-btn").style.display = "none";
  document.getElementById("save-btn").style.display = "none";
}

loadFxManifests();
loadManifest("units");
