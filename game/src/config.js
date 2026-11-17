// Cielo Bay — config.js: every constant, palette, car definition and
// district of the city in one place, so the rest of the game reads
// numbers from here instead of hiding magic values in its logic.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  var CFG = {
    // View and world.
    VIEW_W: 1280,
    VIEW_H: 720,
    WORLD_W: 3200,
    WORLD_H: 2400,
    ROAD_W: 96,
    SIDEWALK: 26,
    // Road centre lines. x=600 is the player's spawn road; x=2900 is the
    // beachfront drive; y=2200 is the port road.
    ROADS_V: [200, 600, 1000, 1400, 1800, 2200, 2600, 2900],
    ROADS_H: [200, 600, 1000, 1400, 1800, 2200],
    // Beach and water: sand starts east of the beachfront drive, the sea
    // east of the sand. The pier runs from the drive out over the water.
    SAND_X0: 2960,
    WATER_X0: 3080,
    PIER: { x0: 2890, x1: 3190, y0: 966, y1: 1034 },
    // Landmarks.
    SPAWN: { x: 600, y: 1400 },
    CHOP_SHOP: { x: 600, y: 2110, r: 140 },
    VAN_SPAWN: { x: 1400, y: 2260 },
    MISSION_CAR: { x: 1032, y: 648 },
    PIER_MEET: { x: 3060, y: 1000 },
    // Sunset-warm palette. The sun sits low in the west, so shadows fall
    // long toward the east and every lit window glows amber.
    PALETTE: {
      ground: '#8a7f6d',
      block: '#a89a7f',
      blockAlt: '#9c8f76',
      road: '#3b3b44',
      roadEdge: '#2c2c33',
      laneDash: '#d8c56a',
      sidewalk: '#c9bda1',
      sand: '#e6cd96',
      sandWet: '#d9bd85',
      waterDeep: '#1d5f7a',
      waterShallow: '#3d8ea8',
      waterEdge: '#cfeef5',
      pierWood: '#8a6a48',
      pierEdge: '#6e5236',
      buildingDowntown: '#5a6b7d',
      buildingDowntownTop: '#7d93a8',
      buildingBeach: '#d9a06a',
      buildingBeachTop: '#eec39a',
      buildingPort: '#8a6a4a',
      buildingPortTop: '#a8845c',
      buildingHouse: '#c9a06a',
      windowLit: '#ffd27a',
      windowDark: '#2c3844',
      palmTrunk: '#7a5a38',
      palmLeaf: '#3f7a44',
      containerA: '#b0563a',
      containerB: '#4a7a8a',
      containerC: '#7a8a3a',
      grass: '#7d9155',
      parkPath: '#c9bda1'
    },
    // Named streets, for the HUD's street readout.
    STREET_V: {
      200: 'Coral Way', 600: 'Solano Ave', 1000: 'Marina Blvd',
      1400: 'Cielo St', 1800: 'Palma Ave', 2200: 'Harbor Rd',
      2600: 'Sunset Strip', 2900: 'Boardwalk Dr'
    },
    STREET_H: {
      200: 'Northgate Rd', 600: 'Tropicana Ln', 1000: 'Pier St',
      1400: 'Flamingo Ave', 1800: 'Docks Rd', 2200: 'Anchor Way'
    }
  };
  CB.CFG = CFG;

  // Vehicle definitions. accel is px/s^2, top is px/s, grip steers how
  // sharply a car turns, drift how much the handbrake slides it.
  CFG.CARS = {
    sedan:   { w: 46, h: 22, accel: 420, top: 430, brake: 700, turn: 2.6, grip: 0.92, colors: ['#c94f43', '#4a7a8a', '#d8c56a', '#7a8a9a'] },
    taxi:    { w: 46, h: 22, accel: 430, top: 440, brake: 720, turn: 2.7, grip: 0.92, colors: ['#e8b73a'] },
    sport:   { w: 48, h: 22, accel: 620, top: 560, brake: 800, turn: 3.1, grip: 0.94, colors: ['#d83a2e', '#2e6ad8', '#e8e8e8'] },
    super:   { w: 48, h: 21, accel: 780, top: 660, brake: 900, turn: 3.4, grip: 0.95, colors: ['#1a1a22', '#c9a227'] },
    van:     { w: 56, h: 26, accel: 340, top: 360, brake: 600, turn: 2.2, grip: 0.90, colors: ['#8a8a92', '#5a6b7d'] },
    armored: { w: 60, h: 28, accel: 380, top: 400, brake: 650, turn: 2.1, grip: 0.90, colors: ['#3a3f46'] },
    truck:   { w: 62, h: 26, accel: 300, top: 330, brake: 550, turn: 2.0, grip: 0.88, colors: ['#b0563a', '#4a7a8a'] },
    police:  { w: 48, h: 22, accel: 580, top: 540, brake: 850, turn: 3.0, grip: 0.94, colors: ['#1a2a3a'] }
  };
  // On-foot movement.
  CFG.WALK_SPEED = 190;
  CFG.RUN_SPEED = 305;
  CFG.PLAYER_RADIUS = 13;
  CFG.PLAYER_HP = 100;
  CFG.PISTOL_DAMAGE = 34;
  CFG.PISTOL_RANGE = 620;
  CFG.BULLET_SPEED = 950;
  CFG.MELEE_RANGE = 58;
  CFG.MELEE_DAMAGE = 42;
  // Wanted: points thresholds per star, and how heat cools off.
  CFG.WANTED_POINTS = [0, 25, 60, 110, 170, 240];
  CFG.CRIME_THEFT = 30;
  CFG.CRIME_HIT_PED = 35;
  CFG.CRIME_SHOT = 25;
  CFG.CRIME_KILL = 60;
  CFG.WITNESS_RADIUS = 380;
  CFG.HEAT_HIDDEN_SECS = 8;
  CFG.HEAT_DECAY_SECS = 2.2;
  // Mission rewards (cash) and respect.
  CFG.MISSION_REWARDS = [500, 750, 900, 1200, 2500];
  CFG.MISSION_RESPECT = [10, 15, 20, 25, 40];
  CFG.COURIER_TIME = 100;
  CFG.CHASE_SURVIVE_SECS = 25;
  // Traffic and crowd sizes.
  CFG.TRAFFIC_COUNT = 14;
  CFG.PARKED_COUNT = 10;
  CFG.PED_COUNT = 18;
  CFG.MAX_POLICE = 5;
  // Save key.
  CFG.SAVE_KEY = 'cielo-bay-save-v1';
  CB.CFG = CFG;
})();
