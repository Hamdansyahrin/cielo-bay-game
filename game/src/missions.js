// missions.js — the five-mission chain from fixer Mara Voss, with phone-style
// briefings, minimap markers, timers, checkpoints and cash + respect rewards.
import { MISSIONS, WORLD } from './config.js';
import { makeCar, updateTrafficCar } from './driving.js';
import { spawnRival, nextCarId } from './entities.js';
import { dist2, clamp } from './random.js';
import { nearestRoadX, nearestRoadY } from './city.js';

export function makeMissionState() {
  return {
    index: 0,           // which mission is current (0-4); 5 = all done, free roam
    phase: 'briefing',  // briefing | active | deliver | done
    targetCar: null,
    checkpoints: [],
    checkpointIndex: 0,
    timer: 0,
    rivalsLeft: 0,
    marker: null,       // {x, y, label} for the minimap + HUD
    banner: null,
    completedCount: 0,
  };
}

export function currentMission(G) {
  return G.missions.index < MISSIONS.length ? MISSIONS[G.missions.index] : null;
}

export function missionObjectiveText(G) {
  const m = currentMission(G);
  if (!m) return 'Free roam — Cielo Bay is yours';
  const ms = G.missions;
  if (ms.index === 0 && ms.phase === 'deliver') return m.deliverObjective;
  if (ms.index === 4 && ms.phase === 'deliver') return m.deliverObjective;
  if (ms.index === 1 && ms.checkpoints.length > 0) {
    return `Checkpoint ${ms.checkpointIndex + 1} of ${ms.checkpoints.length} — ${Math.ceil(ms.timer)}s left`;
  }
  if (ms.index === 3) return `${m.objective} (${ms.rivalsLeft} left)`;
  return m.objective;
}

export function startMission(G, index) {
  const m = MISSIONS[index];
  const ms = G.missions;
  ms.index = index;
  ms.phase = 'active';
  ms.checkpoints = [];
  ms.checkpointIndex = 0;
  ms.timer = 0;
  ms.rivalsLeft = 0;
  ms.targetCar = null;
  G.phone(m.briefing);
  G.banner(m.name, m.briefing, 5);
  if (index === 0) setupLiftMission(G);
  if (index === 1) setupCourierMission(G);
  if (index === 2) setupHeatMission(G);
  if (index === 3) setupPierMission(G);
  if (index === 4) setupVanMission(G);
}

function setupLiftMission(G) {
  const ms = G.missions;
  const car = makeCar({
    id: nextCarId(), kind: 'mission',
    x: 1000, y: 940, angle: 0,
    color: '#e86a9a', driver: 'none',
  });
  car.missionMark = true;
  G.cars.push(car);
  ms.targetCar = car;
  ms.marker = { x: car.x, y: car.y, label: 'Marked coupe' };
}

function setupCourierMission(G) {
  const ms = G.missions;
  ms.checkpoints = [
    { x: 600, y: 600, r: 70 },
    { x: 2200, y: 1400, r: 70 },
    { x: 2600, y: 2200, r: 70 },
    { x: 1000, y: 1800, r: 70 },
  ];
  ms.checkpointIndex = 0;
  ms.timer = 90;
  ms.marker = { x: ms.checkpoints[0].x, y: ms.checkpoints[0].y, label: 'Checkpoint 1' };
}

function setupHeatMission(G) {
  // Force three stars; the player must survive and lose them.
  G.wanted = 3;
  G.lastCrimeAt = G.time;
  const ms = G.missions;
  ms.timer = 75;
  ms.marker = null;
}

function setupPierMission(G) {
  const ms = G.missions;
  const pier = G.city.pier;
  const spots = [
    { x: pier.x0 + 140, y: pier.y0 + 30 },
    { x: pier.x0 + 260, y: pier.y1 - 30 },
    { x: pier.x1 - 80, y: (pier.y0 + pier.y1) / 2 },
  ];
  for (const s of spots) spawnRival(G, s.x, s.y);
  ms.rivalsLeft = 3;
  ms.marker = { x: (pier.x0 + pier.x1) / 2, y: (pier.y0 + pier.y1) / 2, label: 'Lantern Pier' };
}

function setupVanMission(G) {
  const ms = G.missions;
  const yard = G.city.portYard;
  const van = makeCar({
    id: nextCarId(), kind: 'mission',
    x: yard.x0 + 700, y: yard.y0 + 160, angle: Math.PI / 2,
    color: '#3a3a3a', driver: 'none',
  });
  van.missionMark = true;
  van.armored = true;
  van.hp = 220;
  G.cars.push(van);
  ms.targetCar = van;
  ms.marker = { x: van.x, y: van.y, label: 'Armored van' };
}

