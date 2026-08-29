import { itemListEl } from "./dom.js";
import {
  activeItem,
  scrubbing,
  isFxTab,
  animator,
} from "./state.js";
import { loadItem } from "./item-loader.js";
import { setScrubbing } from "./controls.js";
import { deleteSelectedFrames } from "./frame-editor.js";
import { playAnim } from "./animation-manager.js";

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
    deleteSelectedFrames();
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
