export let activeTab = "units";
export let allItems = [];
export let activeItem = null;
export let animator = null;
export let rafId = null;
export let lastTime = 0;
export let scale = 2;
export let speed = 1;
export let isFxTab = false;
export let scrubbing = false;
export let loopOverride = null;
export let currentAnims = null;
export let currentAtlas = null;
export let currentImage = null;
export let currentAnimKey = null;
export let currentUnitName = null;
export let selectedFrameIdx = null;
export let anchorFrameIdx = null;
export let hiddenFrames = new Set();
export let draggingMarker = null;
export let lastMousePos = { x: -999, y: -999 };

export function setActiveTab(v) { activeTab = v; }
export function setAllItems(v) { allItems = v; }
export function setActiveItem(v) { activeItem = v; }
export function setAnimator(v) { animator = v; }
export function setRafId(v) { rafId = v; }
export function setLastTime(v) { lastTime = v; }
export function setScale(v) { scale = v; }
export function setSpeed(v) { speed = v; }
export function setIsFxTab(v) { isFxTab = v; }
export function setScrubbing(v) { scrubbing = v; }
export function setLoopOverride(v) { loopOverride = v; }
export function setCurrentAnims(v) { currentAnims = v; }
export function setCurrentAtlas(v) { currentAtlas = v; }
export function setCurrentImage(v) { currentImage = v; }
export function setCurrentAnimKey(v) { currentAnimKey = v; }
export function setCurrentUnitName(v) { currentUnitName = v; }
export function setSelectedFrameIdx(v) { selectedFrameIdx = v; }
export function setAnchorFrameIdx(v) { anchorFrameIdx = v; }
export function setHiddenFrames(v) { hiddenFrames = v; }
export function setDraggingMarker(v) { draggingMarker = v; }
export function setLastMousePos(v) { lastMousePos = v; }

export function animDefs() {
  return currentAnims.filter(
    (a) => !a.projectileConfigs && Array.isArray(a.frames),
  );
}

export function rawToPlaybackIdx(rawIdx) {
  let count = -1;
  for (let i = 0; i <= rawIdx; i++) {
    if (!hiddenFrames.has(i)) count++;
  }
  return Math.max(0, count);
}
