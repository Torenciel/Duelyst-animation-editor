const API = "http://localhost:3000";

const TABS = {
  units: {
    dist: "dist",
    customDist: "dist-custom",
    label: "units",
    placeholder: "← Select a unit to preview its animations",
  },
  fx: {
    dist: "dist-fx",
    customDist: "dist-fx-custom",
    label: "fx",
    placeholder: "← Select an FX to preview",
  },
  "units-custom": {
    dist: "dist-custom",
    customDist: "dist-custom",
    label: "units",
    placeholder: "← Select a unit to preview its animations",
  },
  "fx-custom": {
    dist: "dist-fx-custom",
    customDist: "dist-fx-custom",
    label: "fx",
    placeholder: "← Select an FX to preview",
  },
};

// DOM
const searchInput = document.getElementById("search-input");
const itemListEl = document.getElementById("item-list");
const itemCountEl = document.getElementById("item-count");
const animBar = document.getElementById("anim-bar");
const animBtnGroup = document.getElementById("anim-btn-group");
const placeholder = document.getElementById("placeholder");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const fxOverlay = document.getElementById("fx-overlay");
const fxCtx = fxOverlay.getContext("2d");
ctx.imageSmoothingEnabled = false;
const scaleSlider = document.getElementById("scale-slider");
const scaleVal = document.getElementById("scale-val");
const speedSlider = document.getElementById("speed-slider");
const speedVal = document.getElementById("speed-val");
const frameSlider = document.getElementById("frame-slider");
const frameVal = document.getElementById("frame-val");
const loopBtn = document.getElementById("loop-btn");
const frameEditor = document.getElementById("frame-editor");
const frameStrip = document.getElementById("frame-strip");
const playBtn = document.getElementById("play-btn");
const dupFrameBtn = document.getElementById("dup-frame-btn");
const hideFrameBtn = document.getElementById("hide-frame-btn");
const delFrameBtn = document.getElementById("del-frame-btn");
const globalDur = document.getElementById("global-dur");
const applyDurBtn = document.getElementById("apply-dur-btn");
const repeatBtn = document.getElementById("repeat-btn");
const saveBtn = document.getElementById("save-btn");
const bgSelect = document.getElementById("bg-select");
const jsonPanel = document.getElementById("json-panel");
const jsonHeader = document.getElementById("json-panel-header");
const jsonContent = document.getElementById("json-content");

