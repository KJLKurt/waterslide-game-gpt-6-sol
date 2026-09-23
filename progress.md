Original prompt: Build a mobile-first 3D water slide racing PWA for GitHub Pages with Three.js, 13 humanoid racers, track-constrained physics, NPC AI, responsive touch/keyboard controls, local-only storage, adaptive quality, offline service worker, and race/practice results.

## Production brief
- Loop: choose racer -> countdown -> steer/jump through turns, ramps, gap and optional inside shortcut -> rank by sampled track progress -> finish or fall -> results/retry.
- Art: original candy-blue plastic slide over a pastel sea, procedural humanoids, primitive accessories, crisp translucent HUD. No external textures or runtime downloads.
- States: menu, settings, countdown, racing, paused, finish, fall. Race has a genuine loss condition; practice returns to checkpoints.
- Track: sampled Catmull-Rom centerline, banked ribbon geometry with a main-track jump gap and a separate inside shortcut route. All routes own sample frames and slide meshes.
- Acceptance: 13 racers, stable frame-limited simulation, touch and keyboard input, camera, local persistence, GitHub subpath build, offline cached build.

## Art inventory
- slide/floor/rails: generated ribbon meshes with separate reusable materials; sliding, gap, shortcut and finish zones are color coded.
- racer: shared capsule/sphere/cylinder geometries; skin, suit, goggle, cap, ring materials; sliding/leaning/air poses.
- UI: CSS menu/HUD/pause/results; joystick and jump button; locally generated app icons.

## Review
Pass: all states have feedback; track gaps and shortcut are visible; fall and win are real; procedural parts are replaceable by scene components without touching track simulation.

## Work log
- Initialized empty project and recorded implementation plan.
- Implemented Vite/Three.js project, procedural ribbon course, shortcut, two ramps, main/shortcut gaps, 13 primitive humanoids, race simulation, controls, menus, settings, persistence, and PWA configuration.
- Browser playtest: full race completed; player placed 6/13 in one run, confirming NPC competition. Another run fell off the edge. Shortcut steering entered the branch and saved about 30 m.
- Portrait and landscape screenshots inspected. Real simultaneous joystick and jump input worked. Practice edge fall respawned at checkpoint 288 m. No browser console errors in these runs.
- GitHub-style subpath build tested with static server; service worker controlled only /splashline-racers/ and offline reload showed menu and canvas without errors.
- Added BVH floor raycasts, mobile shadow defaults, sky gradient, optional music, runtime auto resolution fallback, and README.
- Final GitHub-style build completed, desktop Space/A input checked, mobile settings toggles rendered and ran without console errors, and offline reload rechecked.
- No open implementation TODOs. The repository can be published with the included GitHub Pages workflow.
