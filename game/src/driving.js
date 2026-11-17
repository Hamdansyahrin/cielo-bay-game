// driving.js — arcade car physics (acceleration, drift, handbrake) and
// traffic driving on the road grid, plus car/building/car collision response.
import { CAR, WORLD } from './config.js';
import { clamp, normalizeAngle, angleLerp } from './random.js';
import { hitsSolid, nearestRoadX, nearestRoadY, inWater } from './city.js';

export function makeCar(opts) {
  return {
    id: opts.id, kind: opts.kind || 'traffic', // traffic | parked | player | police | mission | van
    x: opts.x, y: opts.y, angle: opts.angle || 0,
    vx: 0, vy: 0, speed: 0, steer: 0, color: opts.color || '#888888',
    hp: 100, driver: opts.driver || 'ai', // ai | player | none
    // traffic state
    axis: opts.axis || 'x', road: opts.road || 0, dir: opts.dir || 1,
    lane: opts.lane || 0, cruise: opts.cruise || CAR.trafficSpeed,
    targetSpeed: opts.cruise || CAR.trafficSpeed,
    // pursuit state
    mode: opts.mode || 'cruise',
    smokeTimer: 0, brakeLight: false, blinker: 0,
  };
}

// Player-driven car update. input: {up, down, left, right, handbrake}.
export function updatePlayerCar(G, car, input, dt) {
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const right = { x: -forward.y, y: forward.x };
  const fwdSpeed = car.vx * forward.x + car.vy * forward.y;
  const latSpeed = car.vx * right.x + car.vy * right.y;

  let accel = 0;
  if (input.up) accel = CAR.accel;
  if (input.down) accel = fwdSpeed > 20 ? -CAR.brake : -CAR.reverseAccel;
  let newFwd = fwdSpeed + accel * dt;
  newFwd = clamp(newFwd, -CAR.maxReverse, CAR.maxSpeed);
  if (!input.up && !input.down) newFwd -= Math.sign(newFwd) * Math.min(Math.abs(newFwd), 260 * dt);

  const steering = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerAuthority = clamp(Math.abs(newFwd) / 120, 0, 1) * Math.sign(newFwd || 1);
  car.angle += steering * CAR.turnRate * steerAuthority * dt;

  const grip = input.handbrake ? CAR.driftGrip : CAR.grip;
  const newLat = latSpeed * Math.exp(-grip * dt);
  if (input.handbrake && Math.abs(newFwd) > 200 && Math.abs(newLat) < 60) {
    // Kick the tail out when the handbrake first bites.
    car.vx += right.x * steering * 90 * dt * 10;
    car.vy += right.y * steering * 90 * dt * 10;
  }
  const f2 = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const r2 = { x: -f2.y, y: f2.x };
  car.vx = f2.x * newFwd + r2.x * newLat;
  car.vy = f2.y * newFwd + r2.y * newLat;
  car.speed = Math.hypot(car.vx, car.vy);
  car.brakeLight = !!input.down || !!input.handbrake;

  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.x = clamp(car.x, 30, WORLD.W - 30);
  car.y = clamp(car.y, 30, WORLD.H - 30);
  if (inWater(G.city, car.x)) { car.x = G.city.waterX0 - 24; car.vx *= -0.3; }

  const hit = hitsSolid(G.city, car.x, car.y, CAR.radius);
  if (hit) {
    const impact = Math.abs(newFwd);
    car.x -= car.vx * dt * 1.2; car.y -= car.vy * dt * 1.2;
    car.vx *= -0.35; car.vy *= -0.35;
    if (impact > 160) {
      car.hp -= impact * 0.06;
      addCrash(G, car.x, car.y, Math.min(14, impact / 40));
      G.shake = Math.min(14, impact / 30);
    }
  }
  if (car.hp < CAR.damageSmokeAt && car.speed > 40) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      G.particles.push({ kind: 'smoke', x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18, vx: 0, vy: -20, life: 0.9, t: 0, size: 10 });
    }
  }
  return car;
}