function syntaxHighlight(json) {
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

function refreshJsonPanel() {
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
const renameAnimBtn = document.createElement("button");
renameAnimBtn.id = "rename-anim-btn";
renameAnimBtn.textContent = "✎ Rename";
const duplicateBtn = document.createElement("button");
duplicateBtn.id = "duplicate-btn";
duplicateBtn.textContent = "⧉ Duplicate";
const deleteAnimBtn = document.createElement("button");
deleteAnimBtn.id = "delete-anim-btn";
deleteAnimBtn.textContent = "✕ Delete anim";

// State
let activeTab = "units";
let allItems = [];
let activeItem = null;
let animator = null;
let rafId = null;
let lastTime = 0;
let scale = 2;
let speed = 1;
let isFxTab = false;
let scrubbing = false;
let loopOverride = null;
let currentAnims = null;
let currentAtlas = null;
let currentImage = null;
let currentAnimKey = null;
let currentUnitName = null;
const canvasWrap = document.getElementById("canvas-wrap");

// ── Projectile DOM refs ───────────────────────────────────────────────────
const projPanel = document.getElementById("proj-panel");
const projReleaseInput = document.getElementById("proj-release-input");
const projScaleInput = document.getElementById("proj-scale-input");
const projSpeedInput = document.getElementById("proj-speed-input");
const projSetOriginBtn = document.getElementById("proj-set-origin-btn");
const projClearBtn = document.getElementById("proj-clear-btn");
const projSaveBtn = document.getElementById("proj-save-btn");
const projOxInput = document.getElementById("proj-ox-input");
const projOyInput = document.getElementById("proj-oy-input");
const projFxSearch = document.getElementById("proj-fx-search");
const projFxDropdown = document.getElementById("proj-fx-dropdown");

// ── Projectile state ──────────────────────────────────────────────────────
// Marker coords in canvas-pixel space (scaled). null = not set.
let projOrigin = null; // { x, y } pixels on canvas
let projClickMode = null; // "origin" | null
let projAnimator = null; // second SpriteAnimator for the FX
let projImage = null;
let projElapsed = 0; // ms since release frame was first hit
let projReleased = false;
// { name, custom } entries from both dist-fx and dist-fx-custom
let fxManifest = [];
let projFxValue = ""; // currently selected FX name

async function loadFxManifests() {
  const [base, custom] = await Promise.all([
    fetch(`${API}/dist-fx/manifest.json`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
    fetch(`${API}/list?dir=dist-fx-custom`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []),
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
loadFxManifests();

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

function getProjEntry(animKey) {
  const wrapper = getProjWrapper();
  if (!wrapper) return null;
  const stripped = animKey
    ? animKey.replace(`${currentUnitName}_`, "") || animKey
    : null;
  return (
    wrapper.projectileConfigs.find((e) => e.animation === stripped) || null
  );
}

function syncProjPanelFromConfig() {
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

let draggingMarker = null; // "origin" | null
let lastMousePos = { x: -999, y: -999 };

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function markerHitTest(pos, marker, radius = 10) {
  if (!marker) return false;
  return (
    Math.abs(pos.x - marker.x) <= radius && Math.abs(pos.y - marker.y) <= radius
  );
}

function updateOriginCoord() {
  if (!projOrigin) return;
  const ox = Math.round((projOrigin.x - canvas.width / 2) / scale);
  const oy = Math.round((projOrigin.y - canvas.height / 2) / scale);
  projOxInput.value = ox;
  projOyInput.value = oy;
}

function applyOxOyInputs() {
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

canvas.addEventListener("mousedown", (e) => {
  if (isFxTab) return;
  const pos = canvasPos(e);

  // Placement mode
  if (projClickMode === "origin") {
    projOrigin = pos;
    updateOriginCoord();
    if (animator?.frameIndex !== undefined)
      projReleaseInput.value = animator.frameIndex;
    projSaveBtn.disabled = false;
    projClickMode = null;
    projSetOriginBtn.classList.remove("active");
    draggingMarker = "origin";
    return;
  }
  // Drag existing marker
  if (markerHitTest(pos, projOrigin)) {
    draggingMarker = "origin";
    return;
  }

  // Otherwise resume playback (original click-to-play behavior)
  setScrubbing(false);
});

canvas.addEventListener("mousemove", (e) => {
  const pos = canvasPos(e);
  lastMousePos = pos;
  if (!draggingMarker || isFxTab) return;
  if (draggingMarker === "origin") {
    projOrigin = pos;
    updateOriginCoord();
    projSaveBtn.disabled = false;
  }
});

canvas.addEventListener("mouseup", () => {
  draggingMarker = null;
});
canvas.addEventListener("mouseleave", () => {
  draggingMarker = null;
});

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
  refreshJsonPanel();
  await saveAnims();
});

function showProjPanel() {
  if (!isFxTab) {
    projPanel.style.display = "flex";
    syncProjPanelFromConfig();
  }
}

bgSelect.addEventListener("change", () => {
  const val = bgSelect.value;
  if (!val) {
    canvasWrap.style.backgroundImage = "";
  } else {
    canvasWrap.style.backgroundImage = `url("${API}/background/${val}.png")`;
    canvasWrap.style.backgroundSize = "cover";
    canvasWrap.style.backgroundPosition = "center";
    canvasWrap.style.backgroundRepeat = "no-repeat";
  }
});

let selectedFrameIdx = null;
let anchorFrameIdx = null; // last plain-click, used as shift+click anchor
let hiddenFrames = new Set(); // indices in raw currentAnims frames array

// ── Tab switching ────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((tabEl) => {
  tabEl.addEventListener("click", () => {
    const tab = tabEl.dataset.tab;
    if (tab === activeTab) return;
    activeTab = tab;
    isFxTab = tab === "fx" || tab === "fx-custom";
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    searchInput.value = "";
    activeItem = null;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    animator = null;
    canvas.style.display = "none";
    frameEditor.style.display = "none";
    projPanel.style.display = "none";
    animBtnGroup.innerHTML = "";

    placeholder.textContent = TABS[tab].placeholder;
    placeholder.style.display = "";
    loadManifest(tab);
  });
});

// ── Manifest ─────────────────────────────────────────────────────────────
async function loadManifest(tab) {
  const { dist } = TABS[tab];
  const isCustomTab = tab === "units-custom" || tab === "fx-custom";
  try {
    if (isCustomTab) {
      allItems = await fetch(`${API}/list?dir=${dist}`).then((r) => r.json());
    } else {
      allItems = await fetch(`${API}/${dist}/manifest.json`).then((r) => {
        if (!r.ok) throw 0;
        return r.json();
      });
    }
    renderList(allItems);
    if (allItems.length === 0) placeholder.textContent = TABS[tab].placeholder;
  } catch {
    placeholder.innerHTML = `No <code>${dist}/manifest.json</code> found.`;
  }
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function renderList(items) {
  itemCountEl.textContent = `${items.length} ${TABS[activeTab].label}`;
  itemListEl.innerHTML = "";
  for (const item of items) {
    const div = document.createElement("div");
    div.className = "list-item" + (item === activeItem ? " active" : "");
    div.textContent = item;
    div.addEventListener("click", () => loadItem(item));
    itemListEl.appendChild(div);
  }
}

async function deleteCustomFile(name) {
  const { dist } = TABS[activeTab];
  if (!confirm(`Delete "${name}" and its files from ${dist}?`)) return;
  const res = await fetch(
    `${API}/delete-file?dir=${encodeURIComponent(dist)}&name=${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    alert("Delete failed");
    return;
  }
  allItems = allItems.filter((x) => x !== name);
  if (activeItem === name) {
    activeItem = null;
    currentAnims = null;
    stopPolling();
    animBtnGroup.innerHTML = "";
    frameStrip.innerHTML = "";
    placeholder.textContent = "← Select an item to preview";
    placeholder.style.display = "";
  }
  const q = searchInput.value.trim().toLowerCase();
  renderList(q ? allItems.filter((u) => u.includes(q)) : allItems);
}

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  renderList(q ? allItems.filter((u) => u.includes(q)) : allItems);
});

// ── Load item ─────────────────────────────────────────────────────────────
async function loadItem(name) {
  activeItem = name;
  loopOverride = isFxTab ? true : null;
  scrubbing = false;
  selectedFrameIdx = null;
  renderList(
    allItems.filter((u) => {
      const q = searchInput.value.trim().toLowerCase();
      return q ? u.includes(q) : true;
    }),
  );

  animBtnGroup.innerHTML =
    '<span style="color:#555a70;font-size:12px">Loading…</span>';
  frameEditor.style.display = "none";

  const { dist, customDist } = TABS[activeTab];
  const animsUrl = await fetch(`${API}/${customDist}/${name}_anims.json`, {
    method: "HEAD",
  })
    .then((r) =>
      r.ok
        ? `${API}/${customDist}/${name}_anims.json`
        : `${API}/${dist}/${name}_anims.json`,
    )
    .catch(() => `${API}/${dist}/${name}_anims.json`);
  const [image, atlas, anims] = await Promise.all([
    loadImage(`${API}/${dist}/${name}.png`),
    fetch(`${API}/${dist}/${name}.json`).then((r) => r.json()),
    fetch(animsUrl).then((r) => r.json()),
  ]);

  currentImage = image;
  currentAtlas = atlas;
  currentAnims = anims;
  currentUnitName = name;
  hiddenFrames = new Set();

  if (rafId) cancelAnimationFrame(rafId);
  rebuildAnimator();

  buildAnimBar(name);
  placeholder.style.display = "none";
  canvas.style.display = "block";

  refreshJsonPanel();
  showProjPanel();
  playAnim(animDefs()[0]?.key);
  startLoop();
  startPolling();
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function animDefs() {
  return currentAnims.filter(
    (a) => !a.projectileConfigs && Array.isArray(a.frames),
  );
}

function rebuildAnimator() {
  const prevIdx = animator ? animator.frameIndex : 0;
  const playbackAnims = animDefs().map((def) => {
    if (def.key !== currentAnimKey) return def;
    return {
      ...def,
      frames: def.frames.filter((_, i) => !hiddenFrames.has(i)),
    };
  });
  animator = new SpriteAnimator(currentImage, currentAtlas, playbackAnims);
  if (currentAnimKey) {
    try {
      animator.play(currentAnimKey);
      animator.frameIndex = Math.min(
        prevIdx,
        (animator.currentAnim?.frames.length || 1) - 1,
      );
    } catch {}
  }
}

// ── Anim bar ──────────────────────────────────────────────────────────────
function buildAnimBar(name) {
  animBtnGroup.innerHTML = "";

  for (const def of animDefs()) {
    const label = def.key.replace(`${name}_`, "") || def.key;
    const btn = document.createElement("button");
    btn.className = "anim-btn";
    btn.textContent = label;
    btn.addEventListener("click", () => playAnim(def.key));
    animBtnGroup.appendChild(btn);
  }

  const sep = document.createElement("div");
  sep.className = "bar-sep";
  animBtnGroup.appendChild(sep);
  renameAnimBtn.onclick = renameCurrentAnim;
  duplicateBtn.onclick = duplicateCurrentAnim;
  deleteAnimBtn.onclick = deleteCurrentAnim;
  animBtnGroup.appendChild(renameAnimBtn);
  animBtnGroup.appendChild(duplicateBtn);
  animBtnGroup.appendChild(deleteAnimBtn);

  const isCustomTab = activeTab === "units-custom" || activeTab === "fx-custom";
  if (isCustomTab) {
    const deleteFileBtn = document.createElement("button");
    deleteFileBtn.id = "delete-file-btn";
    deleteFileBtn.textContent = "✕ Delete file";
    deleteFileBtn.onclick = () => deleteCustomFile(currentUnitName);
    animBtnGroup.appendChild(deleteFileBtn);
  }

}

// ── Play anim ─────────────────────────────────────────────────────────────
function playAnim(key) {
  if (!key || !animator) return;
  currentAnimKey = key;
  projReleased = false;
  projElapsed = 0;
  animator.play(key);

  if (loopOverride !== null)
    animator.currentAnim.repeat = loopOverride ? -1 : 0;
  syncLoopBtn();

  const total = animator.currentAnim.frames.length;
  frameSlider.max = total - 1;
  frameSlider.value = 0;
  frameVal.textContent = `1/${total}`;
  setScrubbing(false);

  document.querySelectorAll(".anim-btn").forEach((b) => {
    const label = key.replace(`${currentUnitName}_`, "") || key;
    b.classList.toggle("active", b.textContent === label);
  });

  selectedFrameIdx = null;
  anchorFrameIdx = null;
  hiddenFrames = new Set();
  renderFrameEditor();
}

function syncLoopBtn() {
  if (!animator?.currentAnim) return;
  const on = animator.currentAnim.repeat === -1;
  loopBtn.classList.toggle("on", on);
  loopBtn.textContent = on ? "↺ Loop: on" : "↺ Loop: off";
}

function syncRepeatBtn() {
  const animDef = currentAnims?.find((a) => a.key === currentAnimKey);
  if (!animDef) return;
  const on = animDef.repeat === -1;
  repeatBtn.classList.toggle("off", !on);
  repeatBtn.textContent = on ? "Repeat: on" : "Repeat: off";
}

// ── Render loop ───────────────────────────────────────────────────────────
function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  lastTime = 0;
  projReleased = false;
  projElapsed = 0;

  function tick(ts) {
    const dt = lastTime ? (ts - lastTime) * speed : 16;
    lastTime = ts;

    if (!scrubbing && animator) {
      animator.update(dt);
      const total = animator.currentAnim?.frames.length || 1;
      frameSlider.value = animator.frameIndex;
      frameVal.textContent = `${animator.frameIndex + 1}/${total}`;
      highlightFrameCell(animator.frameIndex);
      if (animator.completed) setScrubbing(true);
    }

    const cf = animator?.currentAnim?.frames[animator.frameIndex];

    if (cf) {
      const w = Math.round(cf.frame.w * scale);
      const h = Math.round(cf.frame.h * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        ctx.imageSmoothingEnabled = false;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    animator.draw(ctx, canvas.width / 2, canvas.height / 2, scale);

    // ── Projectile preview ──────────────────────────────────────────
    if (!isFxTab && projAnimator && projOrigin) {
      const releaseFrame = parseInt(projReleaseInput.value) || 0;
      const unitFrame = animator.frameIndex;

      // Reset when unit animation loops back before the release frame
      if (projReleased && unitFrame < releaseFrame) {
        projReleased = false;
      }

      if (!projReleased && unitFrame >= releaseFrame) {
        projReleased = true;
        projElapsed = 0;
        projAnimator.play(projFxValue);
      }
      if (projReleased && !scrubbing) {
        projAnimator.update(dt);
        projElapsed += dt;
      }

      if (projReleased && !projAnimator.completed) {
        const projScale = scale * (parseFloat(projScaleInput.value) || 1.0);
        const pf = projAnimator.currentAnim?.frames[projAnimator.frameIndex];
        if (pf?.frame) {
          const fw = Math.round(pf.frame.w * projScale);
          const fh = Math.round(pf.frame.h * projScale);
          fxOverlay.width = Math.max(
            canvas.width,
            Math.round(projOrigin.x + fw / 2),
          );
          fxOverlay.height = Math.max(
            canvas.height,
            Math.round(projOrigin.y + fh / 2),
          );
          fxOverlay.style.left = canvas.offsetLeft + "px";
          fxOverlay.style.top = canvas.offsetTop + "px";
          fxOverlay.style.display = "block";
          fxCtx.clearRect(0, 0, fxOverlay.width, fxOverlay.height);
          fxCtx.imageSmoothingEnabled = false;
          projAnimator.draw(fxCtx, projOrigin.x, projOrigin.y, projScale);
        }
      } else {
        fxOverlay.style.display = "none";
      }
    }

    if (!isFxTab) {
      if (projOrigin) drawMarker(projOrigin.x, projOrigin.y, "#c084fc", "O");
      // Cursor feedback
      if (draggingMarker) {
        canvas.style.cursor = "grabbing";
      } else if (projClickMode) {
        canvas.style.cursor = "crosshair";
      } else if (markerHitTest(lastMousePos, projOrigin)) {
        canvas.style.cursor = "grab";
      } else {
        canvas.style.cursor = "pointer";
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
}

function drawMarker(x, y, color, label) {
  const R = 5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - R - 3, y);
  ctx.lineTo(x + R + 3, y);
  ctx.moveTo(x, y - R - 3);
  ctx.lineTo(x, y + R + 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.max(8, scale * 3)}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(label, x + R + 2, y - R);
  ctx.restore();
}

// ── Controls ──────────────────────────────────────────────────────────────
scaleSlider.addEventListener("input", () => {
  scale = parseFloat(scaleSlider.value);
  scaleVal.textContent = `${scale}×`;
});
speedSlider.addEventListener("input", () => {
  speed = parseFloat(speedSlider.value);
  speedVal.textContent = `${speed}×`;
});

function setScrubbing(val) {
  scrubbing = val;
  playBtn.classList.toggle("playing", !scrubbing);
  playBtn.textContent = scrubbing ? "▶" : "⏸";
}

playBtn.addEventListener("click", () => {
  if (scrubbing) {
    // Resume — if at the last frame, restart
    if (animator?.currentAnim && animator.completed) {
      animator.play(currentAnimKey);
    }
    setScrubbing(false);
  } else {
    setScrubbing(true);
  }
});

frameSlider.addEventListener("mousedown", () => setScrubbing(true));
frameSlider.addEventListener("touchstart", () => setScrubbing(true));
frameSlider.addEventListener("input", () => {
  if (!animator?.currentAnim) return;
  const idx = parseInt(frameSlider.value);
  animator.frameIndex = idx;
  animator.elapsedMs = 0;
  frameVal.textContent = `${idx + 1}/${animator.currentAnim.frames.length}`;
  highlightFrameCell(idx);
});
frameSlider.addEventListener("mouseup", () => setScrubbing(false));
frameSlider.addEventListener("touchend", () => setScrubbing(false));

// Hide / unhide selected frames
dupFrameBtn.addEventListener("click", () => {
  const animDef = currentAnims?.find((a) => a.key === currentAnimKey);
  if (!animDef) return;
  const sel = getSelectedRange();
  if (!sel) return;
  const { lo, hi } = sel;
  const copies = animDef.frames.slice(lo, hi + 1).map((f) => ({ ...f }));
  animDef.frames.splice(hi + 1, 0, ...copies);
  selectedFrameIdx = hi + copies.length;
  anchorFrameIdx = hi + 1;
  rebuildAnimator();
  renderFrameEditor();
});

hideFrameBtn.addEventListener("click", () => {
  const selected = getSelectedRange();
  if (selected === null) return;
  const { lo, hi } = selected;
  const allHidden = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).every(
    (i) => hiddenFrames.has(i),
  );
  for (let i = lo; i <= hi; i++) {
    if (allHidden) hiddenFrames.delete(i);
    else hiddenFrames.add(i);
  }
  rebuildAnimator();
  renderFrameEditor();
});

loopBtn.addEventListener("click", () => {
  if (!animator?.currentAnim) return;
  loopOverride = animator.currentAnim.repeat !== -1;
  animator.currentAnim.repeat = loopOverride ? -1 : 0;
  animator.completed = false;
  syncLoopBtn();
});

// ── Duplicate animation ───────────────────────────────────────────────────
function renameCurrentAnim() {
  if (!currentAnimKey || !currentAnims) return;
  const newKey = prompt("Rename animation:", currentAnimKey);
  if (!newKey || !newKey.trim() || newKey.trim() === currentAnimKey) return;
  const trimmed = newKey.trim();
  if (currentAnims.find((a) => a.key === trimmed)) {
    alert(`"${trimmed}" already exists.`);
    return;
  }
  const animDef = currentAnims.find((a) => a.key === currentAnimKey);
  animDef.key = trimmed;
  currentAnimKey = trimmed;
  buildAnimBar(currentUnitName);
  playAnim(trimmed);
  refreshJsonPanel();
}

function duplicateCurrentAnim() {
  if (!currentAnimKey || !currentAnims) return;
  const newKey = prompt("New animation name:", currentAnimKey + "_copy");
  if (!newKey || !newKey.trim()) return;
  const trimmed = newKey.trim();
  if (currentAnims.find((a) => a.key === trimmed)) {
    alert(`"${trimmed}" already exists.`);
    return;
  }

  const original = currentAnims.find((a) => a.key === currentAnimKey);
  const clone = JSON.parse(JSON.stringify(original));
  clone.key = trimmed;
  currentAnims.push(clone);

  rebuildAnimator();
  buildAnimBar(currentUnitName);
  playAnim(trimmed);
}

// ── Delete animation ──────────────────────────────────────────────────────
async function deleteCurrentAnim() {
  if (!currentAnimKey) return;
  if (!confirm(`Delete animation "${currentAnimKey}"?`)) return;
  currentAnims = currentAnims.filter((a) => a.key !== currentAnimKey);
  currentAnimKey = null;
  rebuildAnimator();
  buildAnimBar(currentUnitName);
  if (animDefs().length > 0) {
    playAnim(animDefs()[0].key);
  } else {
    frameEditor.style.display = "none";
  }
  await saveAnims();
}

// ── Frame editor ──────────────────────────────────────────────────────────
const THUMB = 64;

function renderFrameEditor() {
  if (!currentAnimKey) {
    frameEditor.style.display = "none";
    return;
  }
  const animDef = currentAnims.find((a) => a.key === currentAnimKey);
  if (!animDef) {
    frameEditor.style.display = "none";
    return;
  }

  frameEditor.style.display = "flex";
  frameStrip.innerHTML = "";
  dupFrameBtn.disabled = selectedFrameIdx === null;
  delFrameBtn.disabled = selectedFrameIdx === null;

  // Scroll wheel scrolls horizontally
  frameStrip.onwheel = (e) => {
    e.preventDefault();
    frameStrip.scrollLeft += e.deltaY + e.deltaX;
  };

  const total = animDef.frames.length;
  frameSlider.max = total - 1;

  animDef.frames.forEach((fd, i) => {
    const atlasEntry = currentAtlas.frames[fd.name];
    const cell = document.createElement("div");
    cell.className = "frame-cell" + (i === selectedFrameIdx ? " selected" : "");
    cell.draggable = true;
    cell.dataset.idx = i;

    // Thumbnail
    const tc = document.createElement("canvas");
    tc.width = THUMB;
    tc.height = THUMB;
    if (atlasEntry) {
      const { x, y, w, h } = atlasEntry.frame;
      const s = Math.min(THUMB / w, THUMB / h);
      const dx = (THUMB - w * s) / 2;
      const dy = (THUMB - h * s) / 2;
      const tc2d = tc.getContext("2d");
      tc2d.imageSmoothingEnabled = false;
      tc2d.drawImage(currentImage, x, y, w, h, dx, dy, w * s, h * s);
    } else {
      const tc2 = tc.getContext("2d");
      tc2.fillStyle = "#3a1010";
      tc2.fillRect(0, 0, THUMB, THUMB);
      tc2.fillStyle = "#f06060";
      tc2.font = "10px sans-serif";
      tc2.textAlign = "center";
      tc2.fillText("?", THUMB / 2, THUMB / 2 + 4);
    }

    // Frame number label (last segment of the frame name, e.g. "001")
    const num = document.createElement("div");
    num.className = "frame-num";
    num.textContent =
      fd.name.match(/_(\d+)$/)?.[1] ?? String(i).padStart(3, "0");

    // Select on click / shift+click
    cell.addEventListener("click", (e) => {
      if (e.shiftKey && anchorFrameIdx !== null) {
        selectRange(anchorFrameIdx, i);
      } else {
        selectFrame(i);
      }
    });

    // Drag-to-reorder
    cell.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", i.toString());
      cell.classList.add("dragging");
    });
    cell.addEventListener("dragend", () => cell.classList.remove("dragging"));
    cell.addEventListener("dragover", (e) => {
      e.preventDefault();
      cell.classList.add("drag-over");
    });
    cell.addEventListener("dragleave", () =>
      cell.classList.remove("drag-over"),
    );
    cell.addEventListener("drop", (e) => {
      e.preventDefault();
      cell.classList.remove("drag-over");
      const from = parseInt(e.dataTransfer.getData("text/plain"));
      const to = parseInt(cell.dataset.idx);
      if (from === to) return;
      const animDef2 = currentAnims.find((a) => a.key === currentAnimKey);
      const [moved] = animDef2.frames.splice(from, 1);
      animDef2.frames.splice(to, 0, moved);
      selectedFrameIdx = to;
      rebuildAnimator();
      renderFrameEditor();
    });

    cell.appendChild(tc);
    cell.appendChild(num);
    frameStrip.appendChild(cell);
  });

  // Apply hidden styling after all cells exist
  frameStrip.querySelectorAll(".frame-cell").forEach((cell, i) => {
    cell.classList.toggle("hidden-frame", hiddenFrames.has(i));
  });

  refreshJsonPanel();
  syncRepeatBtn();
}

function getSelectedRange() {
  const cells = [...frameStrip.querySelectorAll(".frame-cell")];
  const indices = cells
    .map((c, i) => (c.classList.contains("selected") ? i : -1))
    .filter((i) => i !== -1);
  if (indices.length === 0)
    return selectedFrameIdx !== null
      ? { lo: selectedFrameIdx, hi: selectedFrameIdx }
      : null;
  return { lo: indices[0], hi: indices[indices.length - 1] };
}

// Convert raw thumbnail index to filtered playback index (hidden frames removed).
// If the frame itself is hidden, returns the index of the last visible frame before it.
function rawToPlaybackIdx(rawIdx) {
  let count = -1;
  for (let i = 0; i <= rawIdx; i++) {
    if (!hiddenFrames.has(i)) count++;
  }
  return Math.max(0, count);
}

function selectFrame(idx) {
  selectedFrameIdx = idx;
  anchorFrameIdx = idx;
  dupFrameBtn.disabled = false;
  delFrameBtn.disabled = false;
  highlightFrameCell(idx);
  if (animator?.currentAnim) {
    const playbackIdx = Math.min(
      rawToPlaybackIdx(idx),
      animator.currentAnim.frames.length - 1,
    );
    animator.frameIndex = playbackIdx;
    animator.elapsedMs = 0;
    setScrubbing(true);
    frameSlider.value = playbackIdx;
    frameVal.textContent = `${playbackIdx + 1}/${animator.currentAnim.frames.length}`;
  }
}

function selectRange(anchor, target) {
  const lo = Math.min(anchor, target);
  const hi = Math.max(anchor, target);
  selectedFrameIdx = target;
  dupFrameBtn.disabled = false;
  delFrameBtn.disabled = false;
  // Highlight range
  frameStrip.querySelectorAll(".frame-cell").forEach((c, i) => {
    c.classList.toggle("selected", i >= lo && i <= hi);
  });
  // Freeze preview on target frame
  if (animator?.currentAnim) {
    const playbackIdx = Math.min(
      rawToPlaybackIdx(target),
      animator.currentAnim.frames.length - 1,
    );
    animator.frameIndex = playbackIdx;
    animator.elapsedMs = 0;
    setScrubbing(true);
    frameSlider.value = playbackIdx;
    frameVal.textContent = `${playbackIdx + 1}/${animator.currentAnim.frames.length}`;
  }
}

function highlightFrameCell(idx) {
  frameStrip
    .querySelectorAll(".frame-cell")
    .forEach((c, i) => c.classList.toggle("selected", i === idx));
}

// ── Delete frame ──────────────────────────────────────────────────────────
function deleteSelectedFrame() {
  const animDef = currentAnims.find((a) => a.key === currentAnimKey);
  if (!animDef) return;

  const sel = getSelectedRange();
  if (!sel) return;
  const { lo, hi } = sel;

  if (animDef.frames.length <= hi - lo + 1) {
    alert("Cannot delete all frames.");
    return;
  }

  animDef.frames.splice(lo, hi - lo + 1);
  selectedFrameIdx = Math.min(lo, animDef.frames.length - 1);
  anchorFrameIdx = selectedFrameIdx;

  // Remove deleted indices from hiddenFrames and shift remaining down
  const newHidden = new Set();
  hiddenFrames.forEach((i) => {
    if (i < lo) newHidden.add(i);
    else if (i > hi) newHidden.add(i - (hi - lo + 1));
  });
  hiddenFrames = newHidden;

  rebuildAnimator();
  renderFrameEditor();
}

delFrameBtn.addEventListener("click", deleteSelectedFrame);

applyDurBtn.addEventListener("click", () => {
  const v = parseInt(globalDur.value);
  if (!v || v < 1) return;
  const animDef = currentAnims.find((a) => a.key === currentAnimKey);
  if (!animDef) return;
  animDef.frames.forEach((f) => (f.duration = v));
  rebuildAnimator();
  renderFrameEditor();
});

repeatBtn.addEventListener("click", () => {
  const animDef = currentAnims?.find((a) => a.key === currentAnimKey);
  if (!animDef) return;
  animDef.repeat = animDef.repeat === -1 ? 0 : -1;
  syncRepeatBtn();
  refreshJsonPanel();
});

// ── Save ──────────────────────────────────────────────────────────────────
async function saveAnims() {
  const relPath = `${TABS[activeTab].customDist}/${currentUnitName}_anims.json`;
  try {
    const r = await fetch(`${API}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: relPath, data: currentAnims }),
    });
    if (!r.ok) throw new Error((await r.json()).error);
    pollSnapshot = JSON.stringify(currentAnims);
    saveBtn.textContent = "Saved ✓";
    saveBtn.classList.add("saved");
    setTimeout(() => {
      saveBtn.textContent = "Save";
      saveBtn.classList.remove("saved");
    }, 1500);
  } catch (err) {
    alert("Save failed: " + err.message);
  }
}

saveBtn.addEventListener("click", saveAnims);

// ── Live reload ───────────────────────────────────────────────────────────
let pollSnapshot = null;
let pollInterval = null;

function startPolling() {
  stopPolling();
  if (!currentUnitName) return;
  const { customDist } = TABS[activeTab];
  const url = `${API}/${customDist}/${currentUnitName}_anims.json`;
  pollSnapshot = JSON.stringify(currentAnims);
  pollInterval = setInterval(async () => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return;
      const text = await r.text();
      if (text === pollSnapshot) return;
      pollSnapshot = text;
      currentAnims = JSON.parse(text);
      rebuildAnimator();
      renderFrameEditor();
    } catch {
      /* file not saved yet, ignore */
    }
  }, 1000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  pollSnapshot = null;
}

