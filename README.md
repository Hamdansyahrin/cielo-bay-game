# Cielo Bay — steal cars, run the fixer's missions, outrun the heat

An original open-world crime game for the make.fun GTA 6 bounty. A
sun-soaked coastal city, built from scratch in plain canvas JavaScript
— no libraries, no network at play time, every sound synthesized live.

## Play

Serve `game/` with any static server and open `index.html`:

```
python3 -m http.server --directory game 8903
```

Or run the entry program, which copies the game and screenshots to
the output directory and writes `dossier.json`:

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## The city

Cielo Bay is a fictional coastal city with three districts — Downtown
towers, the Beachfront with its pier, and the industrial Port — named
streets, sidewalks, palms, a beach with animated water, parked cars and
lit windows at dusk. Traffic drives the road grid with headlights;
pedestrians walk the sidewalks and flee gunfire and theft.

## The game

- **On foot:** WASD / arrows to walk, Shift to run, mouse to aim,
  click to fire the pistol, F or right-click to swing a melee hit.
- **Driving:** E enters or leaves any car. Stealing a car someone sees
  raises your wanted level. W/S accelerate and brake, A/D steer,
  Space is the handbrake for drifts. Cars take damage, smoke, and
  wreck; collisions with buildings, cars and pedestrians all count.
- **Wanted 1–5 stars:** theft, hit-and-runs and shots raise the heat
  when witnessed. Police cruisers spawn on the roads and chase you
  down; at 4–5 stars they set roadblocks. Stay hidden and the heat
  cools off. Get caught and it is BUSTED; lose all your health and it
  is WASTED.
- **Missions from Mara Voss, the fixer:** five jobs with phone
  briefings, minimap markers and cash + respect payouts — lift a
  marked Comet and deliver it to the chop shop; a timed four-drop
  courier run; survive a three-star chase and lose the heat; clear
  the rival Vipers off the pier; and the finale, an armored van from
  the port at four stars. Free roam after the fifth.
- **HUD:** wanted stars, cash, respect, health, speedometer, an
  objective banner, phone toasts, and a live minimap with roads,
  police blips and the mission marker.
- **Save:** progress (cash, respect, job, position) saves to
  localStorage; continue from the title screen with C.
- **Sound:** WebAudio synth only — engine, sirens, shots, crashes,
  pickups. M mutes.

## Screenshots

Four deterministic scenes, posed by `game/src/shots.js` from
`?shot=` with a fixed seed: downtown on foot, driving the beachfront,
a three-star pursuit, and the pier job. See `shots.json`.

## Originality

Cielo Bay, Mara Voss, the Vipers, and every street, car and sound are
original fiction made for this entry. Nothing here is from Rockstar
Games' Grand Theft Auto series or any other commercial game.
