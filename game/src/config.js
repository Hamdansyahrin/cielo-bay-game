// Cielo Bay — config.js: every constant the rest of the game reads.
// Palette, world geometry, district bands, street names, tuning.
(function () {
  'use strict';
  var CB = window.CB = window.CB || {};

  CB.CFG = {
    VIEW_W: 1280, VIEW_H: 720,
    WORLD_W: 3600, WORLD_H: 2400,
    ROAD_W: 92,
    // Road centre lines: vertical roads run north-south, horizontal east-west.
    ROADS_X: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400],
    ROADS_Y: [200, 600, 1000, 1400, 1800, 2150],
    WATER_Y: 2240,          // beach sand ends, water begins (south shore)
    PIER: { x: 2820, y: 880, w: 560, h: 240 },  // wooden deck, east marina
    PLAYER_SPEED: 205, PLAYER_RUN: 315, PLAYER_R: 13,
    BULLET_SPEED: 950, FIRE_COOLDOWN: 0.26, MELEE_RANGE: 46,
    SEEN_RADIUS: 240,        // a witness must be this close AND have line of sight
    POLICE_GIVE_UP: 8,       // seconds unseen before a cruiser quits
    HEAT_DECAY: 5.5,         // hidden seconds per star shed once no cruiser sees you
    SAVE_KEY: 'cielo-bay-save-v1'
  };

  CB.PALETTE = {
    sky: '#2a1a3a', sand: '#e8c98a', sandDark: '#d9b26e',
    water: '#2e7ea6', waterLight: '#57b6d9', foam: '#eaf7ff',
    road: '#3d3a44', roadLine: '#e8d44d', sidewalk: '#9a8f83',
    grass: '#5d8a4a', palm: '#3f7d3a', palmTrunk: '#8a6a44',
    deck: '#a97c50', deckDark: '#8a6238',
    player: '#ffd23f', ped: ['#ef6f6c', '#f2a65a', '#7fb069', '#5aa9e6', '#c77dff', '#f4f1de'],
    carBody: ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#e9c46a', '#6d6875', '#84a98c', '#ff8fa3'],
    police: '#f1fa8c', van: '#8d99ae'
  };

  CB.DISTRICTS = [
    { name: 'DOWNTOWN', x0: 0, x1: 1300, floors: [6, 14], tone: ['#5b4a68', '#6e5570', '#4a3f5c', '#7a5c6e'] },
    { name: 'BEACHFRONT', x0: 1300, x1: 2600, floors: [2, 6], tone: ['#c98a5e', '#d9a066', '#b87a52', '#e0aa72'] },
    { name: 'THE PORT', x0: 2600, x1: 3600, floors: [1, 3], tone: ['#6e6a5e', '#7d7668', '#5d5a50', '#8a8272'] }
  ];

  CB.STREETS_X = ['Solano Ave', 'Marina Blvd', 'Cielo Way', 'Palmera St', 'Voss Ave', 'Coral Ave', 'Harbor Rd', 'Dockside Ave', 'Breakwater Blvd'];
  CB.STREETS_Y = ['1st Street', 'Ember Row', 'Sunset Strip', 'Calle Brisa', 'Gullwing Terrace', 'Tidewater Lane'];

  CB.CAR_NAMES = ['Comet', 'Solstice', 'Brisa', 'Mako', 'Paloma', 'Turbolet', 'Cascada', 'Vireo'];
})();
