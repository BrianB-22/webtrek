import { GameState, GamePhase, CellType } from '../game/types'
import { GALAXY_SIZE, SECTOR_SIZE } from '../game/Galaxy'
import { C } from './colors'
import { TitleScreen, IntroState } from './TitleScreen'
import { drawSprite } from './sprites'

const CELL = 20
const GCELL_W = 44
const GCELL_H = 20

// Logical drawing resolution — all coordinates are in this space
const W = 800
const H = 520

type ViewerMode = 'space' | 'technical' | 'navigation' | 'damage'
const VIEWER_MODES: ViewerMode[] = ['space', 'technical', 'navigation', 'damage']
const VIEWER_CYCLE_MS = 5000

// sect.x = column, sect.y = row (0-indexed)
type SectPos = { x: number; y: number }

interface CombatAnim {
  type: 'laser' | 'torpedo' | 'enemyFire'
  start: number    // performance.now() — may be in the future for delayed anims
  duration: number
  src: SectPos
  dsts: SectPos[]
}

interface Layout {
  sector: { x: number; y: number }
  statusPanel: { x: number; y: number; w: number; h: number }
  galaxy: { x: number; y: number }
  phasers: { x: number; y: number; w: number; h: number }
  command: { x: number; y: number; w: number; h: number }
  shipInfo: { x: number; y: number; w: number; h: number }
  viewer: { x: number; y: number; w: number; h: number }
  systems: { x: number; y: number; w: number; h: number }
  messages: { x: number; y: number; w: number; h: number }
  damage: { x: number; y: number; w: number; h: number }
}

export class Renderer {
  private ctx: CanvasRenderingContext2D
  readonly canvas: HTMLCanvasElement
  private L: Layout
  private titleScreen = new TitleScreen()
  private viewerModeIdx = 0
  private viewerLastChange = 0
  private anims: CombatAnim[] = []

  // Layout geometry exposed for mouse hit-testing
  readonly CELL = CELL

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!

    // HiDPI / devicePixelRatio support — render at native pixel density
    const dpr = window.devicePixelRatio || 1
    const displayW = Math.round(Math.min(1600, window.innerWidth - 20))
    const displayH = Math.round(displayW * H / W)
    canvas.width  = displayW * dpr
    canvas.height = displayH * dpr
    canvas.style.width  = displayW + 'px'
    canvas.style.height = displayH + 'px'
    this.ctx.scale(displayW * dpr / W, displayH * dpr / H)

    const sectorW = SECTOR_SIZE * CELL + 20
    const sectorH = SECTOR_SIZE * CELL + 20
    const statusW = 194
    const mid = sectorH + 16
    const phaserH = 78, cmdH = 60, shipH = 86
    const rightPaneX = sectorW + 16 + statusW + 8
    const rightPaneW = W - rightPaneX - 4
    const viewerW = 208, systemsW = 164
    const logX = sectorW + 16

