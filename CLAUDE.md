# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WebTrek — a browser-based tribute to EGA Trek (Nels Anderson, 1992). Single-player space strategy game rendered on HTML5 Canvas, deployed to GitHub Pages.

## Commands

```bash
npm install       # install deps
npm run dev       # dev server at localhost:5173/webtrek/
npm run build     # TypeScript check + Vite build → dist/
npm run lint      # tsc --noEmit (type check only, no test framework yet)
npm run preview   # serve built dist/ locally
```

## Architecture

All game logic is pure TypeScript with no runtime dependencies beyond `@supabase/supabase-js` (reserved for leaderboards/save states, not yet wired up).

```
src/
  main.ts                  # entry: init Game, Renderer, keyboard loop
  game/
    types.ts               # all shared interfaces/enums (GameState, PlayerShip, etc.)
    Galaxy.ts              # procedural galaxy generation; exports generateGalaxy()
    Game.ts                # game logic class; all cmd* methods mutate this.state
  render/
    Renderer.ts            # canvas renderer; render(state, commandBuffer) called per frame
    colors.ts              # EGA palette constants
  input/
    CommandParser.ts       # maps text commands → Game method calls
```

**Data flow:** `main.ts` owns the game loop (`requestAnimationFrame`), keyboard input, and the command buffer string. Keystrokes accumulate in `commandBuffer`; Enter dispatches to `parseCommand()` which calls the appropriate `Game.cmd*()` method. `Game` mutates `this.state` in place. `Renderer.render()` reads state each frame and redraws the canvas.

**Galaxy structure:** 8×8 grid of quadrants, each quadrant is an 8×8 sector grid. `galaxy[][]` holds `GalaxyCell` (summary counts, scanned flag). `quadrant` on GameState is the currently-loaded `QuadrantData` (full `cells[][]` + enemy array). Quadrant data lives in `Game._quadrants[][]` — accessed when the player warps to a new quadrant.

**Combat:** `cmdFireLasers` / `cmdFireTorpedo` call `enemyAttack()` after player action. `enemyAttack()` may call `damageSystem()` which degrades a random `ShipSystem` entry.

## Deployment

Push to `main` → GitHub Actions builds and deploys to GitHub Pages at `/<repo-name>/`. The Vite `base` in `vite.config.ts` must match the GitHub repo name (currently `/webtrek/`).

To enable GitHub Pages: repo Settings → Pages → Source: GitHub Actions.

## Supabase (future)

When wiring up Supabase, use env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Vite exposes `VITE_*` vars to the client). Add `.env.local` for local dev (already gitignored).