// Traffic car: follows the road grid, turns at intersections, slows for cars ahead.
export function updateTrafficCar(G, car, dt) {
  const city = G.city;
  const ahead = carAhead(G, car);
  const want = ahead !== null ? Math.min(car.cruise, ahead) : car.cruise;
  car.targetSpeed = want;
  car.speed += clamp(want - car.speed, -500 * dt, 320 * dt);
  const step = car.speed * dt;
  let nx = car.x, ny = car.y;
  if (car.axis === 'x') nx += car.dir * step;
  else ny += car.dir * step;
  // At an intersection, sometimes turn onto the crossing road.
  const nearCross = car.axis === 'x'
    ? nearestRoadY(city, car.y) : nearestRoadX(city, car.x);
  const crossDist = car.axis === 'x' ? Math.abs(car.y - nearCross) : Math.abs(car.x - nearCross);
  if (crossDist < 26 && G.rng() < 0.012) {
    if (car.axis === 'x') {
      car.axis = 'y'; car.road = nearCross; car.y = nearCross; car.dir = G.rng() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'x'; car.road = nearCross; car.x = nearCross; car.dir = G.rng() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
    car.lane = (G.rng() < 0.5 ? -1 : 1) * 14;
  }
  // End of the road: turn around at the city edge.
  const limit = car.axis === 'x' ? WORLD.W - 90 : WORLD.H - 90;
  const pos = car.axis === 'x' ? nx : ny;
  if (pos > limit || pos < 90) {
    car.dir *= -1;
    car.angle += Math.PI;
    nx = car.x; ny = car.y;
  }
  car.x = nx; car.y = ny;
  // Keep on the lane: nudge back onto the road centre + lane offset.
  if (car.axis === 'x') car.y += (car.road + car.lane - car.y) * Math.min(1, 4 * dt);
  else car.x += (car.road + car.lane - car.x) * Math.min(1, 4 * dt);
  const targetAngle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  car.angle = angleLerp(car.angle, targetAngle, Math.min(1, 6 * dt));
}

// Distance to the nearest car ahead on the same road, or null.
function carAhead(G, car) {
  let best = null;
  for (const other of G.cars) {
    if (other === car || other.kind === 'parked' || other.speed === 0 && other.driver === 'none') continue;
    if (other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
    const along = car.axis === 'x' ? (other.x - car.x) * car.dir : (other.y - car.y) * car.dir;
    if (along > 0 && along < 90) {
      const gap = along - 44;
      const speed = Math.max(0, gap * 2.2);
      if (best === null || speed < best) best = speed;
    }
  }
  return best;
}

// Police pursuit on the road grid: chase the player's road position,
// switching axis at intersections, with a little wobble so it reads as driving.
export function updatePoliceCar(G, car, dt) {
  const city = G.city;
  const tx = G.player.car ? G.player.car.x : G.player.x;
  const ty = G.player.car ? G.player.car.y : G.player.y;
  const targetSpeed = Math.min(CAR.policeSpeed, 380 + G.wanted * 36);
  car.speed += clamp(targetSpeed - car.speed, -600 * dt, 420 * dt);
  const step = car.speed * dt;
  if (car.axis === 'x') {
    const dx = tx - car.x;
    car.dir = dx >= 0 ? 1 : -1;
    car.x += car.dir * step;
    if (Math.abs(dx) < 60) {
      // Switch to the vertical road through the nearest intersection.
      const ry = nearestRoadY(city, car.y);
      if (Math.abs(car.y - ry) < 40) {
        car.axis = 'y'; car.road = ry; car.y = ry;
      }
    }
  } else {
    const dy = ty - car.y;
    car.dir = dy >= 0 ? 1 : -1;
    car.y += car.dir * step;
    if (Math.abs(dy) < 60) {
      const rx = nearestRoadX(city, car.x);
      if (Math.abs(car.x - rx) < 40) {
        car.axis = 'x'; car.road = rx; car.x = rx;
      }
    }
  }
  if (car.axis === 'x') car.y += (car.road + car.lane - car.y) * Math.min(1, 5 * dt);
  else car.x += (car.road + car.lane - car.x) * Math.min(1, 5 * dt);
  const targetAngle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  car.angle = angleLerp(car.angle, targetAngle, Math.min(1, 8 * dt));
  const hit = hitsSolid(city, car.x, car.y, CAR.radius);
  if (hit) { car.speed *= 0.4; car.x -= Math.cos(car.angle) * step; car.y -= Math.sin(car.angle) * step; }
}

// Car vs car: soft circle push + damage, and a bump sound trigger via G.bump.
export function resolveCarCollisions(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.kind === 'parked' && b.kind === 'parked') continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = CAR.radius * 2 - 4;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      const push = (min - d) / 2;
      const aMove = a.kind === 'parked' ? 0 : 1, bMove = b.kind === 'parked' ? 0 : 1;
      const sum = aMove + bMove || 1;
      a.x -= nx * push * (aMove / sum) * 2; a.y -= ny * push * (aMove / sum) * 2;
      b.x += nx * push * (bMove / sum) * 2; b.y += ny * push * (bMove / sum) * 2;
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 120) {
        a.hp -= impact * 0.03; b.hp -= impact * 0.03;
        addCrash(G, (a.x + b.x) / 2, (a.y + b.y) / 2, 8);
        G.bump = true;
      }
      // Exchange a little momentum so bumps feel physical.
      const avx = a.vx || 0, avy = a.vy || 0, bvx = b.vx || 0, bvy = b.vy || 0;
      a.vx = avx * 0.6 + bvx * 0.2; a.vy = avy * 0.6 + bvy * 0.2;
      b.vx = bvx * 0.6 + avx * 0.2; b.vy = bvy * 0.6 + avx * 0.2;
    }
  }
}

export function addCrash(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = G.rng() * Math.PI * 2;
    G.particles.push({
      kind: 'spark', x, y,
      vx: Math.cos(a) * (60 + G.rng() * 160), vy: Math.sin(a) * (60 + G.rng() * 160),
      life: 0.4 + G.rng() * 0.3, t: 0, size: 2 + G.rng() * 3,
    });
  }
  G.particles.push({ kind: 'smoke', x, y, vx: 0, vy: -30, life: 1.1, t: 0, size: 14 });
}
