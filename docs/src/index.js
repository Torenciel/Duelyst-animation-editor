import "./controls.js";
import "./canvas.js";
import "./animation-manager.js";
import "./frame-editor.js";
import { loadFxManifests } from "./projectile.js";
import "./keyboard.js";
import "./aseprite-import.js";
import { loadManifest } from "./item-loader.js";

loadFxManifests();
loadManifest("units");
