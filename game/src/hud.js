// hud.js — HUD (wanted stars, cash, health, speedo), the minimap, objective
// banner, phone toasts, and the title / pause / busted / wasted screens.
import { WORLD, WANTED } from './config.js';
import { currentMission, missionObjectiveText } from './missions.js';

export function drawHUD(ctx, G, W, H) {
  if (G.screen === 'title') { drawTitle(ctx, G, W, H); return; }
  if (G.screen === 'busted') { drawEndScreen(ctx, G, W, H, 'BUSTED', 'The Cielo Bay police picked you up. Mara Voss posted your bail — it cost you 10% of your cash.'); return; }
  if (G.screen === 'wasted') { drawEndScreen(ctx, G, W, H, 'WASTED', 'You went down in Cielo Bay. Bay General patched you up — it cost you 10% of your cash.'); return; }
  if (G.screen === 'complete') { drawComplete(ctx, G, W, H); return; }

  drawTopBar(ctx, G, W);
  drawMinimap(ctx, G, W, H);
  drawObjective(ctx, G, W);
  drawBanner(ctx, G, W, H);
  drawToasts(ctx, G, W, H);
  drawSpeedo(ctx, G, W, H);
  drawHint(ctx, G, W, H);
  if (G.screen === 'paused') drawPaused(ctx, G, W, H);
}

function drawTopBar(ctx, G, W) {
  // Wanted stars, top-left.
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px sans-serif';
  let stars = '';
  for (let i = 0; i < WANTED.maxStars; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(12, 10, 190, 40);
  ctx.fillStyle = G.wanted > 0 ? '#ffd94a' : 'rgba(255,255,255,0.55)';
  ctx.fillText(stars, 20, 38);
  // Cash + respect.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(12, 56, 190, 66);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${G.player.cash}`, 20, 82);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Respect ${G.player.respect}`, 20, 104);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(12, 128, 190, 26);
  ctx.fillStyle = '#333';
  ctx.fillRect(20, 136, 174, 10);
  ctx.fillStyle = G.player.health > 40 ? '#5ac93a' : '#ff3a3a';
  ctx.fillRect(20, 136, 174 * Math.max(0, G.player.health / G.player.maxHealth), 10);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('HEALTH', 22, 133);
}

function drawMinimap(ctx, G, W, H) {
  const mw = 200, mh = 150;
  const x0 = W - mw - 14, y0 = H - mh - 14;
  const sx = mw / WORLD.W, sy = mh / WORLD.H;
  ctx.fillStyle = 'rgba(10,10,18,0.72)';
  ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
  // Water + beach.
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(x0 + G.city.waterX0 * sx, y0, (WORLD.W - G.city.waterX0) * sx, mh);
  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(x0 + G.city.beachX0 * sx, y0, (G.city.waterX0 - G.city.beachX0) * sx, mh);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (const rx of G.city.roadsX) {
    ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + mh); ctx.stroke();
  }
  for (const ry of G.city.roadsY) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + mw, y0 + ry * sy); ctx.stroke();
  }
  // Pier.
  ctx.strokeStyle = '#ffd98a';
  ctx.beginPath();
  ctx.moveTo(x0 + G.city.pier.x0 * sx, y0 + ((G.city.pier.y0 + G.city.pier.y1) / 2) * sy);
  ctx.lineTo(x0 + G.city.pier.x1 * sx, y0 + ((G.city.pier.y0 + G.city.pier.y1) / 2) * sy);
  ctx.stroke();
  // Mission marker.
  const mk = G.missions.marker;
  if (mk) {
    const pulse = 1 + Math.sin(G.time * 5) * 0.25;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath(); ctx.arc(x0 + mk.x * sx, y0 + mk.y * sy, 5 * pulse, 0, Math.PI * 2); ctx.fill();
  }
  // Police blips.
  for (const car of G.cars) {
    if (car.kind !== 'police') continue;
    ctx.fillStyle = car.mode === 'roadblock' ? '#ff7a3a' : '#3a7aff';
    ctx.beginPath(); ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player.
  const px = G.player.car ? G.player.car.x : G.player.x;
  const py = G.player.car ? G.player.car.y : G.player.y;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x0 + px * sx, y0 + py * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a9a8a';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x0 + px * sx, y0 + py * sy, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CIELO BAY', x0 + 2, y0 - 6);
}

function drawObjective(ctx, G, W) {
  const text = missionObjectiveText(G);
  const m = currentMission(G);
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  const w = Math.max(320, ctx.measureText(text).width + 48);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W / 2 - w / 2, 10, w, 34);
  ctx.fillStyle = '#ffd94a';
  ctx.fillText((m ? `JOB ${G.missions.index + 1}: ${m.name} — ` : '') + text, W / 2, 32);
}

