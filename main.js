import { createGame, TOWER_TYPES, PADS, getUpgradeCost, getSellValue, getWaveInfo } from './game.js';

const $ = id => document.getElementById(id);
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const art = {
  sentry: `<svg viewBox="0 0 96 96" aria-hidden="true"><ellipse cx="49" cy="80" rx="30" ry="9" fill="#c9d3b3"/><path d="m17 65 29-15 32 16-29 17Z" fill="#697d5d"/><path d="m17 65 32 15 29-14v8L49 89 17 73Z" fill="#4b6349"/><path d="m31 46 17-8 17 8v23l-17 9-17-9Z" fill="#9dab82"/><path d="m48 54 17-8v23l-17 9Z" fill="#7b8f66"/><path d="m26 37 22-11 23 12-23 12Z" fill="#bad18c"/><path d="m26 37 22 11 23-10v13L48 62 26 50Z" fill="#91a967"/><path d="m48 48 23-10v13L48 62Z" fill="#718c53"/><path d="m48 36 30-14 10 7-31 15Z" fill="#d2e99f"/><path d="m57 44 31-15v9L57 53Z" fill="#7f9d58"/><path d="m48 36 9 8v9l-9-7Z" fill="#a7c372"/><path d="m81 26 7 3v9l-7-4Z" fill="#3d5738"/><path d="m36 40 9-4 10 5-9 4Z" fill="#c9de98"/></svg>`,
  cannon: `<svg viewBox="0 0 96 96" aria-hidden="true"><ellipse cx="49" cy="80" rx="31" ry="9" fill="#d7ceb7"/><path d="m15 64 31-16 34 16-31 18Z" fill="#8a856b"/><path d="m15 64 34 16 31-16v10L49 91 15 74Z" fill="#686b56"/><path d="m31 52 18-9 18 9v16L49 79l-18-11Z" fill="#a49a76"/><path d="m49 61 18-9v16L49 79Z" fill="#7c7e60"/><ellipse cx="47" cy="49" rx="21" ry="14" fill="#8b805b"/><path d="m30 42 12-24 24 5-7 30Z" fill="#8a9472"/><path d="m42 18 18-7 23 14-17 12Z" fill="#e2b775"/><path d="m66 37 17-12-10 30-14 8Z" fill="#a68b58"/><path d="m42 18 24 19-7 26-25-20Z" fill="#c5a266"/><path d="m48 19 12-4 16 10-11 7Z" fill="#4a5141"/><path d="m42 34 21 16-3 8-22-16Z" fill="#e7bf7b"/><circle cx="33" cy="58" r="7" fill="#6e765b"/><circle cx="33" cy="58" r="3" fill="#b9a275"/></svg>`,
  frost: `<svg viewBox="0 0 96 96" aria-hidden="true"><ellipse cx="49" cy="80" rx="29" ry="8" fill="#c5d6ca"/><path d="m18 65 30-14 30 15-30 17Z" fill="#729b8c"/><path d="m18 65 30 16 30-15v8L48 91 18 74Z" fill="#526e65"/><path d="m31 51 17-9 18 9v18l-18 9-17-9Z" fill="#a3bcad"/><path d="m48 60 18-9v18l-18 9Z" fill="#7c9d8b"/><path d="m27 48 21-10 23 11-23 12Z" fill="#c1d9c8"/><path d="m48 11 15 21-15 33-15-33Z" fill="#a1dfde"/><path d="m48 11 15 21-15 8Z" fill="#e1ffff"/><path d="m48 40 15-8-15 33Z" fill="#61b7c0"/><path d="m48 11-15 21 15 8Z" fill="#b5edeb"/><path d="m48 40-15-8 15 33Z" fill="#83d3d6"/><path d="m27 29 9 12-2 20-12-17Z" fill="#91cfca"/><path d="m69 34 8 13-15 16 1-20Z" fill="#b5e4da"/><path d="m27 29 9 12-14 3Z" fill="#d3f7e9"/><path d="m69 34 8 13-14-4Z" fill="#d4f5ed"/></svg>`,
};
const roles = { sentry: 'Quick & dependable', cannon: 'A heavy hitter', frost: 'Cool under pressure' };
const summaries = { sentry: 'Single-target damage', cannon: 'Area splash damage', frost: 'Slows enemies by 50%' };
let world;
let rendererReady = false;
let buildType = 'sentry';
let soundEnabled = false;
let soundContext;
let lastShotSound = 0;
let toastTimer;
let detailsKey = '';
let dirty = true;
let modalPause = false;
const game = createGame({ onEvent: handleEvent });

