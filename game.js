/** Deterministic tower-defense simulation. Coordinates are shared with the 3D board. */
export const TOWER_TYPES = Object.freeze({
  sentry: Object.freeze({ name: 'Sentry', cost: 100, damage: 20, range: 3.25, interval: 0.68, description: 'Fast, precise fire. Your reliable first line of defense.', color: '#d2ed7b' }),
  cannon: Object.freeze({ name: 'Cannon', cost: 160, damage: 48, range: 3.6, interval: 1.55, description: 'Heavy shells deal splash damage to clustered enemies.', color: '#f3ba72' }),
  frost: Object.freeze({ name: 'Frost', cost: 130, damage: 10, range: 3.2, interval: 0.95, description: 'Chills enemies to half speed for 2.2 seconds.', color: '#9bdbe8' }),
});

export const PATH = Object.freeze([
  { x: -9, z: -3 }, { x: -4, z: -3 }, { x: -4, z: 3 },
  { x: 3, z: 3 }, { x: 3, z: -1 }, { x: 9, z: -1 },
].map(Object.freeze));

export const PADS = Object.freeze([
  [-7, -1.3], [-5.7, 0.3], [-6, 4], [-2, 0], [-2, 4.8], [0, 1.2], [1, 4.8],
  [1, -1.2], [4.8, 1.2], [5, -2.8], [7, 1], [0, -4.3], [-3, -5.2], [6, -4.8],
].map(([x, z], id) => Object.freeze({ id, x, z })));

const SEGMENTS = PATH.slice(1).map((end, index) => ({
  start: PATH[index], end, length: Math.hypot(end.x - PATH[index].x, end.z - PATH[index].z),
}));
const PATH_LENGTH = SEGMENTS.reduce((sum, segment) => sum + segment.length, 0);
const ENEMY_TYPES = {
  scout: { hp: 52, speed: 1.5, reward: 10, leak: 1 },
  runner: { hp: 36, speed: 2.5, reward: 11, leak: 1 },
  tank: { hp: 155, speed: 0.96, reward: 20, leak: 2 },
  boss: { hp: 510, speed: 0.78, reward: 70, leak: 4 },
};

export function getUpgradeCost(tower) {
  if (!tower || tower.level >= 3 || !TOWER_TYPES[tower.type]) return null;
  return Math.round(TOWER_TYPES[tower.type].cost * (tower.level === 1 ? 0.75 : 1.15));
}

export function getSellValue(tower) {
  return tower ? Math.floor(tower.spent * 0.7) : 0;
}

export function getWaveInfo(wave) {
  const number = Math.max(1, Math.min(12, Number.isFinite(wave) ? Math.floor(wave) : 1));
  const boss = number % 4 === 0;
  return {
    count: 6 + number * 2 + (boss ? 1 : 0),
    name: number === 12 ? 'The final stand' : boss ? 'Heavy company' : number >= 5 ? 'Under pressure' : number >= 2 ? 'Picking up speed' : 'First contact',
    description: boss ? 'An armored boss leads the charge. Upgrade your firepower.' : number >= 5 ? 'A mix of scouts, runners, and armored tanks.' : number >= 2 ? 'Fast runners join the scouts. Frost towers slow them down.' : 'A scouting party approaches. Get your defenses ready.',
  };
}

