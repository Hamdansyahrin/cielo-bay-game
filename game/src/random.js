// Cielo Bay — random.js: a small seeded RNG so the city, the traffic and
// every posed screenshot are reproducible from one seed, and so a
// ?seed= run of the game always builds the same world.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  // mulberry32: tiny, fast, good enough for world generation.
  function SeededRandom(seed) {
    this.state = (seed >>> 0) || 1;
  }
  SeededRandom.prototype.next = function () {
    var t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  SeededRandom.prototype.range = function (a, b) {
    return a + this.next() * (b - a);
  };
  SeededRandom.prototype.int = function (a, b) {
    return Math.floor(this.range(a, b + 1));
  };
  SeededRandom.prototype.pick = function (arr) {
    return arr[Math.floor(this.next() * arr.length)];
  };
  SeededRandom.prototype.chance = function (p) {
    return this.next() < p;
  };
  // A shuffled copy of an array, Fisher-Yates with this RNG.
  SeededRandom.prototype.shuffled = function (arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  };

  CB.SeededRandom = SeededRandom;

  // Turn an arbitrary seed string into a 32-bit number.
  function hashSeed(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  // A bell-ish value in [0,1) from two uniform draws.
  SeededRandom.prototype.bell = function () {
    return (this.next() + this.next()) / 2;
  };
  // Random point on a road centre line, for spawning cars and police.
  SeededRandom.prototype.roadPoint = function (cfg) {
    if (this.chance(0.55)) {
      return { x: this.pick(cfg.ROADS_V), y: this.range(60, cfg.WORLD_H - 60) };
    }
    return { x: this.range(60, cfg.WORLD_W - 60), y: this.pick(cfg.ROADS_H) };
  };

  CB.hashSeed = hashSeed;
})();
