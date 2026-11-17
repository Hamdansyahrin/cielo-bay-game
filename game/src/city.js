// Cielo Bay — city.js: builds the static city from the seeded RNG and
// answers geometry questions (buildings, roads, line of sight).
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var CFG = CB.CFG;

  function districtAt(x) {
    for (var i = 0; i < CB.DISTRICTS.length; i++) {
      if (x >= CB.DISTRICTS[i].x0 && x < CB.DISTRICTS[i].x1) return CB.DISTRICTS[i];
    }
    return CB.DISTRICTS[CB.DISTRICTS.length - 1];
  }
  CB.districtAt = districtAt;

  function onRoadX(x) { for (var i = 0; i < CFG.ROADS_X.length; i++) if (Math.abs(x - CFG.ROADS_X[i]) <= CFG.ROAD_W / 2) return true; return false; }
  function onRoadY(y) { for (var i = 0; i < CFG.ROADS_Y.length; i++) if (Math.abs(y - CFG.ROADS_Y[i]) <= CFG.ROAD_W / 2) return true; return false; }
  CB.onRoad = function (x, y) { return onRoadX(x) || onRoadY(y); };
  CB.nearestRoadX = function (x) { var b = CFG.ROADS_X[0], bd = 1e9; CFG.ROADS_X.forEach(function (r) { var d = Math.abs(r - x); if (d < bd) { bd = d; b = r; } }); return b; };
  CB.nearestRoadY = function (y) { var b = CFG.ROADS_Y[0], bd = 1e9; CFG.ROADS_Y.forEach(function (r) { var d = Math.abs(r - y); if (d < bd) { bd = d; b = r; } }); return b; };

  // Buildings fill each block between roads, inset from the sidewalk.
  CB.buildCity = function (rng) {
    var buildings = [], palms = [], i, j;
    var xs = [0].concat(CFG.ROADS_X.map(function (r) { return r + CFG.ROAD_W / 2; }));
    var xe = CFG.ROADS_X.map(function (r) { return r - CFG.ROAD_W / 2; }).concat([CFG.WORLD_W]);
    var ys = [0].concat(CFG.ROADS_Y.map(function (r) { return r + CFG.ROAD_W / 2; }));
    var ye = CFG.ROADS_Y.map(function (r) { return r - CFG.ROAD_W / 2; }).concat([CFG.WATER_Y]);
    for (i = 0; i < xs.length; i++) {
      for (j = 0; j < ys.length; j++) {
        var x0 = xs[i] + 16, y0 = ys[j] + 16, x1 = xe[i] - 16, y1 = ye[j] - 16;
        if (x1 - x0 < 90 || y1 - y0 < 90) continue;
        // The pier deck and the chop-shop lot stay clear of buildings.
        var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        if (cx > CFG.PIER.x - 90 && cx < CFG.PIER.x + CFG.PIER.w + 90 && cy > CFG.PIER.y - 90 && cy < CFG.PIER.y + CFG.PIER.h + 90) continue;
        if (cx > 2980 && cx < 3420 && cy > 1560 && cy < 1980) continue;
        var d = districtAt(cx);
        // One or two buildings per block.
        var n = (x1 - x0 > 260 && rng.chance(0.6)) ? 2 : 1;
        for (var k = 0; k < n; k++) {
          var bw = (x1 - x0) / n - 18;
          var bx = x0 + k * ((x1 - x0) / n) + 9;
          var floors = rng.int(d.floors[0], d.floors[1]);
          buildings.push({
            x: bx, y: y0 + 8, w: bw, h: (y1 - y0) - 16,
            floors: floors, hgt: floors * 13, color: rng.pick(d.tone),
            roof: rng.pick(['#3a3244', '#443a4a', '#332c40']),
            litSeed: rng.int(1, 99999), name: ''
          });
        }
        // Palms along the block's south sidewalk, beachfront loves them.
        var palmN = rng.int(1, 3);
        for (var p = 0; p < palmN; p++) palms.push({ x: rng.range(x0 + 10, x1 - 10), y: y1 + 8, s: rng.range(0.8, 1.25) });
      }
    }
    // Beach palms along the sand.
    for (var b = 0; b < 26; b++) palms.push({ x: rng.range(40, CFG.WORLD_W - 40), y: rng.range(CFG.WATER_Y - 46, CFG.WATER_Y - 8), s: rng.range(0.9, 1.4) });
    return {
      buildings: buildings, palms: palms,
      chopShop: { x: 3200, y: 1770, r: 95, name: 'Voss Chop Shop' },
      garage: { x: 3200, y: 1770 }
    };
  };

  CB.buildingAt = function (city, x, y, pad) {
    pad = pad || 0;
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  };

  // Circle vs buildings: push (x,y) out along the smallest penetration.
  CB.collideBuildings = function (city, x, y, r) {
    var b = CB.buildingAt(city, x, y, r);
    if (!b) return { x: x, y: y, hit: false };
    var left = (x + r) - b.x, right = (b.x + b.w) - (x - r);
    var top = (y + r) - b.y, bot = (b.y + b.h) - (y - r);
    var m = Math.min(left, right, top, bot);
    if (m === left) x = b.x - r; else if (m === right) x = b.x + b.w + r;
    else if (m === top) y = b.y - r; else y = b.y + b.h + r;
    return { x: x, y: y, hit: true };
  };

  // Line of sight: blocked only by building rectangles (sampled walk).
  CB.hasLOS = function (G, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var dist = Math.hypot(dx, dy);
    if (dist < 1) return true;
    var steps = Math.ceil(dist / 22);
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      if (CB.buildingAt(G.city, x1 + dx * t, y1 + dy * t, 0)) return false;
    }
    return true;
  };

  CB.inWater = function (x, y) {
    if (y >= CFG.WATER_Y + 26) return true;
    var P = CFG.PIER;
    var inMarina = x > P.x - 40 && y > P.y - 130 && y < P.y + P.h + 130 && x < CFG.WORLD_W;
    return inMarina && !(x >= P.x && x <= P.x + P.w && y >= P.y && y <= P.y + P.h) && y < CFG.WATER_Y;
  };
  CB.onPier = function (x, y) {
    var P = CFG.PIER;
    return x >= P.x && x <= P.x + P.w && y >= P.y && y <= P.y + P.h;
  };
  CB.clampWorld = function (x, y) {
    return { x: Math.max(14, Math.min(CFG.WORLD_W - 14, x)), y: Math.max(14, Math.min(CFG.WORLD_H - 14, y)) };
  };
})();
