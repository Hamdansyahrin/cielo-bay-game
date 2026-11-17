// Cielo Bay — save.js: progress in localStorage (cash, respect,
// mission index, player position). Nothing leaves the browser.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var KEY = CB.CFG.SAVE_KEY;

  CB.saveGame = function (G) {
    try {
      var data = {
        cash: G.cash, respect: G.respect, mission: G.missionIndex,
        x: Math.round(G.player.x), y: Math.round(G.player.y),
        done: G.missionIndex >= 5
      };
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  };
  CB.loadGame = function () {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (typeof d.cash !== 'number' || typeof d.mission !== 'number') return null;
      return d;
    } catch (e) { return null; }
  };
  CB.hasSave = function () { return CB.loadGame() !== null; };
  CB.clearSave = function () { try { window.localStorage.removeItem(KEY); } catch (e) {} };
  CB.applySave = function (G, d) {
    G.cash = d.cash; G.respect = d.respect || 0;
    G.missionIndex = Math.max(0, Math.min(5, d.mission));
    if (typeof d.x === 'number' && typeof d.y === 'number' && !CB.buildingAt(G.city, d.x, d.y, 4)) {
      G.player.x = d.x; G.player.y = d.y;
    }
  };
})();
