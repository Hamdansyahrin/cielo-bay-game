// police.js — the wanted level, police spawning and pursuit on the road grid,
// roadblocks at high heat, heat decay, and the BUSTED / WASTED states.
import { WANTED, POLICE_COLOR, GAME, WORLD } from './config.js';
import { makeCar, updatePoliceCar } from './driving.js';
import { dist2, clamp } from './random.js';
import { nearestRoadX, nearestRoadY } from './city.js';
import { nextCarId } from './entities.js';

export function makePoliceState() {
  return {
    wanted: 0,
    hiddenTimer: 0,
    lastCrimeAt: null,
    bustTimer: 0,
    roadblockSpawnedFor: 0,
  };
}

// A crime raises the wanted level (capped at 5) and resets the hide clock.
export function addWanted(G, stars, reason) {
  const before = G.wanted;
  G.wanted = Math.min(WANTED.maxStars, G.wanted + stars);
  G.lastCrimeAt = G.time;
  G.police.hiddenTimer = 0;
  if (G.wanted > before) {
    G.toast(`Wanted level ${'★'.repeat(G.wanted)}${G.wanted < WANTED.maxStars ? '☆'.repeat(WANTED.maxStars - G.wanted) : ''} — ${reason}`);
    if (typeof G.onWantedChange === 'function') G.onWantedChange(G.wanted);
  }
}

export function policeCars(G) {
  return G.cars.filter((c) => c.kind === 'police');
}

function spawnPoliceCar(G, nearPlayer) {
  const city = G.city;
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  // Spawn on a road at the edge of the visible area, on the player's side of town.
  const axis = G.rng() < 0.5 ? 'x' : 'y';
  let x, y, road;
  if (axis === 'x') {
    road = nearestRoadY(city, py);
    x = clamp(px + (G.rng() < 0.5 ? -1 : 1) * 620, 120, WORLD.W - 120);
    y = road + 14;
  } else {
    road = nearestRoadX(city, px);
    x = road + 14;
    y = clamp(py + (G.rng() < 0.5 ? -1 : 1) * 620, 120, WORLD.H - 120);
  }
  const car = makeCar({
    id: nextCarId(), kind: 'police',
    x, y, angle: axis === 'x' ? 0 : Math.PI / 2,
    color: POLICE_COLOR, driver: 'ai',
    axis, road, dir: 1, lane: 14, cruise: 420,
  });
  car.speed = 380;
  G.cars.push(car);
  return car;
}

function spawnRoadblock(G) {
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  const axis = G.rng() < 0.5 ? 'x' : 'y';
  const ahead = 420;
  for (let i = -1; i <= 1; i++) {
    const x = axis === 'x' ? px + ahead : px + i * 52;
    const y = axis === 'x' ? py + i * 52 : py + ahead;
    if (x < 100 || x > WORLD.W - 100 || y < 100 || y > WORLD.H - 100) continue;
    const car = makeCar({
      id: nextCarId(), kind: 'police',
      x, y, angle: axis === 'x' ? Math.PI / 2 : 0,
      color: POLICE_COLOR, driver: 'none',
      axis: axis === 'x' ? 'y' : 'x', road: axis === 'x' ? x : y, dir: 1,
    });
    car.speed = 0;
    car.mode = 'roadblock';
    G.cars.push(car);
  }
  G.toast('Roadblock ahead!');
}

export function updatePolice(G, dt) {
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;

  // Keep the right number of pursuit cars on the road.
  const want = G.wanted > 0 ? Math.min(GAME.policeMax, G.wanted * WANTED.policePerStar) : 0;
  const have = policeCars(G).filter((c) => c.mode !== 'roadblock').length;
  if (have < want && G.time - (G.lastPoliceSpawn || 0) > 1.2) {
    G.lastPoliceSpawn = G.time;
    spawnPoliceCar(G);
  }
  // Roadblocks at 4-5 stars, once per wanted level reached.
  if (G.wanted >= 4 && G.police.roadblockSpawnedFor !== G.wanted) {
    G.police.roadblockSpawnedFor = G.wanted;
    spawnRoadblock(G);
  }
  if (G.wanted === 0) G.police.roadblockSpawnedFor = 0;

  for (const car of policeCars(G)) {
    if (car.mode === 'roadblock') continue;
    updatePoliceCar(G, car, dt);
    // Siren flash timer for the renderer.
    car.blinker += dt * 6;
  }

  // Heat decay: hidden (no police close, no recent crime) for long enough drops a star.
  if (G.wanted > 0) {
    const nearest = policeCars(G).reduce((m, c) => Math.min(m, dist2(c.x, c.y, px, py)), Infinity);
    const hidden = nearest > 520 * 520 && (G.lastCrimeAt === null || G.time - G.lastCrimeAt > 6);
    if (hidden) {
      G.police.hiddenTimer += dt;
      if (G.police.hiddenTimer >= WANTED.decayHiddenSeconds) {
        G.police.hiddenTimer = 0;
        G.wanted -= 1;
        G.toast(G.wanted === 0 ? 'You lost them. The heat is off.' : `Heat dropping — ${G.wanted} star${G.wanted > 1 ? 's' : ''} left.`);
        if (typeof G.onWantedChange === 'function') G.onWantedChange(G.wanted);
      }
    } else {
      G.police.hiddenTimer = 0;
    }
  }

  // BUSTED: a police car sits on the player on foot for a moment.
  if (G.wanted > 0 && G.player.onFoot && G.screen === 'playing') {
    const close = policeCars(G).some((c) => dist2(c.x, c.y, px, py) < WANTED.bustDistance * WANTED.bustDistance);
    if (close) {
      G.police.bustTimer += dt;
      if (G.police.bustTimer >= WANTED.bustHoldSeconds) {
        G.police.bustTimer = 0;
        G.screen = 'busted';
        if (typeof G.onBusted === 'function') G.onBusted();
      }
    } else {
      G.police.bustTimer = 0;
    }
  }

  // Despawn police that are far away once the heat is off.
  if (G.wanted === 0) {
    const before = G.cars.length;
    G.cars = G.cars.filter((c) => {
      if (c.kind !== 'police') return true;
      return dist2(c.x, c.y, px, py) < 900 * 900;
    });
    if (G.cars.length !== before) {
      // leave roadblocks to fade with the heat
    }
  }
}

// WASTED check lives here too: health at zero ends the run.
export function checkWasted(G) {
  if (G.player.health <= 0 && G.screen === 'playing') {
    G.screen = 'wasted';
    if (typeof G.onWasted === 'function') G.onWasted();
  }
}
