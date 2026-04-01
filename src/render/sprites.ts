import { CellType } from '../game/types'
import { C } from './colors'

// Each sprite draws into a CELL×CELL box with top-left at (x, y).
// CELL = 20px. All coordinates are relative to that origin.

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  type: CellType,
  x: number,
  y: number
): void {
  switch (type) {
    case CellType.Ship:             drawPlayerShip(ctx, x, y); break
    case CellType.Star:             drawStar(ctx, x, y); break
    case CellType.Planet:           drawPlanet(ctx, x, y); break
    case CellType.BlackHole:        drawBlackHole(ctx, x, y); break
    case CellType.EnemyBattleship:  drawBattleship(ctx, x, y); break
    case CellType.EnemyCommand:     drawCommandShip(ctx, x, y); break
    case CellType.EnemyScout:       drawScout(ctx, x, y); break
    case CellType.EnemySupply:      drawSupplyShip(ctx, x, y); break
    case CellType.EnemyBase:        drawEnemyBase(ctx, x, y); break
    case CellType.StarBase:         drawStarBase(ctx, x, y); break
    case CellType.ResearchStation:  drawResearch(ctx, x, y); break
    case CellType.SupplyDepot:      drawDepot(ctx, x, y); break
    case CellType.Nova:             drawNova(ctx, x, y); break
  }
}

// ── Player Ship (Enterprise, facing right, white) ─────────────────────────

function drawPlayerShip(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.white

  // Saucer (left/front)
  ctx.beginPath()
  ctx.ellipse(x + 6, y + 10, 4, 6, 0, 0, Math.PI * 2)
  ctx.fill()

  // Neck
  ctx.fillRect(x + 8, y + 8, 3, 4)

  // Secondary hull (body)
  ctx.fillRect(x + 10, y + 8, 8, 4)

  // Upper nacelle
  ctx.fillRect(x + 10, y + 3, 7, 2)
  // Upper pylon
  ctx.fillRect(x + 12, y + 5, 2, 3)

  // Lower nacelle
  ctx.fillRect(x + 10, y + 15, 7, 2)
  // Lower pylon
  ctx.fillRect(x + 12, y + 12, 2, 3)

  // Nacelle glow (bussard collectors — orange tip)
  ctx.fillStyle = '#FF6633'
  ctx.fillRect(x + 17, y + 3, 1, 2)
  ctx.fillRect(x + 17, y + 15, 1, 2)
}

// ── Star (yellow, 4-point) ────────────────────────────────────────────────

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + 10, cy = y + 10

  // Glow
  ctx.fillStyle = '#554400'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  // Core
  ctx.fillStyle = C.yellow
  ctx.beginPath()
  ctx.arc(cx, cy, 2, 0, Math.PI * 2)
  ctx.fill()

  // Spikes
  ctx.strokeStyle = C.yellow
  ctx.lineWidth = 1
  for (const [dx, dy] of [[0,-5],[0,5],[-5,0],[5,0]]) {
    ctx.beginPath()
    ctx.moveTo(cx + dx * 0.4, cy + dy * 0.4)
    ctx.lineTo(cx + dx, cy + dy)
    ctx.stroke()
  }
}

// ── Planet (green, with surface stripe) ──────────────────────────────────

function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + 10, cy = y + 10

  ctx.fillStyle = '#005500'
  ctx.beginPath()
  ctx.arc(cx, cy, 6, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = C.green
  ctx.beginPath()
  ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.fill()

  // Surface bands
  ctx.fillStyle = '#003300'
  ctx.fillRect(cx - 5, cy - 1, 10, 2)
  ctx.fillRect(cx - 3, cy - 4, 6, 1)

  // Atmosphere highlight
  ctx.strokeStyle = '#44FF44'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.arc(cx - 1, cy - 1, 4, Math.PI * 1.1, Math.PI * 1.6)
  ctx.stroke()
}

// ── Black Hole ────────────────────────────────────────────────────────────

