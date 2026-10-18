# Volute

Volute is a browser arcade puzzle set in a geothermal pump hall. Mineral cores travel along a winding channel toward an intake. Aim the injector, fire matching charges into the train, and extract groups of three or more before the intake spends your cells. Chain reactions raise the score; marked cores grant temporary machinery effects. Clear five levels to finish the run.

All art, animation frames, particle systems, music, and sound effects are committed under `public/assets/`. The production build only bundles those files and runs without an asset-generation tool or external service.

## Run

```sh
npm ci
npm run dev
```

Open the URL Vite prints. To create and serve the static production site:

```sh
npm run build
npm run preview
```

The site is emitted to `dist/` and can be served from a root or sub-path. Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` to verify the source.

## Controls

| Action                         | Control                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| Aim                            | Mouse, pen, touch pointer, or A / D and left / right arrows |
| Fire                           | Click, tap, or Space                                        |
| Swap loaded and queued charges | X                                                           |
| Pause or resume                | Escape or P                                                 |
| Mute or unmute                 | M                                                           |
| Start or dismiss an ending     | Enter, Space, click, or tap                                 |
| Debug overlay                  | Backtick                                                    |

The game uses the Simple 2D engine for input, audio, canvas fit, frame timing, and the debug overlay. The game simulation and debug surface are in `src/game.ts`.
