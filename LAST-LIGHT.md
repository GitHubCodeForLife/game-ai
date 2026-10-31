# Last Light — Roads of Dawn

A local Three.js auto-combat campaign based on [the game logic document](game-flow.html). Explore Japan and Egypt, clear six stages, earn gold, and buy permanent upgrades. The original Bastion game remains at `/`.

## Run

```sh
npm start
```

Open **http://localhost:3000/last-light.html**. The existing server binds only to `127.0.0.1`. Three.js, geometry, and synthesized music are local; no installation or remote API is needed.

## Campaign

First-time visitors automatically see the welcome introduction before the region map, with a two-wave practice lesson and “Skip to regions.” Starting practice does not dismiss the introduction: leaving an unfinished first lesson or reloading returns to the welcome screen. Finishing the lesson and continuing, or explicitly skipping, saves the choice so returning players go straight to the map. Tutorial replay is available from the map and Settings between runs. Practice does not earn gold or change purchased upgrades.

| Region | Stage | Difficulty | Waves | Boss | First clear / repeat gold |
| --- | --- | --- | --- | --- | --- |
| Japan | Bamboo Pass | Easy | 5 | Pass Sentinel | 120 / 90 |
| Japan | Lantern Village | Normal | 8 | Lantern Captain | 210 / 168 |
| Japan | Mountain Fortress | Hard | 10 | Iron Warden | 306 / 252 |
| Egypt | Desert Crossing | Easy | 6 | Dune Guardian | 130 / 100 |
| Egypt | Temple Gates | Normal | 8 | Gate Colossus | 210 / 168 |
| Egypt | Buried Sanctuary | Hard | 12 | Sunstone Guardian | 342 / 288 |

Clear Bamboo Pass to unlock Lantern Village. Clear Lantern Village to unlock both Mountain Fortress and Desert Crossing. Egypt then progresses through Temple Gates to Buried Sanctuary. All six clears complete the campaign; cleared stages remain replayable.

The stage preview shows difficulty, enemy types, boss, wave count, rewards, unlock requirements, and starting stats. Each stage has a finite formation per wave; every enemy and boss escort appears immediately. Japan has bamboo, a lantern village, and fortress scenery. Egypt has dunes and pyramids, a colonnaded temple, and a darker sanctuary. Boss patterns include heavy strikes, double cuts, Guard, slams, and enrage.

## Combat

- The fighter moves and attacks automatically. Melee enemies queue; archers take firing turns.
- Enemy HP and damage numbers show actual HP lost. The player’s separate blue armor bar stays below HP, including the overhead character label.
- Pick one of three eligible Condition — Action skills at level-up. Every offer contains a direct damage option when available.
- Rest between nonfinal waves: Recover heals 25% of max HP or Train grants 30% of the current full EXP threshold. Then manually start the next wave.
- The final wave is defined by the selected stage, not a fixed wave 10. Defeat every enemy while alive to win.
- Space pauses/resumes. Keys 1–3 choose a skill. 1×/2× controls combat speed.
- Results show outcome, completed waves, wave reached on defeat, enemies defeated, final level, skills with ranks, reward breakdown, and wallet balance.

## Gold and equipment

Easy / Normal / Hard stages pay 10 / 14 / 18 gold per completed wave, plus 40 / 56 / 72 on victory and a one-time first-clear bonus of 30 / 42 / 54. Defeat, abandonment, and interrupted runs pay only completed-wave gold. Incomplete waves do not award gold. Reopening results does not pay again.

Sharpen Blade grants +2 starting base damage per rank; Reinforce Armor grants +5 starting armor per rank. Each has five ranks costing 25, 50, 90, 140, and 200 gold. Upgrades persist between runs, can only be purchased outside a run, and apply once at stage entry. Armor does not refill each wave. Run skills and level reset.

Base fighter: 100 HP, 18 damage, 5% critical chance, 0.85-second interval. Armor cap is half maximum HP, rounded down. Skill percentage bonuses use the permanently upgraded starting base damage.

## Settings and audio

Settings has independent 0–100% music and SFX volume, separate mute controls, a preview sound, reduced motion (System / On / Off), and tutorial replay. New profiles have music enabled at 60%; playback begins after the first click, tap, or key press. Sound effects start muted and can be enabled separately. Returning players keep their saved volume and mute choices. Music uses different local melodies for Japan and Egypt and a faster boss arrangement.

Reduced motion removes shake, particles, ambient bobbing, and rising-number movement while retaining readable damage and attack feedback. Opening Settings pauses a live run; closing it leaves the run paused until Resume. Backgrounding mutes audio and pauses combat.

