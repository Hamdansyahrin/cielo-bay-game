// Cielo Bay — driving.js: car physics for the player, grid driving for
// traffic, and every collision that bends metal or worse.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var CFG = CB.CFG;

  function angleLerp(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  CB.angleLerp = angleLerp;

  CB.carCorners = function (car) {
    var c = Math.cos(car.angle), s = Math.sin(car.angle);
    var hw = car.w / 2, hh = car.h / 2, out = [];
    [[hw, hh], [hw, -hh], [-hw, hh], [-hw, -hh]].forEach(function (o) {
      out.push({ x: car.x + o[0] * c - o[1] * s, y: car.y + o[0] * s + o[1] * c });
    });
    return out;
  };
  CB.carHitsBuilding = function (G, car) {
    var cs = CB.carCorners(car);
    for (var i = 0; i < cs.length; i++) if (CB.buildingAt(G.city, cs[i].x, cs[i].y, 0)) return true;
    return false;
  };

  function damageCar(G, car, amt, x, y) {
    car.hp -= amt;
    if (amt > 6) { CB.sfx.crash(); G.shake = Math.min(14, G.shake + amt * 0.35); }
    if (car.hp < 55 && CB.rng.chance(0.5)) G.particles.push({ x: x || car.x, y: y || car.y, vx: CB.rng.range(-14, 14), vy: CB.rng.range(-30, -12), life: CB.rng.range(0.4, 0.9), t: 0, kind: 'smoke', size: CB.rng.range(4, 8) });
  }
  CB.damageCar = damageCar;

  // The player's car: throttle, steering that bites with speed, drift.
  CB.updatePlayerCar = function (G, dt) {
    var car = G.player.car, inp = G.input;
    var accel = car.armored ? 300 : 380, maxF = car.armored ? 330 : 430, maxR = -130;
    if (inp.up) car.speed += accel * dt;
    else if (inp.down) car.speed -= (car.speed > 10 ? 460 : 200) * dt;
    else car.speed -= car.speed * 0.55 * dt;
    if (inp.handbrake) car.speed -= car.speed * 1.6 * dt;
    car.speed = Math.max(maxR, Math.min(maxF, car.speed));
    var grip = inp.handbrake ? 2.6 : 1.55;
    if (Math.abs(car.speed) > 4) {
      var dir = car.speed >= 0 ? 1 : -1;
      if (inp.left) car.angle -= grip * dt * dir * Math.min(1, Math.abs(car.speed) / 160 + 0.35);
      if (inp.right) car.angle += grip * dt * dir * Math.min(1, Math.abs(car.speed) / 160 + 0.35);
    }
    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    moveCar(G, car, nx, ny, true);
    // Tire smoke while drifting or burning out.
    if ((inp.handbrake && Math.abs(car.speed) > 90) || (inp.up && Math.abs(car.speed) < 30 && car.speed !== 0)) {
      G.particles.push({ x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18, vx: CB.rng.range(-8, 8), vy: CB.rng.range(-8, 8), life: 0.5, t: 0, kind: 'tire', size: 5 });
    }
    if (car.hp < 45) { car.smokeT -= dt; if (car.smokeT <= 0) { car.smokeT = 0.14; G.particles.push({ x: car.x + Math.cos(car.angle) * 16, y: car.y + Math.sin(car.angle) * 16, vx: 4, vy: -22, life: 0.8, t: 0, kind: 'smoke', size: 6 }); } }
    if (car.hp <= 0) { car.speed = 0; }
    G.player.x = car.x; G.player.y = car.y;
    if (Math.abs(car.speed) > 60 && CB.rng.chance(0.3)) CB.engineBlip(car.speed);
  };

  // Shared mover: building bounce, car-to-car bumps, ped tragedy.
  function moveCar(G, car, nx, ny, isPlayer) {
    var ox = car.x, oy = car.y;
    car.x = nx; car.y = ny;
    if (CB.carHitsBuilding(G, car) || CB.inWater(car.x, car.y)) {
      car.x = ox; car.y = oy;
      if (Math.abs(car.speed) > 120) damageCar(G, car, Math.abs(car.speed) * 0.06, nx, ny);
      car.speed *= -0.25;
      return;
    }
    var cl = CB.clampWorld(car.x, car.y); car.x = cl.x; car.y = cl.y;
    for (var i = 0; i < G.cars.length; i++) {
      var o = G.cars[i];
      if (o === car) continue;
      if (Math.abs(o.x - car.x) < (o.w + car.w) / 2 - 6 && Math.abs(o.y - car.y) < (o.h + car.h) / 2 + 8) {
        damageCar(G, o, Math.abs(car.speed) * 0.05 + 3, o.x, o.y);
        if (isPlayer) damageCar(G, car, Math.abs(car.speed) * 0.03, car.x, car.y);
        car.speed *= 0.55; o.speed = (o.speed || 0) + car.speed * 0.2;
        car.x = ox; car.y = oy;
        return;
      }
    }
    if (isPlayer || car.kind === 'police') {
      for (var j = 0; j < G.peds.length; j++) {
        var p = G.peds[j];
        if (p.hp > 0 && Math.abs(car.speed) > 55 && Math.hypot(p.x - car.x, p.y - car.y) < 24) {
          p.hp = 0; p.downT = 0;
          G.particles.push({ x: p.x, y: p.y, vx: 0, vy: -10, life: 0.5, t: 0, kind: 'hit', size: 7 });
          if (isPlayer) CB.reportCrime(G, 'hitrun', car.x, car.y);
          damageCar(G, car, 4, car.x, car.y);
        }
      }
    }
  }
  CB.moveCar = moveCar;

  // Traffic: follow your road, slow for the car ahead, turn at junctions.
  CB.updateTraffic = function (G, dt) {
    for (var i = 0; i < G.cars.length; i++) {
      var car = G.cars[i];
      if (car.parked || car === G.player.car || car.kind === 'police' || car.hp <= 0) continue;
      var vert = Math.abs(Math.sin(car.angle)) > 0.7;
      var ahead = 999;
      for (var j = 0; j < G.cars.length; j++) {
        var o = G.cars[j]; if (o === car) continue;
        var dx = o.x - car.x, dy = o.y - car.y;
        var along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        var side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along > 0 && along < ahead && side < 20) ahead = along;
      }
      var want = ahead < 58 ? 0 : 105;
      car.speed += Math.max(-260 * dt, Math.min(120 * dt, want - car.speed));
      var nx = car.x + Math.cos(car.angle) * car.speed * dt;
      var ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // At a junction, sometimes turn onto the crossing road.
      var nearJunction = false, k;
      if (vert) { for (k = 0; k < CFG.ROADS_Y.length; k++) if (Math.abs(ny - CFG.ROADS_Y[k]) < 8) nearJunction = CFG.ROADS_Y[k]; }
      else { for (k = 0; k < CFG.ROADS_X.length; k++) if (Math.abs(nx - CFG.ROADS_X[k]) < 8) nearJunction = CFG.ROADS_X[k]; }
      if (nearJunction !== false && car.speed > 20 && CB.rng.chance(0.35)) {
        if (vert) { car.y = nearJunction; car.angle = CB.rng.chance(0.5) ? 0 : Math.PI; }
        else { car.x = nearJunction; car.angle = CB.rng.chance(0.5) ? -Math.PI / 2 : Math.PI / 2; }
        continue;
      }
      // Stay on a road: if we drifted off both grids, steer back.
      if (!CB.onRoad(nx, ny)) {
        car.angle += Math.PI * dt * 1.4;
        nx = car.x + Math.cos(car.angle) * car.speed * dt;
        ny = car.y + Math.sin(car.angle) * car.speed * dt;
        if (!CB.onRoad(nx, ny)) { nx = car.x; ny = car.y; car.angle += Math.PI / 2; }
      }
      moveCar(G, car, nx, ny, false);
    }
  };
})();
