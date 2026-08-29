import { API, STATIC_MODE } from "./config.js";
import { loadFxManifests } from "./projectile.js";

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

const openFolderBtn = document.getElementById("open-folder-btn");
if (STATIC_MODE) {
  openFolderBtn.style.display = "none";
} else {
  openFolderBtn.addEventListener("click", () => fetch(`${API}/open-folder`));
}

let importRepeat = -1; // -1 = loop, 0 = once
let importPending = null; // { name, atlas, anims, pngFile }
let importPngFile = null;

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

importSaveBtn.addEventListener("click", async () => {
  if (!importPending) return;
  if (STATIC_MODE) {
    importSaveStatus.textContent = "Save not available in demo mode.";
    importSaveStatus.style.color = "#f06060";
    return;
  }
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