$('tower-list').innerHTML = Object.entries(TOWER_TYPES).map(([type, tower], index) => `<button class="tower-card${type === buildType ? ' selected' : ''}" data-type="${type}" aria-pressed="${type === buildType}" aria-label="Build ${tower.name}, ${tower.cost} gold"><span class="tower-art">${art[type]}</span><span class="tower-info"><span class="tower-name-row"><span class="tower-name">${tower.name}</span><span class="tower-shortcut">${index + 1}</span></span><span class="tower-role">${roles[type]}</span><span class="tower-cost">${icon('coin')}${tower.cost}</span></span><span class="tower-description"><span>${summaries[type]}</span><span>${tower.range.toFixed(1)} RANGE</span></span></button>`).join('');
$('wave-track').innerHTML = Array.from({ length: 12 }, (_, i) => `<div class="wave-step${(i + 1) % 4 === 0 ? ' boss' : ''}" title="Wave ${i + 1}${(i + 1) % 4 === 0 ? ' · Boss' : ''}"></div>`).join('');
$('site-list').innerHTML = PADS.map(pad => `<button class="site-btn" data-pad="${pad.id}">Site ${pad.id + 1}</button>`).join('');

function notify(message, error = false) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').className = `toast visible${error ? ' error' : ''}`;
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}