// ── Keyboard ──────────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;

  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const visible = [...itemListEl.querySelectorAll(".list-item")].map(
      (el) => el.textContent,
    );
    const idx = visible.indexOf(activeItem);
    const next =
      e.key === "ArrowDown"
        ? Math.min(idx + 1, visible.length - 1)
        : Math.max(idx - 1, 0);
    if (visible[next]) loadItem(visible[next]);
    return;
  }

  if (e.key === " ") {
    e.preventDefault();
    setScrubbing(!scrubbing);
    return;
  }
  if (e.key === "Delete") {
    deleteSelectedFrame();
    return;
  }

  if (e.key === "r" && isFxTab && activeItem) {
    playAnim(animator?.currentAnim?.key);
    return;
  }

  if (/^[1-9]$/.test(e.key)) {
    const btns = [...document.querySelectorAll(".anim-btn")];
    const btn = btns[parseInt(e.key) - 1];
    if (btn) btn.click();
  }
});

// ── Aseprite FX import ───────────────────────────────────────────────────
document
  .getElementById("open-folder-btn")
  .addEventListener("click", () => fetch(`${API}/open-folder`));
const importToggleBtn = document.getElementById("import-toggle-btn");
const importPanel = document.getElementById("import-panel");
const importNameInput = document.getElementById("import-name");
const importRepeatBtn = document.getElementById("import-repeat-btn");
const importDrop = document.getElementById("import-drop");
const importFile = document.getElementById("import-file");
const importResult = document.getElementById("import-result");
const importStatus = document.getElementById("import-status");
const importSaveBtn = document.getElementById("import-save-btn");
const importSaveStatus = document.getElementById("import-save-status");

