// Cielo Bay — player.js: the player on foot — WASD/arrows to walk, Shift
// to run, mouse to aim, click to fire the pistol, F or right-click to
// swing a melee hit, E to enter or leave any car. Stealing a car someone
// can see is a crime; the wanted system hears about it from here.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function nearestCar(G, maxDist) {
    var best = null, bestD = maxDist;
    G.cars.forEach(function (car) {
      if (car.wrecked) return;
      var d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
      if (d < bestD) { bestD = d; best = car; }
    });
    return best;
  }

  function updateOnFoot(G, dt) {
    var p = G.player;
    var keys = G.keys;
    var mx = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
    var my = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);
    var running = keys['ShiftLeft'] || keys['ShiftRight'];
    var speed = running ? CB.CFG.RUN_SPEED : CB.CFG.WALK_SPEED;
    if (mx !== 0 || my !== 0) {
      var len = Math.hypot(mx, my);
      var vx = (mx / len) * speed, vy = (my / len) * speed;
      // Move axis by axis so walls slide instead of sticking.
      var nx = p.x + vx * dt;
      if (!G.city.blocked(nx, p.y, CB.CFG.PLAYER_RADIUS)) p.x = nx;
      var ny = p.y + vy * dt;
      if (!G.city.blocked(p.x, ny, CB.CFG.PLAYER_RADIUS)) p.y = ny;
      p.moving = true;
      p.faceAngle = Math.atan2(vy, vx);
    } else {
      p.moving = false;
    }
    // Aim follows the mouse, in world space.
    var wx = G.camera.x + G.mouse.x, wy = G.camera.y + G.mouse.y;
    p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
    // Pistol: hold to fire, one shot per cooldown.
    p.fireCooldown = Math.max(0, (p.fireCooldown || 0) - dt);
    if (G.mouse.down && p.fireCooldown <= 0 && G.screen === 'playing') {
      firePistol(G);
      p.fireCooldown = 0.28;
    }
    // Melee swing on F or right mouse.
    p.meleeCooldown = Math.max(0, (p.meleeCooldown || 0) - dt);
    if ((keys['KeyF'] || G.mouse.right) && p.meleeCooldown <= 0) {
      meleeSwing(G);
      p.meleeCooldown = 0.45;
    }
    // Slow health regen when calm and unhurt for a while.
    p.hurtTimer = Math.max(0, (p.hurtTimer || 0) - dt);
    if (p.hurtTimer <= 0 && p.hp < p.maxHp && G.wanted === 0) {
      p.hp = Math.min(p.maxHp, p.hp + 4 * dt);
    }
  }

  function firePistol(G) {
    var p = G.player;
    var a = p.aimAngle;
    G.bullets.push({
      x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
      vx: Math.cos(a) * CB.CFG.BULLET_SPEED, vy: Math.sin(a) * CB.CFG.BULLET_SPEED,
      life: CB.CFG.PISTOL_RANGE / CB.CFG.BULLET_SPEED, dmg: CB.CFG.PISTOL_DAMAGE, from: 'player'
    });
    CB.Audio.shot();
    G.muzzle = 0.06;
    // A shot in earshot of a witness is a crime.
    var seen = witnessNearby(G, p.x, p.y);
    if (seen) CB.addCrime(G, CB.CFG.CRIME_SHOT);
    else if (G.wanted === 0 && G.rng.chance(0.0)) { /* unheard shots stay quiet */ }
    // Peds near the shot flee.
    G.peds.forEach(function (ped) {
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 320) ped.state = 'flee';
    });
  }

  function meleeSwing(G) {
    var p = G.player;
    var a = p.aimAngle;
    var hx = p.x + Math.cos(a) * 40, hy = p.y + Math.sin(a) * 40;
    CB.Audio.melee();
    G.particles.push({ x: hx, y: hy, vx: 0, vy: 0, life: 0.15, maxLife: 0.15, color: '#e8e8e8', size: 26, kind: 'ring' });
    // Hit a rival in range.
    G.rivals.forEach(function (r) {
      if (r.hp > 0 && Math.hypot(r.x - hx, r.y - hy) < 46) {
        damageRival(G, r, CB.CFG.MELEE_DAMAGE);
        r.x += Math.cos(a) * 26; r.y += Math.sin(a) * 26;
      }
    });
  }

  // Is any pedestrian or police car close enough to witness a crime?
  function witnessNearby(G, x, y) {
    var r = CB.CFG.WITNESS_RADIUS;
    for (var i = 0; i < G.peds.length; i++) {
      if (Math.hypot(G.peds[i].x - x, G.peds[i].y - y) < r) return true;
    }
    for (var j = 0; j < G.police.length; j++) {
      if (Math.hypot(G.police[j].x - x, G.police[j].y - y) < r) return true;
    }
    return false;
  }

  function damageRival(G, rival, dmg) {
    rival.hp -= dmg;
    rival.flash = 0.12;
    G.particles.push({ x: rival.x, y: rival.y, vx: 0, vy: -30, life: 0.4, maxLife: 0.4, color: '#d83a2e', size: 6, kind: 'dot' });
    if (rival.hp <= 0) {
      rival.state = 'down';
      rival.downAt = G.time;
      CB.addCrime(G, CB.CFG.CRIME_KILL);
      CB.toast(G, 'Rival down — ' + (G.rivals.filter(function (q) { return q.hp > 0; }).length) + ' left', 2.5);
    }
  }

  CB.updateOnFoot = updateOnFoot;
  CB.nearestCar = nearestCar;
  CB.witnessNearby = witnessNearby;
  CB.damageRival = damageRival;
  CB.firePistol = firePistol;

  // E: get in the nearest car, or get out of the one being driven.
  // Taking a car that is not yours is theft when anyone sees it.
  function enterExitCar(G) {
    var p = G.player;
    if (p.car) {
      exitCar(G);
      return;
    }
    var car = nearestCar(G, 72);
    if (!car) return;
    if (car.isPolice) return; // police cars stay locked
    var stolen = car.isTraffic || car.isParked || car.missionTarget || car.missionVan;
    p.car = car;
    car.isPlayer = true;
    car.isTraffic = false;
    car.isParked = false;
    car.ai = null;
    p.onFoot = false;
    CB.Audio.setEngine(0, true);
    if (stolen) {
      if (witnessNearby(G, car.x, car.y)) {
        CB.addCrime(G, CB.CFG.CRIME_THEFT);
        CB.toast(G, 'Stolen — someone saw you!', 3);
      } else {
        CB.toast(G, 'Car taken — nobody saw a thing', 2.5);
      }
    }
    if (car.missionTarget) CB.onMissionCarTaken(G, car);
    if (car.missionVan) CB.onMissionVanTaken(G, car);
  }

  function exitCar(G) {
    var p = G.player;
    var car = p.car;
    if (!car) return;
    // Step out on the car's left side, clear of walls.
    var sx = car.x - Math.sin(car.angle) * 34, sy = car.y + Math.cos(car.angle) * 34;
    if (G.city.blocked(sx, sy, CB.CFG.PLAYER_RADIUS)) {
      sx = car.x + Math.sin(car.angle) * 34; sy = car.y - Math.cos(car.angle) * 34;
    }
    p.x = sx; p.y = sy;
    p.car = null;
    p.onFoot = true;
    car.isPlayer = false;
    car.speed = Math.max(0, car.speed * 0.2);
    CB.Audio.setEngine(0, false);
  }

  function damagePlayer(G, dmg) {
    var p = G.player;
    if (p.hp <= 0) return;
    p.hp -= dmg;
    p.hurtTimer = 4;
    G.shake = Math.min(14, G.shake + 6);
    if (p.hp <= 0) {
      p.hp = 0;
      G.screen = 'wasted';
      G.cash = Math.max(0, G.cash - 150);
      CB.Audio.setEngine(0, false);
    }
  }

  // Bullets fly, spark on walls, and hit rivals or the player. Hits are
  // tested against the whole step the bullet took, so a fast bullet can
  // never jump over its target between two slow frames.
  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    var t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }

  function updateBullets(G, dt) {
    for (var i = G.bullets.length - 1; i >= 0; i--) {
      var b = G.bullets[i];
      var ox = b.x, oy = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      var dead = b.life <= 0;
      if (!dead && (G.city.blocked(b.x, b.y, 2) || G.city.blocked((ox + b.x) / 2, (oy + b.y) / 2, 2))) {
        dead = true;
        G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, maxLife: 0.15, color: '#ffd27a', size: 5, kind: 'dot' });
      }
      if (!dead && b.from === 'player') {
        for (var j = 0; j < G.rivals.length; j++) {
          var r = G.rivals[j];
          if (r.hp > 0 && segDist(r.x, r.y, ox, oy, b.x, b.y) < 16) {
            damageRival(G, r, b.dmg);
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.from === 'rival') {
        var p = G.player;
        if (p.onFoot && segDist(p.x, p.y, ox, oy, b.x, b.y) < 14) {
          damagePlayer(G, 8);
          dead = true;
        } else if (!p.onFoot && p.car && segDist(p.car.x, p.car.y, ox, oy, b.x, b.y) < 26) {
          p.car.damage = Math.min(100, p.car.damage + 2);
          G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, maxLife: 0.15, color: '#ffd27a', size: 5, kind: 'dot' });
          dead = true;
        }
      }
      if (dead) G.bullets.splice(i, 1);
    }
  }

  CB.enterExitCar = enterExitCar;
  CB.exitCar = exitCar;
  CB.damagePlayer = damagePlayer;
  CB.updateBullets = updateBullets;
})();
