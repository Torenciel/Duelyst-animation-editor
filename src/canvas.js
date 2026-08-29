import {
  canvas,
  ctx,
  fxOverlay,
  fxCtx,
  frameSlider,
  frameVal,
  projReleaseInput,
  projScaleInput,
  projSetOriginBtn,
  projSaveBtn,
} from "./dom.js";
import {
  scrubbing,
  animator,
  scale,
  speed,
  isFxTab,
  rafId, setRafId,
  lastTime, setLastTime,
  draggingMarker, setDraggingMarker,
  lastMousePos, setLastMousePos,
} from "./state.js";
import { setScrubbing } from "./controls.js";
import {
  getProjAnimator,
  getProjOrigin, setProjOrigin,
  getProjClickMode, setProjClickMode,
  getProjElapsed, setProjElapsed,
  getProjReleased, setProjReleased,
  getProjFxValue,
  updateOriginCoord,
} from "./projectile.js";
import { highlightFrameCell } from "./frame-editor.js";

export function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  setLastTime(0);
  setProjReleased(false);
  setProjElapsed(0);

  function tick(ts) {
    const dt = lastTime ? (ts - lastTime) * speed : 16;
    setLastTime(ts);

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
    const projAnimator = getProjAnimator();
    const projOrigin = getProjOrigin();

    if (!isFxTab && projAnimator && projOrigin) {
      const releaseFrame = parseInt(projReleaseInput.value) || 0;
      const unitFrame = animator.frameIndex;

      // Reset when unit animation loops back before the release frame
      if (getProjReleased() && unitFrame < releaseFrame) {
        setProjReleased(false);
      }

      if (!getProjReleased() && unitFrame >= releaseFrame) {
        setProjReleased(true);
        setProjElapsed(0);
        projAnimator.play(getProjFxValue());
      }
      if (getProjReleased() && !scrubbing) {
        projAnimator.update(dt);
        setProjElapsed(getProjElapsed() + dt);
      }

      if (getProjReleased() && !projAnimator.completed) {
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
      const currentProjOrigin = getProjOrigin();
      if (currentProjOrigin)
        drawMarker(currentProjOrigin.x, currentProjOrigin.y, "#c084fc", "O");
      // Cursor feedback
      if (draggingMarker) {
        canvas.style.cursor = "grabbing";
      } else if (getProjClickMode()) {
        canvas.style.cursor = "crosshair";
      } else if (markerHitTest(lastMousePos, currentProjOrigin)) {
        canvas.style.cursor = "grab";
      } else {
        canvas.style.cursor = "pointer";
      }
    }

    setRafId(requestAnimationFrame(tick));
  }

  setRafId(requestAnimationFrame(tick));
}

export function drawMarker(x, y, color, label) {
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
    Math.abs(pos.x - marker.x) <= radius &&
    Math.abs(pos.y - marker.y) <= radius
  );
}

canvas.addEventListener("mousedown", (e) => {
  if (isFxTab) return;
  const pos = canvasPos(e);

  // Placement mode
  if (getProjClickMode() === "origin") {
    setProjOrigin(pos);
    updateOriginCoord();
    if (animator?.frameIndex !== undefined)
      projReleaseInput.value = animator.frameIndex;
    projSaveBtn.disabled = false;
    setProjClickMode(null);
    projSetOriginBtn.classList.remove("active");
    setDraggingMarker("origin");
    return;
  }
  // Drag existing marker
  if (markerHitTest(pos, getProjOrigin())) {
    setDraggingMarker("origin");
    return;
  }

  // Otherwise resume playback (original click-to-play behavior)
  setScrubbing(false);
});

canvas.addEventListener("mousemove", (e) => {
  const pos = canvasPos(e);
  setLastMousePos(pos);
  if (!draggingMarker || isFxTab) return;
  if (draggingMarker === "origin") {
    setProjOrigin(pos);
    updateOriginCoord();
    projSaveBtn.disabled = false;
  }
});

canvas.addEventListener("mouseup", () => {
  setDraggingMarker(null);
});
canvas.addEventListener("mouseleave", () => {
  setDraggingMarker(null);
});
