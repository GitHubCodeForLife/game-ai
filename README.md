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
- Sound is optional and starts muted. Switching tabs pauses an active wave.

## Development

```sh
npm test
```

- `game.js` — deterministic simulation and balance.
- `world.js` — Three.js scene, models, pointer controls, and effects.
- `main.js` — HUD, player actions, dialogs, and sound.
- `style.css` / `index.html` — responsive interface.
- `server.js` — dependency-free local static server.
- `vendor/` — pinned Three.js 0.180.0 modules and upstream MIT license.

The game and Three.js run locally without network access. Optional Google Fonts fall back to system fonts when offline. Game progress lasts for the current page session.
# game-ai
# game-ai
