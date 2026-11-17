// Cielo Bay — render.js: draws the world on the canvas — sunset ground,
// beach and animated water, the road grid, the pier, the port, and the
// buildings as 2.5D extrusions with long west-sun shadows and lit
// windows. Cars, peds, the player and rivals are drawn in y order so
// the height reads. The camera follows the player with shake on impacts.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function updateCamera(G) {
    var p = G.player;
    var tx = p.x - CB.CFG.VIEW_W / 2, ty = p.y - CB.CFG.VIEW_H / 2;
    tx = Math.max(0, Math.min(CB.CFG.WORLD_W - CB.CFG.VIEW_W, tx));
    ty = Math.max(0, Math.min(CB.CFG.WORLD_H - CB.CFG.VIEW_H, ty));
    G.camera.x += (tx - G.camera.x) * 0.12;
    G.camera.y += (ty - G.camera.y) * 0.12;
    G.shake = Math.max(0, G.shake - 0.6);
  }

  function drawWorld(ctx, G) {
    var cfg = CB.CFG, pal = cfg.PALETTE;
    var cam = G.camera;
    var shX = (G.rng.next() - 0.5) * G.shake, shY = (G.rng.next() - 0.5) * G.shake;
    ctx.save();
    ctx.translate(-Math.round(cam.x + shX), -Math.round(cam.y + shY));
    // Ground base.
    ctx.fillStyle = pal.ground;
    ctx.fillRect(cam.x - 20, cam.y - 20, CB.CFG.VIEW_W + 40, CB.CFG.VIEW_H + 40);
    // City blocks.
    G.city.blocks.forEach(function (b) {
      ctx.fillStyle = (b.district === 'port') ? '#8f8578' : pal.block;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      // Sidewalk rim around each block.
      ctx.strokeStyle = pal.sidewalk;
      ctx.lineWidth = 10;
      ctx.strokeRect(b.x0 + 5, b.y0 + 5, b.x1 - b.x0 - 10, b.y1 - b.y0 - 10);
    });
    drawBeachAndWater(ctx, G);
    drawRoads(ctx, G);
    drawPier(ctx, G);
    drawContainers(ctx, G);
    drawBuildings(ctx, G);
    drawPalms(ctx, G);
    drawMissionBeacon(ctx, G);
    // Entities in y order so nearer things overlap further ones.
    var drawables = [];
    G.cars.forEach(function (c) { drawables.push({ y: c.y, fn: function () { drawCar(ctx, G, c); } }); });
    G.peds.forEach(function (ped) { drawables.push({ y: ped.y, fn: function () { drawPed(ctx, G, ped); } }); });
    G.rivals.forEach(function (r) { drawables.push({ y: r.y, fn: function () { drawRival(ctx, G, r); } }); });
    drawables.push({ y: G.player.y, fn: function () { drawPlayer(ctx, G); } });
    drawables.sort(function (a, b) { return a.y - b.y; });
    drawables.forEach(function (d) { d.fn(); });
    drawBullets(ctx, G);
    drawParticles(ctx, G);
    drawHeadlights(ctx, G);
    ctx.restore();
  }

  function drawBeachAndWater(ctx, G) {
    var cfg = CB.CFG, pal = cfg.PALETTE;
    var cam = G.camera;
    var top = Math.max(cam.y - 20, 0), bot = Math.min(cam.y + CB.CFG.VIEW_H + 20, cfg.WORLD_H);
    // Sand strip.
    ctx.fillStyle = pal.sand;
    ctx.fillRect(cfg.SAND_X0, top, cfg.WATER_X0 - cfg.SAND_X0, bot - top);
    // Sea, with a slow animated swell drawn as shifting light bands.
    var grad = ctx.createLinearGradient(cfg.WATER_X0, 0, cfg.WORLD_W, 0);
    grad.addColorStop(0, pal.waterShallow);
    grad.addColorStop(1, pal.waterDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(cfg.WATER_X0, top, cfg.WORLD_W - cfg.WATER_X0, bot - top);
    ctx.strokeStyle = 'rgba(207,238,245,0.5)';
    ctx.lineWidth = 2;
    for (var i = 0; i < 5; i++) {
      var wy = top + ((i * 173 + G.time * 24) % (bot - top + 200)) - 100;
      ctx.beginPath();
      for (var x = cfg.WATER_X0 + 10; x < cfg.WORLD_W; x += 40) {
        var yy = wy + Math.sin(x * 0.02 + G.time * 1.4 + i) * 6;
        if (x === cfg.WATER_X0 + 10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // Wet sand edge, animated.
    ctx.strokeStyle = pal.waterEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (var y = top; y <= bot; y += 30) {
      var xx = cfg.WATER_X0 + Math.sin(y * 0.03 + G.time * 1.8) * 5;
      if (y === top) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }

  function drawRoads(ctx, G) {
    var cfg = CB.CFG, pal = cfg.PALETTE;
    var cam = G.camera;
    ctx.fillStyle = pal.road;
    cfg.ROADS_V.forEach(function (rx) {
      ctx.fillRect(rx - cfg.ROAD_W / 2, cam.y - 20, cfg.ROAD_W, CB.CFG.VIEW_H + 40);
    });
    cfg.ROADS_H.forEach(function (ry) {
      ctx.fillRect(cam.x - 20, ry - cfg.ROAD_W / 2, CB.CFG.VIEW_W + 40, cfg.ROAD_W);
    });
    // Centre dashes.
    ctx.fillStyle = pal.laneDash;
    cfg.ROADS_V.forEach(function (rx) {
      for (var y = Math.floor((cam.y - 20) / 60) * 60; y < cam.y + CB.CFG.VIEW_H + 20; y += 60) {
        ctx.fillRect(rx - 2, y, 4, 30);
      }
    });
    cfg.ROADS_H.forEach(function (ry) {
      for (var x = Math.floor((cam.x - 20) / 60) * 60; x < cam.x + CB.CFG.VIEW_W + 20; x += 60) {
        ctx.fillRect(x, ry - 2, 30, 4);
      }
    });
    // Street name painted on the beachfront drive.
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('B O A R D W A L K   D R', 2900, 700);
    ctx.restore();
  }

  function drawPier(ctx, G) {
    var cfg = CB.CFG, pal = cfg.PALETTE;
    var p = cfg.PIER;
    ctx.fillStyle = pal.pierEdge;
    ctx.fillRect(p.x0 - 4, p.y0 - 4, p.x1 - p.x0 + 8, p.y1 - p.y0 + 8);
    ctx.fillStyle = pal.pierWood;
    ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (var x = p.x0 + 20; x < p.x1; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, p.y0); ctx.lineTo(x, p.y1); ctx.stroke();
    }
    // Pier lamps.
    ctx.fillStyle = '#ffd27a';
    for (var lx = p.x0 + 60; lx < p.x1; lx += 120) {
      ctx.beginPath(); ctx.arc(lx, p.y0 + 8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(lx, p.y1 - 8, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawContainers(ctx, G) {
    G.city.containers.forEach(function (c) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(c.x + 6, c.y + 6, c.w, c.h);
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      ctx.beginPath();
      for (var x = c.x + 18; x < c.x + c.w; x += 18) {
        ctx.moveTo(x, c.y + 3); ctx.lineTo(x, c.y + c.h - 3);
      }
      ctx.stroke();
    });
  }
  CB.drawWorld = drawWorld;
  CB.updateCamera = updateCamera;

  // 2.5D buildings: a long shadow to the east, two shaded side faces,
  // a lit roof, and windows that glow amber at dusk.
  function drawBuildings(ctx, G) {
    var sorted = G.city.buildings.slice().sort(function (a, b) { return a.y - b.y; });
    sorted.forEach(function (b) {
      var dx = b.hgt * 0.22, dy = b.hgt * 0.34;
      // Long shadow toward the east (the sun is low in the west).
      ctx.fillStyle = 'rgba(20,16,10,0.28)';
      ctx.fillRect(b.x + b.hgt * 0.4, b.y + b.hgt * 0.3, b.w, b.h);
      // South and east faces.
      ctx.fillStyle = shade(b.color, -28);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + dx, b.y + b.h - dy);
      ctx.lineTo(b.x + dx + b.w, b.y + b.h - dy); ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(b.color, -14);
      ctx.beginPath();
      ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w + dx, b.y - dy);
      ctx.lineTo(b.x + b.w + dx, b.y + b.h - dy); ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.closePath(); ctx.fill();
      // Roof.
      ctx.fillStyle = b.top;
      ctx.fillRect(b.x + dx, b.y - dy, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + dx, b.y - dy, b.w, b.h);
      // Lit windows on the roof face, deterministic from the seed.
      var cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 26));
      for (var i = 0; i < cols; i++) {
        for (var j = 0; j < rows; j++) {
          var lit = ((b.seed * 31 + i * 17 + j * 13) % 100) < 52;
          ctx.fillStyle = lit ? '#ffd27a' : '#2c3844';
          ctx.fillRect(b.x + dx + 8 + i * ((b.w - 16) / cols), b.y - dy + 8 + j * ((b.h - 16) / rows), 9, 7);
        }
      }
    });
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    var b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawPalms(ctx, G) {
    G.city.palms.forEach(function (palm) {
      ctx.strokeStyle = '#7a5a38';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.lineTo(palm.x + 3, palm.y - 18); ctx.stroke();
      ctx.fillStyle = '#3f7a44';
      for (var i = 0; i < 5; i++) {
        var a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(palm.x + 3 + Math.cos(a) * 10, palm.y - 18 + Math.sin(a) * 8, 11, 4.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // The mission beacon: a pulsing ring and light column on the target.
  function drawMissionBeacon(ctx, G) {
    if (G.screen !== 'playing') return;
    var marker = CB.missionMarker(G);
    if (!marker) return;
    var pulse = (Math.sin(G.time * 4) + 1) / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,58,' + (0.5 + pulse * 0.5) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(marker.x, marker.y, 26 + pulse * 10, 0, Math.PI * 2); ctx.stroke();
    var grad = ctx.createLinearGradient(marker.x, marker.y - 130, marker.x, marker.y);
    grad.addColorStop(0, 'rgba(255,210,58,0)');
    grad.addColorStop(1, 'rgba(255,210,58,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(marker.x - 8, marker.y - 130, 16, 130);
    ctx.restore();
  }

  function drawCar(ctx, G, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    var w = car.w, h = car.h;
    // Soft shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(3, 5, w / 2 + 2, h / 2 + 3, 0, 0, Math.PI * 2); ctx.fill();
    var body = car.wrecked ? '#3a3a3a' : car.color;
    ctx.fillStyle = body;
    CB._roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    CB._roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.stroke();
    // Roof and windshield.
    ctx.fillStyle = car.wrecked ? '#2a2a2a' : shade(body, 18);
    CB._roundRect(ctx, -w / 6, -h / 2 + 3, w / 3, h - 6, 4); ctx.fill();
    ctx.fillStyle = 'rgba(40,60,80,0.85)';
    ctx.fillRect(w / 6, -h / 2 + 4, 5, h - 8);
    // Headlights.
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath(); ctx.arc(w / 2 - 2, -h / 2 + 4, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2 - 2, h / 2 - 4, 2.5, 0, Math.PI * 2); ctx.fill();
    // Police light bar, flashing.
    if (car.isPolice && !car.wrecked) {
      var on = Math.floor(G.time * 6) % 2 === 0;
      ctx.fillStyle = on ? '#ff2a2a' : '#2a6aff';
      ctx.fillRect(-4, -h / 2 + 2, 8, 6);
      ctx.fillStyle = on ? '#2a6aff' : '#ff2a2a';
      ctx.fillRect(-4, h / 2 - 8, 8, 6);
    }
    // Mission target ring.
    if ((car.missionTarget || car.missionVan) && !car.wrecked) {
      ctx.strokeStyle = 'rgba(255,210,58,' + (0.6 + Math.sin(G.time * 5) * 0.4) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(ctx, G, ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8b48a';
      ctx.beginPath(); ctx.arc(14, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8b48a';
      ctx.beginPath(); ctx.arc(0, -2, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawRival(ctx, G, r) {
    if (r.hp <= 0) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle + Math.PI / 2);
      ctx.fillStyle = '#8a2a2a';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = r.flash > 0 ? '#ffffff' : '#a02a2a';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8b48a';
    ctx.beginPath(); ctx.arc(0, -2, 4.5, 0, Math.PI * 2); ctx.fill();
    // Gun toward the player.
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(r.angle) * 18, Math.sin(r.angle) * 18); ctx.stroke();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-14, -24, 28, 5);
    ctx.fillStyle = '#d83a2e';
    ctx.fillRect(-14, -24, 28 * (r.hp / 100), 5);
    ctx.restore();
  }

  function drawPlayer(ctx, G) {
    var p = G.player;
    if (!p.onFoot) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.hurtTimer > 0 && Math.floor(G.time * 12) % 2 === 0 ? '#ff8a7a' : '#2e6ad8';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e8c89a';
    ctx.beginPath(); ctx.arc(0, -2, 5.5, 0, Math.PI * 2); ctx.fill();
    // Pistol toward the mouse.
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(p.aimAngle) * 22, Math.sin(p.aimAngle) * 22); ctx.stroke();
    if (G.muzzle > 0) {
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath(); ctx.arc(Math.cos(p.aimAngle) * 26, Math.sin(p.aimAngle) * 26, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBullets(ctx, G) {
    ctx.save();
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    G.bullets.forEach(function (b) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawParticles(ctx, G) {
    G.particles.forEach(function (pt) {
      if (pt.kind === 'smoke') {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife) * 0.45;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - pt.life / pt.maxLife), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (pt.kind === 'ring') {
        ctx.strokeStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - pt.life / pt.maxLife), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
  }

  // Headlight cones, low alpha so the dusk reads without washing out.
  function drawHeadlights(ctx, G) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    G.cars.forEach(function (car) {
      if (car.wrecked || car.isParked) return;
      var moving = car.isPlayer || car.isTraffic || car.isPolice;
      if (!moving) return;
      var grad = ctx.createLinearGradient(car.x, car.y,
        car.x + Math.cos(car.angle) * 150, car.y + Math.sin(car.angle) * 150);
      grad.addColorStop(0, 'rgba(255,240,180,0.14)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(car.x + Math.cos(car.angle) * 20, car.y + Math.sin(car.angle) * 20);
      var a1 = car.angle - 0.22, a2 = car.angle + 0.22;
      ctx.lineTo(car.x + Math.cos(a1) * 150, car.y + Math.sin(a1) * 150);
      ctx.lineTo(car.x + Math.cos(a2) * 150, car.y + Math.sin(a2) * 150);
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }
  CB._shade = shade;
})();
