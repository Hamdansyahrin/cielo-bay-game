// Cielo Bay — city.js: builds the whole coastal city from a seed — the
// road grid, the three districts, buildings, palms, the beach, the pier,
// the port, parked cars and the landmarks the missions use. Everything
// is deterministic: the same seed always builds the same Cielo Bay.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function districtAt(cfg, x, y) {
    if (y >= 1800) return 'port';
    if (x >= 2560) return 'beach';
    if (x >= 960 && x <= 2240 && y >= 160 && y <= 1040) return 'downtown';
    return 'town';
  }

  // A block is the rectangle between four road centre lines.
  function buildBlocks(cfg) {
    var blocks = [];
    for (var vi = 0; vi < cfg.ROADS_V.length - 1; vi++) {
      for (var hi = 0; hi < cfg.ROADS_H.length - 1; hi++) {
        var x0 = cfg.ROADS_V[vi] + cfg.ROAD_W / 2;
        var x1 = cfg.ROADS_V[vi + 1] - cfg.ROAD_W / 2;
        var y0 = cfg.ROADS_H[hi] + cfg.ROAD_W / 2;
        var y1 = cfg.ROADS_H[hi + 1] - cfg.ROAD_W / 2;
        blocks.push({ x0: x0, y0: y0, x1: x1, y1: y1,
          cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
          district: districtAt(cfg, (x0 + x1) / 2, (y0 + y1) / 2) });
      }
    }
    return blocks;
  }

  function buildBuildings(cfg, rng, blocks) {
    var buildings = [];
    blocks.forEach(function (b) {
      var w = b.x1 - b.x0, h = b.y1 - b.y0;
      if (b.district === 'downtown') {
        // Downtown: one or two tall towers per block, set back from the
        // sidewalk so the street stays readable.
        var n = rng.chance(0.5) ? 2 : 1;
        for (var i = 0; i < n; i++) {
          var bw = rng.range(90, 130), bh = rng.range(90, 130);
          var bx = b.x0 + 30 + (i === 0 ? 0 : w - bw - 60) + rng.range(-8, 8);
          var by = b.y0 + 30 + rng.range(0, Math.max(0, h - bh - 60));
          buildings.push({ x: bx, y: by, w: bw, h: bh,
            hgt: rng.range(64, 118), district: 'downtown',
            color: cfg.PALETTE.buildingDowntown, top: cfg.PALETTE.buildingDowntownTop,
            seed: rng.int(0, 9999) });
        }
      } else if (b.district === 'beach') {
        // Beachfront: low pastel hotels and houses, palms out front.
        var nb = rng.int(1, 2);
        for (var j = 0; j < nb; j++) {
          var bw2 = rng.range(70, 110), bh2 = rng.range(60, 90);
          buildings.push({ x: b.x0 + 26 + j * ((w - bw2 - 52) / Math.max(1, nb - 1 || 1)),
            y: b.y0 + 30 + rng.range(0, 40), w: bw2, h: bh2,
            hgt: rng.range(18, 38), district: 'beach',
            color: cfg.PALETTE.buildingBeach, top: cfg.PALETTE.buildingBeachTop,
            seed: rng.int(0, 9999) });
        }
      } else if (b.district === 'port') {
        // Port: long low sheds and container stacks.
        var bw3 = rng.range(140, 200), bh3 = rng.range(60, 90);
        buildings.push({ x: b.x0 + 24, y: b.y0 + 26, w: bw3, h: bh3,
          hgt: rng.range(14, 24), district: 'port',
          color: cfg.PALETTE.buildingPort, top: cfg.PALETTE.buildingPortTop,
          seed: rng.int(0, 9999) });
      } else {
        // Town: two or three houses, sometimes a pocket park instead.
        if (rng.chance(0.22)) return; // park block, no buildings
        var nh = rng.int(2, 3);
        for (var k = 0; k < nh; k++) {
          var bw4 = rng.range(56, 84), bh4 = rng.range(48, 70);
          buildings.push({ x: b.x0 + 28 + (k % 2) * ((w - bw4 - 56)),
            y: b.y0 + 28 + Math.floor(k / 2) * ((h - bh4 - 56) / 1),
            w: bw4, h: bh4, hgt: rng.range(12, 22), district: 'town',
            color: cfg.PALETTE.buildingHouse, top: '#d9b183',
            seed: rng.int(0, 9999) });
        }
      }
    });
    return buildings;
  }
  CB._cityBuild = { districtAt: districtAt, buildBlocks: buildBlocks, buildBuildings: buildBuildings };

  function buildPalms(cfg, rng, blocks) {
    var palms = [];
    // A palm row down the beachfront drive, and scattered pairs on the
    // sidewalks of the town blocks.
    for (var y = 240; y < cfg.WORLD_H - 100; y += 170) {
      palms.push({ x: 2948 + rng.range(-6, 6), y: y + rng.range(-20, 20) });
    }
    blocks.forEach(function (b) {
      if (b.district === 'town' && rng.chance(0.5)) {
        palms.push({ x: b.x0 + 18, y: b.y0 + 18 });
        if (rng.chance(0.6)) palms.push({ x: b.x1 - 18, y: b.y1 - 18 });
      }
      if (b.district === 'beach' && rng.chance(0.7)) {
        palms.push({ x: b.x0 + 20, y: b.cy });
      }
    });
    return palms;
  }

  function buildContainers(cfg, rng) {
    var containers = [];
    var colors = [cfg.PALETTE.containerA, cfg.PALETTE.containerB, cfg.PALETTE.containerC];
    // Container stacks in the port yard, south of the port road.
    for (var i = 0; i < 9; i++) {
      var cx = 240 + (i % 3) * 260 + rng.range(-20, 20);
      var cy = 2280 + Math.floor(i / 3) * 60 + rng.range(-8, 8);
      containers.push({ x: cx, y: cy, w: 150, h: 34, color: colors[i % 3] });
    }
    return containers;
  }

  function farFromLandmarks(cfg, x, y) {
    var spots = [cfg.SPAWN, cfg.MISSION_CAR, cfg.CHOP_SHOP, cfg.VAN_SPAWN, cfg.PIER_MEET];
    for (var i = 0; i < spots.length; i++) {
      if (Math.hypot(x - spots[i].x, y - spots[i].y) < 170) return false;
    }
    return true;
  }

  function buildParked(cfg, rng) {
    var parked = [];
    var models = ['sedan', 'sedan', 'taxi', 'sport', 'van'];
    var tries = 0;
    while (parked.length < cfg.PARKED_COUNT && tries < 300) {
      tries++;
      var vertical = rng.chance(0.5);
      var line = vertical ? rng.pick(cfg.ROADS_V) : rng.pick(cfg.ROADS_H);
      var along = rng.range(140, vertical ? cfg.WORLD_H - 140 : cfg.WORLD_W - 140);
      var off = (rng.chance(0.5) ? 1 : -1) * (cfg.ROAD_W / 2 - 16);
      var x = vertical ? line + off : along;
      var y = vertical ? along : line + off;
      if (x > cfg.SAND_X0 - 40) continue;
      if (!farFromLandmarks(cfg, x, y)) continue;
      var model = rng.pick(models);
      parked.push({ x: x, y: y, angle: vertical ? (rng.chance(0.5) ? -Math.PI / 2 : Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
        model: model, color: rng.pick(cfg.CARS[model].colors) });
    }
    return parked;
  }

  // True when the point is on asphalt (within half a road width of a
  // centre line). The pier deck counts as road for driving onto it.
  function isRoad(cfg, x, y) {
    for (var i = 0; i < cfg.ROADS_V.length; i++) {
      if (Math.abs(x - cfg.ROADS_V[i]) <= cfg.ROAD_W / 2) return true;
    }
    for (var j = 0; j < cfg.ROADS_H.length; j++) {
      if (Math.abs(y - cfg.ROADS_H[j]) <= cfg.ROAD_W / 2) return true;
    }
    return false;
  }
  function onPier(cfg, x, y) {
    return x >= cfg.PIER.x0 && x <= cfg.PIER.x1 && y >= cfg.PIER.y0 && y <= cfg.PIER.y1;
  }
  function isWater(cfg, x, y) {
    return x >= cfg.WATER_X0 && !onPier(cfg, x, y);
  }
  // True when a circle of radius r at (x,y) hits a building, the sea or
  // the world edge. Roads, sidewalks, sand and the pier are open.
  function blocked(city, x, y, r) {
    var cfg = city.cfg;
    if (x < r || y < r || x > cfg.WORLD_W - r || y > cfg.WORLD_H - r) return true;
    if (isWater(cfg, x, y)) return true;
    var bs = city.buildings;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }
  function nearestRoad(cfg, x, y) {
    var best = null, bestD = 1e9;
    cfg.ROADS_V.forEach(function (rx) {
      var d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { axis: 'v', line: rx, dist: d }; }
    });
    cfg.ROADS_H.forEach(function (ry) {
      var d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { axis: 'h', line: ry, dist: d }; }
    });
    return best;
  }
  function streetName(cfg, x, y) {
    var near = nearestRoad(cfg, x, y);
    if (!near || near.dist > 90) return 'Cielo Bay';
    return near.axis === 'v' ? (cfg.STREET_V[near.line] || 'Cielo Bay')
      : (cfg.STREET_H[near.line] || 'Cielo Bay');
  }

  function buildCity(seed) {
    var cfg = CB.CFG;
    var rng = new CB.SeededRandom(seed);
    var blocks = buildBlocks(cfg);
    var city = {
      cfg: cfg, seed: seed,
      blocks: blocks,
      buildings: buildBuildings(cfg, rng, blocks),
      palms: buildPalms(cfg, rng, blocks),
      containers: buildContainers(cfg, rng),
      parked: buildParked(cfg, rng),
      chopShop: { x: cfg.CHOP_SHOP.x, y: cfg.CHOP_SHOP.y, r: cfg.CHOP_SHOP.r },
      spawn: { x: cfg.SPAWN.x, y: cfg.SPAWN.y },
      vanSpawn: { x: cfg.VAN_SPAWN.x, y: cfg.VAN_SPAWN.y },
      missionCar: { x: cfg.MISSION_CAR.x, y: cfg.MISSION_CAR.y },
      pierMeet: { x: cfg.PIER_MEET.x, y: cfg.PIER_MEET.y },
      courierPoints: [
        { x: 1000, y: 240, name: 'Northgate rooftop drop' },
        { x: 2600, y: 620, name: 'Sunset Strip kiosk' },
        { x: 2200, y: 1820, name: 'Docks Rd warehouse' },
        { x: 220, y: 1020, name: 'Coral Way cafe' }
      ]
    };
    city.isRoad = function (x, y) { return isRoad(cfg, x, y); };
    city.isWater = function (x, y) { return isWater(cfg, x, y); };
    city.onPier = function (x, y) { return onPier(cfg, x, y); };
    city.blocked = function (x, y, r) { return blocked(city, x, y, r); };
    city.streetName = function (x, y) { return streetName(cfg, x, y); };
    return city;
  }

  CB.buildCity = buildCity;
})();
