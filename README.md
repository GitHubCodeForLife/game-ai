# Bastion

The **Last Light — Roads of Dawn** auto-combat campaign is available at **http://localhost:3000/last-light.html** after starting the server below. It includes six stages across Japan and Egypt, a tutorial, saved gold, permanent upgrades, settings, and isolated testing mode. See [LAST-LIGHT.md](LAST-LIGHT.md) for controls, progression, and tests; [game-flow.html](game-flow.html) is the design reference.

A complete browser tower defense game built with HTML, CSS, vanilla JavaScript, and Three.js. All scenery, towers, enemies, and effects are procedural 3D geometry.

## Play locally

Requires Node.js 18 or newer. No package installation is needed.

```sh
npm start
```

Open **http://localhost:3000**. Use `PORT=3001 npm start` to choose another port. Serve through HTTP; ES modules cannot load by opening `index.html` directly from disk.

## How to play

- Protect the blue crystal through 12 waves. You start with 20 health, 350 gold, and three free towers.
- Choose a **Sentry** (100 gold), **Cannon** (160), or **Frost** (130), then click an empty stone build pad.
- Sentries attack quickly, Cannons deal splash damage, and Frost towers slow enemies by 50%.
- Start each wave when you are ready. Kills and cleared waves earn gold.
- Click a tower to upgrade it up to level 3 or sell it for 70% of the gold spent. Free starting towers have no resale value until upgraded.
- Use **1 / 2 / 3** to choose a tower, **Space** to pause, and **Escape** to deselect. Drag to orbit and scroll to zoom.
- The build panel also has a keyboard-accessible site picker.
- Background music and sound effects are enabled by default after the first click, tap, or key press. Open the speaker button for separate volume and mute controls; your choices are remembered locally. The forest score becomes more urgent during combat and boss waves. Sentries, Cannons, and Frost towers each have their own sound, with cues for building, upgrading, selling, crystal damage, wave completion, victory, and defeat. Pausing or switching tabs silences audio; sound settings lets you listen while combat is paused.

## Development

```sh
npm test
```

- `game.js` — deterministic simulation and balance.
- `world.js` — Three.js scene, models, pointer controls, and effects.
- `main.js` — HUD, player actions, dialogs, and audio controls.
- `bastion-audio.js` — original synthesized background music, tower effects, and saved audio preferences.
- `style.css` / `index.html` — responsive interface.
- `server.js` — dependency-free local static server.
- `vendor/` — pinned Three.js 0.180.0 modules and upstream MIT license.

The game and Three.js run locally without network access. Optional Google Fonts fall back to system fonts when offline. Game progress lasts for the current page session.

Run audio and gameplay checks with `node --test game.test.js bastion-audio.test.js`. No audio downloads or additional packages are needed.
# game-ai
# game-ai
