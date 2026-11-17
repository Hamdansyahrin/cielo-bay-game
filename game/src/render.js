// render.js — the 2.5D world renderer: sunset ground, roads, beach + animated
// water, pier, height-shaded buildings with long shadows, cars, pedestrians,
// the player, headlights, particles and screen shake.
import { WORLD, PALETTE } from './config.js';
import { clamp } from './random.js';

const SUN = { dx: 0.55, dy: 0.35 }; // low sun from the west: long shadows to the east

export function drawWorld(ctx, G, view) {
  const { camX, camY, zoom, W, H } = view;
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camX + W / (2 * zoom), -camY + H / (2 * zoom));
  if (G.shake > 0.2) ctx.translate((G.rng() - 0.5) * G.shake, (G.rng() - 0.5) * G.shake);

  drawGround(ctx, G, camX, camY, W / zoom, H / zoom);
  drawRoads(ctx, G);
  drawBeachAndWater(ctx, G);
  drawPier(ctx, G);
  drawPortYard(ctx, G);
  drawPlaza(ctx, G);
  drawBuildingShadows(ctx, G);
  drawPalms(ctx, G);
  drawParkedCars(ctx, G);
  drawCheckpoints(ctx, G);
  drawChopShop(ctx, G);
  drawPeds(ctx, G);
  drawCars(ctx, G);
  drawPlayer(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);
  drawBuildings(ctx, G);
  drawHeadlights(ctx, G);
  ctx.restore();
}

function drawGround(ctx, G, camX, camY, vw, vh) {
  const x0 = Math.max(0, camX - vw / 2 - 40), y0 = Math.max(0, camY - vh / 2 - 40);
  const x1 = Math.min(WORLD.W, camX + vw / 2 + 40), y1 = Math.min(WORLD.H, camY + vh / 2 + 40);
  ctx.fillStyle = '#b3986e';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // District tint blocks.
  ctx.fillStyle = PALETTE.groundDowntown;
  ctx.fillRect(0, 0, 1500, 1300);
  ctx.fillStyle = PALETTE.groundMidtown;
  ctx.fillRect(1500, 0, 1100, 1900);
  ctx.fillStyle = PALETTE.groundPort;
  ctx.fillRect(0, 1900, 2600, 500);
  // Subtle ground noise: deterministic speckles from the city seed.
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 220; i++) {
    const sx = ((i * 733) % WORLD.W), sy = ((i * 197) % WORLD.H);
    if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue;
    ctx.fillRect(sx, sy, 3, 3);
  }
}

function drawRoads(ctx, G) {
  const city = G.city;
  ctx.fillStyle = PALETTE.road;
  for (const rx of city.roadsX) ctx.fillRect(rx - WORLD.ROAD_W / 2, 0, WORLD.ROAD_W, WORLD.H);
  for (const ry of city.roadsY) ctx.fillRect(0, ry - WORLD.ROAD_W / 2, WORLD.W, WORLD.ROAD_W);
  // Sidewalks.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of city.roadsX) {
    ctx.fillRect(rx - WORLD.ROAD_W / 2 - 14, 0, 10, WORLD.H);
    ctx.fillRect(rx + WORLD.ROAD_W / 2 + 4, 0, 10, WORLD.H);
  }
  for (const ry of city.roadsY) {
    ctx.fillRect(0, ry - WORLD.ROAD_W / 2 - 14, WORLD.W, 10);
    ctx.fillRect(0, ry + WORLD.ROAD_W / 2 + 4, WORLD.W, 10);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const rx of city.roadsX) {
    for (let y = 40; y < WORLD.H; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
  }
  for (const ry of city.roadsY) {
    for (let x = 40; x < WORLD.W; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
  }
  // Street name labels (small, on the road).
  ctx.fillStyle = 'rgba(232,210,122,0.85)';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < city.roadsX.length; i++) {
    ctx.save();
    ctx.translate(city.roadsX[i], 120);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('SOLANO AVE', 0, 0);
    ctx.restore();
  }
}

