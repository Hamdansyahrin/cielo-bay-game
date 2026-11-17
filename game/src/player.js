// player.js — the player on foot (move, run, aim, shoot, melee) and
// entering / exiting any car, including stealing one in view of witnesses.
import { PLAYER, CAR, WORLD } from './config.js';
import { clamp, dist2 } from './random.js';
import { pushOutOfSolids, inWater, onPier } from './city.js';
import { makeCar } from './driving.js';

export function makePlayer(start) {
  return {
    x: start.x, y: start.y, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
    vx: 0, vy: 0, health: PLAYER.health, maxHealth: PLAYER.health,
    cash: 0, respect: 0,
    onFoot: true, car: null,
    fireCd: 0, meleeCd: 0, meleeAnim: 0, hurtFlash: 0,
    runStamina: 1, lastRegenAt: 0,
  };
}

// On-foot update. input: {up,down,left,right,run}, mouse in world coords.
export function updatePlayerOnFoot(G, p, input, mouseWorld, dt) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const running = input.run && len > 0 && p.runStamina > 0.05;
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (running) p.runStamina = Math.max(0, p.runStamina - dt * 0.25);
  else p.runStamina = Math.min(1, p.runStamina + dt * 0.15);
  p.vx = mx * speed; p.vy = my * speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 24, WORLD.W - 24);
  p.y = clamp(p.y, 24, WORLD.H - 24);
  if (inWater(G.city, p.x)) { p.x = G.city.waterX0 - 18; }
  if (len > 0) p.angle = Math.atan2(my, mx);
  p.aimAngle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
  pushOutOfSolids(G.city, p, PLAYER.radius);
  // Slow health regen when out of combat.
  if (G.time - p.lastRegenAt > 1) {
    p.lastRegenAt = G.time;
    if (p.health > 0 && p.health < p.maxHealth && G.wanted === 0) {
      p.health = Math.min(p.maxHealth, p.health + 1.5);
    }
  }
  p.fireCd -= dt; p.meleeCd -= dt; p.meleeAnim -= dt; p.hurtFlash -= dt;
}

// Fire the pistol toward the mouse. Returns true when a shot was fired.
export function playerShoot(G, p, mouseWorld) {
  if (p.fireCd > 0 || p.onFoot === false) return false;
  p.fireCd = PLAYER.fireCooldown;
  const a = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
  p.aimAngle = a;
  G.bullets.push({
    x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
    vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
    from: 'player', damage: PLAYER.bulletDamage, life: 1.1, t: 0,
  });
  G.particles.push({ kind: 'flash', x: p.x + Math.cos(a) * 24, y: p.y + Math.sin(a) * 24, vx: 0, vy: 0, life: 0.07, t: 0, size: 10 });
  if (typeof G.onShot === 'function') G.onShot(p.x, p.y);
  if (typeof G.onCrime === 'function') G.onCrime('shots-fired', 1, p.x, p.y);
  return true;
}

// Melee swing: hits rivals (and peds) in front of the player.
export function playerMelee(G, p) {
  if (p.meleeCd > 0) return false;
  p.meleeCd = 0.45; p.meleeAnim = 0.25;
  let hitAny = false;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < PLAYER.meleeRange + 14) {
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      const diff = Math.abs(((a - p.aimAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < 1.1) {
        ped.hp -= PLAYER.meleeDamage;
        ped.state = ped.kind === 'rival' ? 'fight' : 'down';
        ped.stateT = ped.kind === 'rival' ? 0 : 3;
        if (ped.hp <= 0) { ped.state = 'down'; ped.stateT = 9999; }
        hitAny = true;
        G.particles.push({ kind: 'flash', x: ped.x, y: ped.y, vx: 0, vy: 0, life: 0.12, t: 0, size: 8 });
      }
    }
  }
  return hitAny;
}

// Nearest car the player can enter (within 56px).
export function nearestEnterableCar(G, p) {
  let best = null, bd = 56 * 56;
  for (const car of G.cars) {
    if (car.driver === 'player') continue;
    const d2 = dist2(car.x, car.y, p.x, p.y);
    if (d2 < bd) { bd = d2; best = car; }
  }
  return best;
}

function witnessesNear(G, x, y, radius) {
  let count = 0;
  for (const ped of G.peds) {
    if (ped.state !== 'down' && dist2(ped.x, ped.y, x, y) < radius * radius) count++;
  }
  for (const car of G.cars) {
    if (car.kind === 'traffic' && dist2(car.x, car.y, x, y) < radius * radius) count++;
  }
  return count;
}

// Enter a car. Stealing a parked or traffic car in view of witnesses raises wanted.
export function enterCar(G, p, car) {
  if (!car) return false;
  const wasParked = car.kind === 'parked';
  const wasTraffic = car.kind === 'traffic';
  const stolen = wasParked || wasTraffic;
  if (stolen) {
    const witnesses = witnessesNear(G, car.x, car.y, 320);
    if (witnesses > 0 && typeof G.onCrime === 'function') {
      G.onCrime('car-theft', 1, car.x, car.y);
    }
    G.toast(`You took the ${car.color === '#c93a3a' ? 'red' : 'parked'} car${witnesses > 0 ? ' — someone saw that!' : ''}`);
  }
  car.kind = 'player';
  car.driver = 'player';
  car.vx = 0; car.vy = 0;
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  if (typeof G.onEnterCar === 'function') G.onEnterCar(car);
  return true;
}

// Step out of the car onto the road beside it.
export function exitCar(G, p) {
  const car = p.car;
  if (!car) return false;
  car.kind = 'traffic';
  car.driver = 'ai';
  car.axis = Math.abs(Math.cos(car.angle)) > Math.abs(Math.sin(car.angle)) ? 'x' : 'y';
  // Re-anchor the car onto the road grid so traffic AI can take over.
  if (car.axis === 'x') {
    car.road = car.y;
    car.dir = Math.cos(car.angle) >= 0 ? 1 : -1;
  } else {
    car.road = car.x;
    car.dir = Math.sin(car.angle) >= 0 ? 1 : -1;
  }
  car.cruise = 170;
  car.speed = Math.min(car.speed, 120);
  const side = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
  p.x = car.x + side.x * 34;
  p.y = car.y + side.y * 34;
  p.x = clamp(p.x, 24, WORLD.W - 24);
  p.y = clamp(p.y, 24, WORLD.H - 24);
  pushOutOfSolids(G.city, p, PLAYER.radius);
  p.onFoot = true;
  p.car = null;
  p.vx = 0; p.vy = 0;
  return true;
}