function drawBlackHole(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + 10, cy = y + 10

  // Accretion disk glow
  ctx.strokeStyle = '#443300'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, cy, 7, 3, -0.3, 0, Math.PI * 2)
  ctx.stroke()

  // Event horizon
  ctx.fillStyle = '#000000'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()

  // Inner glow ring
  ctx.strokeStyle = '#886600'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.stroke()
}

// ── Enemy Battleship (Klingon D7, facing left, cyan) ─────────────────────

function drawBattleship(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.cyan

  // Main body
  ctx.fillRect(x + 4, y + 8, 11, 4)

  // Nose (pointing left)
  ctx.beginPath()
  ctx.moveTo(x + 4, y + 8)
  ctx.lineTo(x, y + 10)
  ctx.lineTo(x + 4, y + 12)
  ctx.closePath()
  ctx.fill()

  // Upper wing (swept forward)
  ctx.beginPath()
  ctx.moveTo(x + 9, y + 8)
  ctx.lineTo(x + 17, y + 3)
  ctx.lineTo(x + 19, y + 5)
  ctx.lineTo(x + 12, y + 8)
  ctx.closePath()
  ctx.fill()

  // Lower wing
  ctx.beginPath()
  ctx.moveTo(x + 9, y + 12)
  ctx.lineTo(x + 17, y + 17)
  ctx.lineTo(x + 19, y + 15)
  ctx.lineTo(x + 12, y + 12)
  ctx.closePath()
  ctx.fill()
}

// ── Command Ship (larger, red) ────────────────────────────────────────────

function drawCommandShip(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.red

  // Thicker body
  ctx.fillRect(x + 3, y + 7, 12, 6)

  // Heavy nose
  ctx.beginPath()
  ctx.moveTo(x + 3, y + 7)
  ctx.lineTo(x, y + 10)
  ctx.lineTo(x + 3, y + 13)
  ctx.closePath()
  ctx.fill()

  // "Command horns" — two short projections at rear
  ctx.fillRect(x + 13, y + 5, 5, 2)
  ctx.fillRect(x + 13, y + 13, 5, 2)

  // Wide swept wings
  ctx.beginPath()
  ctx.moveTo(x + 8, y + 7)
  ctx.lineTo(x + 18, y + 2)
  ctx.lineTo(x + 18, y + 6)
  ctx.lineTo(x + 11, y + 7)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(x + 8, y + 13)
  ctx.lineTo(x + 18, y + 18)
  ctx.lineTo(x + 18, y + 14)
  ctx.lineTo(x + 11, y + 13)
  ctx.closePath()
  ctx.fill()
}

// ── Scout Ship (narrow wedge, magenta) ────────────────────────────────────

function drawScout(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.magenta

  // Slim dart shape
  ctx.beginPath()
  ctx.moveTo(x, y + 10)     // nose (left)
  ctx.lineTo(x + 8, y + 8)
  ctx.lineTo(x + 18, y + 6)
  ctx.lineTo(x + 18, y + 8)
  ctx.lineTo(x + 8, y + 10)
  ctx.lineTo(x + 18, y + 12)
  ctx.lineTo(x + 18, y + 14)
  ctx.lineTo(x + 8, y + 12)
  ctx.closePath()
  ctx.fill()
}

// ── Supply Ship (boxy freighter, green) ───────────────────────────────────

function drawSupplyShip(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#006600'

  // Main cargo box
  ctx.fillRect(x + 3, y + 6, 13, 8)

  ctx.fillStyle = C.green
  // Nose
  ctx.fillRect(x + 1, y + 8, 3, 4)
  // Engine pods (rear top/bottom)
  ctx.fillRect(x + 14, y + 5, 4, 3)
  ctx.fillRect(x + 14, y + 12, 4, 3)

  // Cargo hold stripes
  ctx.fillStyle = '#004400'
  ctx.fillRect(x + 5, y + 7, 1, 6)
  ctx.fillRect(x + 9, y + 7, 1, 6)
  ctx.fillRect(x + 13, y + 7, 1, 6)
}

