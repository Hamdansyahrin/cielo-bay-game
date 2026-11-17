// Cielo Bay — hud.js: everything drawn over the world — wanted stars,
// cash and health, the speedometer, the objective banner, Mara's phone
// toasts, the minimap, and the title / pause / busted / wasted screens.
// The HUD is drawn every frame on the same canvas as the world.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function toast(G, text, secs) {
    G.toasts.push({ text: text, t: secs || 3, max: secs || 3 });
    if (G.toasts.length > 4) G.toasts.shift();
  }

  function drawStars(ctx, x, y, wanted) {
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (var i = 0; i < 5; i++) {
      ctx.fillStyle = i < wanted ? '#ffd23a' : 'rgba(255,255,255,0.28)';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeText('★', x + i * 30, y);
      ctx.fillText('★', x + i * 30, y);
    }
  }

  function drawTopLeft(ctx, G) {
    var p = G.player;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,18,0.55)';
    roundRect(ctx, 12, 12, 250, 108, 10); ctx.fill();
    drawStars(ctx, 26, 34, G.wanted);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('$' + Math.round(G.cash).toLocaleString('en-US'), 26, 66);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('RESPECT ' + G.respect, 150, 66);
    // Health bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, 26, 86, 180, 12, 6); ctx.fill();
    ctx.fillStyle = p.hp > 35 ? '#5ec95e' : '#d83a2e';
    roundRect(ctx, 26, 86, 180 * Math.max(0, p.hp / p.maxHp), 12, 6); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px sans-serif';
    ctx.fillText('HP ' + Math.ceil(p.hp), 212, 92);
    ctx.restore();
  }

  function drawSpeedo(ctx, G) {
    var p = G.player;
    if (!p.car || p.onFoot) return;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,18,0.55)';
    roundRect(ctx, 12, 640, 190, 66, 10); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(CB.speedKmh(p.car) + '', 26, 664);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('km/h  ·  ' + p.car.model.toUpperCase(), 84, 666);
    // Car damage bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, 26, 690, 150, 8, 4); ctx.fill();
    ctx.fillStyle = p.car.damage > 70 ? '#d83a2e' : '#e8b73a';
    roundRect(ctx, 26, 690, 150 * Math.max(0, 1 - p.car.damage / 100), 8, 4); ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  CB.toast = toast;
  CB.drawTopLeft = drawTopLeft;
  CB.drawSpeedo = drawSpeedo;
  CB._roundRect = roundRect;

  function drawMinimap(ctx, G) {
    var x0 = 1058, y0 = 12, w = 210, h = 150;
    var sx = w / CB.CFG.WORLD_W, sy = h / CB.CFG.WORLD_H;
    ctx.save();
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    roundRect(ctx, x0, y0, w, h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    roundRect(ctx, x0, y0, w, h, 8); ctx.stroke();
    // Water and sand on the east edge.
    ctx.fillStyle = '#1d5f7a';
    ctx.fillRect(x0 + CB.CFG.WATER_X0 * sx, y0, w - CB.CFG.WATER_X0 * sx, h);
    ctx.fillStyle = '#e6cd96';
    ctx.fillRect(x0 + CB.CFG.SAND_X0 * sx, y0, (CB.CFG.WATER_X0 - CB.CFG.SAND_X0) * sx, h);
    // Roads.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    CB.CFG.ROADS_V.forEach(function (rx) {
      ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + h); ctx.stroke();
    });
    CB.CFG.ROADS_H.forEach(function (ry) {
      ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + w, y0 + ry * sy); ctx.stroke();
    });
    // Buildings as faint dots.
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    G.city.buildings.forEach(function (b) {
      ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    });
    // Traffic as grey dots, police as red blips.
    ctx.fillStyle = 'rgba(200,200,200,0.8)';
    G.cars.forEach(function (c) {
      if (c.isTraffic) ctx.fillRect(x0 + c.x * sx - 1, y0 + c.y * sy - 1, 2, 2);
    });
    ctx.fillStyle = '#ff4a3a';
    G.police.forEach(function (c) {
      ctx.beginPath(); ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
    });
    // Mission marker: pulsing yellow ring.
    var marker = CB.missionMarker(G);
    if (marker) {
      var pulse = 3 + Math.sin(G.time * 5) * 1.5;
      ctx.strokeStyle = '#ffd23a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, pulse + 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath(); ctx.arc(x0 + marker.x * sx, y0 + marker.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Player: white triangle, pointing where they face.
    var p = G.player;
    var ang = p.car ? p.car.angle : (p.faceAngle || 0);
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  // The objective banner: sized by measuring the full displayed string.
  function drawBanner(ctx, G) {
    var text = CB.objectiveText(G);
    ctx.save();
    ctx.font = 'bold 16px sans-serif';
    var w = ctx.measureText(text).width + 36;
    var x = (CB.CFG.VIEW_W - w) / 2, y = 14;
    ctx.fillStyle = 'rgba(10,12,18,0.62)';
    roundRect(ctx, x, y, w, 32, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,122,0.7)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, 32, 8); ctx.stroke();
    ctx.fillStyle = '#ffd27a';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, CB.CFG.VIEW_W / 2, y + 17);
    ctx.restore();
  }

  // Mara's phone toasts, bottom-right, long ones truncated with ...
  function drawToasts(ctx, G) {
    ctx.save();
    ctx.font = '14px sans-serif';
    var y = CB.CFG.VIEW_H - 16;
    for (var i = G.toasts.length - 1; i >= 0; i--) {
      var t = G.toasts[i];
      var text = t.text;
      while (text.length > 4 && ctx.measureText(text).width > 500) {
        text = text.slice(0, -4) + '...';
      }
      var w = ctx.measureText(text).width + 28;
      var x = CB.CFG.VIEW_W - w - 14;
      var h = 34;
      y -= h + 8;
      ctx.globalAlpha = Math.min(1, t.t / 0.5 + 0.2);
      ctx.fillStyle = 'rgba(12,16,22,0.78)';
      roundRect(ctx, x, y, w, h, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(94,201,94,0.8)';
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, w, h, 8); ctx.stroke();
      ctx.fillStyle = '#e8f5e8';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 14, y + h / 2 + 1);
    }
    ctx.restore();
  }

  function drawCrosshair(ctx, G) {
    if (G.player.car || G.screen !== 'playing') return;
    var mx = G.mouse.x, my = G.mouse.y;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13);
    ctx.stroke();
    ctx.restore();
  }

  CB.drawMinimap = drawMinimap;
  CB.drawBanner = drawBanner;
  CB.drawToasts = drawToasts;
  CB.drawCrosshair = drawCrosshair;

  function drawStreetName(ctx, G) {
    ctx.save();
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var name = G.city.streetName(G.player.x, G.player.y);
    var text = name + '  ·  Cielo Bay';
    var w = ctx.measureText(text).width + 24;
    ctx.fillStyle = 'rgba(10,12,18,0.5)';
    roundRect(ctx, (CB.CFG.VIEW_W - w) / 2, CB.CFG.VIEW_H - 30, w, 22, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(text, CB.CFG.VIEW_W / 2, CB.CFG.VIEW_H - 19);
    ctx.restore();
  }

  function drawTitle(ctx, G) {
    var W = CB.CFG.VIEW_W, H = CB.CFG.VIEW_H;
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2a1a3a');
    grad.addColorStop(0.55, '#c95a3a');
    grad.addColorStop(1, '#e8a34a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Sun.
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath(); ctx.arc(W / 2, 190, 64, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,122,0.35)';
    ctx.beginPath(); ctx.arc(W / 2, 190, 96, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18;
    ctx.fillText('CIELO BAY', W / 2, 130);
    ctx.shadowBlur = 0;
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#ffe9b8';
    ctx.fillText('Steal cars. Run the fixer\'s jobs. Outrun the heat.', W / 2, 300);
    // Story card.
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    roundRect(ctx, W / 2 - 330, 330, 660, 150, 12); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    var story = [
      'You are fresh out of the county lockup, back in Cielo Bay with',
      'nothing but a burner phone. Mara Voss, the fixer, has five jobs',
      'for you — lift a Comet, run her courier drops, lose a three-star',
      'chase, take the pier back from the Vipers, and steal an armored',
      'van from the port. The city is yours. The heat is real.'
    ];
    story.forEach(function (line, i) { ctx.fillText(line, W / 2 - 310, 358 + i * 24); });
    // Controls.
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('WASD / arrows — move & drive      Mouse — aim      Click — shoot      F — melee', W / 2 - 310, 520);
    ctx.fillText('E — enter / leave a car      Space — handbrake      Shift — run      P — pause      M — mute', W / 2 - 310, 544);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    var hasSave = CB.Save.has();
    ctx.fillText(hasSave ? 'ENTER — start new game      C — continue ($' + (CB.Save.read() || {}).cash + ', job ' + ((CB.Save.read() || {}).mission + 1) + ' of 5)' : 'Press ENTER to start', W / 2, 600);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('An original game. Cielo Bay, Mara Voss and the Vipers are fictional — nothing here is from any commercial game.', W / 2, 660);
    ctx.restore();
  }

  function drawPause(ctx, G) {
    var W = CB.CFG.VIEW_W, H = CB.CFG.VIEW_H;
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,16,0.66)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('PAUSED', W / 2, H / 2 - 30);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText('P — resume      M — mute      Enter — resume', W / 2, H / 2 + 20);
    ctx.restore();
  }

  function drawEndScreen(ctx, G, kind) {
    var W = CB.CFG.VIEW_W, H = CB.CFG.VIEW_H;
    ctx.save();
    ctx.fillStyle = kind === 'busted' ? 'rgba(16,24,64,0.78)' : 'rgba(64,10,10,0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H / 2 - 20);
    ctx.font = '19px sans-serif';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(kind === 'busted'
      ? 'The Cielo Bay PD impounded your ride and fined you $200.'
      : 'Mara is not happy. You lost $150 and woke up at the hospital.',
      W / 2, H / 2 + 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press ENTER to get back out there', W / 2, H / 2 + 80);
    ctx.restore();
  }

  // One call draws every HUD layer for the current screen.
  function drawHUD(ctx, G) {
    if (G.screen === 'title') { drawTitle(ctx, G); return; }
    drawTopLeft(ctx, G);
    drawMinimap(ctx, G);
    drawBanner(ctx, G);
    drawSpeedo(ctx, G);
    drawToasts(ctx, G);
    drawCrosshair(ctx, G);
    drawStreetName(ctx, G);
    if (G.screen === 'paused') drawPause(ctx, G);
    if (G.screen === 'busted') drawEndScreen(ctx, G, 'busted');
    if (G.screen === 'wasted') drawEndScreen(ctx, G, 'wasted');
  }

  CB.drawStreetName = drawStreetName;
  CB.drawTitle = drawTitle;
  CB.drawPause = drawPause;
  CB.drawEndScreen = drawEndScreen;
  CB.drawHUD = drawHUD;
})();
