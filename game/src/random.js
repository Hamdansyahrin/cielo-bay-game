// Cielo Bay — random.js: a small seeded RNG (mulberry32) so the city,
// the traffic and the ?shot= scenes are identical on every load.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function RNG(seed) {
    this.s = (seed >>> 0) || 1;
  }
  RNG.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  RNG.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; };
  RNG.prototype.chance = function (p) { return this.next() < p; };

  CB.RNG = RNG;
  // The live game RNG; main.js reseeds it from ?seed= or the default.
  CB.rng = new RNG(1337);
  CB.reseed = function (seed) { CB.rng = new RNG(seed); return CB.rng; };
})();
