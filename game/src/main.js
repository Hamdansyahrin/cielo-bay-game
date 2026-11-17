// Cielo Bay — main.js: boot, input, the game loop and the states.
// The loop reschedules itself FIRST, so a single bad frame can never
// freeze the bay; mission code is always null-guarded.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var CFG = CB.CFG;

  var params = new URLSearchParams(window.location.search);
  var seed = parseInt(params.get('seed') || '1337', 10) || 1337;
  CB.reseed(seed);

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  var G = {
    time: 0, screen: 'title',
    city: null, player: null,
    cars: [], peds: [], police: [], roadblocks: [], bullets: [], particles: [], toasts: [],
    rivals: [], markedCar: null, van: null,
    cash: 0, respect: 0, wanted: 0,
    missionIndex: 0, missionState: null, pendingNext: null,
    lastCrimeAt: -99, lastCrimeX: 0, lastCrimeY: 0,
    gunfireAt: -99, gunfireX: 0, gunfireY: 0,
    lastSeenX: 0, lastSeenY: 0, lastSeenAt: -99, hiddenT: 0, heatHoldT: 0, decayT: 0,
    bustT: 0, spawnT: 0, lastBlockAt: -99, shake: 0, muzzleT: 0,
    camera: { x: 0, y: 0 },
    input: { up: false, down: false, left: false, right: false, run: false, handbrake: false, mouseDown: false, melee: false, mouseX: 640, mouseY: 360 }
  };
  CB.G = G;

  G.city = CB.buildCity(CB.rng);
  G.player = CB.makePlayer(600, 480);
  CB.spawnTraffic(G);
  CB.spawnPeds(G);
  G.lastSeenX = G.player.x; G.lastSeenY = G.player.y;

  // ---------------- input ----------------
  var KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', Space: 'handbrake' };
  window.addEventListener('keydown', function (e) {
    CB.audioInit();
    var k = KEYMAP[e.code];
    if (k) { G.input[k] = true; if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'KeyF' && G.player.car) { /* handled below */ }
    if (e.code === 'KeyE' && G.screen === 'playing') CB.tryEnterExit(G);
    if (e.code === 'KeyF') G.input.melee = true;
    if (e.code === 'KeyM') CB.toast(G, CB.audioToggleMute() ? 'Sound off' : 'Sound on', 'info');
    if (e.code === 'KeyP') {
      if (G.screen === 'playing') G.screen = 'paused';
      else if (G.screen === 'paused') G.screen = 'playing';
    }
    if (e.code === 'Enter') {
      if (G.screen === 'title') startRun(G, false);
      else if (G.screen === 'busted' || G.screen === 'wasted') CB.respawn(G);
      else if (G.screen === 'paused') G.screen = 'playing';
    }
    if (e.code === 'KeyC' && G.screen === 'title' && CB.hasSave()) startRun(G, true);
  });
  window.addEventListener('keyup', function (e) {
    var k = KEYMAP[e.code];
    if (k) G.input[k] = false;
    if (e.code === 'KeyF') G.input.melee = false;
  });
  canvas.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect();
    G.input.mouseX = (e.clientX - r.left) * (CFG.VIEW_W / r.width);
    G.input.mouseY = (e.clientY - r.top) * (CFG.VIEW_H / r.height);
  });
  canvas.addEventListener('mousedown', function (e) {
    CB.audioInit();
    if (e.button === 0) {
      G.input.mouseDown = true;
      CB.playerShoot(G); // fire at once: a tap shorter than a frame still shoots
    }
    if (e.button === 2) G.input.melee = true;
  });
  window.addEventListener('mouseup', function (e) {
    if (e.button === 0) G.input.mouseDown = false;
    if (e.button === 2) G.input.melee = false;
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function startRun(G, useSave) {
    if (useSave) {
      var d = CB.loadGame();
      if (d) CB.applySave(G, d);
    } else {
      G.cash = 0; G.respect = 0; G.missionIndex = 0;
      G.player.x = 600; G.player.y = 480; G.player.hp = 100; G.player.car = null;
    }
    G.screen = 'playing';
    if (G.missionIndex < 5) CB.startMission(G, G.missionIndex);
    else { G.missionState = null; CB.toast(G, 'Welcome back to Cielo Bay. Free roam.', 'phone'); }
  }

  // ---------------- loop ----------------
  var last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame); // reschedule FIRST: one throw can't freeze the game
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (G.screen === 'playing') {
      G.time += dt;
      if (G.player.car) CB.updatePlayerCar(G, dt); else CB.updatePlayerFoot(G, dt);
      CB.updateTraffic(G, dt);
      CB.updatePeds(G, dt);
      CB.updateBullets(G, dt);
      CB.updatePolice(G, dt);
      CB.updateMissions(G, dt);
      CB.updateParticles(G, dt);
      CB.updateToasts(G, dt);
      if (G.player.hp < 100 && !G.player.car && G.wanted === 0) G.player.hp = Math.min(100, G.player.hp + dt * 1.6);
    } else if (G.screen === 'title') {
      G.time += dt;
      CB.updateTraffic(G, dt);
      CB.updatePeds(G, dt);
      CB.updateParticles(G, dt);
    }
    // Camera follows with a little lookahead; shake decays.
    var tx = (G.player.car ? G.player.car.x : G.player.x) - CFG.VIEW_W / 2;
    var ty = (G.player.car ? G.player.car.y : G.player.y) - CFG.VIEW_H / 2;
    G.camera.x += (Math.max(0, Math.min(CFG.WORLD_W - CFG.VIEW_W, tx)) - G.camera.x) * 0.12;
    G.camera.y += (Math.max(0, Math.min(CFG.WORLD_H - CFG.VIEW_H, ty)) - G.camera.y) * 0.12;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 22);
    ctx.save();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    CB.drawWorld(G, ctx);
    var i;
    for (i = 0; i < G.cars.length; i++) CB.drawCar(G, ctx, G.cars[i]);
    for (i = 0; i < G.police.length; i++) if (G.roadblocks.indexOf(G.police[i]) >= 0) CB.drawCar(G, ctx, G.police[i]);
    for (i = 0; i < G.police.length; i++) if (G.roadblocks.indexOf(G.police[i]) < 0) CB.drawCar(G, ctx, G.police[i]);
    for (i = 0; i < G.peds.length; i++) CB.drawPed(G, ctx, G.peds[i]);
    CB.drawPlayer(G, ctx);
    CB.drawEffects(G, ctx);
    ctx.restore();
    if (G.screen === 'playing' || G.screen === 'paused') CB.drawHUD(G, ctx);
    if (G.screen !== 'playing') CB.drawScreens(G, ctx);
  }

  // ---------------- debug / playtest API ----------------
  window.__cielo = {
    G: G,
    state: function () {
      var c = G.player.car;
      return {
        screen: G.screen, x: Math.round(G.player.x), y: Math.round(G.player.y),
        onFoot: !c, mission: G.missionIndex, cash: G.cash, respect: G.respect,
        wanted: G.wanted, police: G.police.length, hp: Math.round(G.player.hp),
        carX: c ? Math.round(c.x) : null, carY: c ? Math.round(c.y) : null,
        carSpeed: c ? Math.round(Math.abs(c.speed)) : 0, time: Math.round(G.time * 10) / 10
      };
    },
    missionTarget: function () {
      var t = CB.missionTargetPos(G);
      return t ? { x: Math.round(t.x), y: Math.round(t.y) } : null;
    },
    chopShop: function () { return { x: G.city.chopShop.x, y: G.city.chopShop.y }; },
    teleport: function (x, y) {
      G.player.x = x; G.player.y = y;
      if (G.player.car) { G.player.car.x = x; G.player.car.y = y; }
      G.camera.x = Math.max(0, Math.min(CFG.WORLD_W - CFG.VIEW_W, x - CFG.VIEW_W / 2));
      G.camera.y = Math.max(0, Math.min(CFG.WORLD_H - CFG.VIEW_H, y - CFG.VIEW_H / 2));
    },
    teleportCarTo: function (x, y) {
      if (G.player.car) { G.player.car.x = x; G.player.car.y = y; G.player.x = x; G.player.y = y; }
    },
    missionInfo: function () {
      var ms = G.missionState;
      if (!ms) return { idx: G.missionIndex, phase: 'none' };
      return { idx: ms.idx, phase: ms.phase, cpIndex: ms.cpIndex || 0, timer: Math.round(ms.timer || 0), surviveT: Math.round(ms.surviveT || 0) };
    },
    setMission: function (idx) {
      G.missionState = null; G.pendingNext = null;
      if (G.screen !== 'playing') G.screen = 'playing';
      CB.startMission(G, idx);
    },
    rivals: function () { return G.rivals.map(function (r) { return { x: Math.round(r.x), y: Math.round(r.y), hp: r.hp }; }); },
    checkpoints: function () {
      var ms = G.missionState;
      return ms && ms.checkpoints ? ms.checkpoints.map(function (c) { return { x: c.x, y: c.y, name: c.name }; }) : [];
    },
    vanPos: function () { return G.van ? { x: Math.round(G.van.x), y: Math.round(G.van.y) } : null; },
    policeCount: function () { return G.police.length; }
  };

  // ---------------- boot ----------------
  var shotName = params.get('shot');
  if (shotName) {
    CB.poseShot(G, shotName);
    // Let the posed scene breathe for a few frames, then flag ready.
    var warm = 0;
    var warmId = setInterval(function () {
      warm++;
      if (warm >= 6) { clearInterval(warmId); window.__shot = 'ready'; }
    }, 90);
  }
  requestAnimationFrame(frame);
})();
