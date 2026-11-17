// Cielo Bay — hud.js: everything nailed to the screen — minimap with
// police blips, wanted stars, cash, health, speedometer, the objective
// banner, phone toasts, and the full-screen states.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};
  var CFG = CB.CFG;

  CB.toast = function (G, text, kind) {
    G.toasts.push({ text: text, kind: kind || 'info', t: 0, life: kind === 'phone' ? 7 : 4 });
    if (G.toasts.length > 3) G.toasts.shift();
  };
  CB.updateToasts = function (G, dt) {
    for (var i = G.toasts.length - 1; i >= 0; i--) {
      G.toasts[i].t += dt;
      if (G.toasts[i].t > G.toasts[i].life) G.toasts.splice(i, 1);
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  CB.drawHUD = function (G, ctx) {
    // Objective banner, top centre — measures the full string it draws.
    var obj = CB.missionObjective(G);
    var m = CB.MISSIONS[G.missionIndex < 5 ? G.missionIndex : 4];
    var title = G.missionState ? ('JOB ' + (G.missionState.idx + 1) + ': ' + m.title.toUpperCase()) : (G.missionIndex >= 5 ? 'CIELO BAY' : 'MARA VOSS');
    ctx.font = 'bold 15px system-ui, sans-serif';
    var w1 = ctx.measureText(title).width;
    ctx.font = '14px system-ui, sans-serif';
    var w2 = ctx.measureText(obj).width;
    var bw = Math.max(w1, w2) + 36;
    ctx.fillStyle = 'rgba(16,10,26,0.78)';
    roundRect(ctx, (CFG.VIEW_W - bw) / 2, 12, bw, 52, 10); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, CFG.VIEW_W / 2, 33);
    ctx.fillStyle = '#fff'; ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(obj, CFG.VIEW_W / 2, 54);
    // Cash + respect, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(16,10,26,0.78)';
    roundRect(ctx, 14, 12, 178, 52, 10); ctx.fill();
    ctx.fillStyle = '#7fb069'; ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('$' + G.cash.toLocaleString('en-US'), 26, 37);
    ctx.fillStyle = '#e8b4ff'; ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('RESPECT ' + G.respect, 26, 56);
    // Wanted stars, top right above the minimap.
    ctx.font = '22px system-ui, sans-serif'; ctx.textAlign = 'right';
    for (var s = 0; s < 5; s++) {
      ctx.fillStyle = s < G.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', CFG.VIEW_W - 18 - (4 - s) * 24, 36);
    }
    if (G.wanted > 0 && G.hiddenT > 2.5) {
      ctx.fillStyle = '#57b6d9'; ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('HIDDEN — heat cooling', CFG.VIEW_W - 18, 54);
    }
    if (G.bustT > 0.15) {
      ctx.fillStyle = '#ff4757'; ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('THE PD IS ON YOU — MOVE!', CFG.VIEW_W - 18, 54);
    }
    drawMinimap(G, ctx);
    // Health, bottom centre-left; speedometer while driving, bottom-left.
    var p = G.player;
    ctx.fillStyle = 'rgba(16,10,26,0.78)';
    roundRect(ctx, 14, CFG.VIEW_H - 40, 210, 26, 8); ctx.fill();
    ctx.fillStyle = p.hp > 35 ? '#7fb069' : '#e63946';
    roundRect(ctx, 18, CFG.VIEW_H - 36, 202 * Math.max(0, p.hp / p.maxHp), 18, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('HEALTH', 24, CFG.VIEW_H - 23);
    if (p.car) {
      var spd = Math.round(Math.abs(p.car.speed) * 0.62);
      ctx.fillStyle = 'rgba(16,10,26,0.85)';
      roundRect(ctx, 14, CFG.VIEW_H - 118, 150, 66, 10); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(String(spd), 28, CFG.VIEW_H - 76);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('MPH  ' + p.car.name.toUpperCase(), 84, CFG.VIEW_H - 76);
      ctx.fillStyle = p.car.hp > 40 ? '#7fb069' : '#e63946';
      roundRect(ctx, 26, CFG.VIEW_H - 68, 126 * Math.max(0, p.car.hp / p.car.maxHp), 8, 4); ctx.fill();
    }
    drawToasts(G, ctx);
    // Off-screen mission marker arrow at the view edge.
    var tp = CB.missionTargetPos(G);
    if (tp) {
      var sx = tp.x - G.camera.x, sy = tp.y - G.camera.y;
      if (sx < 0 || sy < 0 || sx > CFG.VIEW_W || sy > CFG.VIEW_H) {
        var cx = Math.max(28, Math.min(CFG.VIEW_W - 28, sx)), cy = Math.max(84, Math.min(CFG.VIEW_H - 28, sy));
        var ang = Math.atan2(sy - CFG.VIEW_H / 2, sx - CFG.VIEW_W / 2);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  };

  function drawMinimap(G, ctx) {
    var MW = 216, MH = 144, MX = CFG.VIEW_W - MW - 14, MY = 66;
    var sx = MW / CFG.WORLD_W, sy = MH / CFG.WORLD_H;
    ctx.fillStyle = 'rgba(14,20,28,0.88)';
    roundRect(ctx, MX - 4, MY - 4, MW + 8, MH + 8, 10); ctx.fill();
    ctx.fillStyle = '#2e7ea6';
    ctx.fillRect(MX, MY + CFG.WATER_Y * sy, MW, MH - CFG.WATER_Y * sy);
    ctx.fillStyle = '#c98a5e';
    ctx.fillRect(MX + CFG.PIER.x * sx, MY + CFG.PIER.y * sy, CFG.PIER.w * sx, CFG.PIER.h * sy);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
    CFG.ROADS_X.forEach(function (r) { ctx.beginPath(); ctx.moveTo(MX + r * sx, MY); ctx.lineTo(MX + r * sx, MY + MH); ctx.stroke(); });
    CFG.ROADS_Y.forEach(function (r) { ctx.beginPath(); ctx.moveTo(MX, MY + r * sy); ctx.lineTo(MX + MW, MY + r * sy); ctx.stroke(); });
    var tp = CB.missionTargetPos(G);
    if (tp) {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(MX + tp.x * sx, MY + tp.y * sy, 4.5 + Math.sin(G.time * 5) * 1.2, 0, Math.PI * 2); ctx.fill();
    }
    G.police.forEach(function (c) {
      ctx.fillStyle = Math.floor(G.time * 4) % 2 ? '#ff4757' : '#57b6d9';
      ctx.fillRect(MX + c.x * sx - 2.5, MY + c.y * sy - 2.5, 5, 5);
    });
    ctx.fillStyle = '#fff';
    var px = MX + G.player.x * sx, py = MY + G.player.y * sy;
    ctx.save(); ctx.translate(px, py); ctx.rotate(G.player.car ? G.player.car.angle : G.player.angle);
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(CB.districtAt(G.player.x).name, MX + 4, MY + MH - 5);
  }

  function drawToasts(G, ctx) {
    var y = CFG.VIEW_H - 150;
    ctx.textAlign = 'left';
    for (var i = G.toasts.length - 1; i >= 0; i--) {
      var t = G.toasts[i];
      var label = t.kind === 'phone' ? '📱 ' : t.kind === 'heat' ? '🚔 ' : t.kind === 'good' ? '💰 ' : '• ';
      var text = label + t.text;
      if (text.length > 92) text = text.slice(0, 91) + '…';
      ctx.font = '13px system-ui, sans-serif';
      var w = ctx.measureText(text).width + 24;
      var a = t.t < 0.25 ? t.t / 0.25 : (t.t > t.life - 0.6 ? Math.max(0, (t.life - t.t) / 0.6) : 1);
      ctx.fillStyle = 'rgba(16,10,26,' + (0.82 * a) + ')';
      roundRect(ctx, 14, y, w, 26, 8); ctx.fill();
      ctx.fillStyle = t.kind === 'heat' ? '#ff9f43' : t.kind === 'good' ? '#7fb069' : '#ffffff';
      ctx.globalAlpha = a;
      ctx.fillText(text, 26, y + 17);
      ctx.globalAlpha = 1;
      y -= 32;
    }
  }

  function panel(ctx, title, titleColor, lines, foot) {
    ctx.fillStyle = 'rgba(12,8,20,0.82)';
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = titleColor; ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText(title, CFG.VIEW_W / 2, 150);
    ctx.font = '16px system-ui, sans-serif'; ctx.fillStyle = '#f4f1de';
    lines.forEach(function (ln, i) { ctx.fillText(ln, CFG.VIEW_W / 2, 205 + i * 25); });
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(foot, CFG.VIEW_W / 2, 205 + lines.length * 25 + 22);
  }

  CB.drawScreens = function (G, ctx) {
    if (G.screen === 'title') {
      // A live slice of the city drifts behind the title card.
      ctx.fillStyle = 'rgba(12,8,20,0.45)';
      ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
      panel(ctx, 'CIELO BAY', '#ffd23f', [
        'A sun-soaked coastal city with a fixer problem.',
        'Mara Voss has five jobs. The Cielo Bay PD has other plans.',
        '',
        'WASD / arrows — move      Shift — run      Mouse — aim',
        'Click — pistol      F — melee      E — enter / exit any car',
        'In a car: W/S drive, A/D steer, Space — handbrake',
        'P — pause      M — mute      Wanted cools while you stay hidden'
      ], CB.hasSave() ? 'ENTER — new game      C — continue      ($' + (CB.loadGame() || {}).cash + ' saved)' : 'ENTER — start');
    } else if (G.screen === 'paused') {
      panel(ctx, 'PAUSED', '#ffffff', ['The bay waits for no one. Well — just this once.'], 'P or ENTER — resume');
    } else if (G.screen === 'busted') {
      panel(ctx, 'BUSTED', '#ff4757', ['The CBPD got their cuffs on you.', 'Bail and towing cost you $150.'], 'ENTER — back on the street');
    } else if (G.screen === 'wasted') {
      panel(ctx, 'WASTED', '#e63946', ['You flatlined on the asphalt of Cielo Bay.', 'The hospital patched you up. The bill is your pride.'], 'ENTER — wake up');
    }
  };
})();
