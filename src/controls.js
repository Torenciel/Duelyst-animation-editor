import {
  scaleSlider,
  scaleVal,
  speedSlider,
  speedVal,
  playBtn,
  frameSlider,
  frameVal,
  loopBtn,
  bgSelect,
  canvasWrap,
} from "./dom.js";
import {
  setScale,
  setSpeed,
  scrubbing,
  setScrubbing as setScrubbingState,
  animator,
  currentAnimKey,
  setLoopOverride,
} from "./state.js";
import { API } from "./config.js";

export function setScrubbing(val) {
  setScrubbingState(val);
  playBtn.classList.toggle("playing", !val);
  playBtn.textContent = val ? "▶" : "⏸";
}

scaleSlider.addEventListener("input", () => {
  setScale(parseFloat(scaleSlider.value));
  scaleVal.textContent = `${scaleSlider.value}×`;
});

speedSlider.addEventListener("input", () => {
  setSpeed(parseFloat(speedSlider.value));
  speedVal.textContent = `${speedSlider.value}×`;
});

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
  import("./frame-editor.js").then(({ highlightFrameCell }) => highlightFrameCell(idx));
});
frameSlider.addEventListener("mouseup", () => setScrubbing(false));
frameSlider.addEventListener("touchend", () => setScrubbing(false));

loopBtn.addEventListener("click", () => {
  if (!animator?.currentAnim) return;
  const newLoopOverride = animator.currentAnim.repeat !== -1;
  setLoopOverride(newLoopOverride);
  animator.currentAnim.repeat = newLoopOverride ? -1 : 0;
  animator.completed = false;
  import("./animation-manager.js").then(({ syncLoopBtn }) => syncLoopBtn());
});

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