// ── Enemy Base ────────────────────────────────────────────────────────────

function drawEnemyBase(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.red

  // Diamond shape
  ctx.beginPath()
  ctx.moveTo(x + 10, y + 2)
  ctx.lineTo(x + 18, y + 10)
  ctx.lineTo(x + 10, y + 18)
  ctx.lineTo(x + 2, y + 10)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#660000'
  ctx.beginPath()
  ctx.moveTo(x + 10, y + 5)
  ctx.lineTo(x + 15, y + 10)
  ctx.lineTo(x + 10, y + 15)
  ctx.lineTo(x + 5, y + 10)
  ctx.closePath()
  ctx.fill()
}

// ── StarBase (Federation, yellow cross-station) ───────────────────────────

function drawStarBase(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.yellow

  // Central hub
  ctx.beginPath()
  ctx.arc(x + 10, y + 10, 3, 0, Math.PI * 2)
  ctx.fill()

  // Four arms
  ctx.fillRect(x + 2, y + 8, 6, 4)   // left
  ctx.fillRect(x + 12, y + 8, 6, 4)  // right
  ctx.fillRect(x + 8, y + 2, 4, 6)   // top
  ctx.fillRect(x + 8, y + 12, 4, 6)  // bottom

  // Arm end pads
  ctx.fillRect(x + 1, y + 7, 2, 6)
  ctx.fillRect(x + 17, y + 7, 2, 6)
  ctx.fillRect(x + 7, y + 1, 6, 2)
  ctx.fillRect(x + 7, y + 17, 6, 2)
}

// ── Research Station (cyan, angled cross) ─────────────────────────────────

function drawResearch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = C.cyan

  // Hub
  ctx.beginPath()
  ctx.arc(x + 10, y + 10, 2, 0, Math.PI * 2)
  ctx.fill()

  // Diagonal arms (X pattern)
  const arm = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x + 10, y + 10)
    ctx.lineTo(x2, y2)
    ctx.lineWidth = 3
    ctx.strokeStyle = C.cyan
    ctx.stroke()
  }
  arm(x + 3, y + 3, x + 17, y + 17)
  arm(x + 17, y + 3, x + 3, y + 17)

  // End caps
  ctx.lineWidth = 1
  for (const [ex, ey] of [[3,3],[17,3],[3,17],[17,17]]) {
    ctx.beginPath()
    ctx.arc(x + ex, y + ey, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ── Supply Depot (green, rectangular dock) ────────────────────────────────

function drawDepot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#004400'
  ctx.fillRect(x + 2, y + 4, 16, 12)

  ctx.fillStyle = C.green
  // Outer frame
  ctx.strokeStyle = C.green
  ctx.lineWidth = 1.5
  ctx.strokeRect(x + 3, y + 5, 14, 10)

  // Interior dividers
  ctx.strokeRect(x + 7, y + 5, 6, 10)

  // Docking ports
  ctx.fillRect(x + 8, y + 3, 4, 2)
  ctx.fillRect(x + 8, y + 15, 4, 2)
}

// ── Nova (supernova explosion, white) ─────────────────────────────────────

function drawNova(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x + 10, cy = y + 10

  // Outer glow
  ctx.fillStyle = '#332200'
  ctx.beginPath()
  ctx.arc(cx, cy, 8, 0, Math.PI * 2)
  ctx.fill()

  // Explosion rays
  ctx.strokeStyle = C.yellow
  ctx.lineWidth = 1
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3)
    ctx.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8)
    ctx.stroke()
  }

  // Inner bright core
  ctx.fillStyle = C.white
  ctx.beginPath()
  ctx.arc(cx, cy, 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = C.yellow
  ctx.beginPath()
  ctx.arc(cx, cy, 1, 0, Math.PI * 2)
  ctx.fill()
}