function drawBeachAndWater(ctx, G) {
  const city = G.city;
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(city.beachX0, 0, city.waterX0 - city.beachX0, WORLD.H);
  // Wet sand band at the waterline.
  ctx.fillStyle = PALETTE.sandWet;
  ctx.fillRect(city.waterX0 - 26, 0, 26, WORLD.H);
  // Water with animated wave lines and a sun glint.
  const grad = ctx.createLinearGradient(city.waterX0, 0, WORLD.W, 0);
  grad.addColorStop(0, PALETTE.waterShallow);
  grad.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(city.waterX0, 0, WORLD.W - city.waterX0, WORLD.H);
  ctx.strokeStyle = 'rgba(255,217,160,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const yBase = i * 270 + 60;
    ctx.beginPath();
    for (let x = city.waterX0; x < WORLD.W; x += 24) {
      const y = yBase + Math.sin(x * 0.02 + G.time * 1.6 + i) * 7;
      if (x === city.waterX0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Sun glint path on the water.
  ctx.fillStyle = 'rgba(255,217,160,0.28)';
  for (let i = 0; i < 12; i++) {
    const gx = city.waterX0 + 30 + ((i * 13) % 140);
    const gy = ((i * 211) % WORLD.H) + Math.sin(G.time + i) * 6;
    ctx.fillRect(gx, gy, 26 - i, 3);
  }
}

function drawPier(ctx, G) {
  const p = G.city.pier;
  ctx.fillStyle = PALETTE.pierWood;
  ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let x = p.x0 + 20; x < p.x1; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, p.y0); ctx.lineTo(x, p.y1); ctx.stroke();
  }
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LANTERN PIER', (p.x0 + p.x1) / 2, p.y0 - 8);
  // Pier lamps.
  ctx.fillStyle = '#ffe9a8';
  for (let x = p.x0 + 40; x < p.x1; x += 90) {
    ctx.beginPath(); ctx.arc(x, p.y0 + 8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, p.y1 - 8, 4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPortYard(ctx, G) {
  const y = G.city.portYard;
  ctx.fillStyle = 'rgba(60,55,50,0.25)';
  ctx.fillRect(y.x0, y.y0, y.x1 - y.x0, y.y1 - y.y0);
  ctx.fillStyle = '#e8d27a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CIELO PORT YARD', y.x0 + 12, y.y0 + 22);
  for (const c of G.city.containers) {
    ctx.save();
    ctx.translate(c.x + (c.rot === 0 ? c.w : c.h) / 2, c.y + (c.rot === 0 ? c.h : c.w) / 2);
    ctx.rotate(c.rot);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-c.w / 2 + 6, -c.h / 2 + 8, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-c.w / 2 + (c.w / 4) * i, -c.h / 2); ctx.lineTo(-c.w / 2 + (c.w / 4) * i, c.h / 2); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPlaza(ctx, G) {
  const p = G.city.plaza;
  ctx.fillStyle = '#d9c9a0';
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8f8578';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#7a9a4a';
  ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SOLANO PLAZA', p.x, p.y + p.r - 16);
}

function drawBuildingShadows(ctx, G) {
  ctx.fillStyle = 'rgba(40,20,10,0.30)';
  for (const b of G.city.buildings) {
    const ox = SUN.dx * b.height * 0.9, oy = SUN.dy * b.height * 0.9;
    ctx.fillRect(b.x + ox, b.y + oy, b.w, b.h);
  }
}

function drawBuildings(ctx, G) {
  // Painter's order: far (top) first so nearer buildings overlap correctly.
  const sorted = G.city.buildings.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const b of sorted) {
    const h = b.height;
    const ox = SUN.dx * h * 0.55, oy = SUN.dy * h * 0.55;
    // Side faces (the 2.5D height).
    ctx.fillStyle = PALETTE.buildingSide;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w + ox, b.y - oy);
    ctx.lineTo(b.x + b.w + ox, b.y + b.h - oy); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6b4a35';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + ox, b.y + b.h - oy);
    ctx.lineTo(b.x + b.w + ox, b.y + b.h - oy); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath(); ctx.fill();
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + ox * 0.4, b.y - oy * 0.4, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + ox * 0.4, b.y - oy * 0.4, b.w, b.h);
    // Lit windows on the roof face.
    if (b.lit) {
      ctx.fillStyle = PALETTE.buildingGlass;
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 30));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 3 + b.height) % 3 === 0) {
            ctx.fillRect(b.x + ox * 0.4 + 8 + i * 30, b.y - oy * 0.4 + 8 + j * 26, 12, 9);
          }
        }
      }
    }
  }
}

function drawPalms(ctx, G) {
  for (const p of G.city.palms) {
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.lean * 20, p.y - 16); ctx.stroke();
    ctx.fillStyle = PALETTE.palmLeaf;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + p.lean;
      ctx.beginPath();
      ctx.ellipse(p.x + p.lean * 20 + Math.cos(a) * 9, p.y - 16 + Math.sin(a) * 7, 11, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParkedCars(ctx, G) {
  for (const car of G.cars) {
    if (car.kind !== 'parked' && car.kind !== 'mission') continue;
    drawCarBody(ctx, car, false);
  }
}

function drawChopShop(ctx, G) {
  const s = G.city.chopShop;
  ctx.fillStyle = '#5a4a3a';
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = '#7a6a55';
  ctx.fillRect(s.x + 8, s.y + 8, s.w - 16, s.h - 16);
  ctx.fillStyle = '#ffd98a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ROOK AUTO YARD', s.x + s.w / 2, s.y + 24);
  ctx.fillStyle = '#c95a3a';
  ctx.fillRect(s.x + s.w / 2 - 40, s.y + s.h - 34, 80, 22);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('CHOP SHOP', s.x + s.w / 2, s.y + s.h - 19);
}

function drawCheckpoints(ctx, G) {
  const ms = G.missions;
  if (ms.index !== 1 || ms.phase !== 'active') return;
  const cp = ms.checkpoints[ms.checkpointIndex];
  if (!cp) return;
  const pulse = 1 + Math.sin(G.time * 5) * 0.12;
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cp.x, cp.y, cp.r * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,217,74,0.18)';
  ctx.beginPath(); ctx.arc(cp.x, cp.y, cp.r * pulse, 0, Math.PI * 2); ctx.fill();
}