    this.L = {
      sector:      { x: 8, y: 8 },
      statusPanel: { x: sectorW + 16, y: 8, w: statusW, h: sectorH },
      galaxy:      { x: rightPaneX, y: 8 },
      phasers:     { x: 8, y: mid, w: 168, h: phaserH },
      command:     { x: 8, y: mid + phaserH + 6, w: 168, h: cmdH },
      shipInfo:    { x: 8, y: mid + phaserH + 6 + cmdH + 6, w: 168, h: shipH },
      viewer:      { x: 184, y: mid, w: viewerW, h: phaserH + 6 + cmdH + 6 + shipH },
      systems:     { x: 184 + viewerW + 4, y: mid, w: systemsW, h: phaserH + 6 + cmdH + 6 + shipH },
      messages:    { x: logX + statusW + 8, y: mid, w: rightPaneW, h: Math.floor((phaserH + 6 + cmdH + 6 + shipH) / 2) - 3 },
      damage:      { x: logX + statusW + 8, y: mid + Math.floor((phaserH + 6 + cmdH + 6 + shipH) / 2) + 3, w: rightPaneW, h: Math.floor((phaserH + 6 + cmdH + 6 + shipH) / 2) - 3 },
    }
  }

  // ── Public layout accessors for mouse hit-testing ─────────────────────────

  getSectorOrigin(): { x: number; y: number } {
    return { x: this.L.sector.x, y: this.L.sector.y }
  }

  getGalaxyOrigin(): { x: number; y: number } {
    return { x: this.L.galaxy.x + 18, y: this.L.galaxy.y + 22 }
  }

  // Convert CSS client coordinates → logical 800×520 drawing coordinates
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * W / rect.width,
      y: (clientY - rect.top)  * H / rect.height,
    }
  }

  // ── Combat animation queue ────────────────────────────────────────────────

  // Player phaser beam to each enemy
  queueLaserAnim(src: SectPos, dsts: SectPos[]): void {
    if (dsts.length === 0) return
    this.anims.push({ type: 'laser', start: performance.now(), duration: 450, src, dsts })
  }

  // Player torpedo moving to target sector
  queueTorpedoAnim(src: SectPos, dst: SectPos): void {
    this.anims.push({ type: 'torpedo', start: performance.now(), duration: 600, src, dsts: [dst] })
  }

  // Enemy return fire — delayed so it plays after player's shot
  queueEnemyFireAnim(srcs: SectPos[], dst: SectPos): void {
    if (srcs.length === 0) return
    this.anims.push({ type: 'enemyFire', start: performance.now() + 380, duration: 380, src: dst, dsts: srcs })
  }

  // ── Render dispatch ───────────────────────────────────────────────────────

  render(state: GameState, commandBuffer: string, intro: IntroState, now = performance.now()): void {
    const { ctx } = this
    ctx.fillStyle = C.black
    ctx.fillRect(0, 0, W, H)

    if (state.phase === GamePhase.Title) {
      this.titleScreen.draw(ctx, W, H, now)
      return
    }

    if (state.phase === GamePhase.Setup) {
      this.titleScreen.drawSetup(ctx, W, H, intro)
      return
    }

    if (state.phase === GamePhase.Briefing) {
      this.titleScreen.drawBriefing(ctx, W, H, intro)
      return
    }

    // Cycle viewer mode
    if (now - this.viewerLastChange > VIEWER_CYCLE_MS) {
      this.viewerModeIdx = (this.viewerModeIdx + 1) % VIEWER_MODES.length
      this.viewerLastChange = now
    }

    this.drawSectorMap(state, now)
    this.drawStatusPanel(state)
    this.drawGalaxyChart(state)
    this.drawPhasers(state)
    this.drawCommand(state, commandBuffer)
    this.drawShipInfo(state)
    this.drawViewer(state, VIEWER_MODES[this.viewerModeIdx], now)
    this.drawSystems(state)
    this.drawMessages(state)
    this.drawDamageReport(state)
  }

  // ── Sector Map ────────────────────────────────────────────────────────────

  private drawSectorMap(state: GameState, now: number): void {
    const { ctx, L } = this
    const ox = L.sector.x, oy = L.sector.y
    const w = SECTOR_SIZE * CELL + 2, h = SECTOR_SIZE * CELL + 2

    ctx.fillStyle = C.white
    ctx.font = '16px VT323'
    for (let x = 0; x < SECTOR_SIZE; x++) ctx.fillText(String(x + 1), ox + 5 + x * CELL, oy - 2)
    for (let y = 0; y < SECTOR_SIZE; y++) ctx.fillText(String(y + 1), ox - 10, oy + 14 + y * CELL)

    ctx.strokeStyle = C.hudBorder
    ctx.lineWidth = 1
    ctx.strokeRect(ox, oy, w, h)
    ctx.fillStyle = C.sectorBg
    ctx.fillRect(ox + 1, oy + 1, w - 2, h - 2)

    const cells = state.quadrant.cells
    for (let row = 0; row < SECTOR_SIZE; row++) {
      for (let col = 0; col < SECTOR_SIZE; col++) {
        const type = cells[row][col]
        if (type !== CellType.Empty) {
          drawSprite(ctx, type, ox + 1 + col * CELL, oy + 1 + row * CELL)
        }
      }
    }

    this.drawCombatAnims(ox, oy, now)
  }

  // Convert sector grid position to pixel center within the sector map
  private sectPx(s: SectPos, ox: number, oy: number): { px: number; py: number } {
    return {
      px: ox + 1 + s.x * CELL + CELL / 2,
      py: oy + 1 + s.y * CELL + CELL / 2,
    }
  }

  private drawCombatAnims(ox: number, oy: number, now: number): void {
    // Expire finished anims
    this.anims = this.anims.filter(a => now < a.start + a.duration)

    const { ctx } = this
    for (const anim of this.anims) {
      if (now < anim.start) continue  // not started yet (delayed enemy fire)

      const t = (now - anim.start) / anim.duration   // 0 → 1
      const alpha = Math.max(0, 1 - t)               // fade out over lifetime

      ctx.save()

      if (anim.type === 'laser') {
        // Bright yellow phaser beam from player to each enemy
        const sp = this.sectPx(anim.src, ox, oy)
        ctx.globalAlpha = alpha * 0.9
        ctx.strokeStyle = '#FFEE33'
        ctx.lineWidth = 2
        ctx.shadowColor = '#FFAA00'
        ctx.shadowBlur = 8
        ctx.lineCap = 'round'
        for (const dst of anim.dsts) {
          const dp = this.sectPx(dst, ox, oy)
          ctx.beginPath()
          ctx.moveTo(sp.px, sp.py)
          ctx.lineTo(dp.px, dp.py)
          ctx.stroke()
        }
        // Bright flash at target on first half
        if (t < 0.5) {
          ctx.globalAlpha = (0.5 - t) * 2 * 0.8
          ctx.fillStyle = '#FFFFFF'
          for (const dst of anim.dsts) {
            const dp = this.sectPx(dst, ox, oy)
            ctx.beginPath()
            ctx.arc(dp.px, dp.py, 5, 0, Math.PI * 2)
            ctx.fill()
          }
        }

      } else if (anim.type === 'torpedo') {
        // Red projectile moving from src to dst
        const sp = this.sectPx(anim.src, ox, oy)
        const dp = this.sectPx(anim.dsts[0], ox, oy)
        const px = sp.px + (dp.px - sp.px) * t
        const py = sp.py + (dp.py - sp.py) * t

        // Trail
        ctx.globalAlpha = 0.35
        ctx.fillStyle = '#FF6600'
        ctx.shadowColor = '#FF4400'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(sp.px + (dp.px - sp.px) * Math.max(0, t - 0.15),
                sp.py + (dp.py - sp.py) * Math.max(0, t - 0.15), 3, 0, Math.PI * 2)
        ctx.fill()

        // Projectile dot
        ctx.globalAlpha = 1
        ctx.fillStyle = '#FF3300'
        ctx.shadowColor = '#FF8800'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(px, py, 4, 0, Math.PI * 2)
        ctx.fill()

        // Impact flash at end
        if (t > 0.85) {
          const flashT = (t - 0.85) / 0.15
          ctx.globalAlpha = (1 - flashT) * 0.9
          ctx.fillStyle = '#FFFFFF'
          ctx.beginPath()
          ctx.arc(dp.px, dp.py, 8 * flashT, 0, Math.PI * 2)
          ctx.fill()
        }

      } else if (anim.type === 'enemyFire') {
        // Red beams from enemies (dsts) toward player (src)
        const dp = this.sectPx(anim.src, ox, oy)
        ctx.globalAlpha = alpha * 0.85
        ctx.strokeStyle = '#FF2222'
        ctx.lineWidth = 1.5
        ctx.shadowColor = '#FF5555'
        ctx.shadowBlur = 6
        ctx.lineCap = 'round'
        for (const src of anim.dsts) {
          const sp = this.sectPx(src, ox, oy)
          ctx.beginPath()
          ctx.moveTo(sp.px, sp.py)
          ctx.lineTo(dp.px, dp.py)
          ctx.stroke()
        }
      }

      ctx.restore()
    }
  }

  // ── Status Panel ──────────────────────────────────────────────────────────

  private drawStatusPanel(state: GameState): void {
    const { ctx, L } = this
    const { x, y, w, h } = L.statusPanel
    this.panel(x, y, w, h, C.panelBg)

    const { player, date, alert, totalEnemies } = state

    // Date box
    ctx.fillStyle = C.panelBg
    ctx.fillRect(x + 4, y + 4, 80, 30)
    ctx.strokeStyle = C.hudBorder
    ctx.lineWidth = 1
    ctx.strokeRect(x + 4, y + 4, 80, 30)
    this.label(x + 10, y + 16, 'Date', C.white)
    this.value(x + 10, y + 28, date.toFixed(1), C.cyan)

    // Status box
    const alertBg = alert ? C.alertBg : C.statusGreen
    ctx.fillStyle = alertBg
    ctx.fillRect(x + 92, y + 4, w - 96, 30)
    ctx.strokeStyle = C.hudBorder
    ctx.strokeRect(x + 92, y + 4, w - 96, 30)
    ctx.fillStyle = C.white
    ctx.font = '18px VT323'
    ctx.textAlign = 'center'
    ctx.fillText(alert ? '>>ALERT<<' : 'Status', x + 92 + (w - 96) / 2, y + 16)
    ctx.fillText(alert ? '' : 'Green', x + 92 + (w - 96) / 2, y + 28)
    ctx.textAlign = 'left'

    // Circular dials — raised slightly so label clears the warp box below
    const dialY = y + 64
    this.drawDial(x + 48, dialY, 32, player.energy, player.maxEnergy, 'Energy')
    this.drawDial(x + 140, dialY, 32, player.shields, player.maxShields, 'Shields')

    // Warp
    ctx.strokeStyle = C.hudBorder
    ctx.strokeRect(x + 4, y + 114, 90, 18)
    this.label(x + 8, y + 127, 'Warp: ' + player.warp.toFixed(1), C.yellow)

    // Klingon count
    ctx.strokeRect(x + 100, y + 114, w - 104, 18)
    this.label(x + 104, y + 127, 'Klingons: ' + totalEnemies, C.red)

    // PhoTorp pips (3 rows × 4 cols)
    this.label(x + 4, y + 146, 'PhoTorps:', C.white)
    for (let i = 0; i < Math.min(player.phoTorps, 12); i++) {
      ctx.fillStyle = C.red
      ctx.fillRect(x + 100 + (i % 4) * 12, y + 136 + Math.floor(i / 4) * 12, 9, 9)
    }
  }

  private drawDial(cx: number, cy: number, r: number, val: number, max: number, label: string): void {
    const { ctx } = this
    const start = Math.PI * 0.75
    const end   = Math.PI * 2.25
    const sweep = end - start
    const pct = Math.max(0, Math.min(1, val / max))
    const valAngle = start + pct * sweep
    const arcColor = pct > 0.6 ? C.green : pct > 0.3 ? C.yellow : C.red

    // Track background (270° arc, gap at bottom)
    ctx.beginPath()
    ctx.arc(cx, cy, r, start, end)
    ctx.strokeStyle = '#222244'
    ctx.lineWidth = 8
    ctx.stroke()

    // Value arc (color-coded)
    if (pct > 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, start, valAngle)
      ctx.strokeStyle = arcColor
      ctx.lineWidth = 8
      ctx.stroke()
    }

    // Tick marks — just outside the arc so they're always visible
    ctx.strokeStyle = '#555577'
    ctx.lineWidth = 1
    for (let i = 0; i <= 8; i++) {
      const a = start + (i / 8) * sweep
      const inner = r + 3, outer = r + 8
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
      ctx.stroke()
    }

    // Center fill
    ctx.beginPath()
    ctx.arc(cx, cy, r - 9, 0, Math.PI * 2)
    ctx.fillStyle = '#0a0a22'
    ctx.fill()

    // Value text inside center
    const displayVal = val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val).toString()
    ctx.fillStyle = pct > 0 ? arcColor : '#555577'
    ctx.font = '13px VT323'
    ctx.textAlign = 'center'
    ctx.fillText(displayVal, cx, cy + 4)

    // Label below dial
    ctx.fillStyle = C.white
    ctx.font = '13px VT323'
    ctx.fillText(label, cx, cy + r + 10)
    ctx.textAlign = 'left'
  }

  // ── Galaxy Chart ──────────────────────────────────────────────────────────

  private drawGalaxyChart(state: GameState): void {
    const { ctx, L } = this
    const ox = L.galaxy.x, oy = L.galaxy.y

    ctx.fillStyle = C.white
    ctx.font = '14px VT323'
    ctx.textAlign = 'center'
    ctx.fillText('Chart Of Known Galaxy', ox + (GALAXY_SIZE * GCELL_W) / 2 + 16, oy - 2)
    ctx.textAlign = 'left'

    for (let col = 0; col < GALAXY_SIZE; col++) {
      ctx.fillText(String(col + 1), ox + 20 + col * GCELL_W, oy + 10)
    }
    for (let row = 0; row < GALAXY_SIZE; row++) {
      ctx.fillText(String(row + 1), ox + 4, oy + 24 + row * GCELL_H)
    }

    const { quad } = state.position
    for (let row = 0; row < GALAXY_SIZE; row++) {
      for (let col = 0; col < GALAXY_SIZE; col++) {
        const cell = state.galaxy[row][col]
        const cx = ox + 18 + col * GCELL_W
        const cy = oy + 22 + row * GCELL_H
        const isCurrent = col === quad.x && row === quad.y

        if (!cell.scanned) {
          ctx.fillStyle = C.darkGray
          ctx.font = '12px VT323'
          ctx.fillText('. . .', cx, cy)
          continue
        }

        ctx.fillStyle = isCurrent ? C.yellow : cell.enemies > 0 ? C.red : C.green
        ctx.font = '12px VT323'
        ctx.fillText(
          `${String(cell.enemies).padStart(3, '0')} ${cell.baseType}${String(cell.stars).padStart(2, '0')}`,
          cx, cy
        )
      }
    }

    ctx.fillStyle = C.cyan
    ctx.font = '14px VT323'
    ctx.fillText(
      `${state.player.name.split(' ').pop()} in quad ${quad.x + 1}-${quad.y + 1}`,
      ox + 4, oy + 24 + GALAXY_SIZE * GCELL_H
    )
  }

  // ── Phasers Panel ─────────────────────────────────────────────────────────

  private drawPhasers(state: GameState): void {
    const { L } = this
    const { x, y, w, h } = L.phasers
    this.panel(x, y, w, h, C.panelBg)
    this.label(x + 8, y + 14, 'LASERS', C.white)

    const { player } = state
    this.scaledBar(x + 8, y + 28, w - 16, 'Eff', player.phaserEff, 100, C.green)
    this.scaledBar(x + 8, y + 50, w - 16, 'Temp', player.phaserTemp, 1500, C.yellow)
  }

  private scaledBar(x: number, y: number, w: number, label: string, val: number, max: number, fg: string): void {
    const { ctx } = this
    this.label(x, y - 2, label, C.white)

    // Scale labels: 0, mid, max
    ctx.fillStyle = C.darkGray
    ctx.font = '13px VT323'
    ctx.fillText('0', x + 30, y + 8)
    ctx.fillText(String(Math.round(max / 2)), x + 30 + Math.floor((w - 30) / 2) - 8, y + 8)
    ctx.fillText(String(max), x + w - 16, y + 8)

    // Bar
    const bx = x + 30, bw = w - 30
    ctx.fillStyle = C.darkGray
    ctx.fillRect(bx, y - 10, bw, 9)
    ctx.fillStyle = fg
    ctx.fillRect(bx, y - 10, Math.floor(bw * Math.max(0, val) / max), 9)
  }

  // ── Command Input ─────────────────────────────────────────────────────────

  private drawCommand(state: GameState, buf: string): void {
    const { L } = this
    const { x, y, w, h } = L.command
    this.panel(x, y, w, h, C.commandBg)
    this.label(x + 8, y + 16, 'COMMAND', C.white)
    this.label(x + 8, y + 38, '> ' + buf + '_', C.yellow)

    const { quad, sect } = state.position
    this.label(x + 8, y + h - 6, `Quad ${quad.x + 1},${quad.y + 1}   Sec ${sect.x + 1},${sect.y + 1}`, C.white)
  }

  // ── Ship Info ─────────────────────────────────────────────────────────────

  private drawShipInfo(state: GameState): void {
    const { ctx, L } = this
    const { x, y, w, h } = L.shipInfo
    this.panel(x, y, w, h, C.darkBlue)

    const { player } = state
    ctx.fillStyle = C.cyan
    ctx.font = '18px VT323'
    ctx.fillText(player.name, x + 8, y + 14)
    ctx.fillStyle = C.white
    ctx.font = '16px VT323'
    ctx.fillText(player.registry, x + 8, y + 26)

    // Oval emblem
    ctx.save()
    ctx.strokeStyle = C.cyan
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h - 24, 28, 18, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#001155'
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = C.white
    ctx.font = '18px VT323'
    ctx.textAlign = 'center'
    ctx.fillText('✦', x + w / 2, y + h - 19)
    ctx.textAlign = 'left'
    ctx.fillStyle = C.lightGray
    ctx.font = '13px VT323'
    ctx.textAlign = 'center'
    ctx.fillText('* *', x + w / 2, y + h - 8)
    ctx.fillStyle = C.white
    ctx.font = '13px VT323'
    ctx.fillText(player.org, x + w / 2, y + h - 0)
    ctx.textAlign = 'left'
  }

  // ── Main Viewer ───────────────────────────────────────────────────────────

  private drawViewer(state: GameState, mode: ViewerMode, now: number): void {
    const { ctx, L } = this
    const { x, y, w, h } = L.viewer
    this.panel(x, y, w, h, '#001100')

    const innerH = h - 40
    ctx.fillStyle = '#000808'
    ctx.fillRect(x + 1, y + 1, w - 2, innerH)

    // Mode label (cycling indicator)
    ctx.fillStyle = C.green
    ctx.font = '18px VT323'
    ctx.textAlign = 'center'
    ctx.fillText('MAIN VIEWER', x + w / 2, y + h - 26)
    ctx.textAlign = 'left'

    const mx = x + w / 2, my = y + innerH / 2

    switch (mode) {
      case 'space':     this.viewerSpace(state, x + 1, y + 1, w - 2, innerH, mx, my); break
      case 'technical': this.viewerTechnical(state, x + 1, y + 1, w - 2, innerH); break
      case 'navigation': this.viewerNavigation(state, x + 1, y + 1, w - 2, innerH, now); break
      case 'damage':    this.viewerDamage(state, x + 1, y + 1, w - 2, innerH); break
    }

    // Coordinates at bottom of viewer (like original)
    ctx.fillStyle = C.green
    ctx.font = '13px VT323'
    const { sect } = state.position
    ctx.fillText(`x ${(sect.x * 11.25).toFixed(1)}`, x + 6, y + h - 12)
    ctx.fillText(`y ${(sect.y * 11.25).toFixed(1)}`, x + 6, y + h - 2)
  }

  private viewerSpace(state: GameState, ox: number, oy: number, w: number, h: number, mx: number, my: number): void {
    const { ctx } = this
    // Starfield — seeded from quadrant position so it stays consistent
    const seed = state.position.quad.x * 100 + state.position.quad.y
    for (let i = 0; i < 40; i++) {
      const sx = ox + ((seed * 17 + i * 137) % w)
      const sy = oy + ((seed * 31 + i * 97) % h)
      const brightness = 100 + ((seed + i * 7) % 155)
      ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`
      ctx.fillRect(sx, sy, 1, 1)
    }

    const enemies = state.quadrant.enemies
    if (enemies.length > 0) {
      // Show closest enemy
      const e = enemies[0]
      const angle = Math.atan2(e.sect.y - state.position.sect.y, e.sect.x - state.position.sect.x)
      const dist = Math.sqrt(Math.pow(e.sect.x - state.position.sect.x, 2) + Math.pow(e.sect.y - state.position.sect.y, 2))
      // Draw enemy at indicated direction, scaled distance
      const ex = mx + Math.cos(angle) * Math.min(dist * 10, w * 0.35)
      const ey = my + Math.sin(angle) * Math.min(dist * 10, h * 0.35)
      ctx.fillStyle = C.red
      ctx.font = '20px VT323'
      ctx.textAlign = 'center'
      ctx.fillText('◆', ex, ey + 6)
      ctx.font = '13px VT323'
      ctx.fillStyle = C.red
      ctx.fillText(`K ${dist.toFixed(1)}`, ex, ey + 16)
      ctx.textAlign = 'left'
    } else {
      // Star or planet in view
      ctx.fillStyle = C.yellow
      ctx.beginPath()
      ctx.arc(mx, my, 10, 0, Math.PI * 2)
      ctx.fill()
    }

    // Direction indicator
    const deg = ((Math.atan2(-(state.position.sect.y), state.position.sect.x) * 180 / Math.PI) + 360) % 360
    ctx.fillStyle = C.darkGray
    ctx.font = '13px VT323'
    ctx.fillText(`dir ${deg.toFixed(0)}°`, ox + 3, oy + 10)
  }

  private viewerTechnical(state: GameState, ox: number, oy: number, w: number, h: number): void {
    const { ctx } = this
    // Scan lines
    ctx.strokeStyle = '#002200'
    ctx.lineWidth = 1
    for (let scanY = oy; scanY < oy + h; scanY += 3) {
      ctx.beginPath(); ctx.moveTo(ox, scanY); ctx.lineTo(ox + w, scanY); ctx.stroke()
    }
    // Tech readout
    const lines = [
      `Energy:  ${Math.round(state.player.energy)}/${state.player.maxEnergy}`,
      `Shields: ${Math.round(state.player.shields)}/${state.player.maxShields}`,
      `Warp:    ${state.player.warp.toFixed(1)}`,
      `PhoTorps: ${state.player.phoTorps}`,
      `Enemies:  ${state.quadrant.enemies.length} in sector`,
    ]
    ctx.fillStyle = C.green
    ctx.font = '15px VT323'
    lines.forEach((line, i) => ctx.fillText(line, ox + 6, oy + 16 + i * 14))
    ctx.fillStyle = '#003300'
    ctx.font = '14px VT323'
    ctx.fillText('TECHNICAL DISPLAY', ox + 6, oy + h - 6)
  }

  private viewerNavigation(state: GameState, ox: number, oy: number, w: number, h: number, now: number): void {
    const { ctx } = this
    // Scrolling star effect
    const offset = (now / 40) % 30
    ctx.strokeStyle = '#003300'
    ctx.lineWidth = 1
    for (let gx = (ox + offset) % 30 + ox; gx < ox + w; gx += 30) {
      ctx.beginPath(); ctx.moveTo(gx, oy); ctx.lineTo(gx, oy + h); ctx.stroke()
    }
    for (let gy = (oy + offset) % 30 + oy; gy < oy + h; gy += 30) {
      ctx.beginPath(); ctx.moveTo(ox, gy); ctx.lineTo(ox + w, gy); ctx.stroke()
    }
    const { quad, sect } = state.position
    ctx.fillStyle = C.green
    ctx.font = '15px VT323'
    ctx.fillText(`NAVIGATION COMPUTER`, ox + 6, oy + 12)
    ctx.fillStyle = C.cyan
    ctx.fillText(`Quadrant: ${quad.x + 1}-${quad.y + 1}`, ox + 6, oy + 28)
    ctx.fillText(`Sector:   ${sect.x + 1},${sect.y + 1}`, ox + 6, oy + 40)
    ctx.fillText(`Course:   ${state.player.warp.toFixed(1)} warp`, ox + 6, oy + 52)
    ctx.fillStyle = '#003300'
    ctx.font = '14px VT323'
    ctx.fillText('NAV DISPLAY', ox + 6, oy + h - 6)
  }

  private viewerDamage(state: GameState, ox: number, oy: number, _w: number, _h: number): void {
    const { ctx } = this
    const damaged = Object.entries(state.player.systems).filter(([, v]) => v < 100)
    ctx.fillStyle = C.green
    ctx.font = '15px VT323'
    ctx.fillText('DAMAGE DISPLAY', ox + 6, oy + 12)
    if (damaged.length === 0) {
      ctx.fillStyle = C.green
      ctx.fillText('All systems nominal.', ox + 6, oy + 32)
    } else {
      damaged.slice(0, 5).forEach(([name, pct], i) => {
        const color = pct > 60 ? C.yellow : C.red
        ctx.fillStyle = color
        ctx.font = '14px VT323'
        const short = name.length > 14 ? name.slice(0, 13) + '.' : name
        ctx.fillText(`${short}: ${pct}%`, ox + 6, oy + 26 + i * 13)
      })
    }
  }

  // ── Systems Status ────────────────────────────────────────────────────────

  private drawSystems(state: GameState): void {
    const { L } = this
    const { x, y, w, h } = L.systems
    this.panel(x, y, w, h, C.panelBg)
    this.label(x + 4, y + 11, 'SYSTEMS STATUS', C.white)

    const systems = Object.entries(state.player.systems)
    systems.forEach(([name, pct], i) => {
      const sy = y + 21 + i * 10
      const displayName = name.length > 15 ? name.slice(0, 14) + '.' : name
      this.label(x + 4, sy, displayName, C.green)
      const bx = x + 108, bw = w - 112
      this.ctx.fillStyle = C.darkGray
      this.ctx.fillRect(bx, sy - 8, bw, 8)
      const color = pct > 75 ? C.green : pct > 40 ? C.yellow : C.red
      this.ctx.fillStyle = color
      this.ctx.fillRect(bx, sy - 8, Math.floor(bw * pct / 100), 8)
    })
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  private drawMessages(state: GameState): void {
    const { ctx, L } = this
    const { x, y, w, h } = L.messages
    this.panel(x, y, w, h, '#003300')

    const nonDamage = state.log.filter(e => !e.text.includes('damage') && !e.text.includes('damaged') && !e.text.includes('hit'))
    ctx.font = '15px VT323'
    const lineH = 12
    const maxLines = Math.floor((h - 4) / lineH)
    nonDamage.slice(0, maxLines).forEach((entry, i) => {
      const ly = y + 12 + i * lineH
      ctx.fillStyle = '#336633'
      ctx.fillText(`${entry.date.toFixed(1)}`, x + 4, ly)
      ctx.fillStyle = C.green
      ctx.fillText(entry.text.slice(0, Math.floor(w / 6) - 6), x + 42, ly)
    })
  }

  // ── Damage Report ─────────────────────────────────────────────────────────

  private drawDamageReport(state: GameState): void {
    const { ctx, L } = this
    const { x, y, w, h } = L.damage
    ctx.strokeStyle = C.yellow
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = '#001100'
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2)

    ctx.fillStyle = C.yellow
    ctx.font = '18px VT323'
    ctx.fillText('DAMAGE REPORT', x + 6, y + 14)

    const damageLog = state.log.filter(e =>
      e.text.includes('damaged') || e.text.includes('hit') || e.text.includes('absorb') || e.text.includes('destroyed')
    )

    ctx.font = '15px VT323'
    const lineH = 12
    const maxLines = Math.floor((h - 20) / lineH)
    damageLog.slice(0, maxLines).forEach((entry, i) => {
      const ly = y + 26 + i * lineH
      ctx.fillStyle = '#884400'
      ctx.fillText(`${entry.date.toFixed(1)}`, x + 4, ly)
      ctx.fillStyle = C.damageTxt
      ctx.fillText(entry.text.slice(0, Math.floor(w / 6) - 6), x + 42, ly)
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private panel(x: number, y: number, w: number, h: number, bg: string): void {
    const { ctx } = this
    ctx.strokeStyle = C.hudBorder
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)
    ctx.fillStyle = bg
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2)
  }

  private label(x: number, y: number, text: string, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.font = '16px VT323'
    this.ctx.fillText(text, x, y)
  }

  private value(x: number, y: number, text: string, color: string): void {
    this.ctx.fillStyle = color
    this.ctx.font = '18px VT323'
    this.ctx.fillText(text, x, y)
  }
}