let importRepeat = -1; // -1 = loop, 0 = once

importToggleBtn.addEventListener("click", () => {
  const open = importPanel.classList.toggle("open");
  importToggleBtn.classList.toggle("open", open);
});

importRepeatBtn.addEventListener("click", () => {
  importRepeat = importRepeat === -1 ? 0 : -1;
  importRepeatBtn.textContent =
    importRepeat === -1 ? "Repeat: loop" : "Repeat: once";
  importRepeatBtn.classList.toggle("off", importRepeat === 0);
});

importDrop.addEventListener("click", () => importFile.click());
importDrop.addEventListener("dragover", (e) => {
  e.preventDefault();
  importDrop.classList.add("drag-over");
});
importDrop.addEventListener("dragleave", () =>
  importDrop.classList.remove("drag-over"),
);
importDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  importDrop.classList.remove("drag-over");
  const files = [...e.dataTransfer.files];
  const json = files.find(
    (f) => f.type === "application/json" || f.name.endsWith(".json"),
  );
  const png = files.find(
    (f) => f.type === "image/png" || f.name.endsWith(".png"),
  );
  if (png) importPngFile = png;
  if (json) processAsepriteFile(json);
});
importFile.addEventListener("change", () => {
  if (importFile.files[0]) processAsepriteFile(importFile.files[0]);
});

