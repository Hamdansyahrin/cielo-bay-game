// shots.js — deterministic ?shot= scene posing for the screenshots.
// Each scene sets up a busy frame (HUD + minimap + wanted + objective) and
// then the game sets window.__shot = "ready" once a frame has been drawn.
import { makeCar } from './driving.js';
import { spawnRival, nextCarId } from './entities.js';

export const SHOT_QUERIES = {
  cover: '?shot=cover&seed=1',
  drive: '?shot=drive&seed=1',
  chase: '?shot=chase&seed=1',
  mission: '?shot=mission&seed=1',
};

export function poseShot(G, name) {
  const p = G.player;
  // A fixed seed keeps every shot reproducible.
  G.rng = (function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })(1);
  G.screen = 'playing';
  G.time = 12;

  if (name === 'cover') {
    // Downtown on foot, traffic + pedestrians + minimap + mission 1 objective.
    p.x = 600; p.y = 660; p.onFoot = true; p.car = null;
    p.aimAngle = -Math.PI / 2;
    G.missions.index = 0; G.missions.phase = 'active';
    G.missions.marker = { x: 1000, y: 940, label: 'Marked coupe' };
    G.banner('The Lift', "Mara Voss: There's a coral coupe parked by Solano Plaza. Lift it.", 8);
    placeTrafficNear(G, 600, 660, 8);
    placePedsNear(G, 600, 660, 8);
  } else if (name === 'drive') {
    // Driving the beachfront road, sunset water on the right.
    const car = makeCar({ id: nextCarId(), kind: 'player', x: 2600, y: 1300, angle: -Math.PI / 2, color: '#c93a3a', driver: 'player' });
    car.speed = 380; car.vx = 0; car.vy = -380;
    G.cars.push(car);
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
    G.missions.index = 1; G.missions.phase = 'active';
    G.missions.checkpoints = [{ x: 2600, y: 600, r: 70 }];
    G.missions.checkpointIndex = 0; G.missions.timer = 45;
    G.missions.marker = { x: 2600, y: 600, label: 'Checkpoint 1' };
    G.banner('Hot Courier', 'Checkpoint 1 of 4 — 45s left. The tide is turning.', 8);
    placeTrafficNear(G, 2600, 1300, 6);
    placePedsNear(G, 2600, 1300, 4);
  } else if (name === 'chase') {
    // Police pursuit at 3 stars, objective banner up.
    const car = makeCar({ id: nextCarId(), kind: 'player', x: 1400, y: 1400, angle: 0, color: '#3a7ac9', driver: 'player' });
    car.speed = 420; car.vx = 420; car.vy = 0;
    G.cars.push(car);
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
    G.wanted = 3;
    G.missions.index = 2; G.missions.phase = 'active';
    G.missions.timer = 42;
    G.missions.marker = null;
    G.banner('Cooling Off', 'Three stars. Lose the heat — get to 0 stars.', 8);
    for (let i = 0; i < 3; i++) {
      const pc = makeCar({
        id: nextCarId(), kind: 'police',
        x: 1400 - 180 - i * 90, y: 1400 + (i - 1) * 50, angle: 0,
        color: '#2a4a8a', driver: 'ai', axis: 'x', road: 1400, dir: 1, lane: 14, cruise: 420,
      });
      pc.speed = 420; pc.blinker = i * 2;
      G.cars.push(pc);
    }
    placeTrafficNear(G, 1400, 1400, 4);
  } else if (name === 'mission') {
    // The pier mission: rivals holding Lantern Pier, player aiming in.
    p.x = 2760; p.y = 1000; p.onFoot = true; p.car = null;
    p.aimAngle = 0;
    G.missions.index = 3; G.missions.phase = 'active';
    G.missions.rivalsLeft = 3;
    G.missions.marker = { x: 3000, y: 1000, label: 'Lantern Pier' };
    G.banner('Pier Claim', 'Clear the rivals on Lantern Pier. They shoot back.', 8);
    const pier = G.city.pier;
    spawnRival(G, pier.x0 + 140, pier.y0 + 30);
    spawnRival(G, pier.x0 + 260, pier.y1 - 30);
    spawnRival(G, pier.x1 - 80, (pier.y0 + pier.y1) / 2);
    placeTrafficNear(G, 2600, 1000, 3);
  }
  // Camera on the player, a beat of simulation so the frame is alive.
  G.camera.x = p.x; G.camera.y = p.y;
  for (let i = 0; i < 12; i++) G.tick(1 / 60, true);
}

function placeTrafficNear(G, cx, cy, n) {
  const roads = G.city.roadsX.concat(G.city.roadsY);
  for (let i = 0; i < n; i++) {
    const axis = G.rng() < 0.5 ? 'x' : 'y';
    const road = axis === 'x' ? G.city.roadsY[Math.floor(G.rng() * G.city.roadsY.length)] : G.city.roadsX[Math.floor(G.rng() * G.city.roadsX.length)];
    const along = axis === 'x' ? cx + (G.rng() - 0.5) * 700 : cy + (G.rng() - 0.5) * 700;
    const car = makeCar({
      id: nextCarId(), kind: 'traffic',
      x: axis === 'x' ? along : road + 14,
      y: axis === 'x' ? road + 14 : along,
      angle: axis === 'x' ? 0 : Math.PI / 2,
      color: ['#c93a3a', '#3a7ac9', '#e8c93a', '#e8e8e8', '#5ac93a'][i % 5],
      driver: 'ai', axis, road, dir: 1, lane: 14,
      cruise: 170 + G.rng() * 60,
    });
    car.speed = car.cruise;
    G.cars.push(car);
  }
}

function placePedsNear(G, cx, cy, n) {
  for (let i = 0; i < n; i++) {
    G.peds.push({
      id: 500 + i, kind: 'ped',
      x: cx + (G.rng() - 0.5) * 500, y: cy + (G.rng() - 0.5) * 400,
      angle: G.rng() * Math.PI * 2, speed: 50, walkPhase: G.rng() * 6,
      state: 'walk', stateT: 0, hp: 100,
      color: '#e8c0a0', shirt: ['#c93a3a', '#3a7ac9', '#5ac93a', '#e8c93a'][i % 4],
    });
  }
}