function drawPeds(ctx, G) {
  for (const p of G.peds) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.state === 'down') {
      // Knocked down: lying flat.
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-12, -5, 24, 10);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(15, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(p.walkPhase) * 2;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 8, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Body.
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(0, bob * 0.4, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, -10 + bob * 0.4, 6, 0, Math.PI * 2); ctx.fill();
    // Facing tick.
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(Math.cos(p.angle) * 10, -10 + Math.sin(p.angle) * 10); ctx.stroke();
    if (p.kind === 'rival') {
      // Red marker + health bar over rivals.
      ctx.fillStyle = '#ff3a3a';
      ctx.beginPath(); ctx.arc(0, -22, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-12, -30, 24, 4);
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(-12, -30, 24 * Math.max(0, p.hp / 100), 4);
      // Gun in hand.
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.angle) * 16, Math.sin(p.angle) * 16); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCarBody(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-20, -10 + 6, 46, 24);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-22, -12, 44, 24, 6);
  ctx.fill();
  // Hood + trunk shading.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(6, -11, 14, 22);
  // Windshield.
  ctx.fillStyle = '#1a2a3a';
  ctx.fillRect(-2, -10, 8, 20);
  // Roof.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(-12, -9, 10, 18);
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-16, -14, 9, 4); ctx.fillRect(-16, 10, 9, 4);
  ctx.fillRect(8, -14, 9, 4); ctx.fillRect(8, 10, 9, 4);
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(-24, -10, 3, 6); ctx.fillRect(-24, 4, 3, 6);
  }
  if (car.kind === 'police') {
    // Light bar, flashing with blinker.
    const flash = Math.sin(car.blinker || 0) > 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-4, -13, 8, 4);
    ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
    ctx.fillRect(-4, 9, 8, 4);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  if (car.armored) {
    ctx.strokeStyle = '#ffd94a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-22, -12, 44, 24);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARMORED', 0, -16);
  }
  if (car.missionMark) {
    // Pulsing gold marker above the target car.
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.moveTo(0, -34); ctx.lineTo(7, -22); ctx.lineTo(-7, -22);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawCars(ctx, G) {
  for (const car of G.cars) {
    if (car.kind === 'parked' || car.kind === 'mission') continue;
    drawCarBody(ctx, car, car.driver === 'player');
  }
  // Damage smoke is emitted as particles by the physics; nothing extra here.
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (!p.onFoot) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,40,40,${Math.min(0.6, p.hurtFlash * 2)})`;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
  }
  // Body: teal jacket, the player's signature colour.
  ctx.rotate(p.angle);
  ctx.fillStyle = '#2a9a8a';
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c0a0';
  ctx.beginPath(); ctx.arc(3, 0, 7, 0, Math.PI * 2); ctx.fill();
  // Aim direction + pistol.
  ctx.rotate(-p.angle);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.aimAngle) * 20, Math.sin(p.aimAngle) * 20); ctx.stroke();
  if (p.meleeAnim > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 30, p.aimAngle - 0.9, p.aimAngle + 0.9); ctx.stroke();
  }
  // Player arrow so the eye finds them instantly.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -26); ctx.lineTo(6, -16); ctx.lineTo(-6, -16);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBullets(ctx, G) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, G) {
  for (const pt of G.particles) {
    const a = 1 - pt.t / pt.life;
    if (pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(120,120,120,${0.35 * a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1 + pt.t), 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255,200,80,${a})`;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    } else if (pt.kind === 'flash') {
      ctx.fillStyle = `rgba(255,240,160,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a + 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawHeadlights(ctx, G) {
  // Warm headlight cones for moving cars at dusk.
  for (const car of G.cars) {
    if (car.kind === 'parked' || car.kind === 'mission') continue;
    if (car.speed < 30 && car.driver !== 'player') continue;
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const grad = ctx.createRadialGradient(
      car.x + fx * 24, car.y + fy * 24, 4,
      car.x + fx * 24, car.y + fy * 24, 150,
    );
    grad.addColorStop(0, 'rgba(255,230,160,0.20)');
    grad.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(car.x + fx * 22, car.y + fy * 22);
    ctx.lineTo(car.x + fx * 150 - fy * 40, car.y + fy * 150 + fx * 40);
    ctx.lineTo(car.x + fx * 150 + fy * 40, car.y + fy * 150 - fx * 40);
    ctx.closePath();
    ctx.fill();
  }
}
