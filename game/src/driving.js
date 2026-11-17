// Cielo Bay — driving.js: car physics for the player — acceleration,
// braking and reversing, steering that bites harder with speed, the
// Space handbrake that breaks the rear loose into a drift, and
// collisions with buildings, other cars and pedestrians. A damaged car
// smokes; a wrecked one stops.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function updatePlayerCar(G, dt) {
    var p = G.player, car = p.car;
    if (!car) return;
    var def = CB.CFG.CARS[car.model] || CB.CFG.CARS.sedan;
    var keys = G.keys;
    var throttle = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    var steer = (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
    var handbrake = !!(keys['Space']);
    var prevSpeed = car.speed;
    if (throttle > 0) car.speed += def.accel * dt;
    else if (throttle < 0) {
      if (car.speed > 30) car.speed -= def.brake * dt;
      else car.speed -= def.accel * 0.55 * dt; // reverse
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 260 * dt);
    }
    car.speed = Math.max(-def.top * 0.45, Math.min(def.top, car.speed));
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 420 * dt);
    // Steering: sharper at speed, looser in a drift.
    var steerAmount = steer * def.turn * dt * Math.min(1, Math.abs(car.speed) / 140 + 0.25);
    if (handbrake) steerAmount *= 1.7;
    car.angle += steerAmount * Math.sign(car.speed || 1);
    // Drift: the handbrake slides the car sideways and leaves smoke.
    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (handbrake && Math.abs(car.speed) > 120) {
      nx += Math.cos(car.angle + Math.PI / 2) * steer * car.speed * 0.35 * dt;
      ny += Math.sin(car.angle + Math.PI / 2) * steer * car.speed * 0.35 * dt;
      G.particles.push({ x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18,
        vx: 0, vy: -12, life: 0.5, maxLife: 0.5, color: '#cfc8b8', size: 7, kind: 'smoke' });
    }
    // Building collision, checked at the nose and the tail.
    var hitWall = false;
    var fx = nx + Math.cos(car.angle) * 20, fy = ny + Math.sin(car.angle) * 20;
    var tx = nx - Math.cos(car.angle) * 20, ty = ny - Math.sin(car.angle) * 20;
    if (G.city.blocked(fx, fy, 13) || G.city.blocked(tx, ty, 13)) hitWall = true;
    if (hitWall) {
      var impact = Math.abs(prevSpeed);
      if (impact > 90) {
        car.damage += impact * 0.09;
        CB.Audio.crash(impact > 260);
        G.shake = Math.min(16, G.shake + impact * 0.03);
        G.particles.push({ x: fx, y: fy, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: '#ffd27a', size: 8, kind: 'dot' });
      }
      car.speed *= -0.25; // bounce off
      nx = car.x; ny = car.y;
    }
    car.x = nx; car.y = ny;
    // Keep the player in the world even after a hard bounce.
    car.x = Math.max(30, Math.min(CB.CFG.WORLD_W - 30, car.x));
    car.y = Math.max(30, Math.min(CB.CFG.WORLD_H - 30, car.y));
    p.x = car.x; p.y = car.y;
    p.speed = car.speed;
    collideCars(G, car, dt);
    hitPeds(G, car, dt);
    // Damage smoke, and the wreck that ends the drive.
    if (car.damage > 45) {
      car.smokeT -= dt;
      if (car.smokeT <= 0) {
        car.smokeT = 0.12;
        G.particles.push({ x: car.x + Math.cos(car.angle) * 14, y: car.y + Math.sin(car.angle) * 14,
          vx: 0, vy: -26, life: 0.8, maxLife: 0.8, color: '#5a5a5a', size: 9, kind: 'smoke' });
      }
    }
    if (car.damage >= 100 && !car.wrecked) {
      car.wrecked = true;
      car.speed = 0;
      CB.Audio.crash(true);
      G.shake = 18;
      for (var i = 0; i < 14; i++) {
        G.particles.push({ x: car.x, y: car.y, vx: (G.rng.next() - 0.5) * 260, vy: (G.rng.next() - 0.5) * 260,
          life: 0.6, maxLife: 0.6, color: i % 2 ? '#d83a2e' : '#ffd27a', size: 7, kind: 'dot' });
      }
      CB.toast(G, 'Car wrecked — get out and find another', 3.5);
      CB.exitCar(G);
    }
    CB.Audio.setEngine(Math.abs(car.speed) / def.top, true);
  }

  // Car-on-car: push apart and share the damage.
  function collideCars(G, car, dt) {
    G.cars.forEach(function (other) {
      if (other === car || other.wrecked) return;
      var dx = other.x - car.x, dy = other.y - car.y;
      var d = Math.hypot(dx, dy);
      var minD = 40;
      if (d > 0.01 && d < minD) {
        var push = (minD - d) / 2;
        var ux = dx / d, uy = dy / d;
        other.x += ux * push; other.y += uy * push;
        car.x -= ux * push * 0.4; car.y -= uy * push * 0.4;
        var rel = Math.abs(car.speed - other.speed);
        if (rel > 120) {
          car.damage += rel * 0.05;
          other.damage += rel * 0.05;
          CB.Audio.crash(false);
          G.shake = Math.min(12, G.shake + 3);
        }
        if (other.isTraffic) other.speed *= 0.5;
      }
    });
  }

  // A pedestrian hit by the car is knocked down and the law notices.
  function hitPeds(G, car, dt) {
    if (Math.abs(car.speed) < 60) return;
    G.peds.forEach(function (ped) {
      if (ped.state === 'down') return;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
        ped.state = 'down';
        ped.downAt = G.time;
        ped.x += Math.cos(car.angle) * 30;
        ped.y += Math.sin(car.angle) * 30;
        CB.Audio.crash(false);
        G.shake = Math.min(12, G.shake + 5);
        CB.addCrime(G, CB.CFG.CRIME_HIT_PED);
        CB.toast(G, 'Hit and run — the heat is on', 3);
        G.peds.forEach(function (q) {
          if (Math.hypot(q.x - ped.x, q.y - ped.y) < 300) q.state = 'flee';
        });
      }
    });
  }

  CB.updatePlayerCar = updatePlayerCar;

  // Shared car damage: smoke starts, the wreck ends the drive.
  function damageCar(G, car, amount) {
    car.damage += amount;
    if (car.damage >= 100 && !car.wrecked) {
      car.wrecked = true;
      car.speed = 0;
      CB.Audio.crash(true);
    }
  }
  // km/h for the speedometer, from px/s.
  function speedKmh(car) {
    return Math.round(Math.abs(car.speed) * 0.32);
  }
  // Drift smoke for any car sliding sideways fast (traffic never does).
  function carSmoke(G, car, dt) {
    if (car.damage > 45 && !car.wrecked) {
      car.smokeT = (car.smokeT || 0) - dt;
      if (car.smokeT <= 0) {
        car.smokeT = 0.15;
        G.particles.push({ x: car.x, y: car.y, vx: 0, vy: -24, life: 0.7, maxLife: 0.7, color: '#5a5a5a', size: 8, kind: 'smoke' });
      }
    }
  }

  CB.damageCar = damageCar;
  CB.speedKmh = speedKmh;
  CB.carSmoke = carSmoke;
})();
