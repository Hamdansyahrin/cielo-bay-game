// city.js — deterministic generation of Cielo Bay: road grid, blocks, buildings,
// beach + water edge, pier, port yard, palms, parked cars and mission landmarks.
import { WORLD, ROADS_X, ROADS_Y, LANDMARKS, districtAt } from './config.js';
import { makeRng, range, rangeInt, pick, chance } from './random.js';

export function generateCity(seed) {
  const rng = makeRng(seed);
  const city = {
    seed,
    roadsX: ROADS_X.slice(),
    roadsY: ROADS_Y.slice(),
    buildings: [],
    palms: [],
    parkedCars: [],
    containers: [],
    lamps: [],
    plaza: LANDMARKS.plaza,
    chopShop: LANDMARKS.chopShop,
    pier: LANDMARKS.pier,
    beachX0: LANDMARKS.beachX0,
    waterX0: LANDMARKS.waterX0,
    portYard: LANDMARKS.portYard,
    hospital: LANDMARKS.hospital,
  };

  // Buildings fill the blocks between roads. A block is the rectangle between
  // two neighbouring road lines (plus the outer rim up to the beach / port).
  const xs = [60, ...ROADS_X, 2820];
  const ys = [60, ...ROADS_Y, 2340];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + WORLD.ROAD_W / 2 + 14;
      const x1 = xs[bi + 1] - WORLD.ROAD_W / 2 - 14;
      const y0 = ys[bj] + WORLD.ROAD_W / 2 + 14;
      const y1 = ys[bj + 1] - WORLD.ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // Keep the plaza, the chop shop and the port yard clear of buildings.
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (Math.hypot(cx - city.plaza.x, cy - city.plaza.y) < 190) continue;
      if (cx > city.chopShop.x - 140 && cx < city.chopShop.x + city.chopShop.w + 140 &&
          cy > city.chopShop.y - 140 && cy < city.chopShop.y + city.chopShop.h + 140) continue;
      if (cy > 1900 && cx < 2500) continue; // port yard: containers instead
      const d = districtAt(cx, cy);
      const n = d.tall ? rangeInt(rng, 1, 2) : rangeInt(rng, 1, 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 90, Math.min(220, x1 - x0 - 20));
        const h = range(rng, 90, Math.min(200, y1 - y0 - 20));
        const bx = range(rng, x0, Math.max(x0, x1 - w));
        const by = range(rng, y0, Math.max(y0, y1 - h));
        const height = range(rng, d.heightMin, d.heightMax);
        city.buildings.push({
          x: bx, y: by, w, h, height,
          roof: pick(rng, ['#c98a5a', '#7a6a8a', '#5a7a6a', '#b0704a', '#8a7a5a']),
          lit: chance(rng, 0.75),
          district: d.id,
        });
      }
    }
  }

  // Palms along the beachfront and the plaza.
  for (let i = 0; i < 46; i++) {
    const alongBeach = chance(rng, 0.7);
    city.palms.push(alongBeach
      ? { x: range(rng, 2840, 3000), y: range(rng, 80, 2320), lean: range(rng, -0.2, 0.2) }
      : { x: range(rng, city.plaza.x - 120, city.plaza.x + 120),
          y: range(rng, city.plaza.y - 120, city.plaza.y + 120), lean: range(rng, -0.2, 0.2) });
  }
  // Shipping containers in the port yard.
  for (let i = 0; i < 26; i++) {
    city.containers.push({
      x: range(rng, city.portYard.x0 + 20, city.portYard.x1 - 90),
      y: range(rng, city.portYard.y0 + 20, city.portYard.y1 - 50),
      w: range(rng, 60, 90), h: 30,
      color: pick(rng, ['#c95a3a', '#3a7ac9', '#5ac93a', '#c9a03a']),
      rot: chance(rng, 0.5) ? 0 : Math.PI / 2,
    });
  }
  // Parked cars along road edges.
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      if (chance(rng, 0.55)) {
        city.parkedCars.push({
          x: rx + WORLD.ROAD_W / 2 + 26, y: ry + range(rng, -140, 140),
          angle: chance(rng, 0.5) ? 0 : Math.PI,
          color: pick(rng, ['#c93a3a', '#3a7ac9', '#e8c93a', '#e8e8e8', '#3a3a3a', '#5ac93a']),
        });
      }
    }
  }
  // Street lamps at intersections.
  for (const rx of ROADS_X) for (const ry of ROADS_Y) {
    city.lamps.push({ x: rx + WORLD.ROAD_W / 2 + 6, y: ry - WORLD.ROAD_W / 2 - 6 });
  }
  return city;
}

// Nearest road line (centre) to a point, on one axis.
export function nearestRoadX(city, x) {
  let best = city.roadsX[0], bd = Infinity;
  for (const rx of city.roadsX) { const d = Math.abs(rx - x); if (d < bd) { bd = d; best = rx; } }
  return best;
}
export function nearestRoadY(city, y) {
  let best = city.roadsY[0], bd = Infinity;
  for (const ry of city.roadsY) { const d = Math.abs(ry - y); if (d < bd) { bd = d; best = ry; } }
  return best;
}

// Circle vs building/containers collision: returns true when (x,y,r) overlaps solid geometry.
export function hitsSolid(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  for (const c of city.containers) {
    const w = c.rot === 0 ? c.w : c.h, h = c.rot === 0 ? c.h : c.w;
    if (x + r > c.x && x - r < c.x + w && y + r > c.y && y - r < c.y + h) return c;
  }
  return null;
}

// Push a circle out of solid geometry (axis-separated, simple and stable).
export function pushOutOfSolids(city, p, r) {
  const b = hitsSolid(city, p.x, p.y, r);
  if (!b) return false;
  let w, h;
  if (b.rot !== undefined) { w = b.rot === 0 ? b.w : b.h; h = b.rot === 0 ? b.h : b.w; }
  else { w = b.w; h = b.h; }
  const cx = b.x + w / 2, cy = b.y + h / 2;
  const dx = p.x - cx, dy = p.y - cy;
  const ox = w / 2 + r - Math.abs(dx), oy = h / 2 + r - Math.abs(dy);
  if (ox < oy) p.x += dx >= 0 ? ox : -ox;
  else p.y += dy >= 0 ? oy : -oy;
  return true;
}

export function onRoad(city, x, y) {
  const onX = city.roadsX.some((rx) => Math.abs(x - rx) < WORLD.ROAD_W / 2);
  const onY = city.roadsY.some((ry) => Math.abs(y - ry) < WORLD.ROAD_W / 2);
  return onX || onY;
}
export function inWater(city, x) { return x > city.waterX0; }
export function inBeach(city, x) { return x > city.beachX0 && x <= city.waterX0; }
export function onPier(city, x, y) {
  return x >= city.pier.x0 && x <= city.pier.x1 && y >= city.pier.y0 && y <= city.pier.y1;
}
