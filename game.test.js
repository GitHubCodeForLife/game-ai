import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, TOWER_TYPES, PADS, getUpgradeCost, getSellValue, getWaveInfo } from './game.js';

function runUntil(game, predicate, maxSteps = 6000) {
  for (let i = 0; i < maxSteps && !predicate(); i++) game.update(0.1);
  assert.ok(predicate(), 'Simulation reached expected condition');
}

test('starting defenses, purchase validation, and reset preserve the public state object', () => {
  const game = createGame();
  const state = game.state;
  assert.equal(state.coins, 350);
  assert.deepEqual(state.towers.map(tower => [tower.type, tower.padId]), [['sentry', 1], ['sentry', 6], ['frost', 9]]);
  assert.equal(game.placeTower('cannon', 1).ok, false);
  assert.equal(game.placeTower('invalid', 0).ok, false);
  assert.equal(game.placeTower('sentry', -1).ok, false);
  assert.equal(game.placeTower('cannon', 0).ok, true);
  assert.equal(state.coins, 190);
  assert.equal(game.placeTower('cannon', 2).ok, true);
  assert.equal(game.placeTower('sentry', 3).ok, false);
  assert.equal(state.coins, 30);
  game.startWave();
  game.update(0.1);
  game.setPaused(true);
  game.setSpeed(2);
  game.reset();
  assert.equal(game.state, state);
  assert.equal(state.coins, 350);
  assert.equal(state.towers.length, 3);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.status, 'ready');
  assert.equal(state.wave, 0);
  assert.equal(state.paused, false);
  assert.equal(state.speed, 1);
});

test('upgrade costs, three-level limit, and sell refunds account only for actual spending', () => {
  const game = createGame();
  const freeTower = game.state.towers[0];
  assert.equal(getSellValue(freeTower), 0);
  assert.equal(getUpgradeCost(freeTower), 75);
  assert.equal(game.upgradeTower(freeTower.id).ok, true);
  assert.equal(freeTower.level, 2);
  assert.equal(freeTower.spent, 75);
  assert.equal(game.upgradeTower(freeTower.id).ok, true);
  assert.equal(freeTower.level, 3);
  assert.equal(getUpgradeCost(freeTower), null);
  assert.equal(game.upgradeTower(freeTower.id).ok, false);
  assert.equal(game.state.coins, 160);
  const value = getSellValue(freeTower);
  assert.equal(value, 133);
  assert.equal(game.sellTower(freeTower.id).value, value);
  assert.equal(game.state.coins, 293);
  assert.equal(game.sellTower(freeTower.id).ok, false);
  assert.equal(game.placeTower('sentry', 1).ok, true);
});

test('pause freezes simulation, double speed advances twice as far, long frames are capped', () => {
  const normal = createGame();
  const fast = createGame();
  normal.startWave();
  fast.startWave();
  fast.setSpeed(2);
  normal.update(0.1);
  fast.update(0.1);
  assert.ok(Math.abs(fast.state.enemies[0].progress - normal.state.enemies[0].progress * 2) < 1e-8);
  normal.setPaused(true);
  const before = JSON.stringify(normal.state);
  normal.update(10);
  assert.equal(JSON.stringify(normal.state), before);
  normal.setPaused(false);
  const progress = normal.state.enemies[0].progress;
  normal.update(100);
  assert.ok(normal.state.enemies[0].progress - progress <= 1.5 * 0.25 + 1e-8);
  assert.equal(normal.setSpeed(3).ok, false);
  const after = JSON.stringify(normal.state);
  normal.update(NaN);
  normal.update(-1);
  assert.equal(JSON.stringify(normal.state), after);
});

test('a wave pays each kill and completion once and cannot be started twice', () => {
  const events = [];
  const game = createGame({ onEvent: event => events.push(event) });
  game.placeTower('sentry', 0);
  game.placeTower('cannon', 3);
  const coinsAtStart = game.state.coins;
  assert.equal(game.startWave().ok, true);
  assert.equal(game.startWave().ok, false);
  runUntil(game, () => game.state.status !== 'playing');
  assert.equal(game.state.status, 'ready');
  assert.equal(game.state.lives, 20);
  const kills = events.filter(event => event.type === 'kill');
  assert.equal(kills.length, getWaveInfo(1).count);
  assert.equal(new Set(kills.map(event => event.enemyId)).size, kills.length);
  assert.equal(game.state.kills, kills.length);
  assert.equal(game.state.coins, coinsAtStart + kills.reduce((sum, event) => sum + event.reward, 0) + 42);
  assert.equal(events.filter(event => event.type === 'waveComplete').length, 1);
  assert.ok(events.some(event => event.type === 'shoot' && event.from && event.to));
  const coins = game.state.coins;
  game.update(100);
  assert.equal(game.state.coins, coins);
});

