# Cielo Bay

**Cielo Bay — steal cars, run the fixer's jobs, outrun the heat.**

An original open-world crime game in the browser. A sun-soaked coastal city
of your own: three districts (Downtown towers, Beachfront and its pier, the
Port yard), traffic and pedestrians, cars to steal and drive, a five-star
wanted level with police pursuit and roadblocks, combat, and a five-mission
story from fixer Mara Voss.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
server). No network, no build step, no libraries — plain canvas + WebAudio.

- **WASD / arrows** — move on foot, **Shift** run, **mouse** aim, **click** shoot, **Q** melee
- **E** — enter / exit any car (stealing one in front of witnesses raises your wanted level)
- **W/S** drive, **A/D** steer, **Space** handbrake drift, **E** step out
- **P** pause — progress saves after every job (localStorage)

## The jobs

1. **The Lift** — steal the marked coupe, deliver it to Rook Auto Yard
2. **Hot Courier** — a timed run through four checkpoints across town
3. **Cooling Off** — survive three stars, then lose the heat completely
4. **Pier Claim** — clear the rival crew holding Lantern Pier
5. **The Armored Van** — take the van at the port, survive four stars, deliver it

Finish all five and Cielo Bay is yours — free roam, with faster cars spawning
on the streets.

## Structure

`game/src/` is one clear job per file: `config.js` (constants, palette,
districts, missions), `random.js` (seeded RNG), `city.js` (city generation),
`render.js` (2.5D world renderer), `entities.js` (traffic + pedestrians),
`player.js` (on foot + combat + car entry), `driving.js` (car physics +
traffic / pursuit driving), `police.js` (wanted + pursuit + roadblocks),
`missions.js` (the five-mission chain), `hud.js` (HUD + minimap + menus),
`audio.js` (WebAudio synth), `save.js` (localStorage), `shots.js`
(deterministic `?shot=` scenes), `main.js` (boot, loop, input, wiring).

Everything in this game — city, names, characters, story, art, sounds — is
original. Nothing from Rockstar Games' Grand Theft Auto or any other
commercial game.
