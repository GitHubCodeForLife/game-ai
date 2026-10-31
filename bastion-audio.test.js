import test from 'node:test';
import assert from 'node:assert/strict';
import { createBastionAudio, loadAudioPreferences, AUDIO_SAVE_KEY, DEFAULT_AUDIO } from './bastion-audio.js';

function fixture() {
  const contexts = [], gains = [], oscillators = [];
  const parameter = () => ({ value: 0, start: null, setValueAtTime(value) { this.value = value; this.start ??= value; }, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime(value) { this.value = value; } });
  class Audio {
    constructor() { this.currentTime = 0; this.state = 'suspended'; this.destination = {}; contexts.push(this); }
    async resume() { this.state = 'running'; }
    createGain() { const node = { gain: parameter(), connect() {}, disconnect() { this.disconnected = true; } }; gains.push(node); return node; }
    createOscillator() { const node = { frequency: parameter(), connect() {}, disconnect() { this.disconnected = true; }, start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; } }; oscillators.push(node); return node; }
  }
  return { audio: createBastionAudio({ Audio }), contexts, gains, oscillators };
}

test('saved audio choices preserve mute and restore volume; invalid storage uses safe defaults', () => {
  assert.deepEqual(loadAudioPreferences(undefined), DEFAULT_AUDIO);
  assert.deepEqual(loadAudioPreferences({ getItem() { return '{bad'; } }), DEFAULT_AUDIO);
  const storage = { getItem(key) { assert.equal(key, AUDIO_SAVE_KEY); return JSON.stringify({ music: 0, sfx: 35, lastMusic: 42, lastSfx: 35 }); } };
  assert.deepEqual(loadAudioPreferences(storage), { music: 0, sfx: 35, lastMusic: 42, lastSfx: 35 });
  assert.deepEqual(loadAudioPreferences({ getItem: () => JSON.stringify({ music: -1, sfx: 'loud', lastMusic: 0, lastSfx: 101 }) }), DEFAULT_AUDIO);
});

test('music and effects wait for activation, mute independently, and suspend together', async () => {
  const { audio, contexts, gains, oscillators } = fixture();
  audio.tick(); audio.effect('shoot'); assert.equal(contexts.length, 0);
  await audio.unlock(); audio.tick(); assert.equal(contexts.length, 1); assert.equal(oscillators.length, 3);
  audio.setVolumes(0, 80); const beforeMusicMute = oscillators.length;
  contexts[0].currentTime = 1; audio.tick(); assert.equal(oscillators.length, beforeMusicMute); assert.equal(gains[0].gain.value, 0);
  audio.effect('shoot'); assert.equal(oscillators.length, beforeMusicMute + 1); assert.ok(gains[1].gain.value > 0);
  audio.setVolumes(60, 0); const beforeEffectsMute = oscillators.length;
  audio.effect('build'); assert.equal(oscillators.length, beforeEffectsMute); assert.equal(gains[1].gain.value, 0);
  audio.tick(); assert.ok(oscillators.length > beforeEffectsMute);
  audio.setVolumes(60, 80); audio.setSuspended(true); const beforePause = oscillators.length;
  contexts[0].currentTime = 60; audio.tick({ boss: true }); audio.effect('leak');
  assert.equal(oscillators.length, beforePause); assert.equal(gains[0].gain.value, 0); assert.equal(gains[1].gain.value, 0);
  audio.setSuspended(false); audio.tick({ boss: true });
  assert.ok(oscillators.length > beforePause); assert.ok(oscillators.length - beforePause < 6, 'Returning does not replay a backlog');
  assert.ok(gains[0].gain.value > 0); assert.ok(gains[1].gain.value > 0);
});

test('tower effects are distinct, rapid shots are throttled, and voices release their nodes', async () => {
  const { audio, contexts, gains, oscillators } = fixture(); await audio.unlock();
  for (const tower of ['sentry', 'cannon', 'frost']) audio.effect('shoot', tower);
  assert.deepEqual(oscillators.map(node => node.frequency.start), [620, 130, 1200]);
  for (let i = 0; i < 100; i++) audio.effect('shoot', 'sentry');
  assert.equal(oscillators.length, 3);
  contexts[0].currentTime = .1; audio.effect('shoot', 'sentry'); assert.equal(oscillators.length, 4);
  for (let i = 0; i < 100; i++) audio.effect('build');
  assert.equal(audio.status().voices, 48); assert.equal(oscillators.length, 48);
  oscillators.forEach(node => node.onended()); assert.equal(audio.status().voices, 0);
  assert.ok(oscillators.every(node => node.disconnected)); assert.ok(gains.slice(2).every(node => node.disconnected));
  for (const kind of ['upgrade', 'sell', 'wave', 'complete', 'victory', 'defeat', 'leak', 'kill']) audio.effect(kind);
  assert.ok(audio.status().voices > 0); assert.ok(oscillators.every(node => node.stopTime > node.startTime));
});