## Local saves and interruption

Progress is stored under `last-light.profile.v1` in browser local storage: gold, upgrade ranks, stage clears, onboarding, settings, last result, and reward receipts. Purchases and result rewards commit atomically in one profile write. A stale second tab cannot overwrite a newer revision.

The game saves a small active-run summary as it progresses. Reloading or closing a live run does **not** resume combat. On the next visit, the game shows an interrupted result and credits saved completed-wave gold once. Backgrounding without reload keeps the in-memory run paused.

Save failures stop progression and offer Retry save; malformed saves are preserved instead of overwritten. Site-data clearing removes local progress. No accounts or cloud saves are included.

## Testing mode

On the map or stage preview, type **TUGAME** within five seconds. On touch devices, tap the Last Light title five times within three seconds and enter the same code.

The wallet shows ∞, upgrades are free, and every region and stage is immediately available, while upgrade rank caps still apply. Testing uses a temporary copy of the profile: test purchases, rewards, and clears never overwrite real progress. Unlocking test access does not create fake stage clears. Type the code again on the map, use Exit test mode, or reload to restore the real profile and its normal unlock rules. Finish or leave a test run before switching modes.

## Skill baseline

| Skill | Current effect, ranks 1 / 2 / 3 where applicable |
| --- | --- |
| First Strike | First landed attack against **each enemy** critically hits; unique rank. Acquiring it does not reset already-hit enemies. |
| Vital Touch | 50% chance per hit to heal 8 / 12 / 16 HP. |
| Third Beat | Every third hit adds 18 / 30 / 42 damage before critical multiplication. |
| Critical Recovery | Heal 10 / 16 / 22 HP on a critical hit. |
| Tempered Edge | Gain 8 / 12 / 18 armor on a critical hit. |
| Second Wind | Heal 8 / 12 / 16 HP per kill. |
| Overflow Guard | Gain 4 armor per kill, then convert that killing blow's excess healing into additional armor at 1:1; unique rank. |
| Momentum | After a kill, the next hit gains 60% / 90% / 120% of base damage. |
| Opening Guard | Gain 20 / 35 / 50 armor at wave start. |
| Last Stand | Below 50% HP, gain 60% / 90% / 120% of base damage. |
| Retribution | After HP damage, the next hit gains 12 / 20 / 28 damage. |
| Sharpened Edge | Total base-damage bonus: 40% / 80% / 120%. |
| Keen Eye | Total critical-chance bonus: 15 / 30 / 45 percentage points. |
| Vitality | Total max-HP bonus: 25 / 50 / 75; immediately heal 25 on each pick or rank upgrade. |
| Quick Hands | Attack-interval reduction: 20% / 30% / 40%. |

The exhausted-pool fallback grants +6 flat damage. Rest still heals 25% of maximum HP or grants 30% of the current level's full EXP requirement. Armor still caps at 50% of maximum HP, rounded down. Rest healing never creates armor. Overflow Guard's excess-healing conversion applies only to the same killing blow, in addition to its new flat kill reward. All skill-card text is drawn from the live skill definitions.


## Files and verification

- `last-light-campaign.js`: region/stage definitions, rewards, purchases, profile validation and persistence, isolated test mode.
- `last-light-game.js`: browser-independent combat, variable wave counts, upgrades, and boss patterns.
- `last-light-main.js`: onboarding, map, preview, shop, results, settings, keyboard/touch controls, and save orchestration.
- `last-light-world.js`: regional Three.js scenery, fighters, projectiles, HP/armor labels, and reduced motion.
- `last-light-audio.js`: original local music, regional arrangements, combat SFX, independent volume buses.
- `last-light.html` / `last-light.css`: responsive interface.
- `last-light-campaign.css`: illustrated region selection, stage briefing, introduction, workshop, and results, styled after the design flow.
- `last-light-japan.svg` / `last-light-egypt.svg`: original local artwork for the two regions.
- `last-light-campaign.test.js`: campaign progression, economy, persistence failures, test-mode isolation, bosses, and stage completion.
- `last-light.test.js`: combat, skills, armor, wave transitions, audio, and original-stage regressions.

```sh
node --test last-light-campaign.test.js last-light.test.js game.test.js
```

Campaign regression plays all six stages at zero, two, and five upgrade ranks across 30 deterministic seeds each (540 runs), requiring at least 24 wins per 30 for the chosen damage-oriented policy. These are simulation checks, not measured player win rates or final difficulty tuning.

WebGL is required for combat. Desktop and mobile layouts are supported; landscape provides more space for the battlefield. This is a browser game, not an iOS App Store package.
