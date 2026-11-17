// Cielo Bay — render.js: draws the world — sunset blocks, roads with
// names, the beach and its animated water, height-shaded buildings
// throwing long shadows, palms, cars, people, and the weather of crime.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var CFG = CB.CFG, PAL = CB.PALETTE;

  function visible(cam, x, y, pad) {
    return x > cam.x - pad && x < cam.x + CFG.VIEW_W + pad && y > cam.y - pad && y < cam.y + CFG.VIEW_H + pad;
  }

  CB.drawWorld = function (G, ctx) {
    var cam = G.camera;
    ctx.fillStyle = PAL.sidewalk;
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    var x0 = cam.x, y0 = cam.y;
    // Water first (south shore + marina inlet), with a moving foam edge.
    ctx.fillStyle = PAL.water;
    ctx.fillRect(0, CFG.WATER_Y - y0, CFG.VIEW_W, CFG.VIEW_H);
    ctx.fillRect(CFG.PIER.x - 60 - x0, CFG.PIER.y - 150 - y0, CFG.VIEW_W, CFG.PIER.h + 300);
    ctx.fillStyle = PAL.waterLight;
    for (var w = 0; w < 26; w++) {
      var wx = ((w * 173 + Math.sin(G.time * 0.9 + w) * 22) % CFG.WORLD_W) - x0;
      var wy = CFG.WATER_Y + 34 + (w % 5) * 26 - y0;
      if (wx > -60 && wx < CFG.VIEW_W && wy > -10 && wy < CFG.VIEW_H) ctx.fillRect(wx, wy, 44, 3);
    }
    ctx.fillStyle = PAL.foam;
    for (var f = 0; f < 40; f++) {
      var fx = (f * 97) % CFG.WORLD_W - x0;
      var fy = CFG.WATER_Y + 18 + Math.sin(G.time * 1.6 + f * 1.3) * 5 - y0;
      if (fx > -30 && fx < CFG.VIEW_W) ctx.fillRect(fx, fy, 26, 3);
    }
    // Sand.
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(0, CFG.WATER_Y - 52 - y0, CFG.VIEW_W, 52);
    ctx.fillStyle = PAL.sandDark;
    ctx.fillRect(0, CFG.WATER_Y - 52 - y0, CFG.VIEW_W, 4);
    drawRoads(G, ctx);
    drawPier(G, ctx);
    drawGroundMarks(G, ctx);
    // Building shadows stretch north-west in the low sun, then bodies.
    var i, b;
    for (i = 0; i < G.city.buildings.length; i++) {
      b = G.city.buildings[i];
      if (!visible(cam, b.x + b.w / 2, b.y + b.h / 2, 320)) continue;
      ctx.fillStyle = 'rgba(20,10,30,0.34)';
      ctx.fillRect(b.x - x0 - b.hgt * 0.55, b.y - y0 - b.hgt * 0.3, b.w, b.h);
    }
    for (i = 0; i < G.city.buildings.length; i++) {
      b = G.city.buildings[i];
      if (!visible(cam, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
      drawBuilding(G, ctx, b);
    }
    for (i = 0; i < G.city.palms.length; i++) {
      var pm = G.city.palms[i];
      if (visible(cam, pm.x, pm.y, 40)) drawPalm(ctx, pm.x - x0, pm.y - y0, pm.s);
    }
  };

  function drawRoads(G, ctx) {
    var cam = G.camera, x0 = cam.x, y0 = cam.y, i;
    ctx.fillStyle = PAL.road;
    for (i = 0; i < CFG.ROADS_X.length; i++) ctx.fillRect(CFG.ROADS_X[i] - CFG.ROAD_W / 2 - x0, -y0, CFG.ROAD_W, CFG.WORLD_H);
    for (i = 0; i < CFG.ROADS_Y.length; i++) ctx.fillRect(-x0, CFG.ROADS_Y[i] - CFG.ROAD_W / 2 - y0, CFG.WORLD_W, CFG.ROAD_W);
    ctx.strokeStyle = PAL.roadLine; ctx.lineWidth = 3; ctx.setLineDash([22, 18]);
    ctx.beginPath();
    for (i = 0; i < CFG.ROADS_X.length; i++) { ctx.moveTo(CFG.ROADS_X[i] - x0, -y0); ctx.lineTo(CFG.ROADS_X[i] - x0, CFG.WORLD_H - y0); }
    for (i = 0; i < CFG.ROADS_Y.length; i++) { ctx.moveTo(-x0, CFG.ROADS_Y[i] - y0); ctx.lineTo(CFG.WORLD_W - x0, CFG.ROADS_Y[i] - y0); }
    ctx.stroke(); ctx.setLineDash([]);
    // Street names painted along the roads.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    for (i = 0; i < CFG.ROADS_X.length; i++) {
      var sx = CFG.ROADS_X[i] - x0;
      if (sx < -60 || sx > CFG.VIEW_W + 60) continue;
      for (var j = 0; j < CFG.ROADS_Y.length; j++) {
        var sy = CFG.ROADS_Y[j] - 62 - y0;
        if (sy < -20 || sy > CFG.VIEW_H + 20) continue;
        ctx.fillText(CB.STREETS_X[i].toUpperCase(), sx, sy);
      }
    }
    ctx.font = 'bold 12px system-ui, sans-serif';
    for (j = 0; j < CFG.ROADS_Y.length; j++) {
      var ty = CFG.ROADS_Y[j] - y0;
      if (ty < -20 || ty > CFG.VIEW_H + 20) continue;
      for (i = 0; i < CFG.ROADS_X.length; i++) {
        var tx = CFG.ROADS_X[i] + 120 - x0;
        if (tx < -60 || tx > CFG.VIEW_W + 60) continue;
        ctx.fillText(CB.STREETS_Y[j].toUpperCase(), tx, ty - 52);
      }
    }
    // District banners painted on the ground.
    ctx.font = 'bold 30px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.14)';
    CB.DISTRICTS.forEach(function (d) {
      ctx.fillText(d.name, (d.x0 + d.x1) / 2 - x0, 120 - y0);
    });
  }

  function drawPier(G, ctx) {
    var P = CFG.PIER, x = P.x - G.camera.x, y = P.y - G.camera.y;
    ctx.fillStyle = PAL.deck; ctx.fillRect(x, y, P.w, P.h);
    ctx.strokeStyle = PAL.deckDark; ctx.lineWidth = 2;
    for (var i = 0; i <= P.w; i += 28) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + P.h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('CIELO PIER', x + P.w / 2, y + 22);
  }

  function drawGroundMarks(G, ctx) {
    var x0 = G.camera.x, y0 = G.camera.y;
    // The chop shop: a painted lot ring + sign at the Port.
    var s = G.city.chopShop;
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(s.x - x0, s.y - y0, s.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('VOSS CHOP SHOP', s.x - x0, s.y - s.r - 10 - y0);
    // Mission beacon: a pillar of light on the current target.
    var tp = CB.missionTargetPos ? CB.missionTargetPos(G) : null;
    if (tp && G.screen === 'playing') {
      var bx = tp.x - x0, by = tp.y - y0;
      var grad = ctx.createLinearGradient(0, by - 190, 0, by);
      grad.addColorStop(0, 'rgba(255,210,63,0)');
      grad.addColorStop(1, 'rgba(255,210,63,0.5)');
      ctx.fillStyle = grad; ctx.fillRect(bx - 13, by - 190, 26, 190);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(bx, by, 10 + Math.sin(G.time * 4) * 2, 0, Math.PI * 2); ctx.fill();
    }
    // Courier checkpoint ring.
    var ms = G.missionState;
    if (ms && ms.idx === 1 && ms.checkpoints) {
      var cp = ms.checkpoints[ms.cpIndex];
      if (cp) {
        ctx.strokeStyle = '#57b6d9'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cp.x - x0, cp.y - y0, 40 + Math.sin(G.time * 5) * 5, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function drawBuilding(G, ctx, b) {
    var x = b.x - G.camera.x, y = b.y - G.camera.y;
    // Height-shaded top face lifted by the building's height.
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y - b.hgt * 0.28, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(x + 5, y - b.hgt * 0.28 + 5, b.w - 10, b.h - 10);
    // Lit windows: a seeded pattern per building, warm at dusk.
    var rng = new CB.RNG(b.litSeed);
    ctx.fillStyle = '#ffd98a';
    var cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 24));
    for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
      if (rng.chance(0.42)) ctx.fillRect(x + 9 + i * 26, y - b.hgt * 0.28 + 9 + j * 24, 11, 13);
    }
    if (b.floors >= 8) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CIELO', x + b.w / 2, y - b.hgt * 0.28 + 20);
    }
  }

  function drawPalm(ctx, x, y, s) {
    ctx.strokeStyle = PAL.palmTrunk; ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4 * s, y - 12 * s, x + 8 * s, y - 20 * s); ctx.stroke();
    ctx.strokeStyle = PAL.palm; ctx.lineWidth = 3 * s;
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath(); ctx.moveTo(x + 8 * s, y - 20 * s);
      ctx.quadraticCurveTo(x + 8 * s + Math.cos(a) * 13 * s, y - 20 * s + Math.sin(a) * 6 * s - 4, x + 8 * s + Math.cos(a) * 20 * s, y - 20 * s + Math.sin(a) * 10 * s + 3);
      ctx.stroke();
    }
  }

  CB.drawCar = function (G, ctx, car) {
    var x = car.x - G.camera.x, y = car.y - G.camera.y;
    ctx.save(); ctx.translate(x, y); ctx.rotate(car.angle);
    // Headlight cones at dusk.
    if (car.driver || car.kind === 'police') {
      var grad = ctx.createRadialGradient(car.w / 2, 0, 6, car.w / 2 + 60, 0, 95);
      grad.addColorStop(0, 'rgba(255,240,180,0.30)'); grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(car.w / 2, -7); ctx.lineTo(car.w / 2 + 95, -30); ctx.lineTo(car.w / 2 + 95, 30); ctx.lineTo(car.w / 2, 7); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
    ctx.fillStyle = car.hp <= 0 ? '#2c2c30' : car.color;
    ctx.fillRect(-car.w / 2, -car.h / 2, car.w, car.h);
    ctx.fillStyle = '#1d2733'; ctx.fillRect(-car.w * 0.16, -car.h / 2 + 3, car.w * 0.34, car.h - 6);
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(car.w / 2 - 3, -car.h / 2 + 2, 3, 5); ctx.fillRect(car.w / 2 - 3, car.h / 2 - 7, 3, 5);
    ctx.fillStyle = '#e63946'; ctx.fillRect(-car.w / 2, -car.h / 2 + 2, 3, 5); ctx.fillRect(-car.w / 2, car.h / 2 - 7, 3, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#274690'; ctx.fillRect(-8, -car.h / 2, 16, car.h);
      ctx.fillStyle = (Math.floor(G.time * 4) % 2) ? '#ff4757' : '#3742fa';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PD', 0, 3);
    }
    if (car.marked) {
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.strokeRect(-car.w / 2 - 3, -car.h / 2 - 3, car.w + 6, car.h + 6);
    }
    if (car.armored) {
      ctx.strokeStyle = '#dfe6ee'; ctx.lineWidth = 3; ctx.strokeRect(-car.w / 2 + 2, -car.h / 2 + 2, car.w - 4, car.h - 4);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ARMORED', 0, 3);
    }
    ctx.restore();
    if (car.marked && G.missionState && G.missionState.phase === 'steal') {
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('▼ STEAL', x, y - 30 + Math.sin(G.time * 3) * 3);
    }
  };

  CB.drawPed = function (G, ctx, p) {
    var x = p.x - G.camera.x, y = p.y - G.camera.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(x + 2, y + 3, 9, 0, Math.PI * 2); ctx.fill();
    if (p.hp <= 0) {
      ctx.fillStyle = p.color; ctx.fillRect(x - 11, y - 4, 22, 8);
      return;
    }
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : p.color;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c094';
    ctx.beginPath(); ctx.arc(x + Math.cos(p.angle) * 3, y + Math.sin(p.angle) * 3, 4.5, 0, Math.PI * 2); ctx.fill();
    if (p.rival) {
      ctx.fillStyle = '#e8b4ff'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('VIPER', x, y - 15);
      ctx.fillStyle = '#e63946'; ctx.fillRect(x - 12, y - 13, 24, 3);
      ctx.fillStyle = '#7fb069'; ctx.fillRect(x - 12, y - 13, 24 * Math.max(0, p.hp / p.maxHp), 3);
    }
  };

  CB.drawPlayer = function (G, ctx) {
    var p = G.player;
    if (p.car) return;
    var x = p.x - G.camera.x, y = p.y - G.camera.y;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(x + 2, y + 4, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : PAL.player;
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(p.angle) * 17, y + Math.sin(p.angle) * 17); ctx.stroke();
    ctx.fillStyle = '#f2c094';
    ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill();
    if (G.muzzleT > 0) {
      ctx.fillStyle = '#ffe66d';
      var mx = x + Math.cos(p.angle) * 24, my = y + Math.sin(p.angle) * 24;
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
    }
    if (p.meleeT > 0.2) {
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 22, p.angle - 0.7, p.angle + 0.7); ctx.stroke();
    }
  };

  CB.drawEffects = function (G, ctx) {
    var i, x, y;
    for (i = 0; i < G.bullets.length; i++) {
      var b = G.bullets[i];
      x = b.x - G.camera.x; y = b.y - G.camera.y;
      ctx.strokeStyle = b.foe ? '#ff9f43' : '#ffe66d'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - b.vx * 0.012, y - b.vy * 0.012); ctx.lineTo(x, y); ctx.stroke();
    }
    for (i = 0; i < G.particles.length; i++) {
      var pt = G.particles[i], a = 1 - pt.t / pt.life;
      x = pt.x - G.camera.x; y = pt.y - G.camera.y;
      if (pt.kind === 'smoke') ctx.fillStyle = 'rgba(70,70,80,' + (a * 0.55) + ')';
      else if (pt.kind === 'tire') ctx.fillStyle = 'rgba(200,200,200,' + (a * 0.4) + ')';
      else ctx.fillStyle = 'rgba(255,80,80,' + a + ')';
      ctx.beginPath(); ctx.arc(x, y, pt.size * (1 + pt.t * 1.6), 0, Math.PI * 2); ctx.fill();
    }
  };
})();
