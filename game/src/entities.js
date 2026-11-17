// entities.js — spawning and updating traffic cars and pedestrians, and
// the rival crew members who fight the player in the pier and finale missions.
import { CAR_COLORS, CAR, WORLD } from './config.js';
import { makeRng, range, rangeInt, pick, clamp, dist2 } from './random.js';
import { makeCar, updateTrafficCar } from './driving.js';
import { nearestRoadX, nearestRoadY, hitsSolid, onPier } from './city.js';

let nextId = 1;
export function nextCarId() { return nextId++; }

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i++) {
    const axis = G.rng() < 0.5 ? 'x' : 'y';
    const road = axis === 'x' ? pick(G.rng, G.city.roadsY) : pick(G.rng, G.city.roadsX);
    const along = axis === 'x'
      ? range(G.rng, 120, WORLD.W - 120) : range(G.rng, 120, WORLD.H - 120);
    const dir = G.rng() < 0.5 ? 1 : -1;
    const car = makeCar({
      id: nextCarId(), kind: 'traffic',
      x: axis === 'x' ? along : road + (G.rng() < 0.5 ? -14 : 14),
      y: axis === 'x' ? road + (G.rng() < 0.5 ? -14 : 14) : along,
      angle: axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      color: pick(G.rng, CAR_COLORS), driver: 'ai',
      axis, road, dir, lane: (G.rng() < 0.5 ? -1 : 1) * 14,
      cruise: range(G.rng, 150, 240),
    });
    car.speed = car.cruise;
    if (!hitsSolid(G.city, car.x, car.y, 26)) G.cars.push(car);
  }
}

export function spawnParked(G) {
  for (const p of G.city.parkedCars) {
    G.cars.push(makeCar({
      id: nextCarId(), kind: 'parked', x: p.x, y: p.y, angle: p.angle,
      color: p.color, driver: 'none',
    }));
  }
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const axis = G.rng() < 0.5 ? 'x' : 'y';
    const road = axis === 'x' ? pick(G.rng, G.city.roadsY) : pick(G.rng, G.city.roadsX);
    const along = range(G.rng, 120, WORLD.W - 120);
    G.peds.push({
      id: i, kind: 'ped',
      x: axis === 'x' ? along : road + WORLD.ROAD_W / 2 + 12,
      y: axis === 'x' ? road + WORLD.ROAD_W / 2 + 12 : along,
      angle: G.rng() * Math.PI * 2,
      speed: range(G.rng, 40, 70), walkPhase: G.rng() * 6,
      state: 'walk', // walk | flee | down | dead
      stateT: 0, hp: 100,
      color: pick(G.rng, ['#e8a0a0', '#a0c8e8', '#c8e8a0', '#e8d0a0', '#d0a0e8', '#a0e8d0']),
      shirt: pick(G.rng, ['#c93a3a', '#3a7ac9', '#5ac93a', '#e8c93a', '#8a3ac9', '#e8e8e8']),
    });
  }
}

// A rival crew member: armed, hostile, part of a mission.
export function spawnRival(G, x, y) {
  const r = {
    id: 1000 + G.peds.length, kind: 'rival',
    x, y, angle: G.rng() * Math.PI * 2,
    speed: 90, walkPhase: 0, state: 'fight', stateT: 0, hp: 100,
    color: '#e8c0a0', shirt: '#222222', fireCd: range(G.rng, 0.5, 1.5),
  };
  G.peds.push(r);
  return r;
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    updateTrafficCar(G, car, dt);
  }
  // Keep traffic topped up near the player so the streets never feel empty.
  const near = G.cars.filter((c) => c.kind === 'traffic').length;
  if (near < 18 && G.time - (G.lastTrafficTopUp || 0) > 4) {
    G.lastTrafficTopUp = G.time;
    spawnTraffic(G, 3);
  }
}

