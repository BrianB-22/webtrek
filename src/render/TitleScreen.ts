import { C } from './colors'

export const RANKS = ['', 'Lt. Commander', 'Commander', 'Captain', 'Commodore', 'Admiral']

export const BRIEFING_PAGES: string[][] = [
  [
    `Good morning, Captain.`,
    ``,
    `As you know, the Klingon Empire has launched a massive`,
    `invasion fleet into Federation territory.  A large number`,
    `of Klingon cruisers, command vessels and scouts have been`,
    `detected throughout this sector.`,
    ``,
    `You are in command of the U.S.S. Enterprise NCC-1701.`,
    `She is fully battle-ready with a crew of 430 officers`,
    `and enlisted personnel.`,
    ``,
    `Your mission: eliminate all Klingon forces in this`,
    `sector as quickly as possible.`,
  ],
  [
    `SHIP SYSTEMS:`,
    ``,
    `M/A-M Converter  Generates 400 energy/stardate at 100%`,
    `Warp Engines     Max speed: warp 1 + 0.09 x repair%`,
    `Impulse Engines  Fails entirely below 50% repair`,
    `Shields          Absorb enemy fire; raise before battle`,
    `                 Warp with shields up costs double energy`,
    `Phasers          General weapon; distance-dependent damage`,
    `                 Watch temperature — overheating degrades`,
    `PhoTorp Tubes    3 tubes at full repair; 2 at 67%; 1 at 34%`,
    `                 Replenished only at StarBase or Supply Depot`,
  ],
  [
    `COMMANDS:`,
    ``,
    `move <qrow> <qcol> <srow> <scol>  Warp to quadrant+sector`,
    `move <srow> <scol>                Impulse within quadrant`,
    `phasers <e1> [e2] [e3]            Fire at each enemy`,
    `torpedo <row> <col> [row col...]  Fire torpedo at sector`,
    `shup / shdn / max                 Shields up / down / max`,
    `energy [amt]                      Show or transfer energy`,
    `warp <speed>                      Set warp factor (0.1-8)`,
    `srs / lrs                         Short/long range scan`,
    `dock / undock                     Dock at base / leave`,
    `repair  info  help                Status, enemies, commands`,
  ],
]

export type IntroStep =
  | 'restore' | 'name' | 'level' | 'password'
  | 'briefingQ' | 'briefing' | 'done'

export interface IntroState {
  step: IntroStep
  commanderName: string
  level: number
  selfDestructPassword: string
  buffer: string
  briefingPage: number
}

export function defaultIntroState(): IntroState {
  return {
    step: 'restore',
    commanderName: '',
    level: 0,
    selfDestructPassword: '',
    buffer: '',
    briefingPage: 0,
  }
}

type AnimPhase = 'idle' | 'firing' | 'flash' | 'gone' | 'respawn'

export class TitleScreen {
  private animPhase: AnimPhase = 'idle'
  private phaseStart = 0
  private enemyVisible = true