export function completeMission(G) {
  const m = currentMission(G);
  if (!m) return;
  const ms = G.missions;
  G.player.cash += m.reward;
  G.player.respect += m.respect;
  ms.completedCount += 1;
  G.toast(`Mission complete: ${m.name} — +$${m.reward}, +${m.respect} respect`);
  G.banner('Mission Complete', `${m.name} — +$${m.reward}  •  +${m.respect} respect`, 4);
  if (typeof G.onMissionComplete === 'function') G.onMissionComplete(m);
  ms.index += 1;
  ms.phase = 'briefing';
  ms.marker = null;
  ms.targetCar = null;
  if (ms.index >= MISSIONS.length) {
    G.banner('Cielo Bay Is Yours', 'All five jobs done. Free roam — faster cars now spawn on the streets.', 6);
    G.phone('Mara Voss: That is the whole set. The bay is yours now, kid. Drive like you own it.');
    return;
  }
  startMission(G, ms.index);
}

export function failMission(G, reason) {
  const m = currentMission(G);
  if (!m) return;
  G.banner('Job Failed', reason, 4);
  G.phone(`Mara Voss: ${reason} Go back and try again — the job is still open.`);
  startMission(G, G.missions.index);
}

// Called when the player enters any car (hook from main.js).
export function onPlayerEnterCar(G, car) {
  const ms = G.missions;
  if (ms.index === 0 && ms.phase === 'active' && car === ms.targetCar) {
    ms.phase = 'deliver';
    ms.marker = { x: G.city.chopShop.x + G.city.chopShop.w / 2, y: G.city.chopShop.y + G.city.chopShop.h / 2, label: 'Rook Auto Yard' };
    G.banner('Got it', 'Now deliver the coupe to Rook Auto Yard — avoid the heat.', 4);
    return;
  }
  if (ms.index === 4 && ms.phase === 'active' && car === ms.targetCar) {
    ms.phase = 'deliver';
    ms.marker = { x: G.city.chopShop.x + G.city.chopShop.w / 2, y: G.city.chopShop.y + G.city.chopShop.h / 2, label: 'Rook Auto Yard' };
    if (typeof G.onCrime === 'function') G.onCrime('armored-van heist', 4, car.x, car.y);
    G.banner('Four stars!', 'The whole bay is coming. Get the van to Rook Auto Yard.', 4);
  }
}

export function updateMissions(G, dt) {
  const ms = G.missions;
  const m = currentMission(G);
  if (!m) return;
  const p = G.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;

  // Deliveries: inside the chop-shop zone while driving the target car.
  if (ms.phase === 'deliver' && p.car && p.car === ms.targetCar) {
    const s = G.city.chopShop;
    if (px > s.x && px < s.x + s.w && py > s.y && py < s.y + s.h) {
      G.cars = G.cars.filter((c) => c !== ms.targetCar);
      if (p.car === ms.targetCar) {
        p.car = null; p.onFoot = true;
        p.x = s.x + s.w / 2; p.y = s.y + s.h + 30;
      }
      completeMission(G);
      return;
    }
  }

  if (ms.index === 1 && ms.phase === 'active') {
    ms.timer -= dt;
    const cp = ms.checkpoints[ms.checkpointIndex];
    if (cp && dist2(px, py, cp.x, cp.y) < cp.r * cp.r) {
      ms.checkpointIndex += 1;
      G.toast(`Checkpoint ${ms.checkpointIndex} of ${ms.checkpoints.length} — nice driving`);
      if (ms.checkpointIndex >= ms.checkpoints.length) { completeMission(G); return; }
      const next = ms.checkpoints[ms.checkpointIndex];
      ms.marker = { x: next.x, y: next.y, label: `Checkpoint ${ms.checkpointIndex + 1}` };
    }
    if (ms.timer <= 0) failMission(G, 'The courier run timed out.');
  }

  if (ms.index === 2 && ms.phase === 'active') {
    ms.timer -= dt;
    if (G.wanted === 0) { completeMission(G); return; }
    if (ms.timer <= 0) failMission(G, 'You stayed too hot for too long.');
  }

  if (ms.index === 3 && ms.phase === 'active') {
    const alive = G.peds.filter((r) => r.kind === 'rival' && r.state !== 'down').length;
    ms.rivalsLeft = alive;
    if (alive === 0) { completeMission(G); return; }
  }

  // Mission 1 fail-safe: if the marked car is destroyed, respawn the job.
  if (ms.index === 0 && ms.phase === 'active' && ms.targetCar && ms.targetCar.hp <= 0) {
    G.cars = G.cars.filter((c) => c !== ms.targetCar);
    failMission(G, 'The marked coupe was wrecked.');
  }
  if (ms.index === 4 && ms.phase === 'active' && ms.targetCar && ms.targetCar.hp <= 0) {
    G.cars = G.cars.filter((c) => c !== ms.targetCar);
    failMission(G, 'The armored van was wrecked.');
  }
}

// Progression: after missions, faster cars spawn in traffic.
export function trafficCruiseFor(G) {
  const done = G.missions.completedCount;
  return 150 + done * 22 + (G.rng() < 0.12 ? 130 : 0);
}
