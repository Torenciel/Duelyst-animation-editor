import {
  frameEditor,
  frameStrip,
  frameSlider,
  frameVal,
  dupFrameBtn,
  hideFrameBtn,
  delFrameBtn,
  globalDur,
  applyDurBtn,
  repeatBtn,
} from "./dom.js";
import {
  currentAnims,
  currentAnimKey,
  currentAtlas,
  currentImage,
  selectedFrameIdx,
  setSelectedFrameIdx,
  anchorFrameIdx,
  setAnchorFrameIdx,
  hiddenFrames,
  setHiddenFrames,
  animator,
  rawToPlaybackIdx,
} from "./state.js";
import { refreshJsonPanel } from "./json-display.js";
import { setScrubbing } from "./controls.js";
import { THUMB } from "./config.js";

export function renderFrameEditor() {
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
      setSelectedFrameIdx(to);
      import("./animation-manager.js").then(({ rebuildAnimator }) => rebuildAnimator());
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
  import("./animation-manager.js").then(({ syncRepeatBtn }) => syncRepeatBtn());
}

export function getSelectedRange() {
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

export function selectFrame(idx) {
  setSelectedFrameIdx(idx);
  setAnchorFrameIdx(idx);
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

export function selectRange(anchor, target) {
  const lo = Math.min(anchor, target);
  const hi = Math.max(anchor, target);
  setSelectedFrameIdx(target);
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

export function highlightFrameCell(idx) {
  frameStrip
    .querySelectorAll(".frame-cell")
    .forEach((c, i) => c.classList.toggle("selected", i === idx));
}

export function deleteSelectedFrames() {
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
  setSelectedFrameIdx(Math.min(lo, animDef.frames.length - 1));
  setAnchorFrameIdx(selectedFrameIdx);

  // Remove deleted indices from hiddenFrames and shift remaining down
  const newHidden = new Set();
  hiddenFrames.forEach((i) => {
    if (i < lo) newHidden.add(i);
    else if (i > hi) newHidden.add(i - (hi - lo + 1));
  });
  setHiddenFrames(newHidden);

  import("./animation-manager.js").then(({ rebuildAnimator }) => rebuildAnimator());
  renderFrameEditor();
}

dupFrameBtn.addEventListener("click", () => {
  const animDef = currentAnims?.find((a) => a.key === currentAnimKey);
  if (!animDef) return;
  const sel = getSelectedRange();
  if (!sel) return;
  const { lo, hi } = sel;
  const copies = animDef.frames.slice(lo, hi + 1).map((f) => ({ ...f }));
  animDef.frames.splice(hi + 1, 0, ...copies);
  setSelectedFrameIdx(hi + copies.length);
  setAnchorFrameIdx(hi + 1);
  import("./animation-manager.js").then(({ rebuildAnimator }) => rebuildAnimator());
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
  import("./animation-manager.js").then(({ rebuildAnimator }) => rebuildAnimator());
  renderFrameEditor();
});

delFrameBtn.addEventListener("click", deleteSelectedFrames);

applyDurBtn.addEventListener("click", () => {
  const v = parseInt(globalDur.value);
  if (!v || v < 1) return;
  const animDef = currentAnims.find((a) => a.key === currentAnimKey);
  if (!animDef) return;
  animDef.frames.forEach((f) => (f.duration = v));
  import("./animation-manager.js").then(({ rebuildAnimator }) => rebuildAnimator());
  renderFrameEditor();
});

repeatBtn.addEventListener("click", () => {
  const animDef = currentAnims?.find((a) => a.key === currentAnimKey);
  if (!animDef) return;
  animDef.repeat = animDef.repeat === -1 ? 0 : -1;
  import("./animation-manager.js").then(({ syncRepeatBtn }) => syncRepeatBtn());
  refreshJsonPanel();
});