  // ── Title / Splash ────────────────────────────────────────────────────────

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, now: number): void {
    this.updateAnim(now)

    ctx.fillStyle = C.darkBlue
    ctx.fillRect(0, 0, W, H)

    // Version tag
    ctx.fillStyle = C.cyan
    ctx.font = '16px VT323'
    ctx.textAlign = 'left'
    ctx.fillText('Version 1.0', 12, 18)

    // Big title
    ctx.textAlign = 'center'
    ctx.fillStyle = '#CCCCCC'
    ctx.font = 'bold 64px serif'
    // Shadow
    ctx.fillStyle = '#223399'
    ctx.fillText('WebTrek', W / 2 + 3, 88)
    ctx.fillStyle = C.white
    ctx.fillText('WebTrek', W / 2, 85)

    // Subtitle
    ctx.fillStyle = '#66AACC'
    ctx.font = '22px serif'
    ctx.fillText('The Klingon Invasion', W / 2, 120)

    // Enterprise (center of screen, facing left — saucer to the left)
    const ex = W * 0.50, ey = H * 0.38
    this.drawEnterprise(ctx, ex, ey, 1.3)

    // Klingon ship (lower-left, facing right — toward enterprise)
    const kx = W * 0.17, ky = H * 0.63
    if (this.enemyVisible) {
      this.drawKlingon(ctx, kx, ky, 0.6)
    }

    // Phaser beam
    if (this.animPhase === 'firing' || this.animPhase === 'flash') {
      const alpha = this.animPhase === 'firing' ? 0.9 : 0.4 + 0.5 * Math.sin(Date.now() / 60)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = '#FF3333'
      ctx.lineWidth = 2.5
      ctx.shadowColor = '#FF6666'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(ex - 55, ey + 2)
      ctx.lineTo(kx + 30, ky)
      ctx.stroke()
      ctx.restore()
    }

    // ── Bottom-left ship panel ────────────────────────────────────────────
    const bpx = 24, bpy = H - 165
    ctx.strokeStyle = C.hudBorder
    ctx.lineWidth = 1
    ctx.strokeRect(bpx, bpy, 200, 140)
    ctx.fillStyle = '#003333'
    ctx.fillRect(bpx + 1, bpy + 1, 198, 138)

    ctx.textAlign = 'center'
    ctx.fillStyle = C.white
    ctx.font = '20px VT323'
    ctx.fillText('U.S.S. Enterprise', bpx + 100, bpy + 22)
    ctx.font = '18px VT323'
    ctx.fillText('NCC-1701', bpx + 100, bpy + 38)

    // Oval ship emblem
    ctx.save()
    ctx.strokeStyle = C.cyan
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(bpx + 100, bpy + 90, 44, 28, 0, 0, Math.PI * 2)
    ctx.strokeStyle = C.cyan
    ctx.stroke()
    ctx.fillStyle = '#001155'
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = C.white
    ctx.font = '20px sans-serif'
    ctx.fillText('✦', bpx + 100, bpy + 98)
    ctx.fillStyle = C.lightGray
    ctx.font = '14px VT323'
    ctx.fillText('* * *', bpx + 100, bpy + 118)
    ctx.fillStyle = C.white
    ctx.font = '16px VT323'
    ctx.fillText('Starfleet Command', bpx + 100, bpy + 132)

    // ── Bottom-right info panel ───────────────────────────────────────────
    const ipx = W - 390, ipy = H - 165
    ctx.strokeStyle = C.hudBorder
    ctx.lineWidth = 1
    ctx.strokeRect(ipx, ipy, 366, 140)
    ctx.fillStyle = '#003333'
    ctx.fillRect(ipx + 1, ipy + 1, 364, 138)

    ctx.textAlign = 'left'
    ctx.fillStyle = C.cyan
    ctx.font = '16px VT323'
    const infoLines = [
      'WebTrek is a tribute to EGA Trek,',
      'originally created by Nels Anderson',
      'of Arcanum Computing in 1992.',
      '',
      '     A free fan-made browser remake.',
      '',
      'Copyright (c) 1992 by Nels Anderson.',
      'Remake: public tribute, all rights reserved.',
    ]
    infoLines.forEach((line, i) => {
      ctx.fillText(line, ipx + 14, ipy + 20 + i * 16)
    })

    // Blink prompt
    ctx.textAlign = 'center'
    if (Math.floor(now / 600) % 2 === 0) {
      ctx.fillStyle = C.green
      ctx.font = '18px VT323'
      ctx.fillText('Hit any key to continue', W / 2, H - 12)
    }

    ctx.textAlign = 'left'
  }

  // ── Setup / Intro prompts ─────────────────────────────────────────────────

  drawSetup(ctx: CanvasRenderingContext2D, W: number, H: number, intro: IntroState): void {
    ctx.fillStyle = C.darkBlue
    ctx.fillRect(0, 0, W, H)
    this.drawBorder(ctx, W, H)

    // Ship header
    ctx.textAlign = 'center'
    ctx.fillStyle = '#BBAA66'
    ctx.font = 'bold 26px serif'
    ctx.fillText('U.S.S. Enterprise', W / 2, 72)
    ctx.font = 'bold 22px serif'
    ctx.fillText('NCC-1701', W / 2, 102)

    ctx.textAlign = 'left'
    ctx.font = '20px VT323'
    const lx = 60, startY = 175, lh = 38
    const { step, commanderName, level, buffer } = intro
    const rank = RANKS[level] || 'Commander'

    const lines: Array<{ text: string; active: boolean }> = []

    lines.push({
      text: `Restore a saved game (Y/N)?${step === 'restore' ? ' ' + buffer + '_' : ' n'}`,
      active: step === 'restore',
    })

    if (step !== 'restore') {
      lines.push({
        text: `Please enter your name: ${step === 'name' ? buffer + '_' : commanderName}`,
        active: step === 'name',
      })
    }

    if (step !== 'restore' && step !== 'name') {
      lines.push({
        text: `For verification, enter your command level (1-5): ${step === 'level' ? buffer + '_' : level}`,
        active: step === 'level',
      })
    }

    if (step === 'password' || step === 'briefingQ' || step === 'briefing') {
      lines.push({
        text: `${rank}, please enter self-destruct password: ${step === 'password' ? buffer + '_' : intro.selfDestructPassword}`,
        active: step === 'password',
      })
    }

    if (step === 'briefingQ') {
      lines.push({ text: '', active: false })
      lines.push({ text: `Welcome aboard, ${commanderName}!`, active: false })
      lines.push({ text: '', active: false })
      lines.push({
        text: `Will you require a briefing (Y/N)? ${buffer}_`,
        active: true,
      })
    }

    lines.forEach((line, i) => {
      if (line.text === '') return
      ctx.fillStyle = line.active ? C.white : C.lightGray
      ctx.fillText(line.text, lx, startY + i * lh)
    })
  }

  drawBriefing(ctx: CanvasRenderingContext2D, W: number, H: number, intro: IntroState): void {
    ctx.fillStyle = C.darkBlue
    ctx.fillRect(0, 0, W, H)
    this.drawBorder(ctx, W, H)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#BBAA66'
    ctx.font = 'bold 26px serif'
    ctx.fillText('U.S.S. Enterprise', W / 2, 65)
    ctx.font = 'bold 22px serif'
    ctx.fillText('NCC-1701', W / 2, 93)

    ctx.textAlign = 'left'
    const page = BRIEFING_PAGES[intro.briefingPage] ?? []
    page.forEach((line, i) => {
      const indent = line.startsWith('  ')
      ctx.fillStyle = indent ? C.cyan : (line.endsWith(':') ? C.yellow : C.white)
      ctx.font = '18px VT323'
      ctx.fillText(line, 55, 138 + i * 22)
    })

    const isLast = intro.briefingPage >= BRIEFING_PAGES.length - 1
    ctx.fillStyle = C.lightGray
    ctx.font = '17px VT323'
    ctx.fillText(
      isLast
        ? `(Hit "Enter" to begin mission  or  "Q" to skip)`
        : `(Hit "Enter" for next page  or  "Q" to skip briefing)`,
      55, H - 35
    )
  }

  // ── Ship drawing helpers ──────────────────────────────────────────────────

  private drawEnterprise(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    const col = '#DDDDDD'
    ctx.fillStyle = col

    // Secondary hull (main body, center-right)
    ctx.fillRect(cx, cy - 7 * s, 85 * s, 14 * s)

    // Neck connecting saucer to secondary hull
    ctx.fillRect(cx - 14 * s, cy - 5 * s, 18 * s, 10 * s)

    // Saucer section (front/left)
    ctx.beginPath()
    ctx.ellipse(cx - 48 * s, cy, 40 * s, 15 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    // Saucer detail ring
    ctx.strokeStyle = '#999999'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(cx - 48 * s, cy, 40 * s, 15 * s, 0, 0, Math.PI * 2)
    ctx.stroke()

    // Upper pylon
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(cx + 8 * s, cy - 7 * s)
    ctx.lineTo(cx + 15 * s, cy - 26 * s)
    ctx.lineTo(cx + 30 * s, cy - 26 * s)
    ctx.lineTo(cx + 38 * s, cy - 7 * s)
    ctx.closePath()
    ctx.fill()

    // Lower pylon
    ctx.beginPath()
    ctx.moveTo(cx + 8 * s, cy + 7 * s)
    ctx.lineTo(cx + 15 * s, cy + 26 * s)
    ctx.lineTo(cx + 30 * s, cy + 26 * s)
    ctx.lineTo(cx + 38 * s, cy + 7 * s)
    ctx.closePath()
    ctx.fill()

    // Upper nacelle
    ctx.fillStyle = col
    ctx.fillRect(cx + 10 * s, cy - 34 * s, 78 * s, 11 * s)
    ctx.fillStyle = '#FF5522'
    ctx.fillRect(cx + 84 * s, cy - 34 * s, 4 * s, 11 * s)

    // Lower nacelle
    ctx.fillStyle = col
    ctx.fillRect(cx + 10 * s, cy + 25 * s, 78 * s, 11 * s)
    ctx.fillStyle = '#FF5522'
    ctx.fillRect(cx + 84 * s, cy + 25 * s, 4 * s, 11 * s)

    ctx.fillStyle = col
    ctx.strokeStyle = col
  }

  private drawKlingon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    const col = '#AAAAAA'
    ctx.fillStyle = col

    // Main cylindrical body
    ctx.fillRect(cx - 30 * s, cy - 5 * s, 60 * s, 10 * s)

    // Forward hull (pointed nose to the right)
    ctx.beginPath()
    ctx.moveTo(cx + 30 * s, cy - 4 * s)
    ctx.lineTo(cx + 52 * s, cy)
    ctx.lineTo(cx + 30 * s, cy + 4 * s)
    ctx.closePath()
    ctx.fill()

    // Swept wings (forward-swept, Klingon D7 style)
    ctx.beginPath()
    ctx.moveTo(cx - 5 * s, cy - 4 * s)
    ctx.lineTo(cx - 28 * s, cy - 22 * s)
    ctx.lineTo(cx - 22 * s, cy - 24 * s)
    ctx.lineTo(cx + 5 * s, cy - 2 * s)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(cx - 5 * s, cy + 4 * s)
    ctx.lineTo(cx - 28 * s, cy + 22 * s)
    ctx.lineTo(cx - 22 * s, cy + 24 * s)
    ctx.lineTo(cx + 5 * s, cy + 2 * s)
    ctx.closePath()
    ctx.fill()

    // Rear engine pods on wing tips
    ctx.fillRect(cx - 34 * s, cy - 26 * s, 18 * s, 6 * s)
    ctx.fillRect(cx - 34 * s, cy + 21 * s, 18 * s, 6 * s)
  }

  private drawBorder(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.strokeStyle = '#888844'
    ctx.lineWidth = 2
    ctx.strokeRect(16, 16, W - 32, H - 32)
    ctx.strokeStyle = '#AAAAAA'
    ctx.lineWidth = 1
    ctx.strokeRect(20, 20, W - 40, H - 40)
  }

  // ── Animation ─────────────────────────────────────────────────────────────

  private updateAnim(now: number): void {
    const elapsed = now - this.phaseStart
    switch (this.animPhase) {
      case 'idle':
        if (elapsed > 3200) { this.animPhase = 'firing'; this.phaseStart = now }
        break
      case 'firing':
        if (elapsed > 280) { this.animPhase = 'flash'; this.phaseStart = now }
        break
      case 'flash':
        this.enemyVisible = Math.floor(elapsed / 75) % 2 === 0
        if (elapsed > 520) { this.animPhase = 'gone'; this.phaseStart = now; this.enemyVisible = false }
        break
      case 'gone':
        this.enemyVisible = false
        if (elapsed > 1000) { this.animPhase = 'respawn'; this.phaseStart = now }
        break
      case 'respawn':
        this.enemyVisible = true
        if (elapsed > 500) { this.animPhase = 'idle'; this.phaseStart = now }
        break
    }
  }
}
