// Cielo Bay — missions.js: Mara Voss and her five jobs. Phone-style
// briefings, minimap markers, cash + respect, and a chain that only
// ever starts the next job once.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var CFG = CB.CFG;

  CB.MISSIONS = [
    { title: 'Lift the Comet', giver: 'Mara Voss', reward: 500, respect: 10,
      brief: 'A silver Comet is parked off Palmera St. Lift it, bring it to my chop shop at the Port. Quiet hands, quick feet.' },
    { title: 'Courier Run', giver: 'Mara Voss', reward: 750, respect: 12,
      brief: 'Four drops across the bay, clock is running. Hit every checkpoint before the timer dies.' },
    { title: 'Heat Test', giver: 'Mara Voss', reward: 900, respect: 15,
      brief: 'I need to know you can shake the PD. Survive a three-star chase, then lose the heat completely.' },
    { title: 'Pier Pressure', giver: 'Mara Voss', reward: 1200, respect: 20,
      brief: 'The Vipers are holding my pier at the marina. Clear every last one of them off it.' },
    { title: 'The Armored Van', giver: 'Mara Voss', reward: 2500, respect: 35,
      brief: 'Finale. An armored van sits at the Port depot. Take it, survive the heat, deliver it to the shop.' }
  ];

  CB.startMission = function (G, idx) {
    if (idx >= CB.MISSIONS.length) { G.missionState = null; return; }
    G.missionIndex = idx;
    G.pendingNext = null;
    var m = CB.MISSIONS[idx];
    var ms = { idx: idx, phase: 'start', t: 0, timer: 0, cpIndex: 0, surviveT: 0 };
    G.missionState = ms;
    if (idx === 0) setupSteal(G, ms);
    else if (idx === 1) setupCourier(G, ms);
    else if (idx === 2) setupChase(G, ms);
    else if (idx === 3) setupPier(G, ms);
    else if (idx === 4) setupVan(G, ms);
    CB.toast(G, m.giver + ': ' + m.brief, 'phone');
    CB.sfx.phone();
    CB.saveGame(G);
  };

  function setupSteal(G, ms) {
    ms.phase = 'steal';
    if (!G.markedCar || G.markedCar.hp <= 0) {
      G.markedCar = CB.makeCar(1000, 760, 0, { parked: true, driver: false, marked: true, color: '#c0c6ce', name: 'Comet' });
      G.cars.push(G.markedCar);
    }
    ms.target = G.markedCar;
  }
  function setupCourier(G, ms) {
    ms.phase = 'run'; ms.timer = 150;
    ms.checkpoints = [
      { x: 1400, y: 600, name: 'Sunset Strip drop' },
      { x: 2200, y: 1000, name: 'Calle Brisa drop' },
      { x: 1800, y: 1800, name: 'Tidewater drop' },
      { x: 600, y: 1400, name: 'Ember Row drop' }
    ];
  }
  function setupChase(G, ms) {
    ms.phase = 'survive'; ms.surviveT = 45;
    CB.setWanted(G, 3); // exactly three stars — never more
    G.lastSeenX = G.player.x; G.lastSeenY = G.player.y; G.lastSeenAt = G.time;
  }
  function setupPier(G, ms) {
    ms.phase = 'clear';
    G.rivals = [];
    var spots = [[3060, 950], [3160, 1040], [3260, 960], [3180, 1000]];
    for (var i = 0; i < spots.length; i++) {
      var r = CB.makePed(spots[i][0], spots[i][1], { rival: true, hp: 45, color: '#8e44ad', name: 'Viper' });
      G.rivals.push(r); G.peds.push(r);
    }
  }
  function setupVan(G, ms) {
    ms.phase = 'take';
    if (!G.van || G.van.hp <= 0) {
      G.van = CB.makeCar(3050, 1650, Math.PI, { parked: true, driver: false, armored: true, color: CB.PALETTE.van, name: 'Armored Van', hp: 320, w: 58, h: 28 });
      G.cars.push(G.van);
    }
    ms.target = G.van;
  }

  CB.onMissionCarTaken = function (G, car) {
    var ms = G.missionState;
    if (!ms) return;
    if (ms.idx === 0 && car === G.markedCar && ms.phase === 'steal') {
      ms.phase = 'deliver';
      CB.toast(G, 'Got it. Now deliver it to the chop shop.', 'phone');
      CB.addWanted(G, 1);
    }
    if (ms.idx === 4 && car === G.van && ms.phase === 'take') {
      ms.phase = 'deliver';
      if (G.wanted < 4) CB.setWanted(G, 4); // the van always draws at least 4 stars
      G.lastSeenX = G.player.x; G.lastSeenY = G.player.y; G.lastSeenAt = G.time;
      CB.toast(G, 'The whole PD just woke up. Deliver the van!', 'heat');
    }
  };

  CB.onRivalDown = function (G, rival) {
    CB.toast(G, 'Viper down.', 'good');
    CB.reportCrime(G, 'shots', G.player.x, G.player.y);
  };

  function completeMission(G) {
    var ms = G.missionState, m = CB.MISSIONS[ms.idx];
    G.cash += m.reward; G.respect += m.respect;
    CB.sfx.cash();
    CB.toast(G, 'JOB DONE  +$' + m.reward + '  +' + m.respect + ' respect', 'good');
    G.missionIndex = ms.idx + 1;
    G.missionState = null;
    // The next job is offered 2.5s later — and ONLY if it has not
    // already begun (a debug start or a fast player must not be reset).
    G.pendingNext = { idx: G.missionIndex, at: G.time + 2.5 };
    CB.saveGame(G);
  }
  CB.completeMission = completeMission;

  CB.missionTargetPos = function (G) {
    var ms = G.missionState;
    if (!ms) return null;
    if (ms.idx === 0) return ms.phase === 'steal' ? { x: G.markedCar.x, y: G.markedCar.y } : { x: G.city.chopShop.x, y: G.city.chopShop.y };
    if (ms.idx === 1) { var cp = ms.checkpoints[ms.cpIndex]; return cp ? { x: cp.x, y: cp.y } : null; }
    if (ms.idx === 3) { var alive = G.rivals.filter(function (r) { return r.hp > 0; }); return alive.length ? { x: alive[0].x, y: alive[0].y } : { x: 3100, y: 1000 }; }
    if (ms.idx === 4) return ms.phase === 'take' ? { x: G.van.x, y: G.van.y } : { x: G.city.chopShop.x, y: G.city.chopShop.y };
    return null;
  };

  CB.missionObjective = function (G) {
    var ms = G.missionState;
    if (!ms) return G.missionIndex >= 5 ? 'Free roam — Cielo Bay is yours.' : 'Waiting for Mara\'s next call…';
    var m = CB.MISSIONS[ms.idx];
    if (ms.idx === 0) return ms.phase === 'steal' ? 'Steal the marked Comet' : 'Deliver the Comet to the chop shop';
    if (ms.idx === 1) return 'Courier: checkpoint ' + (ms.cpIndex + 1) + ' of 4 — ' + Math.max(0, Math.ceil(ms.timer)) + 's left';
    if (ms.idx === 2) return ms.phase === 'survive' ? 'Survive the chase — ' + Math.max(0, Math.ceil(ms.surviveT)) + 's' : 'Lose the heat completely';
    if (ms.idx === 3) { var n = G.rivals.filter(function (r) { return r.hp > 0; }).length; return 'Clear the pier — ' + n + ' Vipers left'; }
    if (ms.idx === 4) return ms.phase === 'take' ? 'Take the armored van at the Port' : 'Deliver the van to the chop shop';
    return m.title;
  };

  CB.updateMissions = function (G, dt) {
    // Fire a scheduled next job only when nothing has started it yet.
    if (G.pendingNext && G.time >= G.pendingNext.at) {
      var want = G.pendingNext.idx;
      G.pendingNext = null;
      if (!G.missionState && G.missionIndex === want && want < 5 && G.screen === 'playing') CB.startMission(G, want);
    }
    var ms = G.missionState;
    if (!ms) return;
    ms.t += dt;
    var px = G.player.car ? G.player.car.x : G.player.x;
    var py = G.player.car ? G.player.car.y : G.player.y;
    if (ms.idx === 0 && ms.phase === 'deliver') {
      if (G.player.car === G.markedCar && Math.hypot(px - G.city.chopShop.x, py - G.city.chopShop.y) < G.city.chopShop.r) completeMission(G);
    } else if (ms.idx === 1 && ms.phase === 'run') {
      ms.timer -= dt;
      if (ms.timer <= 0) { CB.toast(G, 'Too slow — Mara reschedules the run.', 'heat'); setupCourier(G, ms); }
      var cp = ms.checkpoints[ms.cpIndex];
      if (cp && Math.hypot(px - cp.x, py - cp.y) < 64) {
        CB.sfx.pickup(); ms.cpIndex++;
        if (ms.cpIndex >= ms.checkpoints.length) completeMission(G);
        else CB.toast(G, 'Drop made. Next checkpoint!', 'good');
      }
    } else if (ms.idx === 2) {
      if (ms.phase === 'survive') {
        if (G.wanted > 0) ms.surviveT -= dt;
        if (ms.surviveT <= 0) { ms.phase = 'cool'; CB.toast(G, 'You survived. Now vanish.', 'phone'); }
      } else if (ms.phase === 'cool' && G.wanted === 0 && G.police.length === 0) {
        completeMission(G);
      }
    } else if (ms.idx === 3 && ms.phase === 'clear') {
      if (G.rivals.length && G.rivals.every(function (r) { return r.hp <= 0; })) completeMission(G);
    } else if (ms.idx === 4 && ms.phase === 'deliver') {
      if (G.player.car === G.van && Math.hypot(px - G.city.chopShop.x, py - G.city.chopShop.y) < G.city.chopShop.r) completeMission(G);
    }
  };
})();
