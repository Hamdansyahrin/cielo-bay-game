// config.js — constants, palette, districts, streets and tuning for Cielo Bay.
// Every name, street and character here is original fiction. No Rockstar/GTA content.
export const WORLD = { W: 3200, H: 2400, ROAD_W: 72, SIDEWALK: 16 };

// Sunset-warm palette: golden hour over a coastal city.
export const PALETTE = {
  groundDowntown: '#b99a6b',
  groundMidtown: '#c2a273',
  groundPort: '#a08b6d',
  sand: '#e8c98a',
  sandWet: '#d9b878',
  waterDeep: '#2e6f8e',
  waterShallow: '#4f9db5',
  waterGlint: '#ffd9a0',
  road: '#3d3a38',
  roadLine: '#e8d27a',
  sidewalk: '#8f8578',
  curb: '#6f675c',
  buildingTop: '#e8b07a',
  buildingSide: '#8a5f43',
  buildingGlass: '#ffd98a',
  roofA: '#c98a5a',
  roofB: '#7a6a8a',
  roofC: '#5a7a6a',
  palmTrunk: '#6b4a2f',
  palmLeaf: '#3f8a4a',
  pierWood: '#7a5a38',
  containerA: '#c95a3a',
  containerB: '#3a7ac9',
  containerC: '#5ac93a',
  grass: '#7a9a4a',
};

export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const STREET_NAMES_X = [
  'Solano Ave', 'Marina Blvd', 'Coral St', 'Palma Ave',
  'Harbor Rd', 'Sunset Way', 'Dune St',
];
export const STREET_NAMES_Y = [
  'Cielo St', 'Bayview Ave', 'Tradewind Rd', 'Lantern St', 'Anchor Ave', 'Port Rd',
];

// Three districts of the original city of Cielo Bay.
export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', x0: 0, y0: 0, x1: 1500, y1: 1300,
    ground: '#b99a6b', tall: true, heightMin: 46, heightMax: 120 },
  { id: 'beachfront', name: 'Beachfront', x0: 2600, y0: 0, x1: 3200, y1: 2400,
    ground: '#e8c98a', tall: false, heightMin: 14, heightMax: 34 },
  { id: 'port', name: 'Port', x0: 0, y0: 1900, x1: 2600, y1: 2400,
    ground: '#a08b6d', tall: false, heightMin: 18, heightMax: 44 },
  { id: 'midtown', name: 'Midtown', x0: 1500, y0: 0, x1: 2600, y1: 1900,
    ground: '#c2a273', tall: false, heightMin: 20, heightMax: 56 },
];

export function districtAt(x, y) {
  if (x >= 2600) return DISTRICTS[1];
  if (y >= 1900) return DISTRICTS[2];
  if (x < 1500 && y < 1300) return DISTRICTS[0];
  return DISTRICTS[3];
}

// Landmarks (original names).
export const LANDMARKS = {
  chopShop: { x: 2380, y: 2080, w: 150, h: 110, name: 'Rook Auto Yard' },
  pier: { x0: 2820, y0: 940, x1: 3180, y1: 1060, name: 'Lantern Pier' },
  beachX0: 2820,
  waterX0: 3020,
  portYard: { x0: 400, y0: 1980, x1: 2400, y1: 2340, name: 'Cielo Port Yard' },
  plaza: { x: 1000, y: 1000, r: 130, name: 'Solano Plaza' },
  hospital: { x: 1400, y: 600, name: 'Bay General' },
  playerStart: { x: 600, y: 660 },
};

// The five-mission chain from fixer Mara Voss. Original story.
export const MISSIONS = [
  {
    id: 'lift', name: 'The Lift',
    briefing: "Mara Voss: There's a coral coupe parked by Solano Plaza. Lift it and bring it to Rook Auto Yard. Quietly.",
    objective: 'Steal the marked coupe',
    deliverObjective: 'Deliver the coupe to Rook Auto Yard',
    reward: 500, respect: 10,
  },
  {
    id: 'courier', name: 'Hot Courier',
    briefing: 'Mara Voss: A package needs to cross town before the tide turns. Hit every checkpoint. The clock is real.',
    objective: 'Reach the next checkpoint',
    reward: 750, respect: 12,
  },
  {
    id: 'heat', name: 'Cooling Off',
    briefing: 'Mara Voss: You are too hot. Three stars and every cruiser in the bay is looking. Lose them. Stay out of sight.',
    objective: 'Lose the heat — get to 0 stars',
    reward: 1000, respect: 15,
  },
  {
    id: 'pier', name: 'Pier Claim',
    briefing: 'Mara Voss: The Tide Rats hold Lantern Pier and they owe me. Clear them out. Watch your back — they shoot.',
    objective: 'Clear the rivals on Lantern Pier',
    reward: 1200, respect: 20,
  },
  {
    id: 'van', name: 'The Armored Van',
    briefing: 'Mara Voss: One last job. An armored van sits in the port yard. Take it, survive four stars, and bring it home.',
    objective: 'Take the armored van at the port',
    deliverObjective: 'Deliver the van to Rook Auto Yard',
    reward: 2500, respect: 30,
  },
];

export const CAR_COLORS = [
  '#c93a3a', '#3a7ac9', '#e8c93a', '#e8e8e8', '#3a3a3a',
  '#5ac93a', '#c97a3a', '#8a3ac9', '#3ac9c9', '#d9a0b0',
];
export const POLICE_COLOR = '#2a4a8a';
export const PLAYER_CAR_COLOR = '#c93a3a';

export const PLAYER = {
  walkSpeed: 195, runSpeed: 315, radius: 14, health: 100,
  fireCooldown: 0.28, bulletSpeed: 780, bulletDamage: 34, meleeRange: 46, meleeDamage: 40,
};

export const CAR = {
  accel: 560, brake: 900, reverseAccel: 320, maxSpeed: 540,
  maxReverse: 180, turnRate: 2.6, grip: 6.5, driftGrip: 1.6,
  radius: 20, trafficSpeed: 190, policeSpeed: 560, damageSmokeAt: 45,
};

export const WANTED = {
  maxStars: 5, decayHiddenSeconds: 9, policePerStar: 1,
  bustDistance: 46, bustHoldSeconds: 1.6,
};

export const GAME = {
  saveKey: 'cielo-bay-save-v1',
  trafficCount: 26, pedCount: 34, policeMax: 6,
  missionRewardText: (m) => `+$${m.reward}  •  +${m.respect} respect`,
};
