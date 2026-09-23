# Splashline Racers

A mobile-first 3D water slide race for static hosting. The game bundles Three.js, its procedural art, audio, and PWA files; it makes no runtime requests to a CDN or server API. Progress and preferences stay in browser `localStorage`.

## Play locally

```sh
npm ci
npm run dev
```

Open the address printed by Vite. Use A/D or the arrow keys to steer, Space to jump, P or Escape to pause, and F for fullscreen. On touch screens, steer with the thumb joystick and tap Jump with a second finger.

## Publish on GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
3. The included [deployment workflow](.github/workflows/deploy.yml) runs `npm ci` and `npm run build` on each push to `main`.

The Vite base is derived from `GITHUB_REPOSITORY`, so a repository named `repo-name` builds for `https://username.github.io/repo-name/`. The generated service worker registers with scope `/repo-name/`; it cannot control sibling apps on the same host. For a local production build with a specific repository path, run:

```sh
GITHUB_REPOSITORY=username/repo-name npm run build
```

Serve `dist/` at `/repo-name/` to test that build. Vite's preview server serves from `/`, so it does not emulate the GitHub Pages path.

## Implementation

- A Catmull-Rom centerline is sampled into position, tangent, right, and banked up vectors. The slide floor and rails are generated from those samples. The inside shortcut has its own sampled route and saves about 30 meters.
- Each racer tracks distance `s`, lateral offset `u`, speed, air velocity, and sliding/airborne/falling/finished state. Landing uses a downward raycast against BVH-accelerated slide meshes.
- Thirteen primitive-mesh humanoids race with shared geometry and palette materials. NPC skill, risk, and aggression affect line choice, shortcut attempts, speed, and jump failures.
- Auto graphics mode starts with a 1.0 pixel ratio cap on touch devices and reduces resolution on a slow desktop. High mode caps at 1.5. Shadows and postprocessing are optional; both default off on mobile.
- The generated service worker precaches the app shell and build assets, including icons, for offline reload after the first online visit.

## Completion data
| Metric | Amount |
|---|---:|
| **Total elapsed time** | **21 min 27.871 sec** |
| Time to first token | 5.236 sec |
| **Input tokens** | **5,626,680** |
| └ Cached input tokens | **5,517,056** |
| └ Uncached input tokens | **109,624** |
| **Output tokens** | **44,294** |
| └ Reasoning output tokens | **13,749** |
| **Total tokens** | **5,670,974** |

- Model: gpt-sol-6
- Effort: extra-high
- Cost: $1.77
- Site: https://kjlkurt.github.io/waterslide-game-gpt-6-sol/
