# Rebound FC

Third-person walled street football, built to play like Rematch: a ~94 × 60 m arena with rebound walls, aim-and-shoot with a centre reticle, three shot power levels with curve, skill moves, slide tackles, stamina and extra effort, and a rotating keeper.

- 1v1: two players, each team gets an AI keeper
- 2v2, 3v3, 4v4: real players only; the first teammate into the box is keeper
- MacBook (keyboard + mouse), iPad (touch) and game controllers

## Put it online for free (Render)

1. Upload everything in this folder to a GitHub repository (the `public` folder, `server.js`, `package.json` and `render.yaml` must be at the top level).
2. On [render.com](https://render.com): **New → Web Service**, pick the repository.
3. Region **Frankfurt**, build command `npm install`, start command `node server.js`, instance type **Free**.

The server downloads the 3D player model (the Mixamo-rigged "Xbot" from the three.js examples) once at startup and serves it at `/models/player.glb`. If that ever fails, the game falls back to its built-in players.

## Run it on your Mac

```
npm install
npm start
```

Then open http://localhost:3000.

## Files

- `public/index.html` – the game (built from `src/` by `python3 build.py`)
- `src/sim.js` – ball physics, players, keepers, tackles (shared by everyone in a match)
- `src/pose.js` – animation poses
- `src/app.js` – graphics, controls, camera, online play
- `server.js` – serves the game, the player model, and relays online matches
