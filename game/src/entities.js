// Cielo Bay — entities.js: traffic cars and pedestrians — spawning,
// wandering, fleeing, and being very sorry they parked there.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var CFG = CB.CFG;

  CB.makeCar = function (x, y, angle, opts) {
    opts = opts || {};
    return {
      x: x, y: y, angle: angle || 0, speed: 0, steer: 0,
      w: opts.w || 46, h: opts.h || 22,
      color: opts.color || CB.rng.pick(CB.PALETTE.carBody),
      name: opts.name || CB.rng.pick(CB.CAR_NAMES),
      hp: opts.hp || 100, maxHp: opts.hp || 100,
      kind: opts.kind || 'traffic', parked: !!opts.parked,
      driver: opts.driver !== false, armored: !!opts.armored,
      marked: !!opts.marked, smokeT: 0, honkT: 0,
      lane: 0, targetX: x, targetY: y, turnAt: null, waitT: 0
    };
  };

  // Parked cars hug block edges; traffic cars start on road lanes.
  CB.spawnTraffic = function (G) {
    var rng = CB.rng, i, car;
    for (i = 0; i < 26; i++) {
      var rx = rng.pick(CFG.ROADS_X), ry = rng.range(80, CFG.WORLD_H - 120);
      car = CB.makeCar(rx + (rng.chance(0.5) ? 22 : -22), ry, rng.chance(0.5) ? -Math.PI / 2 : Math.PI / 2, {});
      car.speed = rng.range(60, 110); G.cars.push(car);
    }
    for (i = 0; i < 14; i++) {
      var ry2 = rng.pick(CFG.ROADS_Y), rx2 = rng.range(80, CFG.WORLD_W - 80);
      car = CB.makeCar(rx2, ry2 + (rng.chance(0.5) ? 22 : -22), rng.chance(0.5) ? 0 : Math.PI, {});
      car.speed = rng.range(60, 110); G.cars.push(car);
    }
    for (i = 0; i < 22; i++) {
      var b = rng.pick(G.city.buildings);
      var px = b.x + rng.range(6, Math.max(8, b.w - 52)), py = b.y + b.h + 16;
      if (CB.onRoad(px, py) || CB.buildingAt(G.city, px, py, 20)) continue;
      G.cars.push(CB.makeCar(px, py, rng.chance(0.5) ? 0 : Math.PI, { parked: true, driver: false }));
    }
  };

  CB.makePed = function (x, y, opts) {
    opts = opts || {};
    return {
      x: x, y: y, angle: CB.rng.range(0, Math.PI * 2), speed: 0,
      color: opts.color || CB.rng.pick(CB.PALETTE.ped),
      hp: opts.hp || 30, maxHp: opts.hp || 30, rival: !!opts.rival,
      state: 'walk', fleeT: 0, downT: 0, hitFlash: 0, walkT: CB.rng.range(1, 4),
      tx: x, ty: y, fireT: CB.rng.range(0.5, 1.5), name: opts.name || ''
    };
  };

  CB.spawnPeds = function (G) {
    for (var i = 0; i < 42; i++) {
      // Sidewalks: just off a road line, not inside a building.
      var vert = CB.rng.chance(0.5);
      var x, y;
      if (vert) { x = CB.rng.pick(CFG.ROADS_X) + CB.rng.pick([-58, 58]); y = CB.rng.range(60, CFG.WATER_Y - 40); }
      else { x = CB.rng.range(60, CFG.WORLD_W - 60); y = CB.rng.pick(CFG.ROADS_Y) + CB.rng.pick([-58, 58]); }
      if (CB.buildingAt(G.city, x, y, 6) || CB.inWater(x, y)) continue;
      G.peds.push(CB.makePed(x, y, {}));
    }
  };

  // Pedestrians stroll along sidewalks; a nearby crime sends them running.
  CB.updatePeds = function (G, dt) {
    for (var i = G.peds.length - 1; i >= 0; i--) {
      var p = G.peds[i];
      if (p.hp <= 0) { p.downT += dt; if (p.downT > 6 && !p.rival) G.peds.splice(i, 1); continue; }
      if (p.hitFlash > 0) p.hitFlash -= dt;
      var threat = null;
      if (G.lastCrimeAt > G.time - 2.5 && Math.hypot(G.player.x - p.x, G.player.y - p.y) < 190) threat = G.player;
      if (G.gunfireAt > G.time - 1.5 && Math.hypot(G.gunfireX - p.x, G.gunfireY - p.y) < 260) threat = { x: G.gunfireX, y: G.gunfireY };
      if (p.rival) { CB.updateRival(G, p, dt); continue; }
      if (threat) { p.state = 'flee'; p.fleeT = 1.6; }
      if (p.state === 'flee') {
        p.fleeT -= dt;
        var fx = p.x - (threat ? threat.x : G.player.x), fy = p.y - (threat ? threat.y : G.player.y);
        var fl = Math.hypot(fx, fy) || 1;
        p.angle = Math.atan2(fy, fx);
        p.x += (fx / fl) * 165 * dt; p.y += (fy / fl) * 165 * dt;
        if (p.fleeT <= 0) p.state = 'walk';
      } else {
        p.walkT -= dt;
        if (p.walkT <= 0 || Math.hypot(p.tx - p.x, p.ty - p.y) < 8) {
          p.walkT = CB.rng.range(2, 5);
          // New stroll target: along the nearest road's sidewalk.
          var nx = CB.nearestRoadX(p.x), ny = CB.nearestRoadY(p.y);
          if (CB.rng.chance(0.5)) { p.tx = nx + (p.x >= nx ? 58 : -58); p.ty = Math.max(50, Math.min(CFG.WATER_Y - 30, p.y + CB.rng.range(-320, 320))); }
          else { p.tx = Math.max(50, Math.min(CFG.WORLD_W - 50, p.x + CB.rng.range(-320, 320))); p.ty = ny + (p.y >= ny ? 58 : -58); }
        }
        var dx = p.tx - p.x, dy = p.ty - p.y, dl = Math.hypot(dx, dy);
        if (dl > 4) { p.angle = Math.atan2(dy, dx); p.x += (dx / dl) * 52 * dt; p.y += (dy / dl) * 52 * dt; }
      }
      var c = CB.collideBuildings(G.city, p.x, p.y, 10);
      p.x = c.x; p.y = c.y;
      var cl = CB.clampWorld(p.x, p.y); p.x = cl.x; p.y = Math.min(cl.y, CFG.WATER_Y + 6);
      if (CB.inWater(p.x, p.y)) { p.y = CFG.WATER_Y - 4; }
    }
  };

  // Rival crew members hold ground, strafe a little and shoot back.
  CB.updateRival = function (G, p, dt) {
    var d = Math.hypot(G.player.x - p.x, G.player.y - p.y);
    var tx = G.player.car ? G.player.car.x : G.player.x;
    var ty = G.player.car ? G.player.car.y : G.player.y;
    d = Math.hypot(tx - p.x, ty - p.y);
    p.angle = Math.atan2(ty - p.y, tx - p.x);
    if (d > 300) { p.x += Math.cos(p.angle) * 60 * dt; p.y += Math.sin(p.angle) * 60 * dt; }
    else if (d < 130) { p.x -= Math.cos(p.angle) * 46 * dt; p.y -= Math.sin(p.angle) * 46 * dt; }
    else { p.x += Math.cos(p.angle + Math.PI / 2) * Math.sin(G.time * 0.7 + p.x) * 22 * dt; p.y += Math.sin(p.angle + Math.PI / 2) * Math.sin(G.time * 0.7 + p.x) * 22 * dt; }
    var c = CB.collideBuildings(G.city, p.x, p.y, 11); p.x = c.x; p.y = c.y;
    p.fireT -= dt;
    if (p.fireT <= 0 && d < 330 && CB.hasLOS(G, p.x, p.y, tx, ty)) {
      p.fireT = CB.rng.range(0.8, 1.5);
      var spread = CB.rng.range(-0.09, 0.09);
      G.bullets.push({ x: p.x, y: p.y, vx: Math.cos(p.angle + spread) * 620, vy: Math.sin(p.angle + spread) * 620, life: 0.55, foe: true });
      CB.sfx.shot();
    }
  };

  // Someone nearby who can see a crime: a ped or a cruiser.
  CB.witnessed = function (G, x, y) {
    var i, d;
    for (i = 0; i < G.peds.length; i++) {
      d = Math.hypot(G.peds[i].x - x, G.peds[i].y - y);
      if (d <= CFG.SEEN_RADIUS && G.peds[i].hp > 0 && CB.hasLOS(G, G.peds[i].x, G.peds[i].y, x, y)) return true;
    }
    for (i = 0; i < G.police.length; i++) {
      d = Math.hypot(G.police[i].x - x, G.police[i].y - y);
      if (d <= CFG.SEEN_RADIUS && CB.hasLOS(G, G.police[i].x, G.police[i].y, x, y)) return true;
    }
    return false;
  };
})();
