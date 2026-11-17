// Cielo Bay — missions.js: the five-job chain from fixer Mara Voss.
// Each mission is a small state machine — a briefing on the phone, an
// objective on the HUD and the minimap, and a cash + respect payout.
// After the fifth, Cielo Bay is free roam.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  var MISSIONS = [
    { title: 'Lift the Comet', giver: 'Mara Voss',
      brief: 'Mara: There is a red Comet parked on Marina Blvd. Lift it and bring it to my chop shop on Solano Ave. Quietly, if you can.',
      objective: 'Steal the marked Comet' },
    { title: 'Sunset Courier', giver: 'Mara Voss',
      brief: 'Mara: Four drops, one timer. Hit every checkpoint before the clock dies and the package is yours to keep. Drive like you mean it.',
      objective: 'Hit all 4 courier checkpoints' },
    { title: 'Lose the Heat', giver: 'Mara Voss',
      brief: 'Mara: You are hot — three stars and every cruiser in the bay. Survive the chase, then go dark until the heat is gone.',
      objective: 'Survive the chase, then lose the heat' },
    { title: 'Take Back the Pier', giver: 'Mara Voss',
      brief: 'Mara: The Vipers hold the pier and they are taxing my runners. Clear them out. Pistol work — watch the crossfire.',
      objective: 'Clear the rivals off the pier' },
    { title: 'The Armored Van', giver: 'Mara Voss',
      brief: 'Mara: The big one. An armored van sits at the port. Take it, eat the four stars, and bring it to the chop shop. This buys your name.',
      objective: 'Take the armored van to the chop shop' }
  ];

  function startMission(G, index) {
    var m = MISSIONS[index];
    if (!m) { G.mission = 5; G.freeRoam = true; return; }
    G.mission = index;
    var S = G.missionState = { index: index, phase: 'active', timer: 0, checkIndex: 0, surviveT: 0, hadThree: false };
    CB.Audio.phone();
    CB.toast(G, m.giver + ': ' + m.brief, 7);
    CB.toast(G, 'NEW JOB — ' + m.title, 4);
    if (index === 0) setupLift(G, S);
    if (index === 1) setupCourier(G, S);
    if (index === 2) setupChase(G, S);
    if (index === 3) setupPier(G, S);
    if (index === 4) setupVan(G, S);
    CB.Save.write(G);
  }

  function setupLift(G, S) {
    // The marked Comet: a red sport car parked on Marina Blvd.
    var car = CB.makeCar(G, { x: G.city.missionCar.x, y: G.city.missionCar.y, angle: -Math.PI / 2,
      model: 'sport', color: '#d83a2e', missionTarget: true });
    G.cars.push(car);
    S.targetCar = car;
    S.phase = 'steal';
  }
  function setupCourier(G, S) {
    S.timer = CB.CFG.COURIER_TIME;
    S.checkIndex = 0;
    S.phase = 'courier';
  }
  function setupChase(G, S) {
    // The heat is scripted on: three stars, cruisers already rolling.
    CB.addCrime(G, 120);
    S.surviveT = CB.CFG.CHASE_SURVIVE_SECS;
    S.hadThree = true;
    S.phase = 'survive';
  }
  function setupPier(G, S) {
    // Four rivals hold the pier, pistols out.
    var spots = [
      { x: 3010, y: 990 }, { x: 3080, y: 1010 },
      { x: 3140, y: 985 }, { x: 2980, y: 1020 }
    ];
    spots.forEach(function (s, i) {
      G.rivals.push({ x: s.x, y: s.y, hp: 100, angle: Math.PI, state: 'fight',
        shootT: 1 + i * 0.7, flash: 0, seed: i });
    });
    S.phase = 'clear';
  }
  function setupVan(G, S) {
    S.phase = 'take';
  }

  // Hooks the player module calls when a mission car is taken.
  function onMissionCarTaken(G, car) {
    var S = G.missionState;
    if (G.mission === 0 && S && S.phase === 'steal' && car === S.targetCar) {
      S.phase = 'deliver';
      CB.toast(G, 'Got it. Now bring it to the chop shop on Solano Ave.', 4);
    }
  }
  function onMissionVanTaken(G, car) {
    var S = G.missionState;
    if (G.mission === 4 && S && S.phase === 'take' && car.missionVan) {
      S.phase = 'deliver';
      CB.addCrime(G, 180);
      CB.toast(G, 'Four stars! Lose them or outrun them — deliver the van!', 4);
    }
  }

  CB.MISSIONS = MISSIONS;
  CB.startMission = startMission;
  CB.onMissionCarTaken = onMissionCarTaken;
  CB.onMissionVanTaken = onMissionVanTaken;

  function updateMissions(G, dt) {
    var S = G.missionState;
    if (!S || G.mission >= 5) return;
    var shop = G.city.chopShop;
    if (G.mission === 0) {
      if (S.phase === 'deliver' && G.player.car === S.targetCar) {
        if (Math.hypot(G.player.x - shop.x, G.player.y - shop.y) < shop.r) completeMission(G);
      }
    } else if (G.mission === 1) {
      S.timer -= dt;
      if (S.timer <= 0) {
        CB.toast(G, 'Courier failed — the clock died. Mara gives you one more shot.', 4);
        startMission(G, 1);
        return;
      }
      var cp = G.city.courierPoints[S.checkIndex];
      if (cp && Math.hypot(G.player.x - cp.x, G.player.y - cp.y) < 100) {
        S.checkIndex++;
        CB.Audio.pickup();
        CB.toast(G, 'Drop ' + S.checkIndex + ' of 4 — ' + cp.name, 2.5);
        if (S.checkIndex >= G.city.courierPoints.length) completeMission(G);
      }
    } else if (G.mission === 2) {
      if (S.phase === 'survive') {
        S.surviveT -= dt;
        if (S.surviveT <= 0) {
          S.phase = 'cool';
          CB.toast(G, 'You lived. Now go dark until the heat is gone.', 4);
        }
      } else if (S.phase === 'cool' && G.wanted === 0) {
        completeMission(G);
      }
    } else if (G.mission === 3) {
      if (G.rivals.length > 0 && G.rivals.every(function (r) { return r.hp <= 0; })) completeMission(G);
    } else if (G.mission === 4) {
      if (S.phase === 'deliver' && G.player.car && G.player.car.missionVan) {
        if (Math.hypot(G.player.x - shop.x, G.player.y - shop.y) < shop.r) completeMission(G);
      }
    }
    updateRivals(G, dt);
  }

  // Rivals on the pier shoot at the player when close enough.
  function updateRivals(G, dt) {
    var p = G.player;
    G.rivals.forEach(function (r) {
      if (r.hp <= 0) return;
      r.flash = Math.max(0, (r.flash || 0) - dt);
      var d = Math.hypot(p.x - r.x, p.y - r.y);
      if (d > 560) return;
      r.angle = Math.atan2(p.y - r.y, p.x - r.x);
      // Strafe slowly to keep the fight moving.
      r.x += Math.cos(r.angle + Math.PI / 2) * Math.sin(G.time * 0.7 + r.seed) * 22 * dt;
      r.y += Math.sin(r.angle + Math.PI / 2) * Math.sin(G.time * 0.7 + r.seed) * 22 * dt;
      r.shootT -= dt;
      if (r.shootT <= 0 && d < 520) {
        r.shootT = G.rng.range(0.9, 1.6);
        var a = r.angle + G.rng.range(-0.12, 0.12);
        G.bullets.push({ x: r.x + Math.cos(a) * 20, y: r.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
          life: 520 / 700, dmg: 8, from: 'rival' });
        CB.Audio.rivalShot();
        G.particles.push({ x: r.x + Math.cos(a) * 22, y: r.y + Math.sin(a) * 22,
          vx: 0, vy: 0, life: 0.08, maxLife: 0.08, color: '#ffd27a', size: 7, kind: 'dot' });
      }
    });
  }

  function completeMission(G) {
    var index = G.mission;
    var reward = CB.CFG.MISSION_REWARDS[index] || 0;
    var respect = CB.CFG.MISSION_RESPECT[index] || 0;
    G.cash += reward;
    G.respect += respect;
    G.mission = index + 1;
    G.unlocked = Math.max(G.unlocked, index + 1);
    CB.Audio.missionDone();
    CB.toast(G, 'JOB DONE — ' + MISSIONS[index].title + '  +$' + reward + '  +' + respect + ' respect', 5);
    CB.Save.write(G);
    if (G.mission < 5) {
      setTimeout(function () { if (G.screen === 'playing') startMission(G, G.mission); }, 2500);
    } else {
      G.freeRoam = true;
      CB.toast(G, 'Free roam — Cielo Bay is yours. Mara will call when there is work.', 6);
    }
  }

  function objectiveText(G) {
    if (G.mission >= 5) return 'Free roam — Cielo Bay is yours';
    var S = G.missionState;
    var m = MISSIONS[G.mission];
    if (!S) return m.objective;
    if (G.mission === 0) return S.phase === 'steal' ? 'Steal the marked Comet on Marina Blvd' : 'Deliver the Comet to the chop shop — Solano Ave';
    if (G.mission === 1) return 'Courier: drop ' + (S.checkIndex + 1) + ' of 4 — ' + Math.ceil(S.timer) + 's left';
    if (G.mission === 2) return S.phase === 'survive' ? 'Survive the 3-star chase — ' + Math.ceil(S.surviveT) + 's' : 'Lose the heat — stay out of sight';
    if (G.mission === 3) {
      var left = G.rivals.filter(function (r) { return r.hp > 0; }).length;
      return 'Clear the pier — ' + left + ' rival' + (left === 1 ? '' : 's') + ' left';
    }
    if (G.mission === 4) return S.phase === 'take' ? 'Take the armored van at the port' : 'Deliver the van to the chop shop — 4 stars!';
    return m.objective;
  }

  function missionMarker(G) {
    if (G.mission >= 5) return null;
    var S = G.missionState;
    if (G.mission === 0) return S.phase === 'steal' && S.targetCar ? { x: S.targetCar.x, y: S.targetCar.y } : { x: G.city.chopShop.x, y: G.city.chopShop.y };
    if (G.mission === 1) { var cp = G.city.courierPoints[S.checkIndex]; return cp ? { x: cp.x, y: cp.y } : null; }
    if (G.mission === 2) return null;
    if (G.mission === 3) return { x: G.city.pierMeet.x, y: G.city.pierMeet.y };
    if (G.mission === 4) return S.phase === 'take' ? { x: G.city.vanSpawn.x, y: G.city.vanSpawn.y } : { x: G.city.chopShop.x, y: G.city.chopShop.y };
    return null;
  }

  // Debug jump used by the playtest driver: restart cleanly at a mission.
  function setMission(G, index) {
    G.rivals = [];
    G.missionState = null;
    startMission(G, index);
  }

  CB.updateMissions = updateMissions;
  CB.completeMission = completeMission;
  CB.objectiveText = objectiveText;
  CB.missionMarker = missionMarker;
  CB.setMission = setMission;
})();