function sound(kind) {
  if (!soundEnabled || !soundContext) return;
  const now = soundContext.currentTime;
  if (kind === 'shoot' && now - lastShotSound < .09) return;
  if (kind === 'shoot') lastShotSound = now;
  const oscillator = soundContext.createOscillator();
  const gain = soundContext.createGain();
  const values = { shoot: [320, 130, .045, .025], build: [330, 660, .13, .06], wave: [220, 440, .3, .06], complete: [520, 880, .4, .06], leak: [160, 70, .25, .07] }[kind] || [400, 700, .1, .04];
  oscillator.type = kind === 'shoot' ? 'triangle' : 'sine';
  oscillator.frequency.setValueAtTime(values[0], now);
  oscillator.frequency.exponentialRampToValueAtTime(values[1], now + values[2]);
  gain.gain.setValueAtTime(values[3], now);
  gain.gain.exponentialRampToValueAtTime(.001, now + values[2]);
  oscillator.connect(gain); gain.connect(soundContext.destination);
  oscillator.start(now); oscillator.stop(now + values[2]);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

function handleEvent(event) {
  world?.handleEvent(event);
  dirty = true;
  if (event.type === 'shoot') sound('shoot');
  if (event.type === 'waveStart') sound('wave');
  if (event.type === 'leak') { sound('leak'); notify(`An enemy reached the crystal. −${event.damage} health`, true); }
  if (event.type === 'waveComplete') { sound('complete'); notify(`Wave ${event.wave} cleared. +${event.bonus} bonus gold!`); }
  if (event.type === 'won' || event.type === 'lost') showEnding(event.type === 'won');
}

function chooseType(type) {
  buildType = type;
  game.selectTower(null);
  world?.setSelectedTower(null);
  world?.setBuildType(type);
  dirty = true;
  if (type) $('map-hint').textContent = `${TOWER_TYPES[type].name} selected. Click a marked site to build.`;
}

function selectTower(id) {
  const result = game.selectTower(id);
  buildType = null;
  world?.setBuildType(null);
  world?.setSelectedTower(result.tower);
  dirty = true;
}

function buildAt(id) {
  const occupied = game.state.towers.find(tower => tower.padId === Number(id));
  if (occupied) { selectTower(occupied.id); return; }
  if (!buildType) { notify('Choose a tower from your arsenal first.'); return; }
  const result = game.placeTower(buildType, id);
  notify(result.message, !result.ok);
  if (result.ok) { world?.setSelectedTower(result.tower); sound('build'); }
  dirty = true;
}

function renderUI() {
  const state = game.state;
  const nextWave = state.status === 'ready' ? Math.min(state.wave + 1, state.maxWaves) : state.wave;
  const info = getWaveInfo(nextWave);
  const terminal = state.status === 'won' || state.status === 'lost';
  $('coins').textContent = state.coins;
  $('lives').textContent = state.lives;
  $('wave').textContent = String(nextWave).padStart(2, '0');
  $('kills').textContent = state.kills;
  $('wave-eyebrow').textContent = `${state.status === 'playing' ? 'INCOMING' : terminal ? 'MISSION COMPLETE' : 'UP NEXT'} · WAVE ${String(nextWave).padStart(2, '0')}`;
  $('wave-name').textContent = info.name === 'First contact' ? 'The first footsteps' : info.name;
  $('enemy-count').textContent = state.status === 'playing' ? `${state.enemies.length + state.spawnRemaining} remaining` : `${info.count} enemies`;
  $('wave-type').textContent = nextWave % 4 === 0 ? 'Boss wave' : nextWave >= 5 ? 'Mixed horde' : nextWave >= 2 ? 'Scouts + runners' : 'Scouts';
  $('phase-label').textContent = state.paused ? 'PAUSED' : state.status === 'playing' ? 'WAVE IN PROGRESS' : state.status === 'won' ? 'VALLEY SECURED' : state.status === 'lost' ? 'CRYSTAL FALLEN' : 'BUILD PHASE';
  $('pause-overlay').hidden = !state.paused || terminal || !!document.querySelector('dialog[open]');
  $('pause-btn').innerHTML = icon(state.paused ? 'play' : 'pause');
  $('pause-btn').setAttribute('aria-label', state.paused ? 'Resume game' : 'Pause game');
  $('pause-btn').disabled = terminal;
  $('speed-btn').innerHTML = `${state.speed}×<span>SPEED</span>`;
  $('speed-btn').setAttribute('aria-label', `Set speed to ${state.speed === 1 ? 2 : 1} times`);
  $('start-wave').disabled = !rendererReady || state.status === 'playing' || terminal;
  $('start-wave').innerHTML = `<span>${state.status === 'playing' ? 'Defending…' : terminal ? (state.status === 'won' ? 'Victory!' : 'Game over') : 'Start wave'}</span>${icon(state.status === 'playing' ? 'shield' : 'arrow')}`;
  document.querySelectorAll('.wave-step').forEach((step, i) => {
    step.classList.toggle('complete', i < state.wave && (state.status !== 'playing' || i < state.wave - 1));
    step.classList.toggle('active', i === nextWave - 1 && !terminal);
  });
  document.querySelectorAll('.tower-card').forEach(button => {
    button.classList.toggle('selected', button.dataset.type === buildType);
    button.setAttribute('aria-pressed', String(button.dataset.type === buildType));
  });
  document.querySelectorAll('.site-btn').forEach(button => {
    const tower = state.towers.find(t => t.padId === Number(button.dataset.pad));
    button.classList.toggle('occupied', !!tower);
    button.setAttribute('aria-label', tower ? `Select ${TOWER_TYPES[tower.type].name} at site ${Number(button.dataset.pad) + 1}` : `Build ${buildType ? TOWER_TYPES[buildType].name : 'tower'} at site ${Number(button.dataset.pad) + 1}`);
  });
  const tower = state.towers.find(t => t.id === state.selectedTowerId);
  const key = tower ? `${tower.id}-${tower.level}-${tower.spent}` : '';
  if (key !== detailsKey) {
    detailsKey = key;
    $('tower-details').innerHTML = tower ? `<div class="detail-heading"><strong>${TOWER_TYPES[tower.type].name} · Site ${tower.padId + 1}</strong><span>LEVEL ${tower.level} / 3</span></div><div class="detail-stats"><span><strong>${tower.damage}</strong>DAMAGE</span><span><strong>${tower.range.toFixed(1)}</strong>RANGE</span><span><strong>${(1 / tower.interval).toFixed(1)}/s</strong>FIRE RATE</span></div><div class="detail-actions"><button id="upgrade-btn" class="primary-btn">${tower.level === 3 ? 'Fully upgraded' : `Upgrade · ${getUpgradeCost(tower)} ${icon('coin')}`}</button><button id="sell-btn" class="secondary-btn">Sell · ${getSellValue(tower)}</button></div>` : '';
    $('upgrade-btn')?.addEventListener('click', () => {
      const result = game.upgradeTower(tower.id);
      notify(result.message, !result.ok);
      if (result.ok) { world?.setSelectedTower(result.tower); sound('build'); }
    });
    $('sell-btn')?.addEventListener('click', () => {
      const result = game.sellTower(tower.id);
      notify(result.message, !result.ok);
      world?.setSelectedTower(null);
    });
  }
  if (tower) {
    const cost = getUpgradeCost(tower);
    $('upgrade-btn').disabled = cost === null || state.coins < cost || terminal;
    $('sell-btn').disabled = terminal;
    $('upgrade-btn').title = cost !== null && state.coins < cost ? `${cost - state.coins} more gold needed` : '';
  }
  $('field-note').hidden = !!tower;
  if (tower) $('map-hint').textContent = `${TOWER_TYPES[tower.type].name} · Level ${tower.level} · Ready for orders.`;
  else if (buildType) $('map-hint').textContent = `${TOWER_TYPES[buildType].name} selected. Click a marked site to build.`;
  else $('map-hint').textContent = 'Choose a tower. Make yourself at home.';
  dirty = false;
}

function showEnding(won) {
  $('end-eyebrow').textContent = won ? 'VALLEY SECURED' : 'THE CRYSTAL HAS FALLEN';
  $('end-title').textContent = won ? 'The forest stands.' : 'Every stand is a lesson.';
  $('end-message').textContent = won ? 'Twelve waves. One resilient little outpost. The valley can breathe easy again.' : 'The horde broke through. Try upgrading early and pairing Frost towers with Cannons at the bends.';
  $('end-waves').textContent = won ? 12 : Math.max(0, game.state.wave - 1);
  $('end-kills').textContent = game.state.kills;
  $('end-health').textContent = game.state.lives;
  if (!$('end-dialog').open) $('end-dialog').showModal();
}

function resetGame() {
  modalPause = false;
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  game.reset();
  document.querySelector('.accessible-build').open = false;
  detailsKey = 'reset';
  chooseType('sentry');
  world?.resetView();
  notify('A fresh start. Your three starting towers are on watch.');
  dirty = true;
}

function openDialog(id) {
  modalPause = game.state.paused;
  game.setPaused(true);
  $(id).showModal();
  dirty = true;
}

document.querySelectorAll('.tower-card').forEach(button => button.addEventListener('click', () => chooseType(button.dataset.type)));
document.querySelectorAll('.site-btn').forEach(button => button.addEventListener('click', () => buildAt(Number(button.dataset.pad))));
$('start-wave').addEventListener('click', () => { const result = game.startWave(); if (!result.ok) notify(result.message, true); });
$('pause-btn').addEventListener('click', () => game.setPaused(!game.state.paused));
$('resume-btn').addEventListener('click', () => game.setPaused(false));
$('speed-btn').addEventListener('click', () => game.setSpeed(game.state.speed === 1 ? 2 : 1));
$('grid-btn').addEventListener('click', () => {
  const visible = $('grid-btn').getAttribute('aria-pressed') !== 'true';
  $('grid-btn').setAttribute('aria-pressed', visible);
  world?.setGrid(visible);
});
$('view-btn').addEventListener('click', () => world?.resetView());
$('zoom-in').addEventListener('click', () => world?.zoom(.12));
$('zoom-out').addEventListener('click', () => world?.zoom(-.12));
$('fullscreen-btn').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('battlefield').requestFullscreen) await $('battlefield').requestFullscreen();
    else notify('Fullscreen is not supported by this browser.');
  } catch { notify('Fullscreen is not available in this preview.'); }
});
$('sound-btn').addEventListener('click', async () => {
  try {
    if (!soundContext) soundContext = new (window.AudioContext || window.webkitAudioContext)();
    await soundContext.resume();
    soundEnabled = !soundEnabled;
    $('sound-btn').innerHTML = icon(soundEnabled ? 'volume' : 'muted');
    $('sound-btn').setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound');
    $('sound-btn').title = soundEnabled ? 'Mute sound' : 'Enable sound';
    if (soundEnabled) sound('build');
  } catch { notify('Sound is not available in this browser.'); }
});
$('help-btn').addEventListener('click', () => openDialog('help-dialog'));
document.querySelector('.dialog-close').addEventListener('click', () => $('help-dialog').close());
document.querySelector('.dialog-done').addEventListener('click', () => $('help-dialog').close());
$('restart-btn').addEventListener('click', () => openDialog('restart-dialog'));
$('cancel-restart').addEventListener('click', () => $('restart-dialog').close());
$('confirm-restart').addEventListener('click', resetGame);
$('play-again').addEventListener('click', resetGame);
for (const id of ['help-dialog', 'restart-dialog']) $(id).addEventListener('close', () => { game.setPaused(modalPause); dirty = true; });
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.code === 'Space' && !event.repeat && !event.target.closest('button,summary,a')) { event.preventDefault(); game.setPaused(!game.state.paused); }
  if (['1', '2', '3'].includes(event.key)) chooseType(['sentry', 'cannon', 'frost'][Number(event.key) - 1]);
  if (event.key === 'Escape') chooseType(null);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state.status === 'playing') game.setPaused(true); });

async function init() {
  try {
    const { createWorld } = await import('./world.js');
    world = createWorld($('world'), { onPadClick: buildAt, onTowerClick: selectTower });
    rendererReady = true;
    world.setBuildType(buildType);
    $('loading').remove();
    let last = performance.now();
    let uiTimer = 0;
    function frame(now) {
      const dt = Math.min((now - last) / 1000, .05);
      last = now;
      game.update(dt);
      world.update(game.state, game.state.paused ? 0 : dt);
      uiTimer += dt;
      if (dirty || uiTimer > .2) { renderUI(); uiTimer = 0; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (error) {
    console.error('Bastion could not start:', error);
    $('loading').innerHTML = '<p>The battlefield couldn’t load.<span>Use a browser with WebGL enabled, then reload this page.</span></p>';
    $('start-wave').disabled = true;
  }
  renderUI();
}
init();
