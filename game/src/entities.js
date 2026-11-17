// Cielo Bay — entities.js: the city's other inhabitants. Traffic drives
// the road grid with headlights and simple give-way behaviour; parked
// cars sit on the shoulders; pedestrians walk the sidewalks and run
// from gunfire and theft. All of them recycle near the player so the
// streets always feel alive without simulating the whole map.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  var carId = 0;
  function makeCar(G, spec) {
    var def = CB.CFG.CARS[spec.model] || CB.CFG.CARS.sedan;
    return {
      id: ++carId, x: spec.x, y: spec.y, angle: spec.angle || 0,
      speed: 0, model: spec.model, color: spec.color || def.colors[0],
      w: def.w, h: def.h, damage: 0, wrecked: false,
      isTraffic: !!spec.isTraffic, isParked: !!spec.isParked,
      isPolice: !!spec.isPolice, isPlayer: false,
      missionTarget: !!spec.missionTarget, missionVan: !!spec.missionVan,
      ai: spec.isTraffic ? { dir: 1, axis: 'v', turnAt: 0, wait: 0 } : null,
      smokeT: 0
    };
  }

  // Spawn traffic on roads near the player, spread over the grid.
  function spawnTraffic(G) {
    var rng = G.rng;
    for (var i = 0; i < CB.CFG.TRAFFIC_COUNT; i++) {
      var vertical = rng.chance(0.5);
      var line = vertical ? rng.pick(CB.CFG.ROADS_V) : rng.pick(CB.CFG.ROADS_H);
      var along = rng.range(120, vertical ? CB.CFG.WORLD_H - 120 : CB.CFG.WORLD_W - 120);
      var lane = (rng.chance(0.5) ? 1 : -1) * 22;
      var model = 'sedan';
      var roll = rng.next();
      if (roll > 0.92 && G.unlocked >= 2) model = 'super';
      else if (roll > 0.78 && G.unlocked >= 1) model = 'sport';
      else if (roll > 0.68) model = 'taxi';
      else if (roll > 0.58) model = 'van';
      var car = makeCar(G, {
        x: vertical ? line + lane : along, y: vertical ? along : line + lane,
        angle: vertical ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI),
        model: model, isTraffic: true,
        color: rng.pick(CB.CFG.CARS[model].colors)
      });
      car.ai.axis = vertical ? 'v' : 'h';
      car.ai.dir = lane > 0 ? 1 : -1;
      car.speed = rng.range(90, 150);
      G.cars.push(car);
    }
  }

  // Traffic follows its road; at an intersection it sometimes turns.
  // A car ahead makes it brake, so traffic queues instead of stacking.
  function updateTraffic(G, dt) {
    var cfg = CB.CFG;
    G.cars.forEach(function (car) {
      if (!car.isTraffic || car.wrecked) return;
      var ai = car.ai;
      // Car ahead on the same lane?
      var ahead = 1e9;
      G.cars.forEach(function (other) {
        if (other === car || other.wrecked) return;
        var dx = other.x - car.x, dy = other.y - car.y;
        var along = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
        var side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
        if (along > 0 && along < ahead && side < 26) ahead = along;
      });
      var target = car.speed;
      if (ahead < 70) target = Math.max(0, (ahead - 40) * 1.5);
      else target = ai.cruise || 130;
      car.speed += Math.max(-400 * dt, Math.min(160 * dt, target - car.speed));
      var nx = car.x + Math.cos(car.angle) * car.speed * dt;
      var ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // Turn at intersections: only when centred on a crossing road.
      var nearCross = null;
      if (ai.axis === 'v') {
        cfg.ROADS_H.forEach(function (ry) { if (Math.abs(ny - ry) < 26) nearCross = ry; });
      } else {
        cfg.ROADS_V.forEach(function (rx) { if (Math.abs(nx - rx) < 26) nearCross = rx; });
      }
      if (nearCross !== null && G.rng.chance(0.35) && Math.abs(car.speed) > 20) {
        if (ai.axis === 'v') { car.y = nearCross; car.angle = G.rng.chance(0.5) ? 0 : Math.PI; ai.axis = 'h'; }
        else { car.x = nearCross; car.angle = G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2; ai.axis = 'v'; }
        car.speed = Math.max(60, car.speed * 0.8);
      } else {
        car.x = nx; car.y = ny;
      }
      // Recycle far-away traffic back onto a road near the player.
      if (Math.hypot(car.x - G.player.x, car.y - G.player.y) > 1400) {
        var p = G.rng.roadPoint(cfg);
        car.x = p.x; car.y = p.y;
      }
    });
  }

  CB.makeCar = makeCar;
  CB.spawnTraffic = spawnTraffic;
  CB.updateTraffic = updateTraffic;

  var SHIRTS = ['#d83a2e', '#2e6ad8', '#e8b73a', '#3f7a44', '#8a5ad8', '#e8e8e8', '#d86a2e'];

  function spawnPeds(G) {
    var rng = G.rng, cfg = CB.CFG;
    for (var i = 0; i < cfg.PED_COUNT; i++) {
      var vertical = rng.chance(0.5);
      var line = vertical ? rng.pick(cfg.ROADS_V) : rng.pick(cfg.ROADS_H);
      var along = rng.range(120, vertical ? cfg.WORLD_H - 120 : cfg.WORLD_W - 120);
      var side = (rng.chance(0.5) ? 1 : -1) * (cfg.ROAD_W / 2 + 14);
      G.peds.push({
        x: vertical ? line + side : along, y: vertical ? along : line + side,
        angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 52),
        state: 'walk', color: rng.pick(SHIRTS), downAt: 0, fleeX: 0, fleeY: 0, seed: rng.int(0, 999)
      });
    }
  }

  // Pedestrians stroll the sidewalks; a nearby crime sends them running
  // away from it, and a hit car leaves them down for a while.
  function updatePeds(G, dt) {
    var cfg = CB.CFG;
    G.peds.forEach(function (ped) {
      if (ped.state === 'down') {
        if (G.time - ped.downAt > 6) { ped.state = 'walk'; }
        return;
      }
      if (ped.state === 'flee') {
        var dx = ped.x - G.player.x, dy = ped.y - G.player.y;
        var d = Math.hypot(dx, dy) || 1;
        ped.angle = Math.atan2(dy, dx);
        var sp = 240;
        var nx = ped.x + Math.cos(ped.angle) * sp * dt;
        var ny = ped.y + Math.sin(ped.angle) * sp * dt;
        if (!G.city.blocked(nx, ped.y, 10)) ped.x = nx;
        if (!G.city.blocked(ped.x, ny, 10)) ped.y = ny;
        if (d > 420) ped.state = 'walk';
        return;
      }
      // Walk: keep a heading, drift it slowly, stay out of buildings.
      if (G.rng.chance(0.01)) ped.angle += G.rng.range(-0.9, 0.9);
      var nx2 = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      var ny2 = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (G.city.blocked(nx2, ped.y, 10)) { ped.angle = Math.PI - ped.angle; }
      else ped.x = nx2;
      if (G.city.blocked(ped.x, ny2, 10)) { ped.angle = -ped.angle; }
      else ped.y = ny2;
      // Wander back toward the roads so peds stay on the sidewalks.
      if (!G.city.isRoad(ped.x, ped.y) && Math.hypot(ped.x - G.player.x, ped.y - G.player.y) < 500) {
        var near = null, best = 1e9;
        cfg.ROADS_V.forEach(function (rx) { var dd = Math.abs(ped.x - rx); if (dd < best) { best = dd; near = rx; } });
        if (best > cfg.ROAD_W / 2 + 40) ped.angle = Math.atan2(0, near - ped.x);
      }
    });
  }

  CB.spawnPeds = spawnPeds;
  CB.updatePeds = updatePeds;
})();
