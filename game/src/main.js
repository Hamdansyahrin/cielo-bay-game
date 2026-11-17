// Cielo Bay — main.js: boots the game, owns the loop and the screens,
// and exposes the debug handle the playtest driver uses. Input is
// keyboard + mouse; the loop clamps its delta so a slow headless
// browser still moves the player at the right speed.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function parseQuery() {
    var q = {};
    try {
      var params = new URLSearchParams(window.location.search);
      params.forEach(function (v, k) { q[k] = v; });
    } catch (e) { /* no query */ }
    return q;
  }

  function newGame(seed) {
    var cfg = CB.CFG;
    var G = {
      time: 0, seed: seed,
      rng: new CB.SeededRandom(seed),
      city: CB.buildCity(seed),
      screen: 'title',
      player: { x: cfg.SPAWN.x, y: cfg.SPAWN.y, angle: 0, faceAngle: -Math.PI / 2,
        aimAngle: -Math.PI / 2, hp: cfg.PLAYER_HP, maxHp: cfg.PLAYER_HP,
        onFoot: true, car: null, moving: false, speed: 0,
        fireCooldown: 0, meleeCooldown: 0, hurtTimer: 0 },
      cars: [], peds: [], police: [], rivals: [], roadblocks: [],
      bullets: [], particles: [],
      wanted: 0, wantedPoints: 0, lastCrimeAt: -9999, lastSeenAt: -9999, heatTimer: 0,
      lastKnown: { x: cfg.SPAWN.x, y: cfg.SPAWN.y },
      cash: 0, respect: 0, mission: 0, missionState: null, unlocked: 0, freeRoam: false,
      camera: { x: 0, y: 0 }, shake: 0, muzzle: 0,
      keys: {}, mouse: { x: 640, y: 360, down: false, right: false },
      toasts: [], frozen: false, shotMode: null,
      policeSpawnT: 0, saveT: 0, deaths: 0
    };
    // Parked cars from the city plan, plus the armored van at the port.
    G.city.parked.forEach(function (spec) {
      G.cars.push(CB.makeCar(G, { x: spec.x, y: spec.y, angle: spec.angle, model: spec.model, isParked: true, color: spec.color }));
    });
    G.cars.push(CB.makeCar(G, { x: G.city.vanSpawn.x, y: G.city.vanSpawn.y, angle: -Math.PI / 2, model: 'armored', isParked: true, missionVan: true, color: '#3a3f46' }));
    CB.spawnTraffic(G);
    CB.spawnPeds(G);
    return G;
  }

  function startPlaying(G, fromSave) {
    if (fromSave) {
      var data = CB.Save.read();
      if (data) CB.Save.apply(G, data);
    }
    G.screen = 'playing';
    G.player.hp = G.player.maxHp;
    CB.Audio.resume();
    CB.startMission(G, G.mission);
    CB.toast(G, 'Welcome to Cielo Bay — Mara is on the phone', 4);
  }

  function boot() {
    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');
    var query = parseQuery();
    var seed = query.seed ? CB.hashSeed(String(query.seed)) : ((Date.now() % 2147483647) || 1);
    var G = newGame(seed);
    window.__cielo = makeDebug(G);
    window.__shot = null;
    // Input: keys.
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space') e.preventDefault();
      G.keys[e.code] = true;
      CB.Audio.resume();
      if (e.code === 'Enter') {
        if (G.screen === 'title') startPlaying(G, false);
        else if (G.screen === 'busted' || G.screen === 'wasted') { G.screen = 'playing'; G.player.hp = G.player.maxHp; }
        else if (G.screen === 'paused') G.screen = 'playing';
      }
      if (e.code === 'KeyC' && G.screen === 'title' && CB.Save.has()) startPlaying(G, true);
      if (e.code === 'KeyP' && (G.screen === 'playing' || G.screen === 'paused')) {
        G.screen = G.screen === 'playing' ? 'paused' : 'playing';
      }
      if (e.code === 'KeyM') CB.Audio.setMuted(!CB.Audio.muted);
      if (e.code === 'KeyE' && G.screen === 'playing' && !G.frozen) CB.enterExitCar(G);
    });
    window.addEventListener('keyup', function (e) { G.keys[e.code] = false; });
    // Input: mouse.
    canvas.addEventListener('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      G.mouse.x = e.clientX - rect.left;
      G.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', function (e) {
      CB.Audio.resume();
      var rect = canvas.getBoundingClientRect();
      G.mouse.x = e.clientX - rect.left;
      G.mouse.y = e.clientY - rect.top;
      if (e.button === 0) {
        G.mouse.down = true;
        // A click fires at once (a press-release faster than one frame
        // must still shoot); holding keeps firing from the loop.
        if (G.screen === 'playing' && G.player.onFoot && (G.player.fireCooldown || 0) <= 0) {
          CB.firePistol(G);
          G.player.fireCooldown = 0.28;
        }
      }
      if (e.button === 2) G.mouse.right = true;
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) G.mouse.down = false;
      if (e.button === 2) G.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // A posed screenshot scene starts straight into the world.
    if (query.shot) CB.poseScene(G, query.shot);
    // The loop.
    var last = performance.now();
    function frame(now) {
      // Reschedule first: a throw in one frame must never kill the loop.
      requestAnimationFrame(frame);
      var dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
      last = now;
      if (!G.frozen) {
        G.time += dt;
        update(G, dt);
      } else {
        G.time += dt * 0.5; // keep the water and pulses alive in a still
      }
      CB.updateCamera(G);
      CB.drawWorld(ctx, G);
      CB.drawHUD(ctx, G);
    }
    requestAnimationFrame(frame);
  }
  CB._boot = boot;
  CB._newGame = newGame;

  function update(G, dt) {
    if (G.screen !== 'playing') return;
    var p = G.player;
    if (p.onFoot) CB.updateOnFoot(G, dt);
    else CB.updatePlayerCar(G, dt);
    CB.updateTraffic(G, dt);
    CB.updatePeds(G, dt);
    CB.updateBullets(G, dt);
    CB.updateWanted(G, dt);
    CB.updatePolice(G, dt);
    CB.updateMissions(G, dt);
    // Particles drift and fade.
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var pt = G.particles[i];
      pt.x += (pt.vx || 0) * dt;
      pt.y += (pt.vy || 0) * dt;
      pt.life -= dt;
      if (pt.life <= 0) G.particles.splice(i, 1);
    }
    G.muzzle = Math.max(0, G.muzzle - dt);
    // Phone toasts tick down and leave.
    for (var j = G.toasts.length - 1; j >= 0; j--) {
      G.toasts[j].t -= dt;
      if (G.toasts[j].t <= 0) G.toasts.splice(j, 1);
    }
    // Autosave every 15 seconds of play.
    G.saveT += dt;
    if (G.saveT > 15) {
      G.saveT = 0;
      CB.Save.write(G);
    }
  }

  // The debug handle the playtest driver uses: world state, the mission
  // target, teleports for reaching test points, and mission jumps.
  function makeDebug(G) {
    return {
      G: G,
      state: function () {
        var p = G.player;
        return {
          screen: G.screen,
          x: Math.round(p.x), y: Math.round(p.y),
          onFoot: p.onFoot,
          carX: p.car ? Math.round(p.car.x) : 0,
          carY: p.car ? Math.round(p.car.y) : 0,
          carSpeed: p.car ? Math.round(p.car.speed) : 0,
          mission: G.mission,
          cash: Math.round(G.cash),
          police: G.police.length,
          wanted: G.wanted,
          health: Math.round(p.hp)
        };
      },
      missionTarget: function () {
        var marker = CB.missionMarker(G);
        if (G.mission === 0 && G.missionState && G.missionState.targetCar) {
          return { x: G.missionState.targetCar.x, y: G.missionState.targetCar.y };
        }
        if (marker) return { x: marker.x, y: marker.y };
        return { x: G.player.x, y: G.player.y };
      },
      chopShop: function () { return { x: G.city.chopShop.x, y: G.city.chopShop.y }; },
      teleport: function (x, y) {
        if (G.player.car) { G.player.car.x = x; G.player.car.y = y; G.player.car.speed = 0; }
        G.player.x = x; G.player.y = y;
      },
      teleportCarTo: function (x, y) {
        if (G.player.car) { G.player.car.x = x; G.player.car.y = y; G.player.car.speed = 0; }
        G.player.x = x; G.player.y = y;
      },
      missionInfo: function () {
        return { mission: G.mission, phase: G.missionState ? G.missionState.phase : null,
          objective: CB.objectiveText(G) };
      },
      setMission: function (i) { CB.setMission(G, i); },
      rivals: function () {
        return G.rivals.map(function (r) { return { x: Math.round(r.x), y: Math.round(r.y), hp: r.hp }; });
      },
      checkpoints: function () {
        return G.city.courierPoints.map(function (c) { return { x: c.x, y: c.y, name: c.name }; });
      },
      vanPos: function () { return { x: G.city.vanSpawn.x, y: G.city.vanSpawn.y }; },
      policeCount: function () { return G.police.length; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