export function updatePeds(G, dt) {
  const px = G.player.x, py = G.player.y;
  for (const p of G.peds) {
    p.walkPhase += dt * (p.state === 'flee' ? 14 : 7);
    if (p.state === 'down') {
      p.stateT -= dt;
      if (p.stateT <= 0) { p.state = 'walk'; p.hp = 60; }
      continue;
    }
    if (p.kind === 'rival') { updateRival(G, p, dt); continue; }
    const d2 = dist2(p.x, p.y, px, py);
    const crimeNear = G.lastCrimeAt !== null && G.time - G.lastCrimeAt < 4 && d2 < 260 * 260;
    if (crimeNear && p.state !== 'flee') { p.state = 'flee'; p.stateT = 3; }
    if (p.state === 'flee') {
      p.stateT -= dt;
      const a = Math.atan2(p.y - py, p.x - px);
      p.angle = a;
      const sp = 150;
      p.x += Math.cos(a) * sp * dt;
      p.y += Math.sin(a) * sp * dt;
      if (p.stateT <= 0) p.state = 'walk';
    } else {
      // Stroll along the sidewalk; drift back onto a road edge if pushed off.
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      if (G.rng() < 0.002) p.angle += (G.rng() - 0.5) * 1.6;
      if (p.x < 80 || p.x > WORLD.W - 80 || p.y < 80 || p.y > WORLD.H - 80) {
        p.angle += Math.PI;
      }
      // Stay near roads: if far from any road, turn toward the nearest one.
      const rx = nearestRoadX(G.city, p.x), ry = nearestRoadY(G.city, p.y);
      const nearRoad = Math.min(Math.abs(p.x - rx), Math.abs(p.y - ry));
      if (nearRoad > 90 && G.rng() < 0.02) {
        p.angle = Math.abs(p.x - rx) < Math.abs(p.y - ry)
          ? (p.x < rx ? 0 : Math.PI)
          : (p.y < ry ? Math.PI / 2 : -Math.PI / 2);
      }
    }
    p.x = clamp(p.x, 40, WORLD.W - 40);
    p.y = clamp(p.y, 40, WORLD.H - 40);
    if (hitsSolid(G.city, p.x, p.y, 10)) {
      p.angle += Math.PI / 2;
      p.x = clamp(p.x, 40, WORLD.W - 40);
      p.y = clamp(p.y, 40, WORLD.H - 40);
    }
  }
  // A car hitting a pedestrian knocks them down and is a witnessed crime.
  const playerCar = G.player.car;
  if (playerCar && playerCar.speed > 120) {
    for (const p of G.peds) {
      if (p.state === 'down' || p.kind === 'rival') continue;
      if (dist2(p.x, p.y, playerCar.x, playerCar.y) < 26 * 26) {
        p.state = 'down'; p.stateT = 4; p.hp = 40;
        G.particles.push({ kind: 'smoke', x: p.x, y: p.y, vx: 0, vy: -20, life: 0.7, t: 0, size: 10 });
        if (typeof G.onCrime === 'function') G.onCrime('hit-and-run', 1, p.x, p.y);
      }
    }
  }
}

// Rivals fight: approach the player to medium range, then shoot.
function updateRival(G, r, dt) {
  const px = G.player.x, py = G.player.y;
  const d = Math.hypot(px - r.x, py - r.y);
  r.angle = Math.atan2(py - r.y, px - r.x);
  if (d > 260) {
    r.x += Math.cos(r.angle) * r.speed * dt;
    r.y += Math.sin(r.angle) * r.speed * dt;
  } else if (d < 120) {
    r.x -= Math.cos(r.angle) * r.speed * 0.5 * dt;
    r.y -= Math.sin(r.angle) * r.speed * 0.5 * dt;
  }
  r.fireCd -= dt;
  if (r.fireCd <= 0 && d < 420) {
    r.fireCd = range(G.rng, 0.7, 1.4);
    const spread = (G.rng() - 0.5) * 0.35;
    G.bullets.push({
      x: r.x + Math.cos(r.angle) * 20, y: r.y + Math.sin(r.angle) * 20,
      vx: Math.cos(r.angle + spread) * 640, vy: Math.sin(r.angle + spread) * 640,
      from: 'rival', damage: 9, life: 1.2, t: 0,
    });
    G.particles.push({ kind: 'flash', x: r.x + Math.cos(r.angle) * 22, y: r.y + Math.sin(r.angle) * 22, vx: 0, vy: 0, life: 0.08, t: 0, size: 9 });
    if (typeof G.onShot === 'function') G.onShot(r.x, r.y);
  }
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.t += dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (hitsSolid(G.city, b.x, b.y, 2)) { b.t = b.life; G.particles.push({ kind: 'spark', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, t: 0, size: 3 }); }
  }
  // Bullet hits.
  for (const b of G.bullets) {
    if (b.t >= b.life) continue;
    if (b.from === 'player') {
      for (const p of G.peds) {
        if (p.kind !== 'rival' || p.state === 'down') continue;
        if (dist2(p.x, p.y, b.x, b.y) < 18 * 18) {
          p.hp -= b.damage;
          b.t = b.life;
          G.particles.push({ kind: 'flash', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.12, t: 0, size: 8 });
          if (p.hp <= 0) { p.state = 'down'; p.stateT = 9999; }
        }
      }
      for (const car of G.cars) {
        if (car.kind === 'police' && dist2(car.x, car.y, b.x, b.y) < 24 * 24) {
          car.hp -= b.damage; b.t = b.life;
          if (car.hp <= 0) { car.kind = 'traffic'; car.driver = 'none'; }
        }
      }
    } else if (b.from === 'rival') {
      const p = G.player;
      if (!p.car && dist2(p.x, p.y, b.x, b.y) < 16 * 16) {
        p.health -= b.damage; b.t = b.life;
        p.hurtFlash = 0.25;
        if (typeof G.onPlayerHurt === 'function') G.onPlayerHurt();
      } else if (p.car && dist2(p.car.x, p.car.y, b.x, b.y) < 26 * 26) {
        p.car.hp -= b.damage; b.t = b.life;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.t < b.life && b.x > 0 && b.x < WORLD.W && b.y > 0 && b.y < WORLD.H);
}
