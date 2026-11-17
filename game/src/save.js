// save.js — localStorage save / continue: cash, respect, mission index,
// player position and health. Nothing leaves the browser.
import { GAME } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      version: 1,
      cash: G.player.cash,
      respect: G.player.respect,
      missionIndex: Math.min(G.missions.index, 5),
      completedCount: G.missions.completedCount,
      x: G.player.x, y: G.player.y,
      health: G.player.health,
      savedAt: Date.now(),
    };
    localStorage.setItem(GAME.saveKey, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(GAME.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(GAME.saveKey); } catch (e) {}
}

export function applySave(G, data) {
  G.player.cash = data.cash || 0;
  G.player.respect = data.respect || 0;
  G.player.health = data.health || 100;
  G.player.x = data.x || G.player.x;
  G.player.y = data.y || G.player.y;
  G.missions.completedCount = data.completedCount || 0;
  // Restart at the saved mission index (missions themselves re-set up fresh).
  return data.missionIndex || 0;
}