let importPending = null; // { name, atlas, anims, pngFile }

function processAsepriteFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = JSON.parse(e.target.result);
      const name =
        importNameInput.value.trim() || file.name.replace(/\.json$/i, "");

      // Sort frames by trailing number: "Sprite-0002 3." → 3
      const frameEntries = Object.entries(raw.frames || {});
      frameEntries.sort((a, b) => {
        const na = parseInt(a[0].match(/(\d+)\.\s*$/)?.[1] ?? 0);
        const nb = parseInt(b[0].match(/(\d+)\.\s*$/)?.[1] ?? 0);
        return na - nb;
      });

      // Build atlas JSON
      const atlasFrames = {};
      frameEntries.forEach(([, v], i) => {
        const key = `${name}_${String(i).padStart(3, "0")}`;
        atlasFrames[key] = {
          frame: { x: v.frame.x, y: v.frame.y, w: v.frame.w, h: v.frame.h },
        };
      });
      const atlas = { frames: atlasFrames };

      // Build anims JSON
      const animFrames = Object.keys(atlasFrames).map((k) => ({
        name: k,
        duration: 50,
      }));
      const anims = [{ key: name, repeat: importRepeat, frames: animFrames }];

      // Find the PNG from the meta image field
      const pngName = raw.meta?.image || null;
      importPending = { name, atlas, anims, pngName };

      importStatus.textContent = `${frameEntries.length} frames → ${name}_000 … ${name}_${String(frameEntries.length - 1).padStart(3, "0")}${pngName ? ` (PNG: ${pngName})` : " — drop PNG separately"}`;
      importSaveStatus.textContent = "";
      importResult.classList.add("open");
    } catch (err) {
      importStatus.textContent = `Error: ${err.message}`;
      importResult.classList.add("open");
    }
  };
  reader.readAsText(file);
}

