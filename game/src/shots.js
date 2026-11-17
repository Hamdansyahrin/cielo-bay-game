// Cielo Bay — shots.js: deterministic scene posing for screenshots.
// ?shot=cover|drive|chase|mission with a fixed seed arranges a busy,
// honest frame — real systems, real HUD, nothing faked — then flags
// window.__shot = 'ready' for the capture tool.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  function near(G, x, y, n, maker) {
    for (var i = 0; i < n; i++) {
      var a = CB.rng.range(0, Math.PI * 2), d = CB.rng.range(60, 260);
      maker(x + Math.cos(a) * d, y + Math.sin(a) * d, i);
    }
  }

  CB.poseShot = function (G, name) {
    G.screen = 'playing';
    if (name === 'cover') {
      CB.startMission(G, 0);
      G.player.x = 1085; G.player.y = 695; G.player.angle = 2.75;
      G.input.mouseX = 900; G.input.mouseY = 330;
      near(G, 880, 700, 5, function (x, y) { if (!CB.buildingAt(G.city, x, y, 8) && !CB.onRoad(x, y)) G.peds.push(CB.makePed(x, y, {})); });
      near(G, 1000, 620, 3, function (x, y) { G.cars.push(CB.makeCar(CB.nearestRoadX(x), y, -Math.PI / 2, {})); });
    } else if (name === 'drive') {
      CB.startMission(G, 0);
      var car = CB.makeCar(1750, 2172, 0, { color: '#e63946', name: 'Solstice' });
      car.speed = 235; G.cars.push(car);
      G.player.car = car; car.driver = true;
      G.player.x = car.x; G.player.y = car.y;
      near(G, 2150, 2150, 3, function (x, y) { G.cars.push(CB.makeCar(x, 2128, Math.PI, {})); });
      near(G, 1950, 2210, 4, function (x, y) { if (!CB.buildingAt(G.city, x, y, 8)) G.peds.push(CB.makePed(x, y, {})); });
    } else if (name === 'chase') {
      var ride = CB.makeCar(1400, 1250, -Math.PI / 2, { color: '#457b9d', name: 'Mako' });
      ride.speed = 260; G.cars.push(ride);
      G.player.car = ride; ride.driver = true;
      G.player.x = ride.x; G.player.y = ride.y;
      CB.startMission(G, 2); // sets exactly 3 stars + the chase objective
      var spots = [[1310, 1420], [1490, 1440], [1400, 1560]];
      for (var i = 0; i < spots.length; i++) {
        var c = CB.makeCar(spots[i][0], spots[i][1], -Math.PI / 2, { kind: 'police', color: '#e8e8f0', hp: 130 });
        c.name = 'CBPD Cruiser'; c.lastSeenX = ride.x; c.lastSeenY = ride.y; c.unseenT = 0; c.speed = 240;
        G.police.push(c);
      }
      G.lastSeenX = ride.x; G.lastSeenY = ride.y; G.lastSeenAt = 0;
    } else if (name === 'mission') {
      CB.startMission(G, 3);
      G.player.x = 2960; G.player.y = 1000; G.player.angle = 0.15;
      G.input.mouseX = 900; G.input.mouseY = 350;
      G.muzzleT = 0.05;
    }
    G.camera.x = Math.max(0, Math.min(CB.CFG.WORLD_W - CB.CFG.VIEW_W, G.player.x - CB.CFG.VIEW_W / 2));
    G.camera.y = Math.max(0, Math.min(CB.CFG.WORLD_H - CB.CFG.VIEW_H, G.player.y - CB.CFG.VIEW_H / 2));
  };
})();
