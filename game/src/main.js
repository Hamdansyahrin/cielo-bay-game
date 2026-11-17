// main.js — boot, game loop, input, screen states and the wiring between
// every system of Cielo Bay. Exposes window.__cielo for playtesting.
import { WORLD, LANDMARKS, GAME } from './config.js';
import { makeRng, clamp } from './random.js';
import { generateCity, pushOutOfSolids } from './city.js';
import { drawWorld } from './render.js';
import { drawHUD } from './hud.js';
import { makePlayer, updatePlayerOnFoot, playerShoot, playerMelee, nearestEnterableCar, enterCar, exitCar } from './player.js';
import { updatePlayerCar, resolveCarCollisions } from './driving.js';
import { spawnTraffic, spawnParked, spawnPeds, updateTraffic, updatePeds, updateBullets } from './entities.js';
import { makePoliceState, addWanted, updatePolice, checkWasted } from './police.js';
import { makeMissionState, startMission, updateMissions, onPlayerEnterCar, completeMission } from './missions.js';
import { makeAudio, ensureAudio, resumeAudio, updateEngine, updateSiren, playShot, playBlip, playCrash } from './audio.js';
import { saveGame, loadSave, applySave } from './save.js';
import { poseShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const G = {
  seed,
  rng: makeRng(seed),
  city: generateCity(seed),
  player: null,
  cars: [],
  peds: [],
  bullets: [],
  particles: [],
  toasts: [],
  bannerState: null,
  wanted: 0,
  lastCrimeAt: null,
  police: makePoliceState(),
  missions: makeMissionState(),
  camera: { x: LANDMARKS.playerStart.x, y: LANDMARKS.playerStart.y },
  screen: 'title',
  time: 0,
  shake: 0,
  bump: false,
  lastTrafficTopUp: 0,
  lastPoliceSpawn: 0,
  hasSave: false,
  audio: makeAudio(),
  keys: {},
  mouse: { x: 0, y: 0, down: false },
  shotReady: false,
};

G.player = makePlayer(LANDMARKS.playerStart);
G.hasSave = loadSave() !== null;

// --- UI helpers -------------------------------------------------------------
G.toast = function (text, fromMara) {
  G.toasts.push({ text, fromMara: !!fromMara, t: 0, life: 4.5 });
  if (G.toasts.length > 4) G.toasts.shift();
};
G.phone = function (text) { G.toast(text, true); };
G.banner = function (title, text, seconds) {
  G.bannerState = { title, text, t: seconds || 4, life: seconds || 4 };
};

// --- Crime / wanted hooks ----------------------------------------------------
G.onCrime = function (reason, stars, x, y) {
  G.lastCrimeAt = G.time;
  addWanted(G, stars, reason);
  for (const p of G.peds) {
    if (p.kind === 'ped' && Math.hypot(p.x - x, p.y - y) < 300 && p.state !== 'flee') {
      p.state = 'flee'; p.stateT = 3;
    }
  }
};
G.onShot = function (x, y) { playShot(G.audio); };
G.onPlayerHurt = function () { playBlip(G.audio, 180, 0.2); };
G.onWantedChange = function () { /* siren follows wanted in the loop */ };
G.onEnterCar = function (car) { onPlayerEnterCar(G, car); };
G.onMissionComplete = function () {
  saveGame(G);
  playBlip(G.audio, 1040, 0.3);
  if (G.missions.index >= 5) G.screen = 'complete';
};
G.onBusted = function () {
  G.player.cash = Math.floor(G.player.cash * 0.9);
  saveGame(G);
};
G.onWasted = function () {
  G.player.cash = Math.floor(G.player.cash * 0.9);
  saveGame(G);
};

// --- World setup -------------------------------------------------------------
spawnParked(G);
spawnTraffic(G, 26);
spawnPeds(G, 34);
startMission(G, 0);

// --- Input -------------------------------------------------------------------
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', Space: 'handbrake',
};
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  const mapped = KEYMAP[e.code];
  if (mapped) G.keys[mapped] = true;
  if (e.code === 'Enter') onEnter();
  if (e.code === 'KeyP' || e.code === 'Escape') onPause();
  if (e.code === 'KeyE') onEnterCarKey();
  if (e.code === 'KeyQ') onMeleeKey();
  if (e.code === 'KeyM') { ensureAudio(G.audio); resumeAudio(G.audio); }
});
window.addEventListener('keyup', (e) => {
  const mapped = KEYMAP[e.code];
  if (mapped) G.keys[mapped] = false;
});
canvas.addEventListener('mousemove', (e) => { G.mouse.x = e.clientX; G.mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => {
  G.mouse.x = e.clientX; G.mouse.y = e.clientY;
  G.mouse.down = true;
  ensureAudio(G.audio); resumeAudio(G.audio);
  if (G.screen === 'title') { startGame(); return; }
  if (G.screen === 'playing' && G.player.onFoot) playerShoot(G, G.player, mouseWorld());
});
window.addEventListener('mouseup', () => { G.mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function mouseWorld() {
  return {
    x: G.camera.x + (G.mouse.x - canvas.width / 2) / cameraZoom(),
    y: G.camera.y + (G.mouse.y - canvas.height / 2) / cameraZoom(),
  };
}

function cameraZoom() {
  if (G.player.car) return 0.85;
  return 1;
}

function onEnter() {
  if (G.screen === 'title') { startGame(); return; }
  if (G.screen === 'busted' || G.screen === 'wasted') { respawn(); return; }
  if (G.screen === 'complete') { G.screen = 'playing'; return; }
}

function startGame() {
  ensureAudio(G.audio); resumeAudio(G.audio);
  if (G.hasSave) {
    const data = loadSave();
    if (data) {
      const idx = applySave(G, data);
      G.player.x = data.x; G.player.y = data.y;
      G.camera.x = data.x; G.camera.y = data.y;
      // Mission 0 was already started at boot; only re-start for later missions.
      if (idx > 0) startMission(G, Math.min(idx, 4));
    }
  }
  G.screen = 'playing';
  G.toast('Mara Voss is on the line. Check the job banner up top.');
}

function respawn() {
  const hospital = G.city.hospital;
  G.player.health = G.player.maxHealth;
  G.player.x = hospital.x; G.player.y = hospital.y;
  G.player.onFoot = true;
  if (G.player.car) { G.player.car.kind = 'traffic'; G.player.car.driver = 'ai'; G.player.car = null; }
  G.wanted = 0;
  G.police = makePoliceState();
  G.cars = G.cars.filter((c) => c.kind !== 'police');
  G.camera.x = hospital.x; G.camera.y = hospital.y;
  G.screen = 'playing';
  G.toast('Bay General patched you up. Back to work.');
}

function onPause() {
  if (G.screen === 'playing') G.screen = 'paused';
  else if (G.screen === 'paused') G.screen = 'playing';
}

function onEnterCarKey() {
  if (G.screen !== 'playing') return;
  const p = G.player;
  if (p.onFoot) {
    const car = nearestEnterableCar(G, p);
    if (car) enterCar(G, p, car);
  } else {
    exitCar(G, p);
  }
}

function onMeleeKey() {
  if (G.screen === 'playing' && G.player.onFoot) playerMelee(G, G.player);
}

// --- Simulation ---------------------------------------------------------------
G.tick = function (dt, fromShot) {
  G.time += dt;
  const p = G.player;
  if (G.screen === 'playing' || fromShot) {
    if (p.onFoot) updatePlayerOnFoot(G, p, G.keys, mouseWorld(), dt);
    else updatePlayerCar(G, p.car, G.keys, dt);
    if (G.mouse.down && p.onFoot && !fromShot) playerShoot(G, p, mouseWorld());
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updateBullets(G, dt);
    updatePolice(G, dt);
    updateMissions(G, dt);
    resolveCarCollisions(G);
    checkWasted(G);
    // Particles.
    for (const pt of G.particles) {
      pt.t += dt;
      pt.x += (pt.vx || 0) * dt;
      pt.y += (pt.vy || 0) * dt;
    }
    G.particles = G.particles.filter((pt) => pt.t < pt.life);
    // Toasts + banner.
    for (const t of G.toasts) t.t += dt;
    G.toasts = G.toasts.filter((t) => t.t < t.life);
    if (G.bannerState) {
      G.bannerState.t -= dt;
      if (G.bannerState.t <= 0) G.bannerState = null;
    }
    G.shake = Math.max(0, G.shake - dt * 30);
    if (G.bump) { playCrash(G.audio); G.bump = false; }
    // Camera follows the player (or their car).
    const tx = p.car ? p.car.x : p.x;
    const ty = p.car ? p.car.y : p.y;
    const k = Math.min(1, 5 * dt);
    G.camera.x += (tx - G.camera.x) * k;
    G.camera.y += (ty - G.camera.y) * k;
    G.camera.x = clamp(G.camera.x, 300, WORLD.W - 300);
    G.camera.y = clamp(G.camera.y, 220, WORLD.H - 220);
    // Audio follows the game.
    updateEngine(G.audio, p.car ? p.car.speed : 0, !!p.car);
    updateSiren(G.audio, G.wanted);
  }
};

// --- Frame --------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.screen !== 'paused') G.tick(dt, false);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const zoom = cameraZoom();
  drawWorld(ctx, G, { camX: G.camera.x, camY: G.camera.y, zoom, W: canvas.width, H: canvas.height });
  drawHUD(ctx, G, canvas.width, canvas.height);
  if (shotName && !G.shotReady) {
    G.shotReady = true;
    window.__shot = 'ready';
  }
  requestAnimationFrame(frame);
}

// --- Shot posing ---------------------------------------------------------------
if (shotName) {
  poseShot(G, shotName);
} else {
  G.screen = 'title';
}

// Debug handle for playtesting.
window.__cielo = {
  G,
  startGame, respawn,
  state: () => ({
    screen: G.screen,
    x: Math.round(G.player.x), y: Math.round(G.player.y),
    onFoot: G.player.onFoot,
    health: Math.round(G.player.health),
    cash: G.player.cash,
    wanted: G.wanted,
    mission: G.missions.index,
    missionPhase: G.missions.phase,
    cars: G.cars.length,
    police: G.cars.filter((c) => c.kind === 'police').length,
    peds: G.peds.length,
    toasts: G.toasts.map((t) => t.text),
    carX: G.player.car ? Math.round(G.player.car.x) : null,
    carY: G.player.car ? Math.round(G.player.car.y) : null,
    carSpeed: G.player.car ? Math.round(G.player.car.speed) : null,
  }),
  enterNearestCar: () => {
    const car = nearestEnterableCar(G, G.player);
    return car ? enterCar(G, G.player, car) : false;
  },
  teleport: (x, y) => {
    if (G.player.car) { G.player.car.x = x; G.player.car.y = y; }
    G.player.x = x; G.player.y = y;
    G.camera.x = x; G.camera.y = y;
  },
  teleportCarTo: (x, y) => {
    if (G.player.car) {
      G.player.car.x = x; G.player.car.y = y;
      G.player.car.vx = 0; G.player.car.vy = 0; G.player.car.speed = 0;
      G.player.x = x; G.player.y = y;
      G.camera.x = x; G.camera.y = y;
      return true;
    }
    return false;
  },
  missionTarget: () => {
    const t = G.missions.targetCar;
    return t ? { x: Math.round(t.x), y: Math.round(t.y), kind: t.kind } : null;
  },
  chopShop: () => ({ x: G.city.chopShop.x + G.city.chopShop.w / 2, y: G.city.chopShop.y + G.city.chopShop.h / 2 }),
};

requestAnimationFrame(frame);
