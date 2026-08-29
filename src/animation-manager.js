import {
  animBtnGroup,
  frameEditor,
  frameSlider,
  frameVal,
  loopBtn,
  repeatBtn,
  renameAnimBtn,
  duplicateBtn,
  deleteAnimBtn,
} from "./dom.js";
import {
  currentAnims, setCurrentAnims,
  currentAnimKey, setCurrentAnimKey,
  currentImage,
  currentAtlas,
  activeTab,
  currentUnitName,
  loopOverride,
  animator, setAnimator,
  selectedFrameIdx, setSelectedFrameIdx,
  anchorFrameIdx, setAnchorFrameIdx,
  hiddenFrames, setHiddenFrames,
  animDefs,
} from "./state.js";
import { refreshJsonPanel } from "./json-display.js";
import { renderFrameEditor } from "./frame-editor.js";
import { syncProjPanelFromConfig, setProjReleased, setProjElapsed } from "./projectile.js";
import { setScrubbing } from "./controls.js";
import { STATIC_MODE } from "./config.js";
import { SpriteAnimator } from "./sprite-animator.js";

export function rebuildAnimator() {
  const prevIdx = animator ? animator.frameIndex : 0;
  const playbackAnims = animDefs().map((def) => {
    if (def.key !== currentAnimKey) return def;
    return {
      ...def,
      frames: def.frames.filter((_, i) => !hiddenFrames.has(i)),
    };
  });
  setAnimator(new SpriteAnimator(currentImage, currentAtlas, playbackAnims));
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

export function buildAnimBar(name) {
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
  if (!STATIC_MODE) {
    animBtnGroup.appendChild(renameAnimBtn);
    animBtnGroup.appendChild(duplicateBtn);
    animBtnGroup.appendChild(deleteAnimBtn);
  }

  const isCustomTab = activeTab === "units-custom" || activeTab === "fx-custom";
  if (isCustomTab) {
    const deleteFileBtn = document.createElement("button");
    deleteFileBtn.id = "delete-file-btn";
    deleteFileBtn.textContent = "✕ Delete file";
    deleteFileBtn.onclick = () =>
      import("./item-loader.js").then(({ deleteCustomFile }) =>
        deleteCustomFile(currentUnitName),
      );
    animBtnGroup.appendChild(deleteFileBtn);
  }
}

export function playAnim(key) {
  if (!key || !animator) return;
  setCurrentAnimKey(key);
  setProjReleased(false);
  setProjElapsed(0);
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

  setSelectedFrameIdx(null);
  setAnchorFrameIdx(null);
  setHiddenFrames(new Set());
  renderFrameEditor();
}

export function syncLoopBtn() {
  if (!animator?.currentAnim) return;
  const on = animator.currentAnim.repeat === -1;
  loopBtn.classList.toggle("on", on);
  loopBtn.textContent = on ? "↺ Loop: on" : "↺ Loop: off";
}

export function syncRepeatBtn() {
  const animDef = currentAnims?.find((a) => a.key === currentAnimKey);
  if (!animDef) return;
  const on = animDef.repeat === -1;
  repeatBtn.classList.toggle("off", !on);
  repeatBtn.textContent = on ? "Repeat: on" : "Repeat: off";
}

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
  setCurrentAnimKey(trimmed);
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

async function deleteCurrentAnim() {
  if (!currentAnimKey) return;
  if (!confirm(`Delete animation "${currentAnimKey}"?`)) return;
  setCurrentAnims(currentAnims.filter((a) => a.key !== currentAnimKey));
  setCurrentAnimKey(null);
  rebuildAnimator();
  buildAnimBar(currentUnitName);
  if (animDefs().length > 0) {
    playAnim(animDefs()[0].key);
  } else {
    frameEditor.style.display = "none";
  }
  const { saveAnims } = await import("./persistence.js");
  await saveAnims();
}
