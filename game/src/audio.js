// Cielo Bay — audio.js: every sound is synthesized with WebAudio, no
// audio files at all. Engine hum, sirens, gunshots, crashes, pickups and
// the fixer's phone ring are all oscillators and filtered noise. The
// context starts on the first user gesture; everything is guarded so a
// missing AudioContext can never throw a console error.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  var AudioSys = {
    ctx: null, master: null, muted: false,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null, sirenTimer: 0,
    init: function () {
      if (this.ctx) return;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    resume: function () {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        try { this.ctx.resume(); } catch (e) { /* audio stays off */ }
      }
    },
    setMuted: function (m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },
    // A short oscillator blip with an exponential decay.
    tone: function (freq, dur, type, vol, slideTo) {
      if (!this.ctx || this.muted) return;
      try {
        var t = this.ctx.currentTime;
        var o = this.ctx.createOscillator();
        var g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
        g.gain.setValueAtTime(vol || 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { /* never break the game for a sound */ }
    },
    // Filtered white noise, for shots, crashes and skids.
    noise: function (dur, vol, freq) {
      if (!this.ctx || this.muted) return;
      try {
        var t = this.ctx.currentTime;
        var len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var src = this.ctx.createBufferSource();
        src.buffer = buf;
        var f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = freq || 1200;
        var g = this.ctx.createGain();
        g.gain.setValueAtTime(vol || 0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start(t);
      } catch (e) { /* never break the game for a sound */ }
    },
    shot: function () { this.noise(0.12, 0.5, 2600); this.tone(180, 0.08, 'square', 0.12, 60); },
    rivalShot: function () { this.noise(0.1, 0.25, 2000); },
    crash: function (hard) { this.noise(hard ? 0.35 : 0.18, hard ? 0.5 : 0.25, 500); this.tone(70, 0.2, 'sine', 0.2, 40); },
    pickup: function () { this.tone(660, 0.09, 'sine', 0.2); this.tone(990, 0.12, 'sine', 0.2); },
    phone: function () { this.tone(880, 0.12, 'sine', 0.18); this.tone(1174, 0.12, 'sine', 0.18); },
    melee: function () { this.noise(0.08, 0.2, 900); },
    missionDone: function () {
      var self = this;
      [523, 659, 784, 1046].forEach(function (f, i) {
        setTimeout(function () { self.tone(f, 0.16, 'triangle', 0.22); }, i * 90);
      });
    }
  };

  CB.Audio = AudioSys;

  // Engine and siren are loops kept alive while driving or wanted, with
  // their pitch following the car's speed and the siren alternating.
  AudioSys.startEngine = function () {
    if (!this.ctx || this.engineOsc) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain.gain.value = 0.0;
      var f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { this.engineOsc = null; }
  };
  AudioSys.setEngine = function (speedRatio, on) {
    if (!this.ctx) return;
    if (on) this.startEngine();
    if (!this.engineOsc || !this.engineGain) return;
    try {
      var t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, t, 0.08);
      this.engineGain.gain.setTargetAtTime(on ? 0.05 + speedRatio * 0.05 : 0.0, t, 0.1);
    } catch (e) { /* ignore */ }
  };
  AudioSys.updateSiren = function (on, dt) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch (e) { /* ignore */ }
        this.sirenOsc = null; this.sirenGain = null;
      }
      return;
    }
    this.sirenTimer += dt;
    if (!this.sirenOsc) {
      try {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'triangle';
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      } catch (e) { this.sirenOsc = null; }
    }
    if (this.sirenOsc) {
      var hi = Math.floor(this.sirenTimer / 0.45) % 2 === 0;
      try { this.sirenOsc.frequency.setTargetAtTime(hi ? 880 : 660, this.ctx.currentTime, 0.05); } catch (e) { /* ignore */ }
    }
  };
})();
