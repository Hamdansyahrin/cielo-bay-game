// Cielo Bay — police.js: the wanted system. Crimes add points; points
// set the star level; police cars spawn on the road grid and chase the
// player down it. Stay hidden and the heat cools off a star at a time.
// Get caught on foot or pinned in a slow car and it is BUSTED.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function levelFor(points) {
    var pts = CB.CFG.WANTED_POINTS;
    var level = 0;
    for (var i = 0; i < pts.length; i++) if (points >= pts[i]) level = i;
    return level;
  }

  function addCrime(G, points) {
    G.wantedPoints += points;
    G.lastCrimeAt = G.time;
    G.lastSeenAt = G.time;
    var level = levelFor(G.wantedPoints);
    if (level !== G.wanted) {
      G.wanted = level;
      if (level > 0) CB.toast(G, 'WANTED — ' + level + (level === 1 ? ' star' : ' stars'), 3);
    }
  }

  // Heat cools only while no police can see the player and no crime is
  // fresh. A directly-set wanted level (a mission, a debug handle) is
  // honoured: its points are synced up to that level's threshold.
  function updateWanted(G, dt) {
    if (G.wanted !== levelFor(G.wantedPoints)) {
      if (G.wanted > levelFor(G.wantedPoints)) {
        G.wantedPoints = CB.CFG.WANTED_POINTS[Math.min(G.wanted, 5)];
      } else {
        G.wanted = levelFor(G.wantedPoints);
      }
    }
    if (G.wanted <= 0) return;
    var seen = false;
    for (var i = 0; i < G.police.length; i++) {
      // A wrecked cruiser cannot spot anyone, and neither can one
      // whose view of the player is blocked by a building.
      if (G.police[i].wrecked) continue;
      var pd = Math.hypot(G.police[i].x - G.player.x, G.police[i].y - G.player.y);
      if (pd < 240 && hasLOS(G, G.police[i].x, G.police[i].y, G.player.x, G.player.y)) { seen = true; break; }
    }
    if (seen || G.time - G.lastCrimeAt < CB.CFG.HEAT_HIDDEN_SECS) G.lastSeenAt = G.time;
    if (G.time - G.lastSeenAt > CB.CFG.HEAT_HIDDEN_SECS) {
      G.heatTimer += dt;
      if (G.heatTimer >= CB.CFG.HEAT_DECAY_SECS) {
        G.heatTimer = 0;
        G.wantedPoints = Math.max(0, G.wantedPoints - 35);
        var level = levelFor(G.wantedPoints);
        if (level < G.wanted) {
          G.wanted = level;
          CB.toast(G, G.wanted === 0 ? 'Heat lost — you are clean' : 'Heat cooling — ' + G.wanted + ' stars', 2.5);
        }
      }
    } else {
      G.heatTimer = 0;
    }
  }

  // Line of sight between two points: false when a building stands
  // between them. Heat only counts when the law can actually see you.
  function hasLOS(G, x1, y1, x2, y2) {
    var bs = G.city.buildings;
    for (var i = 1; i < 14; i++) {
      var t = i / 14;
      var x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
      for (var j = 0; j < bs.length; j++) {
        var b = bs[j];
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
      }
    }
    return true;
  }

  function spawnPoliceCar(G, nearX, nearY) {
    var cfg = CB.CFG;
    var p = null;
    for (var tries = 0; tries < 12; tries++) {
      var cand = G.rng.roadPoint(cfg);
      var d = Math.hypot(cand.x - nearX, cand.y - nearY);
      // Land outside the 240px "seen" radius, so a fresh cruiser does
      // not spot the player the instant it appears.
      if (d > 650 && d < 1000) { p = cand; break; }
    }
    if (!p) p = { x: nearX + 700, y: nearY };
    var car = CB.makeCar(G, { x: p.x, y: p.y, angle: 0, model: 'police', isPolice: true, color: '#1a2a3a' });
    // The trail is fresh at dispatch: the cruiser just got the call.
    car.ai = { mode: 'pursue', stuckT: 0, reverseT: 0, seenT: G.time };
    car.bustT = 0;
    G.cars.push(car);
    G.police.push(car);
    return car;
  }

  CB.levelFor = levelFor;
  CB.addCrime = addCrime;
  CB.updateWanted = updateWanted;
  CB.spawnPoliceCar = spawnPoliceCar;
  CB.hasLOS = hasLOS;

  // Police cars chase on the road grid: steer toward the player, back
  // up when wedged against a building, and ram to make the bust.
  function updatePolice(G, dt) {
    var wanted = G.wanted;
    var desired = wanted > 0 ? Math.min(wanted, CB.CFG.MAX_POLICE) : 0;
    G.policeSpawnT = (G.policeSpawnT || 0) - dt;
    var hiddenLong = G.wanted > 0 && G.time - G.lastSeenAt > CB.CFG.HEAT_HIDDEN_SECS;
    if (G.police.length < desired && G.policeSpawnT <= 0 && !hiddenLong) {
      spawnPoliceCar(G, G.player.x, G.player.y);
      G.policeSpawnT = 0.9;
    }
    // Wanted dropped: the furthest cruisers peel off and despawn.
    if (G.police.length > desired) {
      G.police.sort(function (a, b) {
        return Math.hypot(b.x - G.player.x, b.y - G.player.y) - Math.hypot(a.x - G.player.x, a.y - G.player.y);
      });
      var extra = G.police.pop();
      var idx = G.cars.indexOf(extra);
      if (idx >= 0) G.cars.splice(idx, 1);
    }
    updateRoadblocks(G, dt);
    var p = G.player;
    if (!G.lastKnown) G.lastKnown = { x: p.x, y: p.y };
    var giveUps = [];
    G.police.forEach(function (car) {
      if (car.wrecked) return;
      var def = CB.CFG.CARS.police;
      var pdx = p.x - car.x, pdy = p.y - car.y;
      var dist = Math.hypot(pdx, pdy) || 1;
      // This cruiser's own eyes: a clear view refreshes its trail.
      if (dist < 240 && hasLOS(G, car.x, car.y, p.x, p.y)) {
        car.ai.seenT = G.time;
        G.lastSeenAt = G.time;
        G.lastKnown = { x: p.x, y: p.y };
      }
      // A cruiser that lost the trail eight seconds ago gives up and
      // leaves; the heat can then cool for real.
      if (G.time - (car.ai.seenT || -999) > 8) {
        giveUps.push(car);
        return;
      }
      // Chase the live position when freshly seen, else the last place
      // the player was spotted.
      var tgt = (G.time - (car.ai.seenT || -999) < 3) ? p : G.lastKnown;
      var dx = tgt.x - car.x, dy = tgt.y - car.y;
      var wantAngle = Math.atan2(dy, dx);
      var diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.ai.reverseT = Math.max(0, (car.ai.reverseT || 0) - dt);
      if (car.ai.reverseT > 0) {
        car.speed = Math.max(-160, car.speed - 500 * dt);
      } else {
        car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
        car.speed = Math.min(def.top, car.speed + def.accel * dt);
      }
      var nx = car.x + Math.cos(car.angle) * car.speed * dt;
      var ny = car.y + Math.sin(car.angle) * car.speed * dt;
      var fx = nx + Math.cos(car.angle) * 20, fy = ny + Math.sin(car.angle) * 20;
      if (G.city.blocked(fx, fy, 13)) {
        // Wedged: reverse out for a moment, then try again.
        car.ai.reverseT = 0.7;
        car.speed = -Math.abs(car.speed) * 0.4;
        nx = car.x; ny = car.y;
      }
      car.x = nx; car.y = ny;
      // Shove other cars aside instead of stacking on them.
      G.cars.forEach(function (other) {
        if (other === car || other.wrecked) return;
        var ox = other.x - car.x, oy = other.y - car.y;
        var od = Math.hypot(ox, oy);
        if (od > 0.01 && od < 42) {
          other.x += (ox / od) * (42 - od) * 0.5;
          other.y += (oy / od) * (42 - od) * 0.5;
          if (other.isTraffic) other.speed *= 0.6;
        }
      });
      // The bust: caught on foot up close, or pinned in a slow car.
      var touching = dist < 48;
      var pinned = !p.onFoot && p.car && Math.abs(p.car.speed) < 80;
      if (touching && (p.onFoot || pinned)) {
        car.bustT = (car.bustT || 0) + dt;
        if (car.bustT > (p.onFoot ? 1.2 : 1.6)) doBusted(G);
      } else {
        car.bustT = Math.max(0, (car.bustT || 0) - dt * 2);
      }
      CB.carSmoke(G, car, dt);
    });
    giveUps.forEach(function (car) {
      var gi = G.police.indexOf(car);
      if (gi >= 0) G.police.splice(gi, 1);
      var ci = G.cars.indexOf(car);
      if (ci >= 0) G.cars.splice(ci, 1);
    });
    if (giveUps.length > 0 && G.police.length === 0) CB.toast(G, 'You lost the cruisers — stay out of sight', 3);
    CB.Audio.updateSiren(G.police.length > 0, dt);
  }

  // At 4-5 stars the law parks two cruisers across the road ahead.
  function updateRoadblocks(G, dt) {
    if (G.wanted >= 4) {
      if (!G.roadblocks) G.roadblocks = [];
      if (G.roadblocks.length < 2) {
        var p = G.player;
        var dir = p.car ? Math.sign(p.car.speed || 1) : 1;
        var ahead = 320 + G.roadblocks.length * 90;
        var bx = p.x + Math.cos(p.car ? p.car.angle : p.faceAngle || 0) * ahead * dir;
        var by = p.y + Math.sin(p.car ? p.car.angle : p.faceAngle || 0) * ahead * dir;
        var block = CB.makeCar(G, { x: bx, y: by, angle: (p.car ? p.car.angle : 0) + Math.PI / 2, model: 'police', isPolice: true, color: '#1a2a3a' });
        block.ai = { mode: 'block' };
        G.cars.push(block);
        G.roadblocks.push(block);
      }
    } else if (G.roadblocks && G.roadblocks.length > 0) {
      G.roadblocks.forEach(function (b) {
        var i = G.cars.indexOf(b);
        if (i >= 0) G.cars.splice(i, 1);
      });
      G.roadblocks = [];
    }
  }

  function doBusted(G) {
    G.screen = 'busted';
    G.cash = Math.max(0, G.cash - 200);
    G.wanted = 0;
    G.wantedPoints = 0;
    G.police.forEach(function (c) {
      var i = G.cars.indexOf(c);
      if (i >= 0) G.cars.splice(i, 1);
    });
    G.police = [];
    if (G.player.car) CB.exitCar(G);
    G.player.x = G.city.spawn.x; G.player.y = G.city.spawn.y;
    G.player.hp = G.player.maxHp;
    CB.Audio.setEngine(0, false);
    CB.Audio.updateSiren(false, 0);
    CB.Save.write(G);
  }

  CB.updatePolice = updatePolice;
  CB.doBusted = doBusted;
})();
