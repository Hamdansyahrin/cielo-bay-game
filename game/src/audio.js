// Cielo Bay — audio.js: WebAudio synth only. No files, no network.
// Every sound is a few oscillators/noise bursts shaped by hand.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var ctx = null, muted = false, sirenNodes = null;

  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  CB.audioInit = function () { ac(); };
  CB.audioMuted = function () { return muted; };
  CB.audioToggleMute = function () { muted = !muted; if (muted) CB.sirenStop(); return muted; };

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return; var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, vol, freq) {
    if (muted) return; var c = ac(); if (!c) return;
    var len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 900;
    var g = c.createGain(); g.gain.setValueAtTime(vol || 0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start();
  }
  CB.sfx = {
    shot: function () { noise(0.09, 0.16, 1600); tone(160, 0.08, 'square', 0.07, 60); },
    melee: function () { noise(0.06, 0.1, 500); },
    hit: function () { tone(220, 0.07, 'sawtooth', 0.06, 110); },
    crash: function () { noise(0.22, 0.2, 300); tone(70, 0.2, 'sawtooth', 0.1, 40); },
    pickup: function () { tone(660, 0.09, 'sine', 0.09); setTimeout(function () { tone(990, 0.12, 'sine', 0.09); }, 70); },
    cash: function () { tone(880, 0.08, 'triangle', 0.1); setTimeout(function () { tone(1320, 0.14, 'triangle', 0.1); }, 80); },
    door: function () { tone(320, 0.07, 'triangle', 0.07, 240); },
    bust: function () { tone(392, 0.16, 'square', 0.09); setTimeout(function () { tone(311, 0.16, 'square', 0.09); }, 170); setTimeout(function () { tone(262, 0.3, 'square', 0.09); }, 340); },
    phone: function () { tone(1175, 0.07, 'sine', 0.06); setTimeout(function () { tone(1175, 0.07, 'sine', 0.06); }, 110); }
  };
  CB.sirenStart = function () {
    if (muted || sirenNodes) return; var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    o.type = 'triangle'; o.frequency.value = 800; g.gain.value = 0.022;
    lfo.frequency.value = 0.7; lg.gain.value = 180; lfo.connect(lg); lg.connect(o.frequency);
    o.connect(g); g.connect(c.destination); o.start(); lfo.start();
    sirenNodes = { o: o, lfo: lfo };
  };
  CB.sirenStop = function () { if (sirenNodes) { try { sirenNodes.o.stop(); sirenNodes.lfo.stop(); } catch (e) {} sirenNodes = null; } };
  CB.engineBlip = function (speed) { tone(60 + Math.abs(speed) * 0.35, 0.12, 'sawtooth', 0.03); };
})();
