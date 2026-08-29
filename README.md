# Duelyst Animation Pipeline

Tools for converting, viewing, and editing Duelyst sprite animations for use in a Phaser 3 / Canvas 2D game.

## Requirements

- Node.js (no npm packages needed)
- Source assets from the open-source [Duelyst repo](https://github.com/88dots/duelyst)

## Setup

Edit `config.json` with the paths to your local Duelyst source assets:

```json
{
  "unitsDir": "/path/to/duelyst/app/resources/units",
  "fxDir": "/path/to/duelyst/app/resources/fx"
}
```

---

## Folder structure

```
dist/               Converted unit spritesheets (read-only originals)
dist-custom/        Edited/custom units — viewer saves here
dist-fx/            Converted FX spritesheets (read-only originals)
dist-fx-custom/     Custom FX + Aseprite imports
background/         Map background PNGs for viewer preview
```

---

## Output format

Each unit or FX entry consists of three files:

**`{name}.png`** — spritesheet, copied as-is from source.

**`{name}.json`** — atlas:

```json
{
  "frames": {
    "unit_attack_000": { "frame": { "x": 0, "y": 0, "w": 120, "h": 120 } },
    "unit_attack_001": { "frame": { "x": 120, "y": 0, "w": 120, "h": 120 } }
  }
}
```

**`{name}_anims.json`** — animation definitions:

```json
[
  {
    "key": "unit_attack",
    "repeat": 0,
    "frames": [
      { "name": "unit_attack_000", "duration": 50 },
      { "name": "unit_attack_001", "duration": 50 }
    ]
  }
]
```

- `repeat: -1` = loop, `repeat: 0` = play once
- `duration` is in milliseconds per frame

---

## Converter scripts

Convert all source `.plist` spritesheets to the output format above:

```bash
# Convert all units → dist/
node convert-units-plist.js

# Convert all FX → dist-fx/
node convert-fx.js

# Regenerate dist/manifest.json (required after adding new units)
node make-manifest.js
```

> **Naming rule:** the `_anims` suffix must always be last.
> ✓ `neutral_metaltooth_recolor_anims.json`
> ✗ `neutral_metaltooth_anims_recolor.json`

---

## Running the viewer

```bash
node server.js
```

Then open `http://localhost:3000` in your browser.

The server provides:

- Static file serving for all assets
- `POST /save` — saves JSON to `dist-custom/` or `dist-fx-custom/`
- `POST /save-binary?path=...` — saves binary files (PNG) to a dist path
- `GET /list?dir=dist-custom` — lists unit names in a custom folder

---

## Viewer features

### Tabs

| Tab          | Loads from        | Saves to          |
| ------------ | ----------------- | ----------------- |
| Units        | `dist/`           | `dist-custom/`    |
| FX           | `dist-fx/`        | `dist-fx-custom/` |
| Units custom | `dist-custom/`    | `dist-custom/`    |
| FX custom    | `dist-fx-custom/` | `dist-fx-custom/` |

### Animation bar

- Click animation name buttons to switch animations
- **✎ Rename** — rename the current animation
- **⧉ Duplicate** — clone the current animation under a new name
- **✕ Delete anim** — remove the current animation

### Frame editor (units only)

- **▶ / ⏸** — play/pause
- **Frame slider** — scrub through frames manually
- **⧉ Dup** — duplicate selected frame(s)
- **◑ Hide** — hide/show selected frame(s) during playback
- **✕ Delete** — remove selected frame(s)
- **Scale** — preview zoom (default 2×)
- **Speed** — playback speed multiplier
- **↺ Loop** — toggle looping for current playback session (does not save)
- **Repeat** — toggle `repeat` value in the JSON (-1 loop / 0 once) — this saves
- **BG** — select a background map image behind the sprite
- **Set all / Apply** — set every frame's duration to a fixed value
- **Save** — write changes to `dist-custom/`

### Frame selection

- Click a thumbnail to select it and freeze preview on that frame
- Shift+click to select a range
- Drag thumbnails left/right to reorder frames

### Keyboard shortcuts

| Key    | Action                          |
| ------ | ------------------------------- |
| Space  | Play / pause                    |
| Delete | Delete selected frame(s)        |
| ↑ / ↓  | Previous / next unit in list    |
| 1–9    | Switch to animation by position |

---

## Projectile config

Units that fire projectiles store a config entry in their `_anims.json` alongside the animation definitions:

```json
{
  "projectileKey": "fx_arrow_lyonar",
  "releaseFrame": 7,
  "offsetX": 25,
  "offsetY": -12,
  "projectileSpeed": 0.6
}
```

- **`projectileKey`** — name of an FX entry in `dist-fx/` or `dist-fx-custom/`
- **`releaseFrame`** — frame index at which the projectile spawns
- **`offsetX/Y`** — spawn position relative to the sprite's fixed center point (60, 60) in a 120×120 frame
- **`projectileSpeed`** — travel speed in world units per second

### Setting up a projectile config in the viewer

1. Select a unit and switch to its attack animation
2. The **Projectile FX** panel appears above the frame toolbar
3. Search and select the FX to use as the projectile
4. Step to the frame where the projectile should fire
5. Click **+ Origin**, then click the canvas where the projectile spawns — release frame auto-fills
6. Drag the marker to reposition it
7. Adjust **Speed** as needed
8. Click **Save config**

---

## Importing Aseprite FX

For custom FX created in Aseprite:

1. Export from Aseprite: **File → Export Sprite Sheet** → JSON Hash format
2. In the viewer, click **⬇ Import Aseprite FX**
3. Enter the target name (e.g. `fx_arrow_lyonar`)
4. Toggle **Repeat: loop / once**
5. Drop the Aseprite `.json` file (and optionally the `.png`) onto the drop zone
6. Click **↑ Save to dist-fx-custom**

This generates and saves:

- `dist-fx-custom/{name}.json` — atlas with frames renamed `{name}_000`, `{name}_001`…
- `dist-fx-custom/{name}_anims.json` — single animation entry
- `dist-fx-custom/{name}.png` — PNG (if dropped)

The FX is immediately available in the Projectile FX dropdown.

---

## Adding a recolored unit

1. Edit the spritesheet PNG (recolor in Aseprite or similar)
2. Save as `dist/{original_name}_recolor.png`
3. Copy `dist/{original_name}.json` → `dist/{original_name}_recolor.json`
4. Copy `dist/{original_name}_anims.json` → `dist/{original_name}_recolor_anims.json`
5. Run `node make-manifest.js`
6. The unit appears in the Units tab as `{original_name}_recolor`
