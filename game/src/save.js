// Cielo Bay — save.js: continue/save through localStorage. Only plain
// progress is stored — cash, respect, mission index and position — so a
// save can never carry a broken world with it.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  var Save = {
    key: function () { return CB.CFG.SAVE_KEY; },
    write: function (G) {
      try {
        var data = {
          cash: Math.round(G.cash),
          respect: G.respect,
          mission: G.mission,
          px: Math.round(G.player.x),
          py: Math.round(G.player.y),
          unlocked: G.unlocked,
          savedAt: Date.now()
        };
        window.localStorage.setItem(this.key(), JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },
    read: function () {
      try {
        var raw = window.localStorage.getItem(this.key());
        if (!raw) return null;
        var data = JSON.parse(raw);
        if (typeof data.cash !== 'number' || typeof data.mission !== 'number') return null;
        return data;
      } catch (e) { return null; }
    },
    has: function () { return this.read() !== null; },
    clear: function () {
      try { window.localStorage.removeItem(this.key()); } catch (e) { /* ignore */ }
    }
  };

  CB.Save = Save;

  // Apply a loaded save to a fresh game state. Position is clamped onto
  // a road so a save can never strand the player inside a building.
  Save.apply = function (G, data) {
    G.cash = data.cash;
    G.respect = data.respect || 0;
    G.mission = Math.min(data.mission || 0, 5);
    G.unlocked = data.unlocked || 0;
    if (typeof data.px === 'number' && typeof data.py === 'number') {
      G.player.x = Math.max(60, Math.min(3140, data.px));
      G.player.y = Math.max(60, Math.min(2340, data.py));
    }
    return true;
  };
  CB.Save = Save;
})();
