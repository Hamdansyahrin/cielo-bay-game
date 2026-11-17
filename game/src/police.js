// Cielo Bay — police.js: the wanted system and the Cielo Bay PD.
// Crimes only count when witnessed; cruisers chase your LAST KNOWN
// position, search when they lose you, and give up if you stay hidden.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var CFG = CB.CFG;

  var CRIME_HEAT = { theft: 1, theftQuiet: 0, shots: 1, assault: 1, hitrun: 2, copcar: 1 };

  CB.reportCrime = function (G, kind, x, y) {
    G.lastCrimeAt = G.time; G.lastCrimeX = x; G.lastCrimeY = y;
    var heat = CRIME_HEAT[kind] || 0;
    if (!heat) return;
    if (kind === 'theftQuiet') return; // nobody saw a thing
    if (CB.witnessed(G, x, y)) {
      CB.addWanted(G, heat);
      G.lastSeenX = G.player.x; G.lastSeenY = G.player.y; G.lastSeenAt = G.time;
    }
  };

  CB.addWanted = function (G, n) {
    var before = G.wanted;
    G.wanted = Math.max(0, Math.min(5, G.wanted + n));
    if (G.wanted > before) { G.heatHoldT = 6; CB.toast(G, 'WANTED LEVEL ' + G.wanted, 'heat'); }
  };
  CB.setWanted = function (G, n) {
    G.wanted = Math.max(0, Math.min(5, n));
    G.heatHoldT = 6;
  };

  function desiredPolice(G) {
    return [0, 1, 2, 3, 4, 6][G.wanted] || 0;
  }

  // Cruisers roll in on roads 650–1000px away: outside the seen radius,
  // close enough to matter. They never spawn on top of the player.
  function spawnCruiser(G) {
    for (var tries = 0; tries < 12; tries++) {
      var a = CB.rng.range(0, Math.PI * 2), d = CB.rng.range(650, 1000);
      var x = G.player.x + Math.cos(a) * d, y = G.player.y + Math.sin(a) * d;
      if (x < 60 || y < 60 || x > CFG.WORLD_W - 60 || y > CFG.WATER_Y - 40) continue;
      x = CB.nearestRoadX(x); // snap onto the road grid
      var car = CB.makeCar(x, y, CB.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, { kind: 'police', color: '#e8e8f0', hp: 130 });
      car.name = 'CBPD Cruiser';
      car.lastSeenX = G.lastSeenX; car.lastSeenY = G.lastSeenY;
      car.unseenT = 0; car.searchT = 0; car.stuckT = 0; car.px = x; car.py = y;
      G.police.push(car);
      return;
    }
  }
  CB.spawnCruiser = spawnCruiser;

  // At 4–5 stars the PD parks roadblocks across nearby junctions.
  function maybeRoadblock(G) {
    if (G.wanted < 4 || G.roadblocks.length >= G.wanted - 2) return;
    if (G.time - (G.lastBlockAt || -99) < 14) return;
    G.lastBlockAt = G.time;
    var rx = CB.nearestRoadX(G.player.x + CB.rng.range(-500, 500));
    var ry = CB.nearestRoadY(G.player.y + CB.rng.range(-500, 500));
    var horiz = CB.rng.chance(0.5);
    for (var i = -1; i <= 1; i++) {
      var car = CB.makeCar(horiz ? rx : rx + i * 40, horiz ? ry + i * 40 : ry, horiz ? Math.PI / 2 : 0, { kind: 'police', color: '#e8e8f0', hp: 150, parked: true });
      car.name = 'CBPD Roadblock'; car.roadblock = true;
      G.roadblocks.push(car); G.police.push(car);
    }
    CB.toast(G, 'Roadblock ahead!', 'heat');
  }

  CB.updatePolice = function (G, dt) {
    var p = G.player;
    var px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    // Who can see the player right now?
    var seenNow = false;
    for (var i = 0; i < G.police.length; i++) {
      var c = G.police[i];
      var d = Math.hypot(c.x - px, c.y - py);
      c.seesPlayer = d <= CFG.SEEN_RADIUS && CB.hasLOS(G, c.x, c.y, px, py);
      if (c.seesPlayer) seenNow = true;
    }
    if (seenNow) {
      G.lastSeenX = px; G.lastSeenY = py; G.lastSeenAt = G.time;
      G.hiddenT = 0;
    } else if (G.wanted > 0) {
      G.hiddenT += dt;
    }
    // Heat decays only while hidden and once every cruiser has quit.
    if (G.wanted > 0 && !seenNow) {
      if (G.heatHoldT > 0) G.heatHoldT -= dt;
      else if (G.hiddenT > 2.5) {
        G.decayT = (G.decayT || 0) + dt;
        if (G.decayT >= CFG.HEAT_DECAY) { G.decayT = 0; CB.addWanted(G, -1); if (G.wanted === 0) CB.toast(G, 'You lost the heat.', 'good'); }
      }
    } else { G.decayT = 0; }
    // Top up / trim the pursuit.
    var active = G.police.filter(function (c) { return !c.roadblock; });
    if (active.length < desiredPolice(G)) { G.spawnT = (G.spawnT || 0) - dt; if (G.spawnT <= 0) { G.spawnT = 1.4; spawnCruiser(G); } }
    maybeRoadblock(G);
    if (G.wanted === 0 && G.police.length) {
      G.police.length = 0; G.roadblocks.length = 0; CB.sirenStop();
    }
    if (G.police.length) CB.sirenStart(); else CB.sirenStop();

    for (var j = G.police.length - 1; j >= 0; j--) {
      var car = G.police[j];
      if (car.roadblock) continue;
      if (car.hp <= 0) { G.police.splice(j, 1); continue; }
      if (car.seesPlayer) { car.lastSeenX = px; car.lastSeenY = py; car.unseenT = 0; }
      else car.unseenT += dt;
      // Give up: no sighting for 8s and not close to the last known spot.
      if (G.wanted === 0 || (car.unseenT > CFG.POLICE_GIVE_UP && Math.hypot(car.x - px, car.y - py) > 320)) {
        G.police.splice(j, 1); continue;
      }
      var tx = car.lastSeenX, ty = car.lastSeenY;
      if (car.unseenT > 2.5) { // search pattern around last known
        tx += Math.cos(G.time * 0.5 + j * 2.1) * 150;
        ty += Math.sin(G.time * 0.4 + j * 1.7) * 150;
      }
      var want = Math.atan2(ty - car.y, tx - car.x);
      car.angle = CB.angleLerp(car.angle, want, Math.min(1, dt * 2.4));
      var distT = Math.hypot(tx - car.x, ty - car.y);
      var topSpeed = G.wanted >= 4 ? 400 : 355;
      var wantSpeed = distT > 60 ? topSpeed : 60;
      // Anti-stuck: if barely moving while trying, back up briefly.
      var moved = Math.hypot(car.x - (car.px || car.x), car.y - (car.py || car.y));
      car.px = car.x; car.py = car.y;
      if (wantSpeed > 60 && moved < 12 * dt) { car.stuckT += dt; if (car.stuckT > 0.9) { car.speed = -150; car.stuckT = -0.5; } }
      else if (car.stuckT < 0) car.stuckT += dt;
      if (car.stuckT >= 0) car.speed += Math.max(-300 * dt, Math.min(240 * dt, wantSpeed - car.speed));
      var nx = car.x + Math.cos(car.angle) * car.speed * dt;
      var ny = car.y + Math.sin(car.angle) * car.speed * dt;
      CB.moveCar(G, car, nx, ny, false);
      // BUSTED: a cruiser alongside a slow or on-foot player, seeing them.
      if (car.seesPlayer) {
        var pd = Math.hypot(car.x - px, car.y - py);
        var pSpeed = p.car ? Math.abs(p.car.speed) : 0;
        if (pd < 54 && pSpeed < 26) {
          G.bustT += dt;
          if (G.bustT > 1.6) { CB.onBusted(G); return; }
        }
      }
    }
    if (!G.police.some(function (c) { return c.seesPlayer; })) G.bustT = Math.max(0, G.bustT - dt * 1.5);
  };

  CB.onBusted = function (G) {
    if (G.screen !== 'playing') return;
    G.screen = 'busted';
    G.cash = Math.max(0, G.cash - 150);
    CB.setWanted(G, 0); G.police.length = 0; G.roadblocks.length = 0;
    CB.sfx.bust(); CB.sirenStop();
    CB.saveGame(G);
  };
  CB.onWasted = function (G) {
    if (G.screen !== 'playing') return;
    G.screen = 'wasted';
    CB.sfx.bust(); CB.sirenStop();
    CB.saveGame(G);
  };
  CB.respawn = function (G) {
    G.player.hp = 100; G.player.car = null;
    G.player.x = 600; G.player.y = 480;
    CB.setWanted(G, 0); G.police.length = 0; G.roadblocks.length = 0; G.bustT = 0;
    G.screen = 'playing';
  };
})();
