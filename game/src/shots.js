// Cielo Bay — shots.js: poses the four deterministic screenshot scenes
// from ?shot=, with a fixed seed. Each scene starts the game for real,
// stages traffic, peds, police or rivals around the camera, freezes the
// simulation so the frame is stable, and sets window.__shot = "ready"
// once a couple of frames have rendered.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function poseScene(G, shot) {
    G.screen = 'playing';
    G.shotMode = shot;
    var rng = G.rng;
    if (shot === 'cover') {
      // Downtown on foot: player at the Cielo St / Tropicana crossing,
      // traffic rolling past, peds on the sidewalk, job 1 on the banner.
      G.player.x = 1420; G.player.y = 640;
      G.player.onFoot = true; G.player.car = null;
      G.player.aimAngle = -0.5;
      scatterTraffic(G, 1420, 640, 5);
      scatterPeds(G, 1420, 640, 6);
    } else if (shot === 'drive') {
      // Driving the beachfront road north, sun on the water.
      var car = CB.makeCar(G, { x: 2900, y: 1560, angle: -Math.PI / 2, model: 'sport', color: '#d83a2e' });
      G.cars.push(car);
      G.player.car = car; car.isPlayer = true;
      G.player.onFoot = false;
      car.speed = 300;
      G.player.x = car.x; G.player.y = car.y;
      scatterTraffic(G, 2900, 1400, 4);
      scatterPeds(G, 2900, 1300, 3);
      CB.setMission(G, 1);
      G.missionState.timer = 87;
    } else if (shot === 'chase') {
      // Three-star pursuit: the player flees north on Cielo St with
      // three cruisers on their tail and job 3 on the banner.
      var chaseCar = CB.makeCar(G, { x: 1400, y: 1500, angle: -Math.PI / 2, model: 'sport', color: '#2e6ad8' });
      G.cars.push(chaseCar);
      G.player.car = chaseCar; chaseCar.isPlayer = true;
      G.player.onFoot = false;
      chaseCar.speed = 380;
      G.player.x = chaseCar.x; G.player.y = chaseCar.y;
      CB.setMission(G, 2);
      G.missionState.surviveT = 19;
      G.wanted = 3;
      G.wantedPoints = 120;
      G.lastCrimeAt = G.time; G.lastSeenAt = G.time;
      [[1400, 1720], [1340, 1660], [1000, 1500]].forEach(function (pos) {
        var pc = CB.spawnPoliceCar(G, pos[0], pos[1]);
        pc.x = pos[0]; pc.y = pos[1];
        pc.angle = -Math.PI / 2;
        pc.speed = 330;
      });
      scatterTraffic(G, 1400, 1300, 3);
    } else if (shot === 'mission') {
      // The pier job: the player on foot at the pier mouth, aiming at
      // the Vipers holding the deck.
      CB.setMission(G, 3);
      G.player.x = 2960; G.player.y = 1000;
      G.player.onFoot = true; G.player.car = null;
      G.player.aimAngle = 0.1;
      G.player.hp = 100;
      scatterPeds(G, 2900, 900, 3);
    }
    // Settle the camera on the scene, then freeze the simulation so
    // the captured frame is exactly the posed one.
    CB.updateCamera(G);
    G.camera.x = Math.max(0, Math.min(CB.CFG.WORLD_W - CB.CFG.VIEW_W, G.player.x - CB.CFG.VIEW_W / 2));
    G.camera.y = Math.max(0, Math.min(CB.CFG.WORLD_H - CB.CFG.VIEW_H, G.player.y - CB.CFG.VIEW_H / 2));
    G.frozen = true;
    setTimeout(function () { window.__shot = 'ready'; }, 700);
  }

  function scatterTraffic(G, cx, cy, n) {
    for (var i = 0; i < n; i++) {
      var vertical = G.rng.chance(0.5);
      var line = vertical ? G.rng.pick(CB.CFG.ROADS_V) : G.rng.pick(CB.CFG.ROADS_H);
      var along = G.rng.range(-260, 260);
      var lane = (G.rng.chance(0.5) ? 1 : -1) * 22;
      var model = G.rng.pick(['sedan', 'sedan', 'taxi', 'sport']);
      var car = CB.makeCar(G, {
        x: vertical ? line + lane : cx + along, y: vertical ? cy + along : line + lane,
        angle: vertical ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI),
        model: model, isTraffic: true, color: G.rng.pick(CB.CFG.CARS[model].colors)
      });
      car.ai = { axis: vertical ? 'v' : 'h', dir: lane > 0 ? 1 : -1, cruise: 120 };
      car.speed = 120;
      G.cars.push(car);
    }
  }

  function scatterPeds(G, cx, cy, n) {
    for (var i = 0; i < n; i++) {
      G.peds.push({ x: cx + G.rng.range(-220, 220), y: cy + G.rng.range(-180, 180),
        angle: G.rng.range(0, Math.PI * 2), speed: 40, state: 'walk',
        color: G.rng.pick(['#d83a2e', '#2e6ad8', '#e8b73a', '#3f7a44']),
        downAt: 0, fleeX: 0, fleeY: 0, seed: i });
    }
  }

  CB.poseScene = poseScene;

  // The cover scene runs job 1 for real: the marked Comet is parked on
  // Marina Blvd and the banner names the lift, so the cover shows the
  // mission system as well as the city.
  var _poseScene = poseScene;
  CB.poseScene = function (G, shot) {
    if (['cover', 'drive', 'chase', 'mission'].indexOf(shot) < 0) {
      window.__shot = 'ready';
      return;
    }
    if (shot === 'cover') CB.setMission(G, 0);
    _poseScene(G, shot);
  };
  CB.shotScenes = ['cover', 'drive', 'chase', 'mission'];
})();