export function createGame({ onEvent = () => {} } = {}) {
  const state = {};
  let towerSequence = 0;
  let enemySequence = 0;
  let elapsed = 0;
  let spawnTimer = 0;
  let waveQueue = [];

  const emit = (type, details = {}) => onEvent({ type, ...details });
  const change = (reason, details = {}) => emit('change', { reason, ...details });
  const fail = message => ({ ok: false, message });
  const terminal = () => state.status === 'won' || state.status === 'lost';
  const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

  function makeTower(type, pad, spent = TOWER_TYPES[type].cost) {
    const definition = TOWER_TYPES[type];
    return {
      id: `tower-${++towerSequence}`, type, padId: pad.id, x: pad.x, z: pad.z,
      level: 1, damage: definition.damage, range: definition.range,
      interval: definition.interval, cooldown: 0, spent, kills: 0,
    };
  }

  function reset(notify = true) {
    towerSequence = 0;
    enemySequence = 0;
    elapsed = 0;
    spawnTimer = 0;
    waveQueue = [];
    Object.assign(state, {
      coins: 350, lives: 20, wave: 0, maxWaves: 12, kills: 0, status: 'ready',
      paused: false, speed: 1, towers: [], enemies: [], spawnRemaining: 0,
      time: 0,
      selectedTowerId: null,
    });
    state.towers.push(makeTower('sentry', PADS[1], 0), makeTower('sentry', PADS[6], 0), makeTower('frost', PADS[9], 0));
    if (notify) change('reset');
    return { ok: true, message: 'A fresh start. Build your defenses.' };
  }

  function placeTower(type, padId) {
    if (terminal()) return fail('Start a new game to build again.');
    if (!Object.hasOwn(TOWER_TYPES, type)) return fail('Choose a tower first.');
    const pad = PADS.find(item => item.id === Number(padId));
    if (!pad) return fail('Choose a build pad.');
    if (state.towers.some(tower => tower.padId === pad.id)) return fail('There is already a tower on this pad.');
    const cost = TOWER_TYPES[type].cost;
    if (state.coins < cost) return fail(`You need ${cost - state.coins} more coins.`);
    const tower = makeTower(type, pad);
    state.coins -= cost;
    state.towers.push(tower);
    state.selectedTowerId = tower.id;
    change('build', { towerId: tower.id });
    return { ok: true, message: `${TOWER_TYPES[type].name} deployed.`, tower };
  }

  function selectTower(id) {
    const tower = state.towers.find(item => item.id === id);
    state.selectedTowerId = tower?.id ?? null;
    change('select', { towerId: state.selectedTowerId });
    return { ok: true, tower: tower ?? null };
  }

  function upgradeTower(id) {
    if (terminal()) return fail('Start a new game to upgrade again.');
    const tower = state.towers.find(item => item.id === id);
    if (!tower) return fail('Select a tower to upgrade.');
    const cost = getUpgradeCost(tower);
    if (cost === null) return fail('This tower is fully upgraded.');
    if (state.coins < cost) return fail(`You need ${cost - state.coins} more coins.`);
    state.coins -= cost;
    tower.spent += cost;
    tower.level += 1;
    tower.damage = Math.round(TOWER_TYPES[tower.type].damage * 1.65 ** (tower.level - 1));
    tower.range += 0.35;
    tower.interval *= 0.9;
    change('upgrade', { towerId: id });
    return { ok: true, message: `${TOWER_TYPES[tower.type].name} upgraded to level ${tower.level}.`, tower };
  }

  function sellTower(id) {
    if (terminal()) return fail('Start a new game to change your defenses.');
    const index = state.towers.findIndex(item => item.id === id);
    if (index === -1) return fail('Select a tower to sell.');
    const value = getSellValue(state.towers[index]);
    state.towers.splice(index, 1);
    state.coins += value;
    if (state.selectedTowerId === id) state.selectedTowerId = null;
    change('sell', { towerId: id, value });
    return { ok: true, message: `Tower sold for ${value} coins.`, value };
  }

  function startWave() {
    if (terminal()) return fail('Start a new game to play again.');
    if (state.status !== 'ready') return fail('Finish the current wave first.');
    state.wave += 1;
    state.status = 'playing';
    state.paused = false;
    const info = getWaveInfo(state.wave);
    waveQueue = Array.from({ length: info.count }, (_, index) => {
      if (state.wave % 4 === 0 && index === Math.floor(info.count / 2)) return 'boss';
      if (state.wave >= 5 && index % 4 === 3) return 'tank';
      if (state.wave >= 2 && index % 3 === 1) return 'runner';
      return 'scout';
    });
    state.spawnRemaining = waveQueue.length;
    spawnTimer = 0;
    emit('waveStart', { wave: state.wave, ...info });
    change('waveStart');
    return { ok: true, message: `Wave ${state.wave}: ${info.name}.` };
  }

  function spawnEnemy(type) {
    const definition = ENEMY_TYPES[type];
    const maxHp = Math.round(definition.hp * (1 + (state.wave - 1) * 0.23));
    const enemy = {
      id: `enemy-${++enemySequence}`, type, x: PATH[0].x, z: PATH[0].z,
      hp: maxHp, maxHp, progress: 0, speed: definition.speed * (1 + (state.wave - 1) * 0.015),
      slowUntil: 0, reward: definition.reward, leakDamage: definition.leak,
    };
    state.enemies.push(enemy);
    emit('spawn', { enemyId: enemy.id, enemyType: type });
  }

  function setPosition(enemy) {
    let distance = enemy.progress;
    for (const segment of SEGMENTS) {
      if (distance <= segment.length) {
        const amount = distance / segment.length;
        enemy.x = segment.start.x + (segment.end.x - segment.start.x) * amount;
        enemy.z = segment.start.z + (segment.end.z - segment.start.z) * amount;
        return;
      }
      distance -= segment.length;
    }
    Object.assign(enemy, PATH[PATH.length - 1]);
  }

  function damageEnemy(enemy, damage, tower) {
    if (enemy.hp <= 0) return;
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (enemy.hp === 0) {
      state.kills += 1;
      tower.kills += 1;
      state.coins += enemy.reward;
      emit('kill', { enemyId: enemy.id, towerId: tower.id, x: enemy.x, z: enemy.z, reward: enemy.reward });
      change('kill');
    }
  }

  function step(dt) {
    elapsed += dt;
    state.time = elapsed;
    spawnTimer -= dt;
    if (waveQueue.length && spawnTimer <= 0) {
      spawnEnemy(waveQueue.shift());
      state.spawnRemaining = waveQueue.length;
      spawnTimer += Math.max(0.45, 1.02 - state.wave * 0.035);
    }

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.progress += enemy.speed * (enemy.slowUntil > elapsed ? 0.5 : 1) * dt;
      setPosition(enemy);
      if (enemy.progress >= PATH_LENGTH) {
        enemy.hp = 0;
        state.lives = Math.max(0, state.lives - enemy.leakDamage);
        emit('leak', { enemyId: enemy.id, damage: enemy.leakDamage, lives: state.lives });
        change('leak');
        if (state.lives === 0) {
          state.status = 'lost';
          state.paused = false;
          emit('lost', { wave: state.wave, kills: state.kills });
          change('lost');
          return;
        }
      }
    }

    for (const tower of state.towers) {
      tower.cooldown = Math.max(0, tower.cooldown - dt);
      if (tower.cooldown > 0) continue;
      let target = null;
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && distanceSquared(tower, enemy) <= tower.range ** 2 && (!target || enemy.progress > target.progress)) target = enemy;
      }
      if (!target) continue;
      tower.cooldown = tower.interval;
      emit('shoot', { towerId: tower.id, enemyId: target.id, towerType: tower.type, from: { x: tower.x, z: tower.z }, to: { x: target.x, z: target.z } });
      if (tower.type === 'cannon') {
        for (const enemy of state.enemies) {
          if (enemy.hp > 0 && distanceSquared(target, enemy) <= 1.5 ** 2) damageEnemy(enemy, tower.damage, tower);
        }
      } else {
        if (tower.type === 'frost') target.slowUntil = elapsed + 2.2;
        damageEnemy(target, tower.damage, tower);
      }
    }
    state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
    if (state.spawnRemaining === 0 && state.enemies.length === 0) {
      const bonus = 35 + state.wave * 7;
      state.coins += bonus;
      state.status = state.wave === state.maxWaves ? 'won' : 'ready';
      emit('waveComplete', { wave: state.wave, bonus });
      if (state.status === 'won') emit('won', { wave: state.wave, kills: state.kills });
      change(state.status === 'won' ? 'won' : 'waveComplete');
    }
  }

  function update(dt) {
    if (state.paused || state.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    let remaining = Math.min(dt, 0.25) * state.speed;
    while (remaining > 0.000001 && state.status === 'playing') {
      const timestep = Math.min(remaining, 0.05);
      step(timestep);
      remaining -= timestep;
    }
  }

  function setPaused(paused) {
    if (terminal()) return fail('The game has ended.');
    state.paused = Boolean(paused);
    change('pause');
    return { ok: true, message: state.paused ? 'Game paused.' : 'Game resumed.' };
  }

  function setSpeed(speed) {
    if (speed !== 1 && speed !== 2) return fail('Speed must be 1 or 2.');
    state.speed = speed;
    change('speed');
    return { ok: true, message: `Game speed set to ${speed}×.` };
  }

  // Subscribers usually capture the returned game; do not notify before it exists.
  reset(false);
  return { state, placeTower, selectTower, upgradeTower, sellTower, startWave, setPaused, setSpeed, reset, update };
}
