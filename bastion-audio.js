// Original local score and tower effects. Audio is created only after a player gesture.
export const AUDIO_SAVE_KEY = 'bastion.audio.v1';
export const DEFAULT_AUDIO = Object.freeze({ music: 60, sfx: 80, lastMusic: 60, lastSfx: 80 });
export function loadAudioPreferences(storage) {
  const preferences = { ...DEFAULT_AUDIO };
  try {
    const saved = JSON.parse(storage.getItem(AUDIO_SAVE_KEY));
    for (const key of Object.keys(preferences)) {
      const value = saved?.[key], minimum = key.startsWith('last') ? 1 : 0;
      if (Number.isFinite(value) && value >= minimum && value <= 100) preferences[key] = value;
    }
  } catch { /* Storage may be unavailable; audio still works for this session. */ }
  return preferences;
}

export function createBastionAudio({ Audio = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let context, musicBus, effectsBus, suspended = false, musicVolume = .6, effectsVolume = .8;
  let nextBeat = 0, step = 0, battle = false;
  const voices = new Set(), lastEffects = new Map();
  function applyVolumes() {
    if (!context) return;
    for (const [bus, value] of [[musicBus, musicVolume * .38], [effectsBus, effectsVolume * .65]]) {
      bus.gain.cancelScheduledValues(context.currentTime);
      bus.gain.setTargetAtTime(suspended ? 0 : value, context.currentTime, .035);
    }
  }
  async function unlock() {
    if (!Audio) throw Error('Web Audio is unavailable');
    if (!context) {
      context = new Audio(); musicBus = context.createGain(); effectsBus = context.createGain();
      musicBus.gain.value = effectsBus.gain.value = 0;
      musicBus.connect(context.destination); effectsBus.connect(context.destination);
      nextBeat = context.currentTime + .03;
    }
    await context.resume(); applyVolumes();
  }
  function note(frequency, start, duration, gain, type, bus, endFrequency = frequency) {
    if (voices.size >= 48) return;
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    envelope.gain.setValueAtTime(.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(envelope); envelope.connect(bus); voices.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); voices.delete(oscillator); };
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }
  function setVolumes(music, effects) {
    const wasMuted = musicVolume === 0;
    musicVolume = Math.max(0, Math.min(100, music)) / 100;
    effectsVolume = Math.max(0, Math.min(100, effects)) / 100;
    if (context && wasMuted && musicVolume) nextBeat = context.currentTime + .03;
    applyVolumes();
  }
  function setSuspended(value) {
    if (suspended === !!value) return;
    suspended = !!value; applyVolumes();
    if (context && !suspended) nextBeat = context.currentTime + .03;
  }
  function tick({ combat = false, boss = false } = {}) {
    if (!context || context.state !== 'running' || suspended || !musicVolume) return;
    if (battle !== boss) { battle = boss; nextBeat = context.currentTime + .03; }
    if (nextBeat < context.currentTime - .2) nextBeat = context.currentTime + .03;
    const melody = [0, 7, 12, 4, 9, 7, 4, 2, 0, 4, 7, 14, 12, 9, 7, 2];
    const roots = [130.813, 110, 87.307, 97.999], beat = boss ? .32 : combat ? .43 : .56;
    while (nextBeat < context.currentTime + .12) {
      const root = roots[Math.floor(step / 16) % roots.length];
      note(root * 2 * 2 ** (melody[step % 16] / 12), nextBeat, beat * 1.4, .065, 'triangle', musicBus);
      if (step % 8 === 0) {
        note(root, nextBeat, beat * 7.6, .1, 'sine', musicBus);
        note(root * 1.5, nextBeat, beat * 7.4, .045, 'sine', musicBus);
      }
      if (boss && step % 2 === 0) note(90, nextBeat, .16, .08, 'sine', musicBus, 35);
      step++; nextBeat += beat;
    }
  }
  function effect(kind, tower = 'sentry') {
    if (!context || context.state !== 'running' || suspended || !effectsVolume) return;
    const now = context.currentTime, key = kind === 'shoot' ? `${kind}:${tower}` : kind;
    if (['shoot', 'kill'].includes(kind) && now - (lastEffects.get(key) ?? -Infinity) < .09) return;
    lastEffects.set(key, now);
    if (kind === 'shoot') {
      const [pitch, end, length, gain] = { sentry: [620, 220, .065, .06], cannon: [130, 35, .28, .2], frost: [1200, 440, .22, .055] }[tower] || [620, 220, .065, .06];
      note(pitch, now, length, gain, tower === 'sentry' ? 'triangle' : 'sine', effectsBus, end);
    } else if (kind === 'leak') note(160, now, .35, .15, 'sine', effectsBus, 48);
    else if (kind === 'kill') note(780, now, .08, .035, 'sine', effectsBus, 1050);
    else {
      const phrases = { build: [330, 494], upgrade: [330, 440, 660], sell: [494, 330], wave: [220, 330, 440], complete: [392, 494, 587], victory: [262, 330, 392, 524, 660], defeat: [262, 233, 196, 131] };
      const phrase = phrases[kind];
      phrase?.forEach((pitch, index) => note(pitch, now + index * .11, kind === 'victory' || kind === 'defeat' ? .55 : .24, .1, 'sine', effectsBus));
    }
  }
  function status() { return { running: context?.state === 'running', suspended, music: musicVolume > 0, sfx: effectsVolume > 0, voices: voices.size }; }
  return { unlock, setVolumes, setSuspended, tick, effect, status };
}