test('frost slows its target and cannon damages a nearby group', () => {
  const game = createGame();
  game.state.towers = [];
  const frost = game.placeTower('frost', 0).tower;
  game.startWave();
  game.update(0.05);
  const target = game.state.enemies[0];
  assert.ok(target.slowUntil > 0);
  const progress = target.progress;
  game.update(0.1);
  assert.ok(Math.abs(target.progress - progress - target.speed * 0.5 * 0.1) < 1e-8);
  game.sellTower(frost.id);
  const cannon = game.placeTower('cannon', 0).tower;
  const nearby = { ...target, id: 'nearby', hp: 100, maxHp: 100, progress: target.progress + 0.2 };
  target.hp = 100;
  game.state.enemies.push(nearby);
  game.update(0.05);
  assert.equal(target.hp, 100 - cannon.damage);
  assert.equal(nearby.hp, 100 - cannon.damage);
});

test('leaks remove lives without rewards and loss is terminal', () => {
  const events = [];
  const game = createGame({ onEvent: event => events.push(event) });
  for (const tower of [...game.state.towers]) game.sellTower(tower.id);
  game.state.lives = 1;
  game.startWave();
  runUntil(game, () => game.state.status === 'lost');
  assert.equal(game.state.lives, 0);
  assert.equal(game.state.kills, 0);
  assert.equal(game.state.coins, 350);
  assert.equal(events.filter(event => event.type === 'lost').length, 1);
  assert.equal(game.startWave().ok, false);
  assert.equal(game.placeTower('sentry', 0).ok, false);
  const finalState = JSON.stringify(game.state);
  game.update(1);
  assert.equal(JSON.stringify(game.state), finalState);
});

test('a funded defense wins all twelve waves exactly once', () => {
  const events = [];
  const game = createGame({ onEvent: event => events.push(event) });
  game.state.coins = 100000;
  for (const pad of PADS) {
    if (!game.state.towers.some(tower => tower.padId === pad.id)) game.placeTower(pad.id % 3 === 0 ? 'cannon' : 'sentry', pad.id);
  }
  for (const tower of game.state.towers) {
    game.upgradeTower(tower.id);
    game.upgradeTower(tower.id);
  }
  for (let wave = 1; wave <= 12; wave++) {
    assert.equal(game.startWave().ok, true);
    runUntil(game, () => game.state.status !== 'playing');
    assert.equal(game.state.wave, wave);
    assert.notEqual(game.state.status, 'lost');
  }
  assert.equal(game.state.status, 'won');
  assert.equal(events.filter(event => event.type === 'won').length, 1);
  assert.equal(events.filter(event => event.type === 'waveComplete').length, 12);
  assert.equal(game.startWave().ok, false);
  assert.equal(game.state.lives, 20);
  assert.equal(Object.keys(TOWER_TYPES).length, 3);
});

test('the full campaign is winnable using only starting coins and earned rewards', () => {
  const game = createGame();
  const buildPlan = [['sentry', 0], ['cannon', 3], ['sentry', 5], ['cannon', 8], ['sentry', 10], ['sentry', 4], ['sentry', 7], ['sentry', 12]];
  for (let wave = 1; wave <= 12; wave++) {
    const upgradeCandidates = game.state.towers.filter(tower => tower.type !== 'frost' && tower.level < 3).sort((a, b) => a.level - b.level);
    for (const tower of upgradeCandidates) {
      if (game.state.coins >= getUpgradeCost(tower)) game.upgradeTower(tower.id);
    }
    while (buildPlan.length && game.placeTower(...buildPlan[0]).ok) buildPlan.shift();
    assert.equal(game.startWave().ok, true);
    runUntil(game, () => game.state.status !== 'playing');
    assert.notEqual(game.state.status, 'lost');
    assert.ok(game.state.coins >= 0);
  }
  assert.equal(game.state.status, 'won');
  assert.equal(game.state.lives, 20);
});