function drawBanner(ctx, G, W, H) {
  const b = G.bannerState;
  if (!b || b.t <= 0) return;
  const alpha = Math.min(1, b.t);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(W / 2 - 300, H / 2 - 110, 600, 84);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(b.title, W / 2, H / 2 - 76);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  wrapText(ctx, b.text, W / 2, H / 2 - 48, 560, 20);
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}

function drawToasts(ctx, G, W, H) {
  ctx.textAlign = 'left';
  let y = H - 190;
  for (const t of G.toasts) {
    const alpha = Math.min(1, t.t / 0.5, (t.life - t.t) / 0.5);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = 'rgba(20,16,30,0.85)';
    const w = Math.min(420, ctx.measureText(t.text).width + 24);
    ctx.fillRect(14, y - 18, w, 30);
    ctx.fillStyle = t.fromMara ? '#ffd94a' : '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText((t.fromMara ? '📱 Mara: ' : '') + t.text, 22, y + 3);
    ctx.restore();
    y -= 34;
  }
}

function drawSpeedo(ctx, G, W, H) {
  if (!G.player.car) return;
  const car = G.player.car;
  const kmh = Math.round(Math.abs(car.speed) * 0.55);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W - 240, H - 190, 220, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`${kmh} km/h`, W - 26, H - 168);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = car.hp < 45 ? '#ff3a3a' : '#7dff8a';
  ctx.fillText(`CAR ${Math.max(0, Math.round(car.hp))}%`, W - 120, H - 168);
}

function drawHint(ctx, G, W, H) {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px sans-serif';
  const hint = G.player.onFoot
    ? 'WASD move • Shift run • Mouse aim • Click shoot • E enter car • P pause'
    : 'W/S drive • A/D steer • Space handbrake • E exit car • P pause';
  ctx.fillText(hint, W / 2, H - 12);
}

function drawPaused(ctx, G, W, H) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 10);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Press P to keep playing. Progress saves after every job.', W / 2, H / 2 + 24);
}

function drawTitle(ctx, G, W, H) {
  // Sunset gradient sky over the title.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2a1a4a');
  grad.addColorStop(0.55, '#c95a3a');
  grad.addColorStop(1, '#e8a34a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Sun.
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath(); ctx.arc(W / 2, H * 0.42, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,217,138,0.25)';
  ctx.beginPath(); ctx.arc(W / 2, H * 0.42, 110, 0, Math.PI * 2); ctx.fill();
  // Skyline silhouette.
  ctx.fillStyle = '#1a1030';
  const base = H * 0.72;
  let x = 0;
  const heights = [120, 200, 150, 260, 180, 230, 140, 280, 170, 210, 130, 240];
  for (let i = 0; i < heights.length; i++) {
    const bw = W / heights.length;
    ctx.fillRect(x, base - heights[i], bw - 6, heights[i] + H);
    x += bw;
  }
  ctx.fillStyle = '#0a0618';
  ctx.fillRect(0, base, W, H - base);
  // Title.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('CIELO BAY', W / 2, 150);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('steal cars • run the fixer\'s jobs • outrun the heat', W / 2, 190);
  // Story card.
  ctx.fillStyle = 'rgba(10,8,20,0.72)';
  ctx.fillRect(W / 2 - 330, 230, 660, 150);
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 330, 230, 660, 150);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  const story = [
    'You are a driver with nothing but a borrowed jacket and a fast right foot.',
    'Fixer Mara Voss has five jobs for you in the sun-soaked port city of Cielo Bay.',
    'Lift cars, run couriers, lose the heat, clear the pier — and take the armored van.',
  ];
  story.forEach((line, i) => ctx.fillText(line, W / 2, 268 + i * 26));
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(G.hasSave ? 'ENTER — continue your saved game' : 'ENTER or CLICK — start the story', W / 2, 348);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD move • Shift run • Mouse aim • Click shoot • E enter / exit car • Space handbrake • P pause', W / 2, 420);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game. No Rockstar / GTA content. Your progress saves in this browser.', W / 2, H - 24);
}

function drawEndScreen(ctx, G, W, H, title, sub) {
  ctx.fillStyle = 'rgba(10,6,16,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = title === 'BUSTED' ? '#3a7aff' : '#ff3a3a';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  wrapText(ctx, sub, W / 2, H / 2 + 6, 640, 24);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ENTER — back on the streets', W / 2, H / 2 + 70);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Cash $${G.player.cash}  •  Respect ${G.player.respect}  •  Jobs done ${G.missions.completedCount} / 5`, W / 2, H / 2 + 100);
}

function drawComplete(ctx, G, W, H) {
  ctx.fillStyle = 'rgba(10,20,10,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('CIELO BAY IS YOURS', W / 2, H / 2 - 60);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('All five of Mara\'s jobs are done. Free roam — faster cars now spawn on the streets.', W / 2, H / 2 - 20);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ENTER — keep driving', W / 2, H / 2 + 20);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Cash $${G.player.cash}  •  Respect ${G.player.respect}`, W / 2, H / 2 + 52);
}