// importPngFile set by the drop listener above
let importPngFile = null;

importSaveBtn.addEventListener("click", async () => {
  if (!importPending) return;
  const { name, atlas, anims } = importPending;
  importSaveStatus.textContent = "Saving…";
  try {
    // Save atlas JSON
    await fetch(`${API}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `dist-fx-custom/${name}.json`,
        data: atlas,
      }),
    }).then((r) => {
      if (!r.ok) throw new Error("atlas save failed");
    });

    // Save anims JSON
    await fetch(`${API}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: `dist-fx-custom/${name}_anims.json`,
        data: anims,
      }),
    }).then((r) => {
      if (!r.ok) throw new Error("anims save failed");
    });

    // Save PNG if dropped
    if (importPngFile) {
      const buf = await importPngFile.arrayBuffer();
      await fetch(`${API}/save-binary?path=dist-fx-custom/${name}.png`, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: buf,
      }).then((r) => {
        if (!r.ok) throw new Error("png save failed");
      });
    }

    importSaveStatus.textContent = importPngFile
      ? "Saved atlas, anims + PNG ✓"
      : "Saved atlas + anims ✓ (drop PNG to also save it)";
    importSaveStatus.style.color = "#60e0a0";
    importPngFile = null;
    // Refresh FX custom manifest
    loadFxManifests();
  } catch (err) {
    importSaveStatus.textContent = `Error: ${err.message}`;
    importSaveStatus.style.color = "#f06060";
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────
loadManifest("units");
