import { saveBtn } from "./dom.js";
import {
  activeTab,
  currentUnitName,
  currentAnims, setCurrentAnims,
} from "./state.js";
import { API, TABS } from "./config.js";
import { rebuildAnimator } from "./animation-manager.js";
import { renderFrameEditor } from "./frame-editor.js";

let pollSnapshot = null;
let pollInterval = null;

export async function saveAnims() {
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

export function startPolling() {
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
      setCurrentAnims(JSON.parse(text));
      rebuildAnimator();
      renderFrameEditor();
    } catch {
      /* file not saved yet, ignore */
    }
  }, 1000);
}

export function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  pollSnapshot = null;
}

saveBtn.addEventListener("click", saveAnims);
