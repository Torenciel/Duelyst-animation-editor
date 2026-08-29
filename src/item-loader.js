import {
  searchInput,
  itemListEl,
  itemCountEl,
  placeholder,
  canvas,
  frameEditor,
  animBtnGroup,
  frameStrip,
  projPanel,
} from "./dom.js";
import {
  activeTab, setActiveTab,
  allItems, setAllItems,
  activeItem, setActiveItem,
  isFxTab, setIsFxTab,
  setLoopOverride,
  setScrubbing as setScrubbingState,
  setSelectedFrameIdx,
  setCurrentAnims,
  setCurrentAtlas,
  setCurrentImage,
  setCurrentUnitName,
  setHiddenFrames,
  rafId, setRafId,
  setAnimator,
  animDefs,
} from "./state.js";
import { API, TABS } from "./config.js";
import { rebuildAnimator, buildAnimBar, playAnim } from "./animation-manager.js";
import { showProjPanel } from "./projectile.js";
import { refreshJsonPanel } from "./json-display.js";
import { startLoop } from "./canvas.js";
import { startPolling, stopPolling } from "./persistence.js";

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export async function loadManifest(tab) {
  const { dist } = TABS[tab];
  const isCustomTab = tab === "units-custom" || tab === "fx-custom";
  try {
    if (isCustomTab) {
      setAllItems(
        await fetch(`${API}/list?dir=${dist}`).then((r) => r.json()),
      );
    } else {
      setAllItems(
        await fetch(`${API}/${dist}/manifest.json`).then((r) => {
          if (!r.ok) throw 0;
          return r.json();
        }),
      );
    }
    renderList(allItems);
    if (allItems.length === 0) placeholder.textContent = TABS[tab].placeholder;
  } catch {
    placeholder.innerHTML = `No <code>${dist}/manifest.json</code> found.`;
  }
}

export function renderList(items) {
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

export async function deleteCustomFile(name) {
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
  setAllItems(allItems.filter((x) => x !== name));
  if (activeItem === name) {
    setActiveItem(null);
    setCurrentAnims(null);
    stopPolling();
    animBtnGroup.innerHTML = "";
    frameStrip.innerHTML = "";
    placeholder.textContent = "← Select an item to preview";
    placeholder.style.display = "";
  }
  const q = searchInput.value.trim().toLowerCase();
  renderList(q ? allItems.filter((u) => u.includes(q)) : allItems);
}

export async function loadItem(name) {
  setActiveItem(name);
  setLoopOverride(isFxTab ? true : null);
  setScrubbingState(false);
  setSelectedFrameIdx(null);
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

  setCurrentImage(image);
  setCurrentAtlas(atlas);
  setCurrentAnims(anims);
  setCurrentUnitName(name);
  setHiddenFrames(new Set());

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

// ── Tab switching ────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((tabEl) => {
  tabEl.addEventListener("click", () => {
    const tab = tabEl.dataset.tab;
    if (tab === activeTab) return;
    setActiveTab(tab);
    setIsFxTab(tab === "fx" || tab === "fx-custom");
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    searchInput.value = "";
    setActiveItem(null);
    if (rafId) {
      cancelAnimationFrame(rafId);
      setRafId(null);
    }
    setAnimator(null);
    canvas.style.display = "none";
    frameEditor.style.display = "none";
    projPanel.style.display = "none";
    animBtnGroup.innerHTML = "";

    placeholder.textContent = TABS[tab].placeholder;
    placeholder.style.display = "";
    loadManifest(tab);
  });
});

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  renderList(q ? allItems.filter((u) => u.includes(q)) : allItems);
});
