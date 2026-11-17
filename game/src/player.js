// Cielo Bay — player.js: the runner on foot — walking, aiming, fists,
// the pistol, bullets, and getting in and out of other people's cars.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var CFG = CB.CFG;

  CB.makePlayer = function (x, y) {
    return { x: x, y: y, angle: -Math.PI / 2, hp: 100, maxHp: 100, car: null, fireT: 0, meleeT: 0, hitFlash: 0, stepT: 0 };
  };

  CB.updatePlayerFoot = function (G, dt) {
    var p = G.player, inp = G.input;
    var mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    var my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    var sp = inp.run ? CFG.PLAYER_RUN : CFG.PLAYER_SPEED;
    if (mx || my) {
      var l = Math.hypot(mx, my);
      p.x += (mx / l) * sp * dt; p.y += (my / l) * sp * dt;
      if (!inp.mouseDown) p.angle = Math.atan2(my, mx);
      var c = CB.collideBuildings(G.city, p.x, p.y, CFG.PLAYER_R);
      p.x = c.x; p.y = c.y;
      var cl = CB.clampWorld(p.x, p.y); p.x = cl.x; p.y = cl.y;
      if (CB.inWater(p.x, p.y)) { p.y = CFG.WATER_Y - 6; if (p.x > CFG.PIER.x) p.x = CFG.PIER.x - 16; }
    }
    // Aim always follows the mouse.
    var wx = G.camera.x + inp.mouseX, wy = G.camera.y + inp.mouseY;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
    if (p.fireT > 0) p.fireT -= dt;
    if (p.meleeT > 0) p.meleeT -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    // Holding the mouse keeps firing; main.js also fires on mousedown
    // itself so a tap shorter than one frame still shoots.
    if (inp.mouseDown && p.fireT <= 0) CB.playerShoot(G);
    if (inp.melee && p.meleeT <= 0) CB.playerMelee(G);
  };

  CB.playerShoot = function (G) {
    var p = G.player;
    if (p.car || p.fireT > 0 || G.screen !== 'playing') return;
    p.fireT = CFG.FIRE_COOLDOWN;
    var a = p.angle + CB.rng.range(-0.022, 0.022);
    G.bullets.push({ x: p.x + Math.cos(p.angle) * 16, y: p.y + Math.sin(p.angle) * 16, vx: Math.cos(a) * CFG.BULLET_SPEED, vy: Math.sin(a) * CFG.BULLET_SPEED, life: 0.5, foe: false });
    G.muzzleT = 0.05;
    G.gunfireAt = G.time; G.gunfireX = p.x; G.gunfireY = p.y;
    CB.sfx.shot();
    CB.reportCrime(G, 'shots', p.x, p.y);
  };

  CB.playerMelee = function (G) {
    var p = G.player;
    if (p.car) return;
    p.meleeT = 0.34;
    CB.sfx.melee();
    for (var i = 0; i < G.peds.length; i++) {
      var q = G.peds[i];
      if (q.hp > 0 && Math.hypot(q.x - p.x, q.y - p.y) < CFG.MELEE_RANGE && Math.abs(angDiff(q, p)) < 1.2) {
        hurtPed(G, q, 16);
        CB.reportCrime(G, 'assault', p.x, p.y);
      }
    }
  };
  function angDiff(q, p) {
    var a = Math.atan2(q.y - p.y, q.x - p.x) - p.angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function hurtPed(G, q, dmg) {
    q.hp -= dmg; q.hitFlash = 0.18; q.downT = 0;
    CB.sfx.hit();
    G.particles.push({ x: q.x, y: q.y, vx: 0, vy: -14, life: 0.35, t: 0, kind: 'hit', size: 6 });
    if (q.hp <= 0 && q.rival) CB.onRivalDown(G, q);
  }
  CB.hurtPed = hurtPed;

  // Enter or exit the nearest car. Stealing a car with a driver, seen
  // by anyone, is a crime; mission cars count double in Mara's world.
  CB.tryEnterExit = function (G) {
    var p = G.player;
    if (p.car) {
      var side = p.car.angle + Math.PI / 2;
      p.x = p.car.x + Math.cos(side) * 30; p.y = p.car.y + Math.sin(side) * 30;
      var c = CB.collideBuildings(G.city, p.x, p.y, CFG.PLAYER_R); p.x = c.x; p.y = c.y;
      p.car = null; CB.sfx.door();
      return;
    }
    var best = null, bd = 62;
    for (var i = 0; i < G.cars.length; i++) {
      var car = G.cars[i];
      var d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bd) { bd = d; best = car; }
    }
    if (!best) return;
    var wasParked = best.parked, hadDriver = best.driver;
    p.car = best; best.parked = false; best.driver = true;
    p.x = best.x; p.y = best.y;
    CB.sfx.door();
    if (best.marked || best.armored) CB.onMissionCarTaken(G, best);
    else if (hadDriver || !wasParked) CB.reportCrime(G, 'theft', p.x, p.y);
    else CB.reportCrime(G, 'theftQuiet', p.x, p.y);
  };

  // Bullets travel up to ~95px per slow headless frame, so hits are
  // tested along the whole segment they cross, never just the endpoint.
  function segHitsCircle(x1, y1, x2, y2, cx, cy, r) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    var px = x1 + dx * t, py = y1 + dy * t;
    return Math.hypot(cx - px, cy - py) <= r;
  }
  CB.segHitsCircle = segHitsCircle;

  CB.updateBullets = function (G, dt) {
    for (var i = G.bullets.length - 1; i >= 0; i--) {
      var b = G.bullets[i];
      var nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      b.life -= dt;
      var dead = b.life <= 0;
      if (CB.buildingAt(G.city, nx, ny, 0)) dead = true;
      if (!dead && b.foe) {
        // Rival fire can hit the player or the player's car.
        if (G.player.car) {
          if (segHitsCircle(b.x, b.y, nx, ny, G.player.car.x, G.player.car.y, 26)) { CB.damageCar(G, G.player.car, 5, nx, ny); hurtPlayer(G, 2); dead = true; }
        } else if (segHitsCircle(b.x, b.y, nx, ny, G.player.x, G.player.y, 14)) { hurtPlayer(G, 7); dead = true; }
      } else if (!dead) {
        for (var j = 0; j < G.peds.length; j++) {
          var q = G.peds[j];
          if (q.hp > 0 && segHitsCircle(b.x, b.y, nx, ny, q.x, q.y, 14)) { hurtPed(G, q, 15); dead = true; break; }
        }
        if (!dead) {
          for (var k = 0; k < G.cars.length; k++) {
            var car = G.cars[k];
            if (car !== G.player.car && segHitsCircle(b.x, b.y, nx, ny, car.x, car.y, 24)) { CB.damageCar(G, car, 6, nx, ny); dead = true; break; }
          }
          if (!dead) for (var m = 0; m < G.police.length; m++) {
            if (segHitsCircle(b.x, b.y, nx, ny, G.police[m].x, G.police[m].y, 24)) { CB.damageCar(G, G.police[m], 6, nx, ny); CB.reportCrime(G, 'shots', G.player.x, G.player.y); dead = true; break; }
          }
        }
      }
      if (dead) { G.bullets.splice(i, 1); continue; }
      b.x = nx; b.y = ny;
    }
    if (G.muzzleT > 0) G.muzzleT -= dt;
  };

  function hurtPlayer(G, dmg) {
    var p = G.player;
    p.hp -= dmg; p.hitFlash = 0.22;
    CB.sfx.hit();
    if (p.hp <= 0 && G.screen === 'playing') CB.onWasted(G);
  }
  CB.hurtPlayer = hurtPlayer;

  CB.updateParticles = function (G, dt) {
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var pt = G.particles[i];
      pt.t += dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.t >= pt.life) G.particles.splice(i, 1);
    }
  };
})();
