import {
  canvas,
  fxOverlay,
  projPanel,
  projReleaseInput,
  projScaleInput,
  projSpeedInput,
  projSetOriginBtn,
  projClearBtn,
  projSaveBtn,
  projOxInput,
  projOyInput,
  projFxSearch,
  projFxDropdown,
} from "./dom.js";
import { API, STATIC_MODE } from "./config.js";
import {
  isFxTab,
  currentAnims,
  currentUnitName,
  currentAnimKey,
  scale,
  animator,
  setCurrentAnims,
} from "./state.js";
import { SpriteAnimator } from "./sprite-animator.js";

// ── Projectile state ──────────────────────────────────────────────────────
let projOrigin = null;
let projClickMode = null;
let projAnimator = null;
let projImage = null;
let projElapsed = 0;
let projReleased = false;
let fxManifest = [];
let projFxValue = "";

export function getProjOrigin() { return projOrigin; }
export function setProjOrigin(v) { projOrigin = v; }
export function getProjClickMode() { return projClickMode; }
export function setProjClickMode(v) { projClickMode = v; }
export function getProjAnimator() { return projAnimator; }
export function getProjImage() { return projImage; }
export function getProjElapsed() { return projElapsed; }
export function setProjElapsed(v) { projElapsed = v; }
export function getProjReleased() { return projReleased; }
export function setProjReleased(v) { projReleased = v; }
export function getProjFxValue() { return projFxValue; }
export function getFxManifest() { return fxManifest; }

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export async function loadFxManifests() {
  const customPromise = STATIC_MODE
    ? Promise.resolve([])
    : fetch(`${API}/list?dir=dist-fx-custom`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
  const [base, custom] = await Promise.all([
    fetch(`${API}/dist-fx/manifest.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    customPromise,
  ]);
  const customSet = new Set(custom);
  fxManifest = [
    ...custom.map((n) => ({ name: n, custom: true })),
    ...base
      .filter((n) => !customSet.has(n))
      .map((n) => ({ name: n, custom: false })),
  ];
  syncProjPanelFromConfig();
}

function renderFxDropdown(query) {
  const q = query.trim().toLowerCase();
  const matches = q ? fxManifest.filter((e) => e.name.includes(q)) : fxManifest;
  projFxDropdown.innerHTML = "";
  // "none" option
  const none = document.createElement("div");
  none.className = "proj-fx-opt" + (projFxValue === "" ? " selected" : "");
  none.textContent = "— none —";
  none.addEventListener("mousedown", () => selectFx(""));
  projFxDropdown.appendChild(none);
  for (const entry of matches) {
    const div = document.createElement("div");
    div.className =
      "proj-fx-opt" +
      (entry.custom ? " custom" : "") +
      (projFxValue === entry.name ? " selected" : "");
    div.textContent = entry.name;
    div.addEventListener("mousedown", () => selectFx(entry.name, entry.custom));
    projFxDropdown.appendChild(div);
  }
  projFxDropdown.classList.add("open");
}

function selectFx(name, isCustom) {
  projFxValue = name;
  projFxSearch.value = name;
  projFxDropdown.classList.remove("open");
  loadProjFx(name, isCustom);
}

projFxSearch.addEventListener("focus", () =>
  renderFxDropdown(projFxSearch.value),
);
projFxSearch.addEventListener("input", () =>
  renderFxDropdown(projFxSearch.value),
);
projFxSearch.addEventListener("blur", () => {
  setTimeout(() => projFxDropdown.classList.remove("open"), 150);
});

function getProjWrapper() {
  if (!currentAnims) return null;
  return currentAnims.find((a) => Array.isArray(a.projectileConfigs)) || null;
}

export function getProjEntry(animKey) {
  const wrapper = getProjWrapper();
  if (!wrapper) return null;
  const stripped = animKey
    ? animKey.replace(`${currentUnitName}_`, "") || animKey
    : null;
  return (
    wrapper.projectileConfigs.find((e) => e.animation === stripped) || null
  );
}

export function syncProjPanelFromConfig() {
  loadProjEntryIntoPanel(getProjEntry(currentAnimKey));
}

function loadProjEntryIntoPanel(cfg) {
  if (!cfg) {
    projFxValue = "";
    projFxSearch.value = "";
    projReleaseInput.value = 0;
    projScaleInput.value = 1.0;
    projSpeedInput.value = 0.6;
    projOrigin = null;
    projOxInput.value = "";
    projOyInput.value = "";
    projSaveBtn.disabled = true;
    return;
  }
  projFxValue = cfg.projectileKey || "";
  projFxSearch.value = projFxValue;
  projReleaseInput.value = cfg.releaseFrame ?? 0;
  projScaleInput.value = cfg.scale ?? 1.0;
  projSpeedInput.value = cfg.projectileSpeed ?? 0.6;
  if (cfg.offsetX !== undefined && cfg.offsetY !== undefined) {
    projOrigin = {
      x: canvas.width / 2 + cfg.offsetX * scale,
      y: canvas.height / 2 + cfg.offsetY * scale,
    };
    projOxInput.value = cfg.offsetX;
    projOyInput.value = cfg.offsetY;
  } else {
    projOrigin = null;
    projOxInput.value = "";
    projOyInput.value = "";
  }
  projSaveBtn.disabled = false;
  loadProjFx(cfg.projectileKey);
}

async function loadProjFx(name, isCustom) {
  if (!name) {
    projAnimator = null;
    projImage = null;
    fxOverlay.style.display = "none";
    return;
  }
  // If isCustom not provided, detect from fxManifest
  if (isCustom === undefined) {
    const entry = fxManifest.find((e) => e.name === name);
    isCustom = entry ? entry.custom : false;
  }
  const folder = isCustom ? "dist-fx-custom" : "dist-fx";
  try {
    const [img, atlas, anims] = await Promise.all([
      loadImage(`${API}/${folder}/${name}.png`),
      fetch(`${API}/${folder}/${name}.json`).then((r) => r.json()),
      fetch(`${API}/${folder}/${name}_anims.json`).then((r) => r.json()),
    ]);
    projImage = img;
    projAnimator = new SpriteAnimator(img, atlas, anims);
    projAnimator.play(name);
    projElapsed = 0;
    projReleased = false;
  } catch (err) {
    console.error("[loadProjFx]", err);
    projAnimator = null;
    projImage = null;
  }
}

projSetOriginBtn.addEventListener("click", () => {
  projClickMode = projClickMode === "origin" ? null : "origin";
  projSetOriginBtn.classList.toggle("active", projClickMode === "origin");
});

projClearBtn.addEventListener("click", () => {
  projOrigin = null;
  projClickMode = null;
  projReleased = false;
  projElapsed = 0;
  projOxInput.value = "";
  projOyInput.value = "";
  projSetOriginBtn.classList.remove("active");
  projSaveBtn.disabled = true;
});

export function updateOriginCoord() {
  if (!projOrigin) return;
  const ox = Math.round((projOrigin.x - canvas.width / 2) / scale);
  const oy = Math.round((projOrigin.y - canvas.height / 2) / scale);
  projOxInput.value = ox;
  projOyInput.value = oy;
}

export function applyOxOyInputs() {
  const ox = parseInt(projOxInput.value);
  const oy = parseInt(projOyInput.value);
  if (isNaN(ox) || isNaN(oy)) return;
  projOrigin = {
    x: canvas.width / 2 + ox * scale,
    y: canvas.height / 2 + oy * scale,
  };
  projSaveBtn.disabled = false;
}
projOxInput.addEventListener("input", applyOxOyInputs);
projOyInput.addEventListener("input", applyOxOyInputs);

projSaveBtn.addEventListener("click", async () => {
  if (!currentAnims || !projOrigin) return;
  const animKey =
    currentAnimKey.replace(`${currentUnitName}_`, "") || currentAnimKey;
  const offsetX = Math.round((projOrigin.x - canvas.width / 2) / scale);
  const offsetY = Math.round((projOrigin.y - canvas.height / 2) / scale);
  const entry = {
    animation: animKey,
    projectileKey: projFxValue,
    releaseFrame: parseInt(projReleaseInput.value) || 0,
    offsetX,
    offsetY,
    scale: parseFloat(projScaleInput.value) || 1.0,
    projectileSpeed: parseFloat(projSpeedInput.value) || 0.6,
  };
  // Find or create the wrapper object
  let wrapper = getProjWrapper();
  if (!wrapper) {
    wrapper = { projectileConfigs: [] };
    currentAnims.push(wrapper);
  }
  const idx = wrapper.projectileConfigs.findIndex(
    (e) => e.animation === animKey,
  );
  if (idx >= 0) wrapper.projectileConfigs[idx] = entry;
  else wrapper.projectileConfigs.push(entry);
  const { refreshJsonPanel } = await import("./json-display.js");
  refreshJsonPanel();
  const { saveAnims } = await import("./persistence.js");
  await saveAnims();
});

export function showProjPanel() {
  if (!isFxTab) {
    projPanel.style.display = "flex";
    syncProjPanelFromConfig();
  }
}
