// audio.js — WebAudio synth only: engine hum, siren, shots, pickups.
// No audio files, no network. Everything is guarded so headless playtests
// (where AudioContext may be unavailable) never throw.
export function makeAudio() {
  return {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenLfo: null,
    enabled: false, lastShotAt: 0,
  };
}

export function ensureAudio(A) {
  if (A.ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.35;
    A.master.connect(A.ctx.destination);
    A.enabled = true;
    return true;
  } catch (e) {
    return false;
  }
}

export function resumeAudio(A) {
  if (A.ctx && A.ctx.state === 'suspended') {
    A.ctx.resume().catch(() => {});
  }
}

function startEngine(A) {
  if (!A.ctx || A.engineOsc) return;
  try {
    A.engineOsc = A.ctx.createOscillator();
    A.engineOsc.type = 'sawtooth';
    A.engineOsc.frequency.value = 55;
    A.engineGain = A.ctx.createGain();
    A.engineGain.gain.value = 0;
    const filter = A.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    A.engineOsc.connect(filter);
    filter.connect(A.engineGain);
    A.engineGain.connect(A.master);
    A.engineOsc.start();
  } catch (e) { /* audio is best-effort */ }
}

export function updateEngine(A, speed, driving) {
  if (!A.ctx) return;
  if (driving && !A.engineOsc) startEngine(A);
  if (!A.engineOsc || !A.engineGain) return;
  try {
    const target = driving ? 0.05 + Math.min(0.12, Math.abs(speed) / 540 * 0.12) : 0;
    A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.08);
    A.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.22, A.ctx.currentTime, 0.08);
  } catch (e) {}
}

function startSiren(A) {
  if (!A.ctx || A.sirenOsc) return;
  try {
    A.sirenOsc = A.ctx.createOscillator();
    A.sirenOsc.type = 'sine';
    A.sirenOsc.frequency.value = 700;
    A.sirenGain = A.ctx.createGain();
    A.sirenGain.gain.value = 0.05;
    A.sirenLfo = A.ctx.createOscillator();
    A.sirenLfo.frequency.value = 0.7;
    const lfoGain = A.ctx.createGain();
    lfoGain.gain.value = 220;
    A.sirenLfo.connect(lfoGain);
    lfoGain.connect(A.sirenOsc.frequency);
    A.sirenOsc.connect(A.sirenGain);
    A.sirenGain.connect(A.master);
    A.sirenOsc.start();
    A.sirenLfo.start();
  } catch (e) {}
}

export function updateSiren(A, wanted) {
  if (!A.ctx) return;
  if (wanted > 0 && !A.sirenOsc) startSiren(A);
  if (A.sirenGain) {
    try {
      A.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.045 : 0, A.ctx.currentTime, 0.2);
    } catch (e) {}
  }
}

export function playShot(A) {
  if (!A.ctx) return;
  const now = performance.now();
  if (now - A.lastShotAt < 60) return;
  A.lastShotAt = now;
  try {
    const dur = 0.12;
    const buffer = A.ctx.createBuffer(1, A.ctx.sampleRate * dur, A.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    }
    const src = A.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = A.ctx.createGain();
    gain.gain.value = 0.5;
    const filter = A.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    src.connect(filter); filter.connect(gain); gain.connect(A.master);
    src.start();
  } catch (e) {}
}

export function playBlip(A, freq, dur) {
  if (!A.ctx) return;
  try {
    const osc = A.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq || 880;
    const gain = A.ctx.createGain();
    gain.gain.setValueAtTime(0.25, A.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + (dur || 0.15));
    osc.connect(gain); gain.connect(A.master);
    osc.start();
    osc.stop(A.ctx.currentTime + (dur || 0.15));
  } catch (e) {}
}

export function playCrash(A) {
  if (!A.ctx) return;
  try {
    const dur = 0.25;
    const buffer = A.ctx.createBuffer(1, A.ctx.sampleRate * dur, A.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.4);
    }
    const src = A.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = A.ctx.createGain();
    gain.gain.value = 0.4;
    const filter = A.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    src.connect(filter); filter.connect(gain); gain.connect(A.master);
    src.start();
  } catch (e) {}
}
